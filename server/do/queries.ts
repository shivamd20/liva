/**
 * SQL Queries for NoteDurableObject
 * All SQL statements are centralized here for easier maintenance
 */

export const QUERIES = {
  // Table creation
  CREATE_NOTE_CURRENT_TABLE: `
    CREATE TABLE IF NOT EXISTS note_current(
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      title TEXT,
      blob TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      expires_at INTEGER,
      collaborators TEXT NOT NULL,
      user_id TEXT NOT NULL,
      access TEXT NOT NULL DEFAULT 'private'
    );
  `,

  CREATE_NOTE_HISTORY_TABLE: `
    CREATE TABLE IF NOT EXISTS note_history(
      version INTEGER PRIMARY KEY,
      blob TEXT NOT NULL,
      title TEXT,
      timestamp INTEGER NOT NULL,
      meta TEXT
    );
  `,

  CREATE_HISTORY_INDEX: `
    CREATE INDEX IF NOT EXISTS idx_history_version 
    ON note_history(version);
  `,

  // Migration
  ADD_ACCESS_COLUMN: `
    ALTER TABLE note_current 
    ADD COLUMN access TEXT NOT NULL DEFAULT 'private'
  `,

  ADD_EXPIRES_AT_COLUMN: `
    ALTER TABLE note_current
    ADD COLUMN expires_at INTEGER
  `,

  // Current note operations
  GET_CURRENT_NOTE: `
    SELECT * FROM note_current LIMIT 1
  `,

  INSERT_CURRENT_NOTE: `
    INSERT INTO note_current(
      id, version, title, blob, created_at, updated_at, expires_at,
      collaborators, user_id, access
    )
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,

  UPDATE_CURRENT_NOTE: `
    UPDATE note_current
    SET version = ?, title = ?, blob = ?, updated_at = ?
  `,

  UPDATE_ACCESS: `
    UPDATE note_current 
    SET access = ?, updated_at = ? 
    WHERE id = ?
  `,

  DELETE_CURRENT_NOTE: `
    DELETE FROM note_current
  `,

  // History operations
  INSERT_HISTORY_VERSION: `
    INSERT INTO note_history(version, blob, title, timestamp, meta)
    VALUES(?, ?, ?, ?, ?)
  `,

  UPDATE_HISTORY_VERSION: `
    UPDATE note_history
    SET blob = ?, title = ?, timestamp = ?, meta = ?
    WHERE version = ?
  `,

  GET_VERSION: `
    SELECT * FROM note_history WHERE version = ?
  `,

  DELETE_HISTORY: `
    DELETE FROM note_history
  `,
} as const;
