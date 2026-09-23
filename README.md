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

Needs **Node.js 22.5 or newer** (it uses Node's built-in SQLite, so there is
nothing to compile and no database server to install).

```bash
npm install
cp .env.example .env     # then set SESSION_SECRET
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

With the server running on port 3311:

```bash
PORT=3311 npm start &
BASE=http://localhost:3311 ./test/smoke.sh
```

It exercises registration, sign-in, CSRF protection, photo upload and
validation, admin permissions, the last-administrator safeguard, news, events,
directory search and sign-out.

## Configuration

Everything is set through environment variables — see `.env.example`.

| Variable | Purpose |
| --- | --- |
| `SESSION_SECRET` | Signs session cookies. **Required in production**; the server refuses to start without it. |
| `PORT` | Port to listen on. Default `3000`. |
| `NODE_ENV` | Set to `production` when deployed. Turns on secure cookies. |
| `DATABASE_FILE` | Where the SQLite file lives. Default `./data/oba.db`. |
| `ADMIN_EMAIL` | This account is made an administrator each time the server starts — a way back in if admin access is ever lost. |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Hosting

All member data, including photos, lives in one SQLite file. **The host must
give that file a persistent disk**, or everything is lost on each redeploy.

Three ready-made options are included:

- **Render** — `render.yaml` is a blueprint. Create a new Blueprint instance
  from this repository; it provisions a 1 GB disk at `/var/data` and generates
  `SESSION_SECRET` for you. Needs the Starter plan or above, because the free
  plan has no persistent disk.
- **Fly.io** — `fly.toml` plus the `Dockerfile`. The comments at the top of
  `fly.toml` list the four commands.
- **Any Docker host** — build the image and mount a volume at `/data`:

  ```bash
  docker build -t oba-youth .
  docker run -p 3000:3000 -v oba-data:/data \
    -e SESSION_SECRET="$(node -e 'console.log(require("crypto").randomBytes(48).toString("hex"))')" \
    oba-youth
  ```

Put the app behind HTTPS. It sets `trust proxy`, so a normal reverse proxy or
platform router works as-is.

### Backing up

The whole database is one file. To copy it off a running server:

```bash
sqlite3 /var/data/oba.db ".backup '/tmp/oba-backup.db'"
```

Keep those backups somewhere off the server — they contain members' personal
details.

## How it is built

No build step, no framework, no native dependencies.

- **Express 4** with **EJS** templates rendered on the server
- **SQLite** through Node's built-in `node:sqlite`
- **bcryptjs** for password hashing
- **multer** for photo uploads, held in memory and written into the database
- Sessions kept in SQLite through a small custom store, so members stay signed
  in across restarts

```
src/
  server.js        app setup, middleware order, error handling
  db.js            database file and schema
  auth.js          password hashing, the signed-in user, route guards
  csrf.js          per-session form tokens
  session-store.js SQLite-backed session store
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
- Search terms are escaped before they reach a SQL `LIKE`, and every query
  uses bound parameters.
- Member photos are private to signed-in members; only executives' photos are
  public, because they appear on the home page.
- Birthdays display the day and month only — the year is never shown.
- The last remaining administrator cannot be deleted or demoted.
