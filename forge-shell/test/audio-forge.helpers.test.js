'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('../app/js/audio-forge.helpers.js');

test('formatDuration: zero seconds', () => {
  assert.equal(helpers.formatDuration(0), '0:00');
});

test('formatDuration: under a minute', () => {
  assert.equal(helpers.formatDuration(7), '0:07');
  assert.equal(helpers.formatDuration(59), '0:59');
});

test('formatDuration: minutes and seconds', () => {
  assert.equal(helpers.formatDuration(60), '1:00');
  assert.equal(helpers.formatDuration(258), '4:18');
  assert.equal(helpers.formatDuration(3599), '59:59');
});

test('formatDuration: hours', () => {
  assert.equal(helpers.formatDuration(3600), '1:00:00');
  assert.equal(helpers.formatDuration(3661), '1:01:01');
  assert.equal(helpers.formatDuration(36015), '10:00:15');
});

test('formatDuration: rejects negative and non-finite', () => {
  assert.equal(helpers.formatDuration(-5), '0:00');
  assert.equal(helpers.formatDuration(NaN), '0:00');
  assert.equal(helpers.formatDuration(Infinity), '0:00');
});

test('formatTimestamp: ISO date and time', () => {
  // Format: YYYY-MM-DD HH:MM
  assert.equal(
    helpers.formatTimestamp('2026-05-08T14:32:15Z'),
    '2026-05-08 14:32',
  );
});

test('formatTimestamp: invalid input returns empty string', () => {
  assert.equal(helpers.formatTimestamp(''), '');
  assert.equal(helpers.formatTimestamp('not-a-date'), '');
  assert.equal(helpers.formatTimestamp(null), '');
});

test('deriveTitle: from RFC3339 timestamp', () => {
  assert.equal(
    helpers.deriveTitle('2026-05-08T14:32:00Z'),
    'Recording 2026-05-08 14:32',
  );
});

test('deriveTitle: handles missing input', () => {
  assert.match(helpers.deriveTitle(''), /^Recording /);
});

test('parseFrontmatter: typical recording', () => {
  const md = [
    '---',
    'id: 2026-05-08T143200',
    'type: recording',
    'title: Sprint standup',
    'created: 2026-05-08T14:32:00',
    'duration_seconds: 258',
    'transcript_status: transcribed',
    'sources:',
    '  - system',
    '  - mic',
    'audio_files:',
    '  system: audio-forge/audio/2026-05-08T143200.system.wav',
    '  mic: audio-forge/audio/2026-05-08T143200.mic.wav',
    '---',
    '',
    '# Sprint standup',
    '',
    '**System**: Hello team.',
    '**You**: Hi.',
    '',
  ].join('\n');
  const { frontmatter, body } = helpers.parseFrontmatter(md);
  assert.equal(frontmatter.id, '2026-05-08T143200');
  assert.equal(frontmatter.title, 'Sprint standup');
  assert.equal(frontmatter.duration_seconds, 258);
  assert.equal(frontmatter.transcript_status, 'transcribed');
  assert.deepEqual(frontmatter.sources, ['system', 'mic']);
  assert.deepEqual(frontmatter.audio_files, {
    system: 'audio-forge/audio/2026-05-08T143200.system.wav',
    mic: 'audio-forge/audio/2026-05-08T143200.mic.wav',
  });
  assert.match(body, /\*\*System\*\*: Hello team\./);
});

test('parseFrontmatter: missing frontmatter delimiters', () => {
  const result = helpers.parseFrontmatter('# Just a body\n');
  assert.deepEqual(result.frontmatter, {});
  assert.equal(result.body, '# Just a body\n');
});

test('parseFrontmatter: integer-looking strings stay strings if quoted', () => {
  const md = '---\nid: "2026"\nduration_seconds: 42\n---\nbody';
  const { frontmatter } = helpers.parseFrontmatter(md);
  assert.equal(frontmatter.id, '2026');
  assert.equal(frontmatter.duration_seconds, 42);
});

test('statusBadge: maps each status to label + class', () => {
  assert.deepEqual(helpers.statusBadge('transcribed'), {
    label: 'transcribed', icon: 'fa-circle-check', cls: 'af-status-ok',
  });
  assert.deepEqual(helpers.statusBadge('failed'), {
    label: 'failed', icon: 'fa-triangle-exclamation', cls: 'af-status-failed',
  });
  assert.deepEqual(helpers.statusBadge('pending'), {
    label: 'pending', icon: 'fa-circle-pause', cls: 'af-status-pending',
  });
  assert.deepEqual(helpers.statusBadge('transcribing'), {
    label: 'transcribing', icon: 'fa-hourglass-half', cls: 'af-status-progress',
  });
  // Unknown status falls back to pending
  assert.equal(helpers.statusBadge('weird-status').cls, 'af-status-pending');
  assert.equal(helpers.statusBadge(undefined).cls, 'af-status-pending');
});
