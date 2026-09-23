'use strict';

const express = require('express');

const { db } = require('../db');
const { hashPassword, verifyPassword, findUserByEmail } = require('../auth');
const { isFirstUser } = require('../bootstrap');
const { normaliseEmail, isValidEmail, trim } = require('../validate');

const router = express.Router();

const MIN_PASSWORD = 8;

const insertUser = db.prepare(`
  INSERT INTO users (email, password_hash, full_name, is_admin)
  VALUES (?, ?, ?, ?)
`);

/** Rebuilds the session id on privilege change to block session fixation. */
function startSession(req, userId, done) {
  const csrfToken = req.session.csrfToken;
  req.session.regenerate((err) => {
    if (err) return done(err);
    req.session.userId = userId;
    req.session.csrfToken = csrfToken;
    req.session.save(done);
  });
}

function safeNext(value) {
  const target = String(value || '');
  // Only allow same-site paths, never a full URL.
  return /^\/(?!\/)/.test(target) ? target : '/profile';
}

router.get('/register', (req, res) => {
  if (req.user) return res.redirect('/profile');
  res.render('register', {
    title: 'Create your profile',
    values: {},
    error: null,
    firstUser: isFirstUser(),
  });
});

router.post('/register', async (req, res, next) => {
  const email = normaliseEmail(req.body.email);
  const fullName = trim(req.body.full_name, 120);
  const password = String(req.body.password || '');
  const confirm = String(req.body.confirm_password || '');

  const fail = (error) =>
    res.status(400).render('register', {
      title: 'Create your profile',
      values: { email, full_name: fullName },
      error,
      firstUser: isFirstUser(),
    });

  if (!fullName) return fail('Please enter your full name.');
  if (!isValidEmail(email)) return fail('Please enter a valid email address.');
  if (password.length < MIN_PASSWORD) {
    return fail(`Your password must be at least ${MIN_PASSWORD} characters.`);
  }
  if (password !== confirm) return fail('The two passwords do not match.');
  if (findUserByEmail(email)) {
    return fail('An account with that email already exists. Try signing in.');
  }

  try {
    const firstUser = isFirstUser();
    const hash = await hashPassword(password);
    const { lastInsertRowid } = insertUser.run(
      email,
      hash,
      fullName,
      firstUser ? 1 : 0
    );

    startSession(req, Number(lastInsertRowid), (err) => {
      if (err) return next(err);
      req.session.flash = {
        type: 'success',
        message: 'Welcome! Fill in your details below so members can find you.',
      };
      res.redirect('/profile/edit');
    });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return fail('An account with that email already exists.');
    }
    return next(err);
  }
});

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/profile');
  res.render('login', {
    title: 'Sign in',
    values: {},
    error: null,
    next: safeNext(req.query.next),
  });
});

router.post('/login', async (req, res, next) => {
  const email = normaliseEmail(req.body.email);
  const password = String(req.body.password || '');
  const target = safeNext(req.body.next);

  const fail = () =>
    res.status(401).render('login', {
      title: 'Sign in',
      values: { email },
      error: 'That email and password do not match an account.',
      next: target,
    });

  try {
    const user = findUserByEmail(email);
    // Always run a comparison so a missing account and a wrong password
    // take the same amount of time.
    const hash = user?.password_hash || '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi';
    const ok = await verifyPassword(password, hash);
    if (!user || !ok) return fail();

    startSession(req, user.id, (err) => {
      if (err) return next(err);
      res.redirect(target);
    });
  } catch {
    return fail();
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('oba.sid');
    res.redirect('/');
  });
});

module.exports = router;
