'use strict';

const { query } = require('./db');

/**
 * If ADMIN_EMAIL is set, that account is promoted to administrator whenever it
 * exists, which gives the owner a way back in after a deploy.
 */
async function ensureFirstAdmin() {
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!adminEmail) return;

  const { rowCount } = await query(
    'UPDATE users SET is_admin = TRUE WHERE email = $1 AND NOT is_admin',
    [adminEmail]
  );
  if (rowCount > 0) console.log(`Promoted ${adminEmail} to administrator.`);
}

module.exports = { ensureFirstAdmin };
