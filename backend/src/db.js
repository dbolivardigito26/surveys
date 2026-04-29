const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const TURSO_URL = process.env.TURSO_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

let _db = null;

function toObj(row, columns) {
  if (!row) return undefined;
  const obj = {};
  for (const col of columns) obj[col] = row[col];
  return obj;
}

class DBWrapper {
  constructor(client) {
    this._client = client;
  }

  async exec(sql) {
    await this._client.execute(sql);
  }

  prepare(sql) {
    const client = this._client;
    return {
      async run(...args) {
        await client.execute({ sql, args });
      },
      async get(...args) {
        const { rows, columns } = await client.execute({ sql, args });
        return rows.length ? toObj(rows[0], columns) : undefined;
      },
      async all(...args) {
        const { rows, columns } = await client.execute({ sql, args });
        return rows.map(row => toObj(row, columns));
      }
    };
  }
}

async function initDb() {
  const client = createClient({ url: TURSO_URL, authToken: TURSO_AUTH_TOKEN });

  await client.execute('PRAGMA foreign_keys = ON');

  await client.batch([
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS surveys (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      anonymous INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      survey_id TEXT NOT NULL,
      type TEXT NOT NULL,
      text TEXT NOT NULL,
      options TEXT,
      required INTEGER NOT NULL DEFAULT 1,
      order_index INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS waves (
      id TEXT PRIMARY KEY,
      survey_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      opens_at TEXT,
      closes_at TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS responses (
      id TEXT PRIMARY KEY,
      wave_id TEXT NOT NULL,
      respondent_email TEXT,
      respondent_name TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS answers (
      id TEXT PRIMARY KEY,
      response_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      value TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS wave_participants (
      id TEXT PRIMARY KEY,
      wave_id TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      position TEXT,
      token TEXT UNIQUE NOT NULL,
      invited_at TEXT NOT NULL DEFAULT (datetime('now')),
      response_id TEXT
    )`,
  ], 'write');

  const migrations = [
    { table: 'users', column: 'position', def: 'TEXT' },
    { table: 'users', column: 'area', def: 'TEXT' },
    { table: 'wave_participants', column: 'position', def: 'TEXT' },
    { table: 'wave_participants', column: 'area', def: 'TEXT' },
    { table: 'surveys', column: 'measurement_type', def: `TEXT NOT NULL DEFAULT 'waves'` },
  ];
  for (const m of migrations) {
    try {
      const { rows } = await client.execute(`PRAGMA table_info(${m.table})`);
      const existing = rows.map(r => r['name']);
      if (!existing.includes(m.column)) {
        await client.execute(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.def}`);
      }
    } catch {}
  }

  const db = new DBWrapper(client);

  const userCount = await db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (parseInt(userCount?.count || 0) === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await db.prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)')
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
