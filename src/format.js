'use strict';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Postgres hands back a Date for timestamp columns and a plain string for the
 * date columns kept as text, so every helper normalises first.
 */
function isoDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  }
  return String(value || '');
}

/** "25 December 2026" from a date. */
function formatDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate(value));
  if (!match) return '';
  const [, y, m, d] = match;
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

/** "DEC" from a YYYY-MM-DD string, for the date chip on event cards. */
function monthAbbr(value) {
  const match = /^\d{4}-(\d{2})-/.exec(isoDate(value));
  return match ? MONTHS[Number(match[1]) - 1].slice(0, 3) : '';
}

/** "25" from a YYYY-MM-DD string. */
function dayOfMonth(value) {
  const match = /^\d{4}-\d{2}-(\d{2})/.exec(isoDate(value));
  return match ? String(Number(match[1])) : '';
}

/** Birthdays show the day and month only — members keep their year private. */
function formatBirthday(value) {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(isoDate(value));
  if (!match) return '';
  const [, m, d] = match;
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

/** "7:30 pm" from a 24-hour HH:MM string. */
function formatTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match) return '';
  const hour = Number(match[1]);
  const suffix = hour < 12 ? 'am' : 'pm';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${match[2]} ${suffix}`;
}

/** Up to two initials, for the placeholder avatar. */
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : ''))
    .toUpperCase();
}

/** Keeps a plain-text post readable in HTML: paragraphs from blank lines. */
function paragraphs(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

/** True when the event date is today or later. */
function isUpcoming(startsOn) {
  return isoDate(startsOn) >= new Date().toISOString().slice(0, 10);
}

module.exports = {
  formatDate,
  monthAbbr,
  dayOfMonth,
  formatBirthday,
  formatTime,
  initials,
  paragraphs,
  isUpcoming,
};
