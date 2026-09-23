'use strict';

const multer = require('multer');
const { db } = require('./db');

const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: 1 },
  fileFilter(req, file, cb) {
    if (ALLOWED_IMAGE_TYPES.has(file.mimetype)) return cb(null, true);
    cb(new Error('Photos must be a JPG, PNG or WEBP image.'));
  },
});

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Confirms the bytes really are the image type the browser claimed. */
function sniffImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.subarray(0, 8).equals(PNG_MAGIC)) return 'image/png';
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

const stmts = {
  save: db.prepare(`
    INSERT INTO photos (user_id, mime, bytes, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      mime = excluded.mime, bytes = excluded.bytes, updated_at = excluded.updated_at
  `),
  remove: db.prepare('DELETE FROM photos WHERE user_id = ?'),
  exists: db.prepare('SELECT 1 AS ok FROM photos WHERE user_id = ?'),
};

const savePhoto = (userId, mime, bytes) => stmts.save.run(userId, mime, bytes);
const deletePhoto = (userId) => stmts.remove.run(userId);
const hasPhoto = (userId) => Boolean(stmts.exists.get(userId));

/**
 * Runs the single-file upload without letting a bad file abort the request —
 * the route re-renders its form with `req.uploadError` instead.
 */
function acceptPhoto(req, res, next) {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      req.uploadError =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'That photo is larger than 4 MB. Please choose a smaller one.'
          : err.message || 'That photo could not be uploaded.';
    }
    next();
  });
}

/**
 * Applies the photo part of a submitted profile form.
 * Returns an error message, or null when there was nothing wrong.
 */
function applyPhotoChange(req, userId) {
  if (req.uploadError) return req.uploadError;

  if (req.file) {
    const mime = sniffImageType(req.file.buffer);
    if (!mime) return 'That file is not a valid JPG, PNG or WEBP image.';
    savePhoto(userId, mime, req.file.buffer);
  } else if (req.body.remove_photo === 'yes') {
    deletePhoto(userId);
  }
  return null;
}

module.exports = {
  acceptPhoto,
  applyPhotoChange,
  savePhoto,
  deletePhoto,
  hasPhoto,
  sniffImageType,
  MAX_PHOTO_BYTES,
};
