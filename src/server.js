'use strict';

const path = require('node:path');

const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);

const { pool, migrate } = require('./db');
const { attachUser } = require('./auth');
const csrf = require('./csrf');
const { ensureFirstAdmin } = require('./bootstrap');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const IN_PRODUCTION = process.env.NODE_ENV === 'production';

// Behind Render/Fly/Nginx the secure cookie needs the forwarded proto.
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// Formatting helpers every template can reach.
Object.assign(app.locals, require('./format'));
app.locals.siteName = 'OBA Youth Abuja';
app.locals.orgName = 'Obowo Believers Association';

app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(
  express.static(path.join(__dirname, '..', 'public'), {
    maxAge: IN_PRODUCTION ? '7d' : 0,
  })
);

if (IN_PRODUCTION && !process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET must be set in production.');
  process.exit(1);
}

app.use(
  session({
    name: 'oba.sid',
    secret: process.env.SESSION_SECRET || 'dev-only-insecure-secret',
    store: new PgSession({ pool, tableName: 'session', createTableIfMissing: false }),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: IN_PRODUCTION,
      maxAge: 14 * 24 * 60 * 60 * 1000,
    },
  })
);

// --- Flash messages ---------------------------------------------------------
app.use((req, res, next) => {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

// The view locals must be in place before anything can render a page — the
// CSRF rejection page below is a page like any other.
app.use(csrf.issueToken);
app.use(attachUser);
app.use(csrf.guard);

// --- Routes -----------------------------------------------------------------
app.use('/', require('./routes/pages'));
app.use('/', require('./routes/auth-routes'));
app.use('/', require('./routes/profile'));
app.use('/admin', require('./routes/admin'));

app.get('/healthz', (req, res) => res.type('text').send('ok'));

app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page not found',
    message: 'That page does not exist.',
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).render('error', {
    title: status === 413 ? 'File too large' : 'Something went wrong',
    message:
      err.expose && err.message
        ? err.message
        : 'We could not complete that request. Please try again.',
  });
});

async function start() {
  await migrate();
  await ensureFirstAdmin();
  app.listen(PORT, () => {
    console.log(`OBA Youth Abuja running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Could not start:', err.message);
    process.exit(1);
  });
}

module.exports = app;
module.exports.start = start;
