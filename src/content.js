'use strict';

const { one, all, query } = require('./db');

const POST_COLUMNS = `
  p.id, p.title, p.body, p.published_at, p.updated_at,
  u.full_name AS author_name, u.id AS author_id
`;

const EVENT_COLUMNS = `
  e.id, e.title, e.description, e.starts_on, e.starts_at, e.location,
  e.created_at, u.full_name AS created_by_name
`;

const POST_FROM = `FROM posts p LEFT JOIN users u ON u.id = p.author_id`;
const EVENT_FROM = `FROM events e LEFT JOIN users u ON u.id = e.created_by`;

const today = () => new Date().toISOString().slice(0, 10);

const latestPosts = (limit = 3) =>
  all(
    `SELECT ${POST_COLUMNS} ${POST_FROM}
     ORDER BY p.published_at DESC, p.id DESC LIMIT $1`,
    [limit]
  );

const allPosts = () =>
  all(`SELECT ${POST_COLUMNS} ${POST_FROM} ORDER BY p.published_at DESC, p.id DESC`);

const getPost = (id) =>
  one(`SELECT ${POST_COLUMNS} ${POST_FROM} WHERE p.id = $1`, [id]);

const createPost = (title, body, authorId) =>
  query('INSERT INTO posts (title, body, author_id) VALUES ($1, $2, $3)', [
    title,
    body,
    authorId,
  ]);

const updatePost = (id, title, body) =>
  query(
    'UPDATE posts SET title = $1, body = $2, updated_at = NOW() WHERE id = $3',
    [title, body, id]
  );

const deletePost = (id) => query('DELETE FROM posts WHERE id = $1', [id]);

const upcomingEvents = (limit = 3) =>
  all(
    `SELECT ${EVENT_COLUMNS} ${EVENT_FROM}
     WHERE e.starts_on >= $1
     ORDER BY e.starts_on, e.starts_at LIMIT $2`,
    [today(), limit]
  );

const pastEvents = (limit = 20) =>
  all(
    `SELECT ${EVENT_COLUMNS} ${EVENT_FROM}
     WHERE e.starts_on < $1
     ORDER BY e.starts_on DESC, e.starts_at DESC LIMIT $2`,
    [today(), limit]
  );

const allEvents = () =>
  all(`SELECT ${EVENT_COLUMNS} ${EVENT_FROM} ORDER BY e.starts_on DESC, e.starts_at DESC`);

const getEvent = (id) =>
  one(`SELECT ${EVENT_COLUMNS} ${EVENT_FROM} WHERE e.id = $1`, [id]);

const createEvent = (e, userId) =>
  query(
    `INSERT INTO events (title, description, starts_on, starts_at, location, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [e.title, e.description, e.starts_on, e.starts_at, e.location, userId]
  );

const updateEvent = (id, e) =>
  query(
    `UPDATE events SET
       title = $1, description = $2, starts_on = $3, starts_at = $4,
       location = $5, updated_at = NOW()
     WHERE id = $6`,
    [e.title, e.description, e.starts_on, e.starts_at, e.location, id]
  );

const deleteEvent = (id) => query('DELETE FROM events WHERE id = $1', [id]);

module.exports = {
  latestPosts,
  allPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  upcomingEvents,
  pastEvents,
  allEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
};
