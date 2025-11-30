import { TRPCError } from "@trpc/server";
import {
    type ID,
    type NoteCurrent,
    type NoteVersion,
    type createNoteInput,
    type updateNoteInput,
} from "./types";
import type { z } from "zod";

// -----------------------------------------------------------------------------
// In-Memory Stores
// -----------------------------------------------------------------------------

const notesStore = new Map<ID, NoteCurrent>();
const historyStore = new Map<ID, NoteVersion[]>();

// -----------------------------------------------------------------------------
// PubSub System
// -----------------------------------------------------------------------------

class NotePubSub {
    private listeners = new Map<ID, Set<(note: NoteCurrent) => void>>();

    emit(noteId: ID, note: NoteCurrent) {
        const set = this.listeners.get(noteId);
        if (!set) return;
        // Broadcast a clone to prevent mutation issues
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
const now = () => Date.now();

// -----------------------------------------------------------------------------
// Service Methods
// -----------------------------------------------------------------------------

export const NotesService = {
    createNote(input: z.infer<typeof createNoteInput>) {
        const id = input.id ?? makeId();
        if (notesStore.has(id)) {
            throw new TRPCError({ code: "CONFLICT", message: "Note ID already exists" });
        }

        const timestamp = now();
        const initialVersion: NoteVersion = {
            version: 1,
            blob: structuredClone(input.blob),
            title: input.title ?? null,
            timestamp,
            meta: null,
        };

        const current: NoteCurrent = {
            id,
            version: 1,
            title: input.title ?? null,
            blob: structuredClone(input.blob),
            createdAt: timestamp,
            updatedAt: timestamp,
            collaborators: input.collaborators ?? [],
        };

        notesStore.set(id, current);
        historyStore.set(id, [initialVersion]);
        pubsub.emit(id, current);

        return structuredClone(current);
    },

    updateNote(input: z.infer<typeof updateNoteInput>) {
        const current = notesStore.get(input.id);
        if (!current) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
        }

        // Optimistic concurrency check
        if (input.expectedVersion !== undefined && input.expectedVersion !== current.version) {
            throw new TRPCError({ code: "CONFLICT", message: "Version mismatch" });
        }

        const nextVersion = current.version + 1;
        const timestamp = now();

        const versionEntry: NoteVersion = {
            version: nextVersion,
            blob: structuredClone(input.blob),
            title: input.title ?? current.title,
            timestamp,
            meta: input.meta ?? null,
        };

        const newCurrent: NoteCurrent = {
            ...current,
            version: nextVersion,
            title: input.title ?? current.title,
            blob: structuredClone(input.blob),
            updatedAt: timestamp,
        };

        notesStore.set(input.id, newCurrent);
        const history = historyStore.get(input.id) ?? [];
        history.push(versionEntry);
        historyStore.set(input.id, history);

        pubsub.emit(input.id, newCurrent);

        return structuredClone(newCurrent);
    },

    revertToVersion(id: string, version: number) {
        const history = historyStore.get(id);
        if (!history) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
        }

        const targetVersion = history.find((h) => h.version === version);
        if (!targetVersion) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Version not found" });
        }

        const current = notesStore.get(id)!;
        const nextVersion = current.version + 1;
        const timestamp = now();

        const versionEntry: NoteVersion = {
            version: nextVersion,
            blob: structuredClone(targetVersion.blob),
            title: targetVersion.title ?? current.title,
            timestamp,
            meta: { revertedFrom: version },
        };

        const newCurrent: NoteCurrent = {
            ...current,
            version: nextVersion,
            title: versionEntry.title,
            blob: structuredClone(targetVersion.blob),
            updatedAt: timestamp,
        };

        notesStore.set(id, newCurrent);
        history.push(versionEntry);
        pubsub.emit(id, newCurrent);

        return structuredClone(newCurrent);
    },

    getNote(id: string) {
        const note = notesStore.get(id);
        return note ? structuredClone(note) : null;
    },

    listNotes() {
        const list = Array.from(notesStore.values()).map((n) => ({
            id: n.id,
            title: n.title,
            version: n.version,
            updatedAt: n.updatedAt,
            createdAt: n.createdAt,
        }));
        return list.sort((a, b) => b.updatedAt - a.updatedAt);
    },

    getHistory(id: string) {
        const history = historyStore.get(id) ?? [];
        return structuredClone(history);
    },

    getVersion(id: string, version: number) {
        const history = historyStore.get(id) ?? [];
        const ver = history.find((h) => h.version === version);
        return ver ? structuredClone(ver) : null;
    },
};
