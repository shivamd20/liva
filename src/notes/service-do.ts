import { TRPCError } from "@trpc/server";
import type {
	ID,
	NoteCurrent,
	createNoteInput,
	updateNoteInput,
} from "./types";
import type { z } from "zod";
import type { NoteDurableObject } from "../do/NoteDurableObject";
import type { NoteIndexDurableObject } from "../do/NoteIndexDurableObject";

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

	private getIndexStub(): DurableObjectStub<NoteIndexDurableObject> {
		const doId = this.env.NOTE_INDEX_DURABLE_OBJECT.idFromName("global-index");
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
		const indexStub = this.getIndexStub();

		try {
			const current = (await stub.createNote({
				id,
				title: input.title ?? null,
				blob: input.blob,
				collaborators: input.collaborators ?? [],
				userId,
			})) as NoteCurrent;

			// Update index
			await indexStub.upsertNote({
				id: current.id,
				title: current.title,
				version: current.version,
				updatedAt: current.updatedAt,
				createdAt: current.createdAt,
				userId: current.userId,
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
		const indexStub = this.getIndexStub();

		try {
			const current = (await stub.updateNote({
				title: input.title,
				blob: input.blob,
				expectedVersion: input.expectedVersion,
				meta: input.meta ?? null,
			})) as NoteCurrent;

			// Validate ownership
			if (current.userId !== userId) {
				throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to update this note" });
			}

			// Update index
			await indexStub.upsertNote({
				id: current.id,
				title: current.title,
				version: current.version,
				updatedAt: current.updatedAt,
				createdAt: current.createdAt,
				userId: current.userId,
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

	async revertToVersion(id: string, version: number) {
		const stub = this.getStub(id);
		const indexStub = this.getIndexStub();

		try {
			const current = (await stub.revertToVersion(version)) as NoteCurrent;

			// Update index
			await indexStub.upsertNote({
				id: current.id,
				title: current.title,
				version: current.version,
				updatedAt: current.updatedAt,
				createdAt: current.createdAt,
				userId: current.userId,
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
		const indexStub = this.getIndexStub();

		// Check if note exists and user has permission
		const note = (await stub.getNote()) as NoteCurrent | null;
		if (!note) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
		}
		if (note.userId !== userId) {
			throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to delete this note" });
		}

		try {
			await stub.deleteNote();
			await indexStub.deleteNote(id);
			return { success: true };
		} catch (error) {
			throw error;
		}
	}

	async getNote(id: string) {
		const stub = this.getStub(id);
		return await stub.getNote();
	}

	async listNotes(userId?: string) {
		const indexStub = this.getIndexStub();
		return await indexStub.listNotes(userId);
	}

	async getHistory(id: string) {
		const stub = this.getStub(id);
		return await stub.getHistory();
	}

	async getVersion(id: string, version: number) {
		const stub = this.getStub(id);
		return await stub.getVersion(version);
	}
}
