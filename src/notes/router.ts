import { observable } from "@trpc/server/observable";
import { publicProcedure, router } from "../trpc-config";
import { NotesServiceDO, pubsub } from "./service-do";
import {
	createNoteInput,
	getVersionInput,
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
		return await service.revertToVersion(input.id, input.version);
	}),

	deleteNote: publicProcedure.input(idInput).mutation(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.deleteNote(input.id, ctx.userId);
	}),

	// --- Queries ---

	getNote: publicProcedure.input(idInput).query(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.getNote(input.id);
	}),

	listNotes: publicProcedure.query(async ({ ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.listNotes(ctx.userId);
	}),

	getHistory: publicProcedure.input(idInput).query(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.getHistory(input.id);
	}),

	getVersion: publicProcedure.input(getVersionInput).query(async ({ input, ctx }) => {
		const service = new NotesServiceDO(ctx.env);
		return await service.getVersion(input.id, input.version);
	}),

	// --- Subscriptions ---

	subscribeToNote: publicProcedure.input(idInput).subscription(async ({ input, ctx }) => {
		return observable<NoteCurrent>((emit) => {
			const service = new NotesServiceDO(ctx.env);

			// Get initial state
			service.getNote(input.id).then((current) => {
				if (current) {
					emit.next(current);
				}
			});

			const unsubscribe = pubsub.subscribe(input.id, (note) => {
				emit.next(note);
			});

			return () => {
				unsubscribe();
			};
		});
	}),
});
