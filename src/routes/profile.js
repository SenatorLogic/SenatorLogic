'use strict';

const express = require('express');

const { one, query } = require('../db');
const { requireLogin, hashPassword, verifyPassword } = require('../auth');
const { cleanProfile } = require('../validate');
const { acceptPhoto, applyPhotoChange, hasPhoto } = require('../photo');
const { requireToken } = require('../csrf');
const { saveProfileFields, formOptions } = require('../members');

const router = express.Router();

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

router.get('/profile', requireLogin, (req, res) => {
  res.render('member', {
    title: 'My profile',
    member: req.user,
    isSelf: true,
  });
});

router.get(
  '/profile/edit',
  requireLogin,
  wrap(async (req, res) => {
    res.render('profile-edit', {
      title: 'Edit my profile',
      values: req.user,
      error: null,
      hasPhoto: await hasPhoto(req.user.id),
      ...formOptions,
    });
  })
);

router.post(
  '/profile/edit',
  requireLogin,
  acceptPhoto,
  requireToken,
  wrap(async (req, res) => {
    const profile = cleanProfile(req.body);

    const rerender = async (error) =>
      res.status(400).render('profile-edit', {
        title: 'Edit my profile',
        values: { ...req.user, ...profile },
        error,
        hasPhoto: await hasPhoto(req.user.id),
        ...formOptions,
      });

    if (!profile.full_name) return rerender('Please enter your full name.');

    const photoError = await applyPhotoChange(req, req.user.id);
    if (photoError) return rerender(photoError);

    await saveProfileFields(req.user.id, profile);
    req.session.flash = { type: 'success', message: 'Your profile is saved.' };
    res.redirect('/profile');
  })
);

router.get('/profile/password', requireLogin, (req, res) => {
  res.render('password', { title: 'Change password', error: null });
});

router.post(
  '/profile/password',
  requireLogin,
  wrap(async (req, res) => {
    const current = String(req.body.current_password || '');
    const chosen = String(req.body.new_password || '');
    const confirm = String(req.body.confirm_password || '');

    const fail = (error) =>
      res.status(400).render('password', { title: 'Change password', error });

    const row = await one('SELECT password_hash FROM users WHERE id = $1', [
      req.user.id,
    ]);
    if (!(await verifyPassword(current, row.password_hash))) {
      return fail('Your current password is not correct.');
    }
    if (chosen.length < 8) {
      return fail('Your new password must be at least 8 characters.');
    }
    if (chosen !== confirm) return fail('The two new passwords do not match.');

    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [await hashPassword(chosen), req.user.id]
    );
    req.session.flash = { type: 'success', message: 'Your password is changed.' };
    res.redirect('/profile');
  })
);

module.exports = router;
