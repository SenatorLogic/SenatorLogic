'use strict';

// Executive offices, in the order they appear on the home page.
// rank 0 is reserved for ordinary members (no office).
const OFFICES = [
  { rank: 1, name: 'President' },
  { rank: 2, name: 'Vice President' },
  { rank: 3, name: 'General Secretary' },
  { rank: 4, name: 'Assistant Secretary' },
  { rank: 5, name: 'Treasurer' },
  { rank: 6, name: 'Financial Secretary' },
  { rank: 7, name: 'Welfare Officer' },
  { rank: 8, name: 'Public Relations Officer' },
  { rank: 9, name: 'Provost' },
  { rank: 10, name: 'Ex-Officio' },
];

const OFFICE_RANK = new Map(OFFICES.map((o) => [o.name, o.rank]));

const RELATIONSHIP_STATUSES = [
  'Single',
  'In a relationship',
  'Engaged',
  'Married',
  'Widowed',
  'Prefer not to say',
];

const GENDERS = ['Male', 'Female'];

// The eleven autonomous communities of Obowo LGA, Imo State.
const OBOWO_COMMUNITIES = [
  'Alike',
  'Amainyi',
  'Amanze',
  'Amuzi',
  'Avutu',
  'Ehume',
  'Odenkume',
  'Okenalogho',
  'Umuariam',
  'Umungwa',
  'Umulogho',
];

module.exports = {
  OFFICES,
  OFFICE_RANK,
  RELATIONSHIP_STATUSES,
  GENDERS,
  OBOWO_COMMUNITIES,
};
