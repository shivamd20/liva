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
      access TEXT NOT NULL DEFAULT 'private',
      template_id TEXT
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

  ADD_TEMPLATE_ID_COLUMN: `
    ALTER TABLE note_current
    ADD COLUMN template_id TEXT
  `,

  // Current note operations
  GET_CURRENT_NOTE: `
    SELECT * FROM note_current LIMIT 1
  `,

  INSERT_CURRENT_NOTE: `
    INSERT INTO note_current(
      id, version, title, blob, created_at, updated_at, expires_at,
      collaborators, user_id, access, template_id
    )
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

  // Recording History operations
  CREATE_NOTE_RECORDINGS_TABLE: `
    CREATE TABLE IF NOT EXISTS note_recordings(
      session_id TEXT PRIMARY KEY,
      duration INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      title TEXT
    );
  `,

  CREATE_RECORDINGS_INDEX: `
    CREATE INDEX IF NOT EXISTS idx_recordings_created_at
    ON note_recordings(created_at);
  `,

  INSERT_RECORDING: `
    INSERT OR REPLACE INTO note_recordings(session_id, duration, created_at, title)
    VALUES(?, ?, ?, ?)
  `,

  GET_RECORDINGS: `
    SELECT * FROM note_recordings ORDER BY created_at DESC
  `,

  UPDATE_OWNER: `
    UPDATE note_current
    SET user_id = ?
    WHERE id = ?
  `,
} as const;
