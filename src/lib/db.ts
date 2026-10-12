import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

let db: DatabaseSync | undefined;

/** Local SQLite database in data/app.db (git-ignored). */
export function getDb(): DatabaseSync {
  if (db) return db;

  const dir = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? "data");
  mkdirSync(dir, { recursive: true });
  db = new DatabaseSync(path.join(dir, "app.db"));

  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS research (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      topic       TEXT NOT NULL,
      time_range  TEXT NOT NULL,
      depth       TEXT NOT NULL,
      status      TEXT NOT NULL,
      steps       TEXT NOT NULL,
      result      TEXT,
      error       TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scripts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      research_id INTEGER,
      topic       TEXT NOT NULL,
      status      TEXT NOT NULL,
      steps       TEXT NOT NULL,
      content     TEXT,
      error       TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS videos (
      script_id  INTEGER PRIMARY KEY,
      data       TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS brands (
      domain TEXT PRIMARY KEY,
      data   TEXT NOT NULL
    );


    CREATE TABLE IF NOT EXISTS uploads (
      script_id   INTEGER PRIMARY KEY,
      video_id    TEXT NOT NULL,
      title       TEXT NOT NULL,
      privacy     TEXT NOT NULL,
      publish_at  TEXT,
      render_at   TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS thumbnails (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      script_id  INTEGER,
      title      TEXT NOT NULL,
      shape      TEXT NOT NULL,
      concept    TEXT NOT NULL,
      prompt     TEXT NOT NULL,
      headline   TEXT,
      file       TEXT NOT NULL,
      selected   INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clips (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      data       TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plan_slots (
      day         TEXT PRIMARY KEY,
      topic       TEXT,
      research_id INTEGER,
      script_id   INTEGER,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  return db;
}
