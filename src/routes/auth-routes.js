'use strict';

const express = require('express');

const { one } = require('../db');
const { hashPassword, verifyPassword, findUserByEmail } = require('../auth');
const { normaliseEmail, isValidEmail, trim } = require('../validate');

const router = express.Router();

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const MIN_PASSWORD = 8;

/** True while nobody has registered yet — the next signup becomes admin. */
const isFirstUser = async () =>
  Number((await one('SELECT COUNT(*)::int AS n FROM users')).n) === 0;

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

router.get(
  '/register',
  wrap(async (req, res) => {
    if (req.user) return res.redirect('/profile');
    res.render('register', {
      title: 'Create your profile',
      values: {},
      error: null,
      firstUser: await isFirstUser(),
    });
  })
);

router.post(
  '/register',
  wrap(async (req, res, next) => {
    const email = normaliseEmail(req.body.email);
    const fullName = trim(req.body.full_name, 120);
    const password = String(req.body.password || '');
    const confirm = String(req.body.confirm_password || '');

    const fail = async (error) =>
      res.status(400).render('register', {
        title: 'Create your profile',
        values: { email, full_name: fullName },
        error,
        firstUser: await isFirstUser(),
      });

    if (!fullName) return fail('Please enter your full name.');
    if (!isValidEmail(email)) return fail('Please enter a valid email address.');
    if (password.length < MIN_PASSWORD) {
      return fail(`Your password must be at least ${MIN_PASSWORD} characters.`);
    }
    if (password !== confirm) return fail('The two passwords do not match.');
    if (await findUserByEmail(email)) {
      return fail('An account with that email already exists. Try signing in.');
    }

    try {
      const firstUser = await isFirstUser();
      const hash = await hashPassword(password);
      const row = await one(
        `INSERT INTO users (email, password_hash, full_name, is_admin)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [email, hash, fullName, firstUser]
      );

      startSession(req, row.id, (err) => {
        if (err) return next(err);
        req.session.flash = {
          type: 'success',
          message: 'Welcome! Fill in your details below so members can find you.',
        };
        res.redirect('/profile/edit');
      });
    } catch (err) {
      // 23505 is Postgres' unique-violation code.
      if (err.code === '23505') {
        return fail('An account with that email already exists.');
      }
      throw err;
    }
  })
);

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/profile');
  res.render('login', {
    title: 'Sign in',
    values: {},
    error: null,
    next: safeNext(req.query.next),
  });
});

router.post(
  '/login',
  wrap(async (req, res, next) => {
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

    const user = await findUserByEmail(email);
    // Always run a comparison so a missing account and a wrong password take
    // the same amount of time.
    const hash =
      user?.password_hash ||
      '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi';
    const ok = await verifyPassword(password, hash).catch(() => false);
    if (!user || !ok) return fail();

    startSession(req, user.id, (err) => {
      if (err) return next(err);
      res.redirect(target);
    });
  })
);

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('oba.sid');
    res.redirect('/');
  });
});

module.exports = router;
