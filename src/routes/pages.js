'use strict';

const crypto = require('node:crypto');
const path = require('node:path');

const express = require('express');

const { db } = require('../db');
const { requireLogin, PUBLIC_COLUMNS } = require('../auth');
const { OFFICES } = require('../constants');
const content = require('../content');

const router = express.Router();

const stmts = {
  executives: db.prepare(`
    SELECT ${PUBLIC_COLUMNS} FROM users
    WHERE office_rank > 0
    ORDER BY office_rank ASC, full_name ASC
  `),
  memberCount: db.prepare('SELECT COUNT(*) AS n FROM users'),
  member: db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ?`),
  photo: db.prepare(`
    SELECT p.mime, p.bytes, p.updated_at, u.office_rank
    FROM photos p JOIN users u ON u.id = p.user_id
    WHERE p.user_id = ?
  `),
  birthdays: db.prepare(`
    SELECT ${PUBLIC_COLUMNS} FROM users
    WHERE birthday <> '' AND substr(birthday, 6, 2) = ?
    ORDER BY substr(birthday, 9, 2) ASC
  `),
};

/** Makes %, _ and \\ literal inside a LIKE pattern. */
const escapeLike = (value) =>
  String(value).replace(/[\\%_]/g, (char) => `\\${char}`);

function searchMembers({ query, office }) {
  const clauses = [];
  const params = [];

  if (query) {
    const fields = ['full_name', 'occupation', 'obowo_address', 'address', 'office'];
    clauses.push(
      `(${fields.map((f) => `${f} LIKE ? ESCAPE '\\'`).join(' OR ')})`
    );
    const like = `%${escapeLike(query)}%`;
    params.push(...fields.map(() => like));
  }

  if (office === 'executives') {
    clauses.push('office_rank > 0');
  } else if (office) {
    clauses.push('office = ?');
    params.push(office);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db
    .prepare(
      `SELECT ${PUBLIC_COLUMNS} FROM users ${where}
       ORDER BY (office_rank = 0) ASC, office_rank ASC, full_name ASC`
    )
    .all(...params);
}

router.get('/', (req, res) => {
  res.render('home', {
    title: 'OBA Youth Abuja',
    executives: stmts.executives.all(),
    memberCount: stmts.memberCount.get().n,
    news: content.latestPosts(3),
    events: content.upcomingEvents(3),
  });
});

router.get('/news', (req, res) => {
  res.render('news', { title: 'News & updates', posts: content.allPosts() });
});

router.get('/news/:id', (req, res, next) => {
  const post = content.getPost(Number(req.params.id));
  if (!post) return next();
  res.render('post', { title: post.title, post });
});

router.get('/events', (req, res) => {
  res.render('events', {
    title: 'Events',
    upcoming: content.upcomingEvents(50),
    past: content.pastEvents(20),
  });
});

router.get('/events/:id', (req, res, next) => {
  const event = content.getEvent(Number(req.params.id));
  if (!event) return next();
  res.render('event', { title: event.title, event });
});

router.get('/members', requireLogin, (req, res) => {
  const query = String(req.query.q || '').trim().slice(0, 100);
  const office = String(req.query.office || '').trim().slice(0, 60);
  const members = searchMembers({ query, office });

  res.render('members', {
    title: 'Members',
    members,
    query,
    office,
    offices: OFFICES,
  });
});

router.get('/members/:id', requireLogin, (req, res, next) => {
  const member = stmts.member.get(Number(req.params.id));
  if (!member) return next();
  res.render('member', { title: member.full_name, member });
});

router.get('/birthdays', requireLogin, (req, res) => {
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  res.render('birthdays', {
    title: 'Birthdays this month',
    members: stmts.birthdays.all(month),
    monthName: new Date().toLocaleString('en-NG', { month: 'long' }),
  });
});

// Member photos. Executive photos are public because they appear on the home
// page; everyone else's photo is only served to signed-in members.
router.get('/photo/:id', (req, res, next) => {
  const row = stmts.photo.get(Number(req.params.id));
  if (!row) {
    return res.sendFile(path.join(__dirname, '..', '..', 'public', 'img', 'avatar.svg'));
  }
  if (row.office_rank === 0 && !req.user) return next();

  const etag = `"${crypto
    .createHash('sha1')
    .update(`${req.params.id}:${row.updated_at}`)
    .digest('hex')}"`;

  res.set('ETag', etag);
  res.set('Cache-Control', 'private, max-age=0, must-revalidate');
  if (req.headers['if-none-match'] === etag) return res.status(304).end();

  res.type(row.mime).send(Buffer.from(row.bytes));
});

module.exports = router;
