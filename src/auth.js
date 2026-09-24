'use strict';

const bcrypt = require('bcryptjs');
const { one } = require('./db');

const ROUNDS = 12;

const hashPassword = (plain) => bcrypt.hash(plain, ROUNDS);
const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

// Every column a template may display — deliberately excludes password_hash.
const PUBLIC_COLUMNS = `
  id, email, full_name, phone, gender, occupation, address, obowo_address,
  relationship_status, birthday, about, office, office_rank, is_admin,
  created_at, updated_at,
  EXISTS(SELECT 1 FROM photos WHERE photos.user_id = users.id) AS has_photo
`;

function findUserById(id) {
  return one(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
}

function findUserByEmail(email) {
  return one('SELECT * FROM users WHERE email = $1', [
    String(email).trim().toLowerCase(),
  ]);
}

/** Attaches req.user (or null) and the view locals every page needs. */
async function attachUser(req, res, next) {
  try {
    const id = req.session?.userId;
    req.user = id ? await findUserById(id) : null;

    // A deleted account with a live cookie: clear it out.
    if (id && !req.user) req.session.userId = null;

    res.locals.currentUser = req.user;
    res.locals.path = req.path;
    next();
  } catch (err) {
    next(err);
  }
}

function requireLogin(req, res, next) {
  if (req.user) return next();
  const target = encodeURIComponent(req.originalUrl);
  return res.redirect(`/login?next=${target}`);
}

function requireAdmin(req, res, next) {
  if (req.user?.is_admin) return next();
  if (!req.user) return requireLogin(req, res, next);
  return res.status(403).render('error', {
    title: 'Not allowed',
    message: 'Only an administrator can open that page.',
  });
}

module.exports = {
  hashPassword,
  verifyPassword,
  findUserById,
  findUserByEmail,
  attachUser,
  requireLogin,
  requireAdmin,
  PUBLIC_COLUMNS,
};
