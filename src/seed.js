'use strict';

/**
 * Fills an empty database with an example executive team, a news post and an
 * event, so the site can be demonstrated before real members sign up.
 *
 * Run with: npm run seed
 * It refuses to touch a database that already has members.
 */

const bcrypt = require('bcryptjs');
const { pool, one, query, migrate } = require('./db');
const { OFFICE_RANK } = require('./constants');

const DEMO_PASSWORD = process.env.SEED_PASSWORD || 'changeme123';

const PEOPLE = [
  {
    full_name: 'Chidi Okoro',
    email: 'president@obayouthabuja.example',
    office: 'President',
    occupation: 'Civil Engineer',
    obowo_address: 'Umuariam, Obowo LGA, Imo State',
    address: 'Gwarinpa, Abuja',
    relationship_status: 'Married',
    birthday: '1990-04-18',
    gender: 'Male',
    is_admin: true,
  },
  {
    full_name: 'Ngozi Eze',
    email: 'secretary@obayouthabuja.example',
    office: 'General Secretary',
    occupation: 'Teacher',
    obowo_address: 'Alike, Obowo LGA, Imo State',
    address: 'Kubwa, Abuja',
    relationship_status: 'Single',
    birthday: '1994-09-02',
    gender: 'Female',
    is_admin: false,
  },
  {
    full_name: 'Emeka Nwosu',
    email: 'treasurer@obayouthabuja.example',
    office: 'Treasurer',
    occupation: 'Accountant',
    obowo_address: 'Amuzi, Obowo LGA, Imo State',
    address: 'Wuse Zone 3, Abuja',
    relationship_status: 'Engaged',
    birthday: '1992-12-11',
    gender: 'Male',
    is_admin: false,
  },
  {
    full_name: 'Adaeze Iheanacho',
    email: 'welfare@obayouthabuja.example',
    office: 'Welfare Officer',
    occupation: 'Nurse',
    obowo_address: 'Avutu, Obowo LGA, Imo State',
    address: 'Lugbe, Abuja',
    relationship_status: 'Married',
    birthday: '1991-06-25',
    gender: 'Female',
    is_admin: false,
  },
];

async function main() {
  await migrate();

  const existing = Number((await one('SELECT COUNT(*)::int AS n FROM users')).n);
  if (existing > 0) {
    console.error(
      `Refusing to seed: the database already has ${existing} member(s).\n` +
        'Only an empty database can be seeded with demo data.'
    );
    process.exit(1);
  }

  const hash = bcrypt.hashSync(DEMO_PASSWORD, 12);

  for (const p of PEOPLE) {
    await query(
      `INSERT INTO users (
         email, password_hash, full_name, gender, occupation, address,
         obowo_address, relationship_status, birthday, office, office_rank, is_admin
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        p.email,
        hash,
        p.full_name,
        p.gender,
        p.occupation,
        p.address,
        p.obowo_address,
        p.relationship_status,
        p.birthday,
        p.office,
        OFFICE_RANK.get(p.office) || 0,
        p.is_admin,
      ]
    );
  }

  const admin = await one('SELECT id FROM users WHERE is_admin ORDER BY id LIMIT 1');

  await query('INSERT INTO posts (title, body, author_id) VALUES ($1, $2, $3)', [
    'Welcome to the new OBA Youth Abuja site',
    'Our chapter now has a proper member register.\n\n' +
      'Please create your profile, add a clear photo, and fill in your ' +
      'community back home in Obowo so we can find one another easily.',
    admin.id,
  ]);

  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  await query(
    `INSERT INTO events (title, description, starts_on, starts_at, location, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      'Monthly general meeting',
      'Our regular monthly gathering. All members are expected to attend.',
      nextMonth.toISOString().slice(0, 10),
      '16:00',
      'Wuse Zone 3, Abuja',
      admin.id,
    ]
  );

  console.log(`Seeded ${PEOPLE.length} executives, 1 update and 1 event.`);
  console.log(`Sign in with ${PEOPLE[0].email} and the password: ${DEMO_PASSWORD}`);
  console.log('Change that password as soon as you sign in.');
  await pool.end();
}

main().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
