import { observable } from "@trpc/server/observable";
import { publicProcedure, router } from "../trpc-config";
import { NotesServiceDO, pubsub } from "./service-do";
import {
	createNoteInput,
	getVersionInput,
	getHistoryInput,
	idInput,
	updateNoteInput,
	type NoteCurrent,
} from "./types";

export const notesRouter = router({
	// --- Mutations ---

	createNote: publicProcedure.input(createNoteInput).mutation(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.createNote(input, ctx.userId);
	}),

	updateNote: publicProcedure.input(updateNoteInput).mutation(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.updateNote(input, ctx.userId);
	}),

	revertToVersion: publicProcedure.input(getVersionInput).mutation(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.revertToVersion(input.id, input.version, ctx.userId);
	}),

	deleteNote: publicProcedure.input(idInput).mutation(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.deleteNote(input.id, ctx.userId);
	}),

	toggleShare: publicProcedure.input(idInput).mutation(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.toggleShare(input.id, ctx.userId);
	}),

	// --- Queries ---

	getNote: publicProcedure.input(idInput).query(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.getNote(input.id, ctx.userId);
	}),

	listNotes: publicProcedure.query(async ({ ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.listNotes(ctx.userId);
	}),

	getHistory: publicProcedure.input(getHistoryInput).query(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.getHistory(input.id, input.limit, input.cursor, input.direction);
	}),

	getVersion: publicProcedure.input(getVersionInput).query(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.getVersion(input.id, input.version);
	}),

	// --- Subscriptions ---

	// Removed subscribeToNote as it's not used (we use raw WebSockets)
});

