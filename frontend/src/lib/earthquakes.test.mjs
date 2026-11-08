/**
 * NE list must never include events outside the Northeast India bbox.
 * Regression: min-backfill used to pad NE with USGS global/US events.
 */
import assert from 'node:assert/strict';
import { isInNeBbox, filterNeEvents } from './earthquakes.js';

const padded = [
  { id: 'ne1', lat: 27.0, lon: 96.8, place: 'Sarupathar, India', time: 2 },
  { id: 'us1', lat: 33.66, lon: -116.75, place: 'Idyllwild, CA', time: 3 },
  { id: 'us2', lat: 19.11, lon: -155.49, place: 'Hawaii', time: 4 },
];

assert.ok(padded.some((e) => !isInNeBbox(e)), 'fixture includes US events');

const regionalOnly = filterNeEvents(padded);
assert.deepEqual(
  regionalOnly.map((e) => e.id),
  ['ne1'],
  'NE filter must drop US/Hawaii padding',
);

assert.equal(isInNeBbox({ lat: 26.14, lon: 91.73 }), true);
assert.equal(isInNeBbox({ lat: 33.66, lon: -116.75 }), false);

console.log('earthquakes.test.mjs: PASS');
