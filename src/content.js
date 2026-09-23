'use strict';

const { db } = require('./db');

const POST_COLUMNS = `
  p.id, p.title, p.body, p.published_at, p.updated_at,
  u.full_name AS author_name, u.id AS author_id
`;

const EVENT_COLUMNS = `
  e.id, e.title, e.description, e.starts_on, e.starts_at, e.location,
  e.created_at, u.full_name AS created_by_name
`;

const stmts = {
  latestPosts: db.prepare(`
    SELECT ${POST_COLUMNS} FROM posts p
    LEFT JOIN users u ON u.id = p.author_id
    ORDER BY p.published_at DESC, p.id DESC LIMIT ?
  `),
  allPosts: db.prepare(`
    SELECT ${POST_COLUMNS} FROM posts p
    LEFT JOIN users u ON u.id = p.author_id
    ORDER BY p.published_at DESC, p.id DESC
  `),
  post: db.prepare(`
    SELECT ${POST_COLUMNS} FROM posts p
    LEFT JOIN users u ON u.id = p.author_id
    WHERE p.id = ?
  `),
  insertPost: db.prepare(
    'INSERT INTO posts (title, body, author_id) VALUES (?, ?, ?)'
  ),
  updatePost: db.prepare(
    "UPDATE posts SET title = ?, body = ?, updated_at = datetime('now') WHERE id = ?"
  ),
  deletePost: db.prepare('DELETE FROM posts WHERE id = ?'),

  upcomingEvents: db.prepare(`
    SELECT ${EVENT_COLUMNS} FROM events e
    LEFT JOIN users u ON u.id = e.created_by
    WHERE e.starts_on >= ?
    ORDER BY e.starts_on ASC, e.starts_at ASC LIMIT ?
  `),
  pastEvents: db.prepare(`
    SELECT ${EVENT_COLUMNS} FROM events e
    LEFT JOIN users u ON u.id = e.created_by
    WHERE e.starts_on < ?
    ORDER BY e.starts_on DESC, e.starts_at DESC LIMIT ?
  `),
  allEvents: db.prepare(`
    SELECT ${EVENT_COLUMNS} FROM events e
    LEFT JOIN users u ON u.id = e.created_by
    ORDER BY e.starts_on DESC, e.starts_at DESC
  `),
  event: db.prepare(`
    SELECT ${EVENT_COLUMNS} FROM events e
    LEFT JOIN users u ON u.id = e.created_by
    WHERE e.id = ?
  `),
  insertEvent: db.prepare(`
    INSERT INTO events (title, description, starts_on, starts_at, location, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  updateEvent: db.prepare(`
    UPDATE events SET
      title = ?, description = ?, starts_on = ?, starts_at = ?, location = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `),
  deleteEvent: db.prepare('DELETE FROM events WHERE id = ?'),
};

const today = () => new Date().toISOString().slice(0, 10);

module.exports = {
  latestPosts: (limit = 3) => stmts.latestPosts.all(limit),
  allPosts: () => stmts.allPosts.all(),
  getPost: (id) => stmts.post.get(id) || null,
  createPost: (title, body, authorId) =>
    stmts.insertPost.run(title, body, authorId),
  updatePost: (id, title, body) => stmts.updatePost.run(title, body, id),
  deletePost: (id) => stmts.deletePost.run(id),

  upcomingEvents: (limit = 3) => stmts.upcomingEvents.all(today(), limit),
  pastEvents: (limit = 20) => stmts.pastEvents.all(today(), limit),
  allEvents: () => stmts.allEvents.all(),
  getEvent: (id) => stmts.event.get(id) || null,
  createEvent: (e, userId) =>
    stmts.insertEvent.run(e.title, e.description, e.starts_on, e.starts_at, e.location, userId),
  updateEvent: (id, e) =>
    stmts.updateEvent.run(e.title, e.description, e.starts_on, e.starts_at, e.location, id),
  deleteEvent: (id) => stmts.deleteEvent.run(id),
};
