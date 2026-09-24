'use strict';

const express = require('express');

const { requireAdmin } = require('../auth');
const members = require('../members');
const content = require('../content');
const { acceptPhoto, applyPhotoChange, hasPhoto } = require('../photo');
const { requireToken } = require('../csrf');
const { cleanProfile, cleanOffice, cleanEvent, cleanPost } = require('../validate');
const { OFFICES } = require('../constants');

const router = express.Router();

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

router.use(requireAdmin);

const flash = (req, type, message) => {
  req.session.flash = { type, message };
};

// --- Dashboard --------------------------------------------------------------
router.get(
  '/',
  wrap(async (req, res) => {
    const [memberList, posts, events] = await Promise.all([
      members.allMembers(),
      content.allPosts(),
      content.allEvents(),
    ]);
    res.render('admin/dashboard', { title: 'Admin', members: memberList, posts, events });
  })
);

// --- Members ----------------------------------------------------------------
router.get(
  '/members',
  wrap(async (req, res) => {
    res.render('admin/members', {
      title: 'Manage members',
      members: await members.allMembers(),
      offices: OFFICES,
    });
  })
);

router.get(
  '/members/:id/edit',
  wrap(async (req, res, next) => {
    const member = await members.getMember(Number(req.params.id));
    if (!member) return next();
    res.render('admin/member-edit', {
      title: `Edit ${member.full_name}`,
      values: member,
      member,
      error: null,
      hasPhoto: await hasPhoto(member.id),
      offices: OFFICES,
      ...members.formOptions,
    });
  })
);

router.post(
  '/members/:id/edit',
  acceptPhoto,
  requireToken,
  wrap(async (req, res, next) => {
    const id = Number(req.params.id);
    const member = await members.getMember(id);
    if (!member) return next();

    const profile = cleanProfile(req.body);
    const { office, office_rank: rank } = cleanOffice(req.body.office);
    const wantsAdmin = req.body.is_admin === 'yes';

    const rerender = async (error) =>
      res.status(400).render('admin/member-edit', {
        title: `Edit ${member.full_name}`,
        values: { ...member, ...profile, office, is_admin: wantsAdmin },
        member,
        error,
        hasPhoto: await hasPhoto(id),
        offices: OFFICES,
        ...members.formOptions,
      });

    if (!profile.full_name) return rerender('Please enter a full name.');

    // Never let the last administrator lock everyone out.
    const removingAdmin = member.is_admin && !wantsAdmin;
    if (removingAdmin && (await members.adminCount()) <= 1) {
      return rerender(
        'This is the only administrator, so admin rights cannot be removed.'
      );
    }

    const photoError = await applyPhotoChange(req, id);
    if (photoError) return rerender(photoError);

    await members.saveProfileFields(id, profile);
    await members.setOffice(id, office, rank);
    await members.setAdmin(id, wantsAdmin);

    flash(req, 'success', `${profile.full_name}'s profile has been updated.`);
    res.redirect('/admin/members');
  })
);

router.post(
  '/members/:id/delete',
  wrap(async (req, res, next) => {
    const id = Number(req.params.id);
    const member = await members.getMember(id);
    if (!member) return next();

    if (member.is_admin && (await members.adminCount()) <= 1) {
      flash(req, 'error', 'The only administrator cannot be deleted.');
      return res.redirect('/admin/members');
    }
    if (id === req.user.id) {
      flash(req, 'error', 'You cannot delete your own account from here.');
      return res.redirect('/admin/members');
    }

    await members.deleteMember(id);
    flash(req, 'success', `${member.full_name} has been removed.`);
    res.redirect('/admin/members');
  })
);

// --- News & updates ---------------------------------------------------------
router.get('/news/new', (req, res) => {
  res.render('admin/post-edit', {
    title: 'Post an update',
    values: { title: '', body: '' },
    post: null,
    error: null,
  });
});

router.post(
  '/news/new',
  wrap(async (req, res) => {
    const values = cleanPost(req.body);
    if (!values.title || !values.body) {
      return res.status(400).render('admin/post-edit', {
        title: 'Post an update',
        values,
        post: null,
        error: 'Please give the update a title and some text.',
      });
    }
    await content.createPost(values.title, values.body, req.user.id);
    flash(req, 'success', 'Your update has been posted.');
    res.redirect('/news');
  })
);

router.get(
  '/news/:id/edit',
  wrap(async (req, res, next) => {
    const post = await content.getPost(Number(req.params.id));
    if (!post) return next();
    res.render('admin/post-edit', { title: 'Edit update', values: post, post, error: null });
  })
);

router.post(
  '/news/:id/edit',
  wrap(async (req, res, next) => {
    const id = Number(req.params.id);
    const post = await content.getPost(id);
    if (!post) return next();

    const values = cleanPost(req.body);
    if (!values.title || !values.body) {
      return res.status(400).render('admin/post-edit', {
        title: 'Edit update',
        values,
        post,
        error: 'Please give the update a title and some text.',
      });
    }
    await content.updatePost(id, values.title, values.body);
    flash(req, 'success', 'The update has been saved.');
    res.redirect(`/news/${id}`);
  })
);

router.post(
  '/news/:id/delete',
  wrap(async (req, res) => {
    await content.deletePost(Number(req.params.id));
    flash(req, 'success', 'The update has been deleted.');
    res.redirect('/news');
  })
);

// --- Events -----------------------------------------------------------------
router.get('/events/new', (req, res) => {
  res.render('admin/event-edit', {
    title: 'Add an event',
    values: { title: '', description: '', starts_on: '', starts_at: '', location: '' },
    event: null,
    error: null,
  });
});

router.post(
  '/events/new',
  wrap(async (req, res) => {
    const values = cleanEvent(req.body);
    if (!values.title || !values.starts_on) {
      return res.status(400).render('admin/event-edit', {
        title: 'Add an event',
        values,
        event: null,
        error: 'Please give the event a title and a valid date.',
      });
    }
    await content.createEvent(values, req.user.id);
    flash(req, 'success', 'The event has been added.');
    res.redirect('/events');
  })
);

router.get(
  '/events/:id/edit',
  wrap(async (req, res, next) => {
    const event = await content.getEvent(Number(req.params.id));
    if (!event) return next();
    res.render('admin/event-edit', { title: 'Edit event', values: event, event, error: null });
  })
);

router.post(
  '/events/:id/edit',
  wrap(async (req, res, next) => {
    const id = Number(req.params.id);
    const event = await content.getEvent(id);
    if (!event) return next();

    const values = cleanEvent(req.body);
    if (!values.title || !values.starts_on) {
      return res.status(400).render('admin/event-edit', {
        title: 'Edit event',
        values,
        event,
        error: 'Please give the event a title and a valid date.',
      });
    }
    await content.updateEvent(id, values);
    flash(req, 'success', 'The event has been saved.');
    res.redirect(`/events/${id}`);
  })
);

router.post(
  '/events/:id/delete',
  wrap(async (req, res) => {
    await content.deleteEvent(Number(req.params.id));
    flash(req, 'success', 'The event has been deleted.');
    res.redirect('/events');
  })
);

module.exports = router;
