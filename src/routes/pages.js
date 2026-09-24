'use strict';

const crypto = require('node:crypto');
const path = require('node:path');

const express = require('express');

const { all } = require('../db');
const { requireLogin, PUBLIC_COLUMNS } = require('../auth');
const { OFFICES } = require('../constants');
const { getPhoto } = require('../photo');
const members = require('../members');
const content = require('../content');

const router = express.Router();

/** Wraps an async handler so a rejected promise reaches the error middleware. */
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const executives = () =>
  all(`SELECT ${PUBLIC_COLUMNS} FROM users
       WHERE office_rank > 0
       ORDER BY office_rank, full_name`);

const birthdaysInMonth = (month) =>
  all(
    `SELECT ${PUBLIC_COLUMNS} FROM users
     WHERE birthday <> '' AND substr(birthday, 6, 2) = $1
     ORDER BY substr(birthday, 9, 2)`,
    [month]
  );

/** Makes %, _ and \ literal inside a LIKE pattern. */
const escapeLike = (value) => String(value).replace(/[\\%_]/g, (c) => `\\${c}`);

function searchMembers({ query: term, office }) {
  const clauses = [];
  const params = [];

  if (term) {
    // ILIKE so a search is not case-sensitive.
    const fields = ['full_name', 'occupation', 'obowo_address', 'address', 'office'];
    params.push(`%${escapeLike(term)}%`);
    const n = params.length;
    clauses.push(`(${fields.map((f) => `${f} ILIKE $${n}`).join(' OR ')})`);
  }

  if (office === 'executives') {
    clauses.push('office_rank > 0');
  } else if (office) {
    params.push(office);
    clauses.push(`office = $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return all(
    `SELECT ${PUBLIC_COLUMNS} FROM users ${where}
     ORDER BY (office_rank = 0), office_rank, full_name`,
    params
  );
}

router.get(
  '/',
  wrap(async (req, res) => {
    const [exco, count, news, events] = await Promise.all([
      executives(),
      members.memberCount(),
      content.latestPosts(3),
      content.upcomingEvents(3),
    ]);

    res.render('home', {
      title: 'OBA Youth Abuja',
      executives: exco,
      memberCount: count,
      news,
      events,
    });
  })
);

router.get(
  '/news',
  wrap(async (req, res) => {
    res.render('news', { title: 'News & updates', posts: await content.allPosts() });
  })
);

router.get(
  '/news/:id',
  wrap(async (req, res, next) => {
    const post = await content.getPost(Number(req.params.id));
    if (!post) return next();
    res.render('post', { title: post.title, post });
  })
);

router.get(
  '/events',
  wrap(async (req, res) => {
    const [upcoming, past] = await Promise.all([
      content.upcomingEvents(50),
      content.pastEvents(20),
    ]);
    res.render('events', { title: 'Events', upcoming, past });
  })
);

router.get(
  '/events/:id',
  wrap(async (req, res, next) => {
    const event = await content.getEvent(Number(req.params.id));
    if (!event) return next();
    res.render('event', { title: event.title, event });
  })
);

router.get(
  '/members',
  requireLogin,
  wrap(async (req, res) => {
    const term = String(req.query.q || '').trim().slice(0, 100);
    const office = String(req.query.office || '').trim().slice(0, 60);

    res.render('members', {
      title: 'Members',
      members: await searchMembers({ query: term, office }),
      query: term,
      office,
      offices: OFFICES,
    });
  })
);

router.get(
  '/members/:id',
  requireLogin,
  wrap(async (req, res, next) => {
    const member = await members.getMember(Number(req.params.id));
    if (!member) return next();
    res.render('member', { title: member.full_name, member });
  })
);

router.get(
  '/birthdays',
  requireLogin,
  wrap(async (req, res) => {
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    res.render('birthdays', {
      title: 'Birthdays this month',
      members: await birthdaysInMonth(month),
      monthName: new Date().toLocaleString('en-NG', { month: 'long' }),
    });
  })
);

// Member photos. Executive photos are public because they appear on the home
// page; everyone else's photo is only served to signed-in members.
router.get(
  '/photo/:id',
  wrap(async (req, res, next) => {
    const row = await getPhoto(Number(req.params.id));
    if (!row) {
      return res.sendFile(
        path.join(__dirname, '..', '..', 'public', 'img', 'avatar.svg')
      );
    }
    if (row.office_rank === 0 && !req.user) return next();

    const etag = `"${crypto
      .createHash('sha1')
      .update(`${req.params.id}:${new Date(row.updated_at).getTime()}`)
      .digest('hex')}"`;

    res.set('ETag', etag);
    res.set('Cache-Control', 'private, max-age=0, must-revalidate');
    if (req.headers['if-none-match'] === etag) return res.status(304).end();

    res.type(row.mime).send(row.bytes);
  })
);

module.exports = router;
