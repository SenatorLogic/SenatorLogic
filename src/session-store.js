'use strict';

const session = require('express-session');
const { db } = require('./db');

// Minimal SQLite-backed session store so sessions survive restarts without
// pulling in a native dependency.
class SqliteStore extends session.Store {
  constructor() {
    super();
    this.stmts = {
      get: db.prepare('SELECT data, expires_at FROM sessions WHERE sid = ?'),
      set: db.prepare(
        `INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)
         ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at`
      ),
      destroy: db.prepare('DELETE FROM sessions WHERE sid = ?'),
      touch: db.prepare('UPDATE sessions SET expires_at = ? WHERE sid = ?'),
      sweep: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
      all: db.prepare('SELECT sid, data FROM sessions WHERE expires_at > ?'),
      clear: db.prepare('DELETE FROM sessions'),
      length: db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE expires_at > ?'),
    };

    // Drop expired rows hourly.
    this.timer = setInterval(() => this.sweep(), 60 * 60 * 1000);
    this.timer.unref?.();
    this.sweep();
  }

  sweep() {
    try {
      this.stmts.sweep.run(Date.now());
    } catch {
      /* non-fatal */
    }
  }

  expiryOf(sess) {
    const ms = sess?.cookie?.maxAge;
    if (typeof ms === 'number') return Date.now() + ms;
    const expires = sess?.cookie?.expires;
    if (expires) return new Date(expires).getTime();
    return Date.now() + 14 * 24 * 60 * 60 * 1000;
  }

  get(sid, cb) {
    try {
      const row = this.stmts.get.get(sid);
      if (!row) return cb(null, null);
      if (row.expires_at <= Date.now()) {
        this.stmts.destroy.run(sid);
        return cb(null, null);
      }
      return cb(null, JSON.parse(row.data));
    } catch (err) {
      return cb(err);
    }
  }

  set(sid, sess, cb = () => {}) {
    try {
      this.stmts.set.run(sid, JSON.stringify(sess), this.expiryOf(sess));
      return cb(null);
    } catch (err) {
      return cb(err);
    }
  }

  touch(sid, sess, cb = () => {}) {
    try {
      this.stmts.touch.run(this.expiryOf(sess), sid);
      return cb(null);
    } catch (err) {
      return cb(err);
    }
  }

  destroy(sid, cb = () => {}) {
    try {
      this.stmts.destroy.run(sid);
      return cb(null);
    } catch (err) {
      return cb(err);
    }
  }

  length(cb = () => {}) {
    try {
      return cb(null, this.stmts.length.get(Date.now()).n);
    } catch (err) {
      return cb(err);
    }
  }

  clear(cb = () => {}) {
    try {
      this.stmts.clear.run();
      return cb(null);
    } catch (err) {
      return cb(err);
    }
  }

  all(cb = () => {}) {
    try {
      const rows = this.stmts.all.all(Date.now());
      const out = {};
      for (const row of rows) out[row.sid] = JSON.parse(row.data);
      return cb(null, out);
    } catch (err) {
      return cb(err);
    }
  }
}

module.exports = SqliteStore;
