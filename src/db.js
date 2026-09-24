'use strict';

const { Pool } = require('pg');

const CONNECTION_STRING = process.env.DATABASE_URL || '';

if (!CONNECTION_STRING) {
  console.error(
    'FATAL: DATABASE_URL is not set.\n' +
      'Create a free Postgres database at https://neon.tech and put its\n' +
      'connection string in DATABASE_URL (see .env.example).'
  );
  process.exit(1);
}

// Hosted Postgres (Neon and friends) requires TLS; a local server does not.
const needsSsl =
  /sslmode=require/.test(CONNECTION_STRING) ||
  /\.(neon\.tech|render\.com|supabase\.co)/.test(CONNECTION_STRING);

const pool = new Pool({
  connectionString: CONNECTION_STRING,
  ssl: needsSsl ? { rejectUnauthorized: true } : false,
  // Neon's free plan allows few connections, and this app needs very few.
  max: Number(process.env.DATABASE_POOL_MAX) || 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
});

pool.on('error', (err) => {
  // A dropped idle connection is normal on a database that sleeps; the pool
  // opens a new one on the next query.
  console.error('Postgres pool error:', err.message);
});

const query = (text, params) => pool.query(text, params);

/** First row, or null. */
async function one(text, params) {
  const { rows } = await pool.query(text, params);
  return rows[0] || null;
}

/** All rows. */
async function all(text, params) {
  const { rows } = await pool.query(text, params);
  return rows;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email               TEXT NOT NULL UNIQUE,
    password_hash       TEXT NOT NULL,
    full_name           TEXT NOT NULL,
    phone               TEXT NOT NULL DEFAULT '',
    gender              TEXT NOT NULL DEFAULT '',
    occupation          TEXT NOT NULL DEFAULT '',
    address             TEXT NOT NULL DEFAULT '',
    obowo_address       TEXT NOT NULL DEFAULT '',
    relationship_status TEXT NOT NULL DEFAULT '',
    birthday            TEXT NOT NULL DEFAULT '',
    about               TEXT NOT NULL DEFAULT '',
    office              TEXT NOT NULL DEFAULT '',
    office_rank         INTEGER NOT NULL DEFAULT 0,
    is_admin            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS photos (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    mime       TEXT NOT NULL,
    bytes      BYTEA NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS posts (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title        TEXT NOT NULL,
    body         TEXT NOT NULL,
    author_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    starts_on   TEXT NOT NULL,
    starts_at   TEXT NOT NULL DEFAULT '',
    location    TEXT NOT NULL DEFAULT '',
    created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- express-session's store keeps its rows here.
  CREATE TABLE IF NOT EXISTS session (
    sid    VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
    sess   JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_users_office ON users(office_rank);
  CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published_at DESC);
  CREATE INDEX IF NOT EXISTS idx_events_date ON events(starts_on);
  CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);
`;

/** Creates the tables if they are missing. Safe to run on every boot. */
async function migrate() {
  await pool.query(SCHEMA);
}

module.exports = { pool, query, one, all, migrate };
