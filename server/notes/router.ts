import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../trpc-config";
import { NotesServiceDO, pubsub } from "./service-do";
import {
	createNoteInput,
	getVersionInput,
	getHistoryInput,
	idInput,
	updateNoteInput,
	listNotesInput,
	trackBoardAccessInput,
	removeSharedBoardInput,
	type NoteCurrent,
} from "./types";
import { z } from "zod";

export const addRecordingInput = z.object({
	id: z.string(),
	sessionId: z.string(),
	duration: z.number(),
	title: z.string().optional(),
});

// Authenticated procedure - requires user to be logged in
const authedProcedure = publicProcedure.use(({ ctx, next }) => {
	if (!ctx.userId) {
		throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Must be logged in' });
	}
	return next({ ctx: { ...ctx, userId: ctx.userId } });
});

export const notesRouter = router({
	// --- Mutations ---

	createNote: authedProcedure.input(createNoteInput).mutation(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.createNote(input, ctx.userId);
	}),

	updateNote: authedProcedure.input(updateNoteInput).mutation(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.updateNote(input, ctx.userId);
	}),

	revertToVersion: authedProcedure.input(getVersionInput).mutation(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.revertToVersion(input.id, input.version, ctx.userId);
	}),

	deleteNote: authedProcedure.input(idInput).mutation(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.deleteNote(input.id, ctx.userId);
	}),

	toggleShare: authedProcedure.input(idInput).mutation(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.toggleShare(input.id, ctx.userId);
	}),

	addRecording: authedProcedure.input(addRecordingInput).mutation(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.addRecording(input.id, input.sessionId, input.duration, input.title);
	}),

	updateRecordingYouTubeId: authedProcedure.input(z.object({
		id: z.string(),
		sessionId: z.string(),
		videoId: z.string(),
	})).mutation(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.updateRecordingYouTubeId(input.id, input.sessionId, input.videoId);
	}),

	/**
	 * Track when a user accesses a board (updates lastAccessedAt or adds as shared)
	 */
	trackBoardAccess: authedProcedure.input(trackBoardAccessInput).mutation(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		await service.trackBoardAccess(input.noteId, ctx.userId);
		return { success: true };
	}),

	/**
	 * Remove a shared board from user's personal list
	 */
	removeSharedBoard: authedProcedure.input(removeSharedBoardInput).mutation(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		await service.removeSharedBoard(input.noteId, ctx.userId);
		return { success: true };
	}),

	// --- Queries ---

	getNote: authedProcedure.input(idInput).query(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.getNote(input.id, ctx.userId);
	}),

	/**
	 * List user's notes with filtering, sorting, and pagination
	 */
	listNotes: authedProcedure.input(listNotesInput).query(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.listNotes(ctx.userId, input);
	}),

	getHistory: authedProcedure.input(getHistoryInput).query(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.getHistory(input.id, input.limit, input.cursor, input.direction);
	}),

	getVersion: authedProcedure.input(getVersionInput).query(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.getVersion(input.id, input.version);
	}),

	getRecordings: authedProcedure.input(idInput).query(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.getRecordings(input.id);
	}),

	// --- Subscriptions ---

	// Removed subscribeToNote as it's not used (we use raw WebSockets)
});
