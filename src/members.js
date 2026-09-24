'use strict';

const { one, all, query } = require('./db');
const { PUBLIC_COLUMNS } = require('./auth');
const {
  RELATIONSHIP_STATUSES,
  GENDERS,
  OBOWO_COMMUNITIES,
} = require('./constants');

/** Writes the profile fields a member (or an admin on their behalf) may change. */
function saveProfileFields(userId, p) {
  return query(
    `UPDATE users SET
       full_name = $1, phone = $2, gender = $3, occupation = $4, address = $5,
       obowo_address = $6, relationship_status = $7, birthday = $8, about = $9,
       updated_at = NOW()
     WHERE id = $10`,
    [
      p.full_name,
      p.phone,
      p.gender,
      p.occupation,
      p.address,
      p.obowo_address,
      p.relationship_status,
      p.birthday,
      p.about,
      userId,
    ]
  );
}

/** The dropdown choices every profile form needs. */
const formOptions = {
  relationshipStatuses: RELATIONSHIP_STATUSES,
  genders: GENDERS,
  communities: OBOWO_COMMUNITIES,
};

const getMember = (id) =>
  one(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);

const allMembers = () =>
  all(`SELECT ${PUBLIC_COLUMNS} FROM users
       ORDER BY (office_rank = 0), office_rank, full_name`);

const setOffice = (id, office, rank) =>
  query(
    'UPDATE users SET office = $1, office_rank = $2, updated_at = NOW() WHERE id = $3',
    [office, rank, id]
  );

const setAdmin = (id, isAdmin) =>
  query('UPDATE users SET is_admin = $1, updated_at = NOW() WHERE id = $2', [
    Boolean(isAdmin),
    id,
  ]);

const deleteMember = (id) => query('DELETE FROM users WHERE id = $1', [id]);

const adminCount = async () =>
  Number((await one('SELECT COUNT(*)::int AS n FROM users WHERE is_admin')).n);

const memberCount = async () =>
  Number((await one('SELECT COUNT(*)::int AS n FROM users')).n);

module.exports = {
  saveProfileFields,
  formOptions,
  getMember,
  allMembers,
  setOffice,
  setAdmin,
  deleteMember,
  adminCount,
  memberCount,
};
