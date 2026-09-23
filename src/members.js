'use strict';

const { db } = require('./db');
const { PUBLIC_COLUMNS } = require('./auth');
const {
  RELATIONSHIP_STATUSES,
  GENDERS,
  OBOWO_COMMUNITIES,
} = require('./constants');

const stmts = {
  updateProfile: db.prepare(`
    UPDATE users SET
      full_name = ?, phone = ?, gender = ?, occupation = ?, address = ?,
      obowo_address = ?, relationship_status = ?, birthday = ?, about = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `),
  setOffice: db.prepare(
    "UPDATE users SET office = ?, office_rank = ?, updated_at = datetime('now') WHERE id = ?"
  ),
  setAdmin: db.prepare(
    "UPDATE users SET is_admin = ?, updated_at = datetime('now') WHERE id = ?"
  ),
  byId: db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ?`),
  remove: db.prepare('DELETE FROM users WHERE id = ?'),
  adminCount: db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1'),
  all: db.prepare(`
    SELECT ${PUBLIC_COLUMNS} FROM users
    ORDER BY (office_rank = 0) ASC, office_rank ASC, full_name ASC
  `),
};

/** Writes the profile fields a member (or an admin on their behalf) may change. */
function saveProfileFields(userId, profile) {
  stmts.updateProfile.run(
    profile.full_name,
    profile.phone,
    profile.gender,
    profile.occupation,
    profile.address,
    profile.obowo_address,
    profile.relationship_status,
    profile.birthday,
    profile.about,
    userId
  );
}

/** The dropdown choices every profile form needs. */
const formOptions = {
  relationshipStatuses: RELATIONSHIP_STATUSES,
  genders: GENDERS,
  communities: OBOWO_COMMUNITIES,
};

module.exports = {
  saveProfileFields,
  formOptions,
  getMember: (id) => stmts.byId.get(id) || null,
  allMembers: () => stmts.all.all(),
  setOffice: (id, office, rank) => stmts.setOffice.run(office, rank, id),
  setAdmin: (id, isAdmin) => stmts.setAdmin.run(isAdmin ? 1 : 0, id),
  deleteMember: (id) => stmts.remove.run(id),
  adminCount: () => stmts.adminCount.get().n,
};
