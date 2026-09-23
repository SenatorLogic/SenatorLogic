'use strict';

const {
  OFFICE_RANK,
  RELATIONSHIP_STATUSES,
  GENDERS,
  OBOWO_COMMUNITIES,
} = require('./constants');

const trim = (value, max) => String(value ?? '').trim().slice(0, max);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function normaliseEmail(value) {
  return trim(value, 254).toLowerCase();
}

function isValidEmail(value) {
  return EMAIL_RE.test(value);
}

/** Accepts YYYY-MM-DD from <input type="date"> and rejects impossible dates. */
function normaliseBirthday(value) {
  const raw = trim(value, 10);
  if (!raw) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return '';
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const valid =
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d &&
    y >= 1900 &&
    date.getTime() <= Date.now();
  return valid ? raw : '';
}

/** Any calendar date (past or future) from <input type="date">. */
function normaliseDate(value) {
  const raw = trim(value, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return '';
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const valid =
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d &&
    y >= 1900 &&
    y <= 2200;
  return valid ? raw : '';
}

/** HH:MM from <input type="time">. */
function normaliseTime(value) {
  const raw = trim(value, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : '';
}

/** Cleans the fields of an event an administrator creates. */
function cleanEvent(body) {
  return {
    title: trim(body.title, 160),
    description: trim(body.description, 4000),
    starts_on: normaliseDate(body.starts_on),
    starts_at: normaliseTime(body.starts_at),
    location: trim(body.location, 200),
  };
}

/** Cleans a news post. */
function cleanPost(body) {
  return {
    title: trim(body.title, 160),
    body: trim(body.body, 20000),
  };
}

const oneOf = (value, allowed) => (allowed.includes(value) ? value : '');

/** Cleans the profile fields a member may edit about themselves. */
function cleanProfile(body) {
  return {
    full_name: trim(body.full_name, 120),
    phone: trim(body.phone, 30),
    gender: oneOf(trim(body.gender, 20), GENDERS),
    occupation: trim(body.occupation, 120),
    address: trim(body.address, 300),
    obowo_address: trim(body.obowo_address, 300),
    relationship_status: oneOf(
      trim(body.relationship_status, 40),
      RELATIONSHIP_STATUSES
    ),
    birthday: normaliseBirthday(body.birthday),
    about: trim(body.about, 1000),
  };
}

/** Executive office, settable by an administrator only. '' means plain member. */
function cleanOffice(value) {
  const name = trim(value, 60);
  if (!OFFICE_RANK.has(name)) return { office: '', office_rank: 0 };
  return { office: name, office_rank: OFFICE_RANK.get(name) };
}

module.exports = {
  trim,
  normaliseEmail,
  isValidEmail,
  normaliseBirthday,
  normaliseDate,
  normaliseTime,
  cleanProfile,
  cleanOffice,
  cleanEvent,
  cleanPost,
  OBOWO_COMMUNITIES,
};
