import { TRPCError } from "@trpc/server";
import type {
	ID,
	NoteCurrent,
	createNoteInput,
	updateNoteInput,
	ListNotesResponse,
	ListNotesInput,
} from "./types";
import type { z } from "zod";
import type { NoteDurableObject } from "../do/NoteDurableObject";
import type { NoteIndexDurableObject, ListNotesOptions } from "../do/NoteIndexDurableObject";

// -----------------------------------------------------------------------------
// PubSub System (for subscriptions)
// -----------------------------------------------------------------------------

class NotePubSub {
	private listeners = new Map<ID, Set<(note: NoteCurrent) => void>>();

	emit(noteId: ID, note: NoteCurrent) {
		const set = this.listeners.get(noteId);
		if (!set) return;
		for (const cb of set) cb(structuredClone(note));
	}

	subscribe(noteId: ID, cb: (note: NoteCurrent) => void) {
		let set = this.listeners.get(noteId);
		if (!set) {
			set = new Set();
			this.listeners.set(noteId, set);
		}
		set.add(cb);
		return () => {
			set?.delete(cb);
			if (set?.size === 0) this.listeners.delete(noteId);
		};
	}
}

export const pubsub = new NotePubSub();

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

const makeId = (prefix = "n_") => prefix + Math.random().toString(36).slice(2, 9);

// -----------------------------------------------------------------------------
// Service Methods (SQLite-backed Durable Object)
// -----------------------------------------------------------------------------

export class NotesServiceDO {
	constructor(private env: Env) { }

	private getStub(id: string): DurableObjectStub<NoteDurableObject> {
		let doId: DurableObjectId;
		// Check if the ID looks like a 64-character hex string (standard DO ID)
		if (id.length === 64 && /^[0-9a-f]{64}$/.test(id)) {
			try {
				doId = this.env.NOTE_DURABLE_OBJECT.idFromString(id);
			} catch (e) {
				// Fallback if for some reason it's not a valid ID
				doId = this.env.NOTE_DURABLE_OBJECT.idFromName(id);
			}
		} else {
			doId = this.env.NOTE_DURABLE_OBJECT.idFromName(id);
		}
		return this.env.NOTE_DURABLE_OBJECT.get(doId);
	}

	/**
	 * Get user-specific index stub
	 */
	private getUserIndexStub(userId: string): DurableObjectStub<NoteIndexDurableObject> {
		const doId = this.env.NOTE_INDEX_DURABLE_OBJECT.idFromName(`user-index:${userId}`);
		return this.env.NOTE_INDEX_DURABLE_OBJECT.get(doId);
	}

	async createNote(input: z.infer<typeof createNoteInput>, userId: string) {
		let id = input.id;

		// If no ID provided, generate a system-unique ID (not derived from a name)
		if (!id) {
			const doId = this.env.NOTE_DURABLE_OBJECT.newUniqueId();
			id = doId.toString();
		}

		const stub = this.getStub(id);
		const indexStub = this.getUserIndexStub(userId);

		try {
			const current = (await stub.createNote({
				id,
				title: input.title ?? null,
				blob: input.blob,
				collaborators: input.collaborators ?? [],
				userId,
				expiresInHours: input.expiresInHours,
				templateId: input.templateId,
			})) as NoteCurrent;

			// Update user's personal index
			await indexStub.upsertOwnedNote({
				noteId: current.id,
				title: current.title,
				ownerUserId: current.userId,
				visibility: current.access,
				version: current.version,
				thumbnailBase64: null,
				createdAt: current.createdAt,
				updatedAt: current.updatedAt,
			});

			pubsub.emit(id, current);
			return current;
		} catch (error) {
			if (error instanceof Error && error.message === "Note already exists") {
				throw new TRPCError({ code: "CONFLICT", message: "Note ID already exists" });
			}
			throw error;
		}
	}

	async updateNote(input: z.infer<typeof updateNoteInput>, userId: string) {
		const stub = this.getStub(input.id);

		// Check permissions before updating
		const existing = (await stub.getNote()) as unknown as NoteCurrent | null;
		if (!existing) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
		}

		const isOwner = existing.userId === userId;
		const isCollaborator = existing.collaborators.includes(userId);
		const isPublic = existing.access === 'public';

		if (!isOwner && !isCollaborator && !isPublic) {
			throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to update this note" });
		}

