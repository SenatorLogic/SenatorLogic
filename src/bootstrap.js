'use strict';

const { db } = require('./db');

/**
 * The first person to register owns the site. If ADMIN_EMAIL is set, that
 * account is promoted to administrator whenever it exists, which gives the
 * owner a way back in after a deploy.
 */
function ensureFirstAdmin() {
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!adminEmail) return;

  const result = db
    .prepare('UPDATE users SET is_admin = 1 WHERE email = ? AND is_admin = 0')
    .run(adminEmail);

  if (result.changes > 0) {
    console.log(`Promoted ${adminEmail} to administrator.`);
  }
}

/** True while nobody has registered yet — the next signup becomes admin. */
function isFirstUser() {
  return db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0;
}

module.exports = { ensureFirstAdmin, isFirstUser };
