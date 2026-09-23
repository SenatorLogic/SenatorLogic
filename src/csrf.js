'use strict';

const crypto = require('node:crypto');

/** Gives every session a token and exposes it to the templates. */
function issueToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function tokenMatches(req) {
  const sent = String(req.body?._csrf || '');
  const expected = String(req.session?.csrfToken || '');
  if (!expected || sent.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
}

function reject(res) {
  return res.status(403).render('error', {
    title: 'Session expired',
    message: 'That form is no longer valid. Please go back and try again.',
  });
}

const isMultipart = (req) =>
  String(req.headers['content-type'] || '').startsWith('multipart/form-data');

/**
 * Checks every POST except file uploads. A multipart body has not been parsed
 * at this point, so those routes call `requireToken` themselves once multer
 * has run.
 */
function guard(req, res, next) {
  if (req.method !== 'POST' || isMultipart(req)) return next();
  return tokenMatches(req) ? next() : reject(res);
}

/** For routes that parse their own multipart body. Runs after multer. */
function requireToken(req, res, next) {
  return tokenMatches(req) ? next() : reject(res);
}

module.exports = { issueToken, guard, requireToken };
