# OBA Youth Abuja

Member database and noticeboard for **OBA Youth Abuja** — the Abuja youth
chapter of the **Obowo Believers Association**.

Members sign up, build a profile with their photo and details, and find one
another in the directory. The executives appear on the home page, and
administrators post news and upcoming events.

It is a web app: it opens in any phone or laptop browser, and it can be
installed to a phone's home screen (it ships a web app manifest and a service
worker), so it behaves like an app without going through an app store.

## What it does

**For members**
- Create an account and sign in
- A profile with photo, name, job, phone, gender, address in Abuja, home
  address in Obowo, relationship status, birthday and a short bio
- Browse and search the member directory
- See whose birthday falls this month
- Change their own password

**On the home page (public)**
- The executive team — President, Vice President, General Secretary,
  Assistant Secretary, Treasurer, Financial Secretary, Welfare Officer,
  PRO, Provost and Ex-Officio — each with their office, name and photo
- Upcoming events
- The latest news and updates

**For administrators**
- Open and edit *any* member's profile, including their photo
- Assign or remove executive offices
- Grant or withdraw administrator rights
- Remove members
- Post, edit and delete news and updates
- Add, edit and delete events

The first person to register becomes the administrator. After that, an
administrator grants the rights to anyone else.

## Running it locally

Needs **Node.js 20 or newer** and a Postgres database. The free one from
[Neon](https://neon.tech) works for local development too — no need to install
Postgres on your machine.

```bash
npm install
cp .env.example .env     # then set DATABASE_URL and SESSION_SECRET
npm start                # http://localhost:3000
```

Open the site and register — that first account is the administrator.

To look at it with example data instead:

```bash
npm run seed             # adds four executives, one update and one event
```

The seed script prints the sign-in details and refuses to run if the database
already has members.

## Tests

With the server running on port 3311, pointed at a database you don't mind
emptying:

```bash
DATABASE_URL=... PORT=3311 npm start &
BASE=http://localhost:3311 ./test/smoke.sh
```

It exercises registration, sign-in, CSRF protection, photo upload and
validation, admin permissions, the last-administrator safeguard, news, events,
directory search and sign-out.

## Configuration

Everything is set through environment variables — see `.env.example`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. **Required** — the server refuses to start without it. |
| `SESSION_SECRET` | Signs session cookies. **Required in production**; the server refuses to start without it. |
| `PORT` | Port to listen on. Default `3000`. |
| `NODE_ENV` | Set to `production` when deployed. Turns on secure cookies. |
| `ADMIN_EMAIL` | This account is made an administrator each time the server starts — a way back in if admin access is ever lost. |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Hosting — free

The app keeps no data on its own disk, so it can run on a free host that wipes
its filesystem on every restart. Everything lives in Postgres.

**1. Create the database (free, no card).**
Sign up at [neon.tech](https://neon.tech) with GitHub, create a project, and
copy the **pooled** connection string. It looks like:

```
postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require
```

**2. Deploy the app (free, no card).**
Sign up at [render.com](https://render.com) with GitHub, then
**New → Blueprint** and pick this repository. Render reads `render.yaml`,
creates the service on the free plan and asks for two values:

- `DATABASE_URL` — the Neon string from step 1
- `ADMIN_EMAIL` — your email, so you stay an administrator after any redeploy

It generates `SESSION_SECRET` by itself. The tables are created automatically
the first time the app starts.

**3. Register.** Open the site and sign up. The first account is the
administrator.

### What "free" costs you

- **The app sleeps.** After about 15 minutes with no visitors, Render stops the
  free instance. The next person to open the site waits roughly 30–50 seconds
  while it wakes up; after that it is fast until it goes quiet again.
- **Neon's free database** pauses when idle too, and wakes in a second or two.
  It gives 0.5 GB of storage — enough for thousands of members with photos.

Upgrading later is a plan change on Render, not a rebuild. Nothing in the code
changes and no data moves.

### Other hosts

`Dockerfile` and `fly.toml` are included if you would rather use
[Fly.io](https://fly.io) (roughly $3/month, no sleeping) or any Docker host.
Set `DATABASE_URL` and `SESSION_SECRET` and it runs.

### Backing up

Neon keeps its own point-in-time backups, but take your own copies too:

```bash
pg_dump "$DATABASE_URL" > oba-backup.sql
```

Keep them somewhere off the server — they contain members' personal details.

## How it is built

No build step, no framework, no native dependencies.

- **Express 4** with **EJS** templates rendered on the server
- **Postgres** through `pg`, with the schema created on first boot
- **bcryptjs** for password hashing
- **multer** for photo uploads, held in memory and written into the database
- Sessions kept in Postgres (`connect-pg-simple`), so members stay signed in
  across restarts and redeploys

```
src/
  server.js        app setup, middleware order, error handling
  db.js            connection pool, schema and query helpers
  auth.js          password hashing, the signed-in user, route guards
  csrf.js          per-session form tokens
  members.js       member queries shared by the member and admin routes
  content.js       news and event queries
  photo.js         upload handling and image sniffing
  validate.js      cleans and checks every submitted field
  format.js        date, time and name helpers for the templates
  constants.js     offices, relationship statuses, Obowo communities
  bootstrap.js     first-administrator handling
  seed.js          optional demo data
  routes/          pages, auth-routes, profile, admin
views/             EJS templates and partials
public/            stylesheet, client script, logo, icons, manifest
test/smoke.sh      end-to-end checks
```

### Security notes

- Passwords are hashed with bcrypt at cost 12 and never leave the database;
  no query that feeds a template selects the hash.
- Every form carries a per-session CSRF token, checked on all POSTs.
- The session id is regenerated on sign-in and sign-up.
- Uploaded photos are checked against their real magic bytes, not the
  browser's claimed type, and capped at 4 MB.
- Search terms are escaped before they reach a SQL `ILIKE`, and every query
  uses bound parameters.
- Member photos are private to signed-in members; only executives' photos are
  public, because they appear on the home page.
- Birthdays display the day and month only — the year is never shown.
- The last remaining administrator cannot be deleted or demoted.
