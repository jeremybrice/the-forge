const test = require('node:test');
const assert = require('node:assert');

// Inline copy of the helper under test. Keep this in sync with the
// implementation in audio-forge.js. Both intentionally do the same thing —
// the test exists to lock down the contract.
function normalizeDeviceList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((d) => d && typeof d.uid === 'string' && typeof d.name === 'string')
    .map((d) => ({
      uid: d.uid,
      name: d.name,
      isDefault: !!d.isDefault,
      channels: Number.isFinite(d.channels) ? d.channels : 0,
    }));
}

test('normalizes a valid device list', () => {
  const out = normalizeDeviceList([
    { uid: 'a', name: 'Mic A', isDefault: true, channels: 1 },
    { uid: 'b', name: 'Mic B', isDefault: false, channels: 2 },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].uid, 'a');
  assert.equal(out[0].isDefault, true);
  assert.equal(out[1].channels, 2);
});

test('drops malformed entries', () => {
  const out = normalizeDeviceList([
    { uid: 'a', name: 'Mic A' },
    { uid: 123, name: 'Mic Bad' },     // uid not a string
    null,
    { name: 'No UID' },                // missing uid
    { uid: 'c', name: 'Mic C', isDefault: false, channels: 'three' }, // bad channels
  ]);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((d) => d.uid), ['a', 'c']);
  assert.equal(out[1].channels, 0); // bad channels coerced to 0
});

test('returns empty for non-array input', () => {
  assert.deepEqual(normalizeDeviceList(null), []);
  assert.deepEqual(normalizeDeviceList('oops'), []);
  assert.deepEqual(normalizeDeviceList({}), []);
});
