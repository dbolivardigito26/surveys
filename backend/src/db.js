const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Vercel serverless has no writable FS except /tmp; local dev falls back to the database dir
const DB_PATH = process.env.DB_PATH ||
  (process.env.VERCEL ? '/tmp/surveys.db' : path.join(__dirname, '../../database/surveys.db'));

let _db = null;

// Wrapper to mimic better-sqlite3 synchronous API
class DBWrapper {
  constructor(sqlDb) {
    this._db = sqlDb;
    this._dirty = false;
  }

  pragma(stmt) {
    this._db.run(`PRAGMA ${stmt}`);
  }

  exec(sql) {
    this._db.run(sql);
    this._persist();
  }

  prepare(sql) {
    const self = this;
    return {
      run(...params) {
        const stmt = self._db.prepare(sql);
        stmt.run(params);
        stmt.free();
        self._persist();
      },
      get(...params) {
        const stmt = self._db.prepare(sql);
        stmt.bind(params);
        let result;
        if (stmt.step()) result = stmt.getAsObject();
        stmt.free();
        return result;
      },
      all(...params) {
        const results = [];
        const stmt = self._db.prepare(sql);
        stmt.bind(params);
        while (stmt.step()) results.push(stmt.getAsObject());
        stmt.free();
        return results;
      }
    };
  }

  _persist() {
    const data = this._db.export();
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

async function initDb() {
  // Explicitly pass the WASM binary so bundlers (esbuild/Vercel) don't lose the file reference
  const wasmBinary = fs.readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'));
  const SQL = await initSqlJs({ wasmBinary });
  let sqlDb;

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(fileBuffer);
  } else {
    sqlDb = new SQL.Database();
  }

  const db = new DBWrapper(sqlDb);

  db._db.run(`PRAGMA journal_mode = WAL`);
  db._db.run(`PRAGMA foreign_keys = ON`);

  db._db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS surveys (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      anonymous INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      survey_id TEXT NOT NULL,
      type TEXT NOT NULL,
      text TEXT NOT NULL,
      options TEXT,
      required INTEGER NOT NULL DEFAULT 1,
      order_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS waves (
      id TEXT PRIMARY KEY,
      survey_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      opens_at TEXT,
      closes_at TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS responses (
      id TEXT PRIMARY KEY,
      wave_id TEXT NOT NULL,
      respondent_email TEXT,
      respondent_name TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS answers (
      id TEXT PRIMARY KEY,
      response_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS wave_participants (
      id TEXT PRIMARY KEY,
      wave_id TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      position TEXT,
      token TEXT UNIQUE NOT NULL,
      invited_at TEXT NOT NULL DEFAULT (datetime('now')),
      response_id TEXT
    );
  `);

  // Migrations: add columns if not exist
  const migrations = [
    { table: 'users', column: 'position', def: 'TEXT' },
    { table: 'users', column: 'area', def: 'TEXT' },
    { table: 'wave_participants', column: 'position', def: 'TEXT' },
    { table: 'wave_participants', column: 'area', def: 'TEXT' },
    { table: 'surveys', column: 'measurement_type', def: `TEXT NOT NULL DEFAULT 'waves'` },
  ];
  for (const m of migrations) {
    try {
      const cols = db._db.exec(`PRAGMA table_info(${m.table})`);
      const existing = cols[0]?.values?.map((r) => r[1]) || [];
      if (!existing.includes(m.column)) {
        db._db.run(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.def}`);
      }
    } catch {}
  }

  db._persist();

  // Seed default admin if no users exist
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount && parseInt(userCount.count) === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)')
      .run(uuidv4(), 'admin@surveys.local', hash, 'Administrador', 'admin');
    console.log('Usuario admin creado: admin@surveys.local / admin123');
  }

  _db = db;
  return db;
}

function getDb() {
  if (!_db) throw new Error('DB no inicializada');
  return _db;
}

module.exports = { initDb, getDb };
