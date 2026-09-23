'use strict';

const express = require('express');

const { db } = require('../db');
const { requireLogin, hashPassword, verifyPassword } = require('../auth');
const { cleanProfile } = require('../validate');
const { acceptPhoto, applyPhotoChange, hasPhoto } = require('../photo');
const { requireToken } = require('../csrf');
const { saveProfileFields, formOptions } = require('../members');

const router = express.Router();

const stmts = {
  updatePassword: db.prepare(
    "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
  ),
  passwordHash: db.prepare('SELECT password_hash FROM users WHERE id = ?'),
};

router.get('/profile', requireLogin, (req, res) => {
  res.render('member', {
    title: 'My profile',
    member: req.user,
    isSelf: true,
  });
});

router.get('/profile/edit', requireLogin, (req, res) => {
  res.render('profile-edit', {
    title: 'Edit my profile',
    values: req.user,
    error: null,
    hasPhoto: hasPhoto(req.user.id),
    ...formOptions,
  });
});

router.post('/profile/edit', requireLogin, acceptPhoto, requireToken, (req, res) => {
  const profile = cleanProfile(req.body);

  const rerender = (error) =>
    res.status(400).render('profile-edit', {
      title: 'Edit my profile',
      values: { ...req.user, ...profile },
      error,
      hasPhoto: hasPhoto(req.user.id),
      ...formOptions,
    });

  if (!profile.full_name) return rerender('Please enter your full name.');

  const photoError = applyPhotoChange(req, req.user.id);
  if (photoError) return rerender(photoError);

  saveProfileFields(req.user.id, profile);
  req.session.flash = { type: 'success', message: 'Your profile is saved.' };
  res.redirect('/profile');
});

router.get('/profile/password', requireLogin, (req, res) => {
  res.render('password', { title: 'Change password', error: null });
});

router.post('/profile/password', requireLogin, async (req, res, next) => {
  const current = String(req.body.current_password || '');
  const chosen = String(req.body.new_password || '');
  const confirm = String(req.body.confirm_password || '');

  const fail = (error) =>
    res.status(400).render('password', { title: 'Change password', error });

  try {
    const row = stmts.passwordHash.get(req.user.id);
    if (!(await verifyPassword(current, row.password_hash))) {
      return fail('Your current password is not correct.');
    }
    if (chosen.length < 8) {
      return fail('Your new password must be at least 8 characters.');
    }
    if (chosen !== confirm) return fail('The two new passwords do not match.');

    stmts.updatePassword.run(await hashPassword(chosen), req.user.id);
    req.session.flash = { type: 'success', message: 'Your password is changed.' };
    res.redirect('/profile');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
