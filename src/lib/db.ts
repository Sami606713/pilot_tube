import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

let db: DatabaseSync | undefined;

export function getDb(): DatabaseSync {
  if (db) return db;

  const dir = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? "data");
  mkdirSync(dir, { recursive: true });
  db = new DatabaseSync(path.join(dir, "app.db"));

  db.exec(`
    CREATE TABLE IF NOT EXISTS stories (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      url          TEXT NOT NULL UNIQUE,
      title        TEXT NOT NULL,
      source       TEXT NOT NULL,
      summary      TEXT,
      published_at TEXT NOT NULL,
      fetched_at   TEXT NOT NULL DEFAULT (datetime('now')),
      used_at      TEXT,
      skipped_at   TEXT
    );

    CREATE TABLE IF NOT EXISTS scripts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id   INTEGER NOT NULL REFERENCES stories(id),
      data       TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS voiceovers (
      script_id  INTEGER PRIMARY KEY REFERENCES scripts(id),
      voice      TEXT NOT NULL,
      audio_path TEXT NOT NULL,
      duration   REAL NOT NULL,
      words      TEXT NOT NULL,
      scenes     TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clips (
      script_id   INTEGER NOT NULL REFERENCES scripts(id),
      scene_index INTEGER NOT NULL,
      query       TEXT NOT NULL,
      pexels_id   INTEGER NOT NULL,
      pexels_url  TEXT NOT NULL,
      author      TEXT NOT NULL,
      author_url  TEXT NOT NULL,
      file_path   TEXT NOT NULL,
      width       INTEGER NOT NULL,
      height      INTEGER NOT NULL,
      duration    REAL NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (script_id, scene_index)
    );

    CREATE TABLE IF NOT EXISTS cards (
      script_id  INTEGER NOT NULL REFERENCES scripts(id),
      name       TEXT NOT NULL,
      kind       TEXT NOT NULL,
      variables  TEXT NOT NULL,
      file_path  TEXT NOT NULL,
      duration   REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (script_id, name)
    );

    CREATE TABLE IF NOT EXISTS renders (
      script_id      INTEGER PRIMARY KEY REFERENCES scripts(id),
      file_path      TEXT NOT NULL,
      duration       REAL NOT NULL,
      size_bytes     INTEGER NOT NULL,
      render_seconds REAL NOT NULL,
      created_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS thumbnails (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      script_id       INTEGER NOT NULL REFERENCES scripts(id),
      format          TEXT NOT NULL,
      concept         TEXT NOT NULL,
      prompt          TEXT NOT NULL,
      headline        TEXT NOT NULL,
      background_path TEXT NOT NULL,
      file_path       TEXT NOT NULL,
      selected        INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT NOT NULL
    );
  `);

  // Columns added after the first version of the schema.
  const storyColumns = new Set((db.prepare("PRAGMA table_info(stories)").all() as { name: string }[]).map((c) => c.name));
  const added: [string, string][] = [
    ["skipped_at", "TEXT"],
    // Hacker News popularity and a preview image, for the Research page.
    ["points", "INTEGER"],
    ["comments", "INTEGER"],
    ["image", "TEXT"],
  ];
  for (const [name, type] of added) {
    if (!storyColumns.has(name)) db.exec(`ALTER TABLE stories ADD COLUMN ${name} ${type}`);
  }

  return db;
}