		try {
			const current = (await stub.updateNote({
				title: input.title,
				blob: input.blob,
				expectedVersion: input.expectedVersion,
				meta: input.meta ?? null,
			})) as NoteCurrent;

			// Update owner's index
			const ownerIndexStub = this.getUserIndexStub(current.userId);
			await ownerIndexStub.updateNoteMetadata(current.id, {
				title: current.title,
				version: current.version,
				updatedAt: current.updatedAt,
			});

			pubsub.emit(input.id, current);
			return current;
		} catch (error) {
			if (error instanceof Error) {
				if (error.message === "Note not found") {
					throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
				}
				if (error.message === "Version mismatch") {
					throw new TRPCError({ code: "CONFLICT", message: "Version mismatch" });
				}
			}
			throw error;
		}
	}

	async revertToVersion(id: string, version: number, userId: string) {
		const stub = this.getStub(id);

		// Check permissions before updating
		const existing = (await stub.getNote()) as unknown as NoteCurrent | null;
		if (!existing) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
		}

		const isOwner = existing.userId === userId;
		const isCollaborator = existing.collaborators.includes(userId);
		const isPublic = existing.access === 'public';

		if (!isOwner && !isCollaborator && !isPublic) {
			throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to update this note" });
		}

		try {
			const current = (await stub.revertToVersion(version)) as NoteCurrent;

			// Update owner's index
			const ownerIndexStub = this.getUserIndexStub(current.userId);
			await ownerIndexStub.updateNoteMetadata(current.id, {
				title: current.title,
				version: current.version,
				updatedAt: current.updatedAt,
			});

			pubsub.emit(id, current);
			return current;
		} catch (error) {
			if (error instanceof Error) {
				if (error.message === "Note not found") {
					throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
				}
				if (error.message === "Version not found") {
					throw new TRPCError({ code: "BAD_REQUEST", message: "Version not found" });
				}
			}
			throw error;
		}
	}

	async deleteNote(id: string, userId: string) {
		const stub = this.getStub(id);

		// Check if note exists and user has permission
		const note = (await stub.getNote()) as unknown as NoteCurrent | null;
		if (!note) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
		}
		// Strict deletion policy: Only owner can delete
		if (note.userId !== userId) {
			throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to delete this note" });
		}

		try {
			await stub.deleteNote();
			// Remove from owner's index
			const indexStub = this.getUserIndexStub(userId);
			await indexStub.removeNote(id);
			return { success: true };
		} catch (error) {
			throw error;
		}
	}

	async getNote(id: string, userId: string) {
		const stub = this.getStub(id);
		const note = (await stub.getNote()) as unknown as NoteCurrent | null;

		if (note) {
			const isOwner = note.userId === userId;
			const isCollaborator = note.collaborators.includes(userId);
			const isPublic = note.access === 'public';

			if (!isOwner && !isCollaborator && !isPublic) {
				throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to view this note" });
			}
		}

		return note;
	}

	async toggleShare(id: string, userId: string) {
		const stub = this.getStub(id);

		const note = (await stub.getNote()) as unknown as NoteCurrent | null;
		if (!note) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
		}

		if (note.userId !== userId) {
			throw new TRPCError({ code: "FORBIDDEN", message: "Only owner can change sharing settings" });
		}

		const newAccess = note.access === 'public' ? 'private' : 'public';
		const updated = (await stub.updateAccess(newAccess)) as NoteCurrent;

		// Update owner's index with new visibility
		const indexStub = this.getUserIndexStub(userId);
		await indexStub.updateNoteMetadata(id, {
			visibility: updated.access,
			updatedAt: updated.updatedAt,
		});

		pubsub.emit(id, updated);
		return updated;
	}

	/**
	 * List notes for a user with filters, sorting, and pagination
	 */
	async listNotes(userId: string, options: ListNotesInput = {}): Promise<ListNotesResponse> {
		const indexStub = this.getUserIndexStub(userId);

		const listOptions: ListNotesOptions = {
			search: options.search,
			filter: options.filter,
			visibility: options.visibility,
			sortBy: options.sortBy,
			sortOrder: options.sortOrder,
			limit: options.limit,
			cursor: options.cursor,
		};

		const result = await indexStub.listNotes(listOptions);

		// Lazy cleanup: verify shared notes are still accessible
		// For now, we'll just return the results and let the UI handle stale entries
		// A more robust solution would verify each shared note is still public

		return result;
	}

	/**
	 * Track when a user accesses a board they don't own
	 * This adds the board to their personal index as a "shared" board
	 */
	async trackBoardAccess(noteId: string, userId: string): Promise<void> {
		const stub = this.getStub(noteId);
		const note = (await stub.getNote()) as unknown as NoteCurrent | null;

		if (!note) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
		}

		const isOwner = note.userId === userId;
		const isCollaborator = note.collaborators.includes(userId);
		const isPublic = note.access === 'public';

		if (!isOwner && !isCollaborator && !isPublic) {
			throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to access this note" });
		}

		const indexStub = this.getUserIndexStub(userId);

		if (isOwner) {
			// Update last accessed for owned note
			await indexStub.updateLastAccessed(noteId);
		} else {
			// Add/update as shared note in user's index
			await indexStub.upsertSharedNote({
				noteId: note.id,
				title: note.title,
				ownerUserId: note.userId,
				visibility: note.access,
				version: note.version,
				thumbnailBase64: null, // Will be populated by thumbnail update
				createdAt: note.createdAt,
				updatedAt: note.updatedAt,
				lastAccessedAt: Date.now(),
			});
		}
	}

	/**
	 * Remove a shared board from user's index
	 * Users can manually remove boards others shared with them
	 */
	async removeSharedBoard(noteId: string, userId: string): Promise<void> {
		const indexStub = this.getUserIndexStub(userId);

		// Get the note entry to verify it's shared (not owned)
		const entry = await indexStub.getNote(noteId);
		if (!entry) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Board not found in your list" });
		}

		if (entry.isOwned) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot remove a board you own. Use delete instead." });
		}

		await indexStub.removeNote(noteId);
	}

	/**
	 * Update thumbnail for a board in a user's index
	 */
	async updateThumbnail(noteId: string, userId: string, thumbnailBase64: string, version: number): Promise<void> {
		const indexStub = this.getUserIndexStub(userId);
		await indexStub.updateThumbnail(noteId, thumbnailBase64, version);
	}

	async getHistory(id: string, limit?: number, cursor?: number, direction?: 'asc' | 'desc') {
		const stub = this.getStub(id);
		return await stub.getHistory(limit, cursor, direction);
	}

	async getVersion(id: string, version: number) {
		const stub = this.getStub(id);
		return await stub.getVersion(version);
	}

	async addRecording(id: string, sessionId: string, duration: number, title?: string) {
		const stub = this.getStub(id);
		await (stub as any).addRecording({ sessionId, duration, title });
		return { success: true };
	}

	async updateRecordingYouTubeId(id: string, sessionId: string, videoId: string) {
		const stub = this.getStub(id);
		await (stub as any).updateRecordingYouTubeId(sessionId, videoId);
		return { success: true };
	}

	async getRecordings(id: string) {
		const stub = this.getStub(id);
		return await (stub as any).getRecordings() as Array<{
			sessionId: string;
			duration: number;
			createdAt: number;
			title: string | null;
			youtubeVideoId?: string;
		}>;
	}

	/**
	 * Migrate notes from one user to another (for account linking)
	 */
	async migrateUserNotes(oldUserId: string, newUserId: string) {
		const oldIndexStub = this.getUserIndexStub(oldUserId);
		const newIndexStub = this.getUserIndexStub(newUserId);

		let cursor: string | undefined;
		let migratedCount = 0;

		do {
			// Get notes in batches of 50 (max allowed)
			const result = await oldIndexStub.listNotes({ limit: 50, cursor });

			console.log(`Migrating batch of ${result.items.length} notes from ${oldUserId} to ${newUserId}`);

			for (const entry of result.items) {
				if (!entry.isOwned) continue; // Only migrate owned notes

				try {
					// Update Note DO owner
					const stub = this.getStub(entry.noteId);
					await (stub as any).updateOwner(newUserId);

					// Add to new user's index
					await newIndexStub.upsertOwnedNote({
						noteId: entry.noteId,
						title: entry.title,
						ownerUserId: newUserId,
						visibility: entry.visibility,
						version: entry.version,
						thumbnailBase64: entry.thumbnailBase64,
						createdAt: entry.createdAt,
						updatedAt: entry.updatedAt,
						lastAccessedAt: entry.lastAccessedAt,
					});

					// Remove from old user's index
					await oldIndexStub.removeNote(entry.noteId);
					migratedCount++;
				} catch (e) {
					console.error(`Failed to migrate note ${entry.noteId}`, e);
				}
			}

			cursor = result.nextCursor ?? undefined;
		} while (cursor);

		console.log(`Migration complete: ${migratedCount} notes migrated from ${oldUserId} to ${newUserId}`);
	}
}
