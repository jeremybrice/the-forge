'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { reduce, initialState } = require('../app/js/audio-forge.reducer.js');

const baseEvent = (type, extra = {}) => Object.assign({ type }, extra);

test('initialState shape', () => {
  assert.equal(initialState.status, 'idle');
  assert.equal(initialState.id, null);
  assert.equal(initialState.startedAt, null);
  assert.deepEqual(initialState.files, {});
  assert.deepEqual(initialState.sources, []);
  assert.equal(initialState.elapsed, 0);
  assert.deepEqual(initialState.meter, { system: 0, mic: 0 });
  assert.equal(initialState.error, null);
});

test('idle + RECORD_CLICK → starting', () => {
  const next = reduce(initialState, baseEvent('RECORD_CLICK', {
    sources: ['system', 'mic'],
  }));
  assert.equal(next.status, 'starting');
  assert.deepEqual(next.sources, ['system', 'mic']);
  assert.equal(next.error, null);
});

test('starting + START_OK → recording', () => {
  const s = reduce(initialState, baseEvent('RECORD_CLICK', { sources: ['mic'] }));
  const next = reduce(s, baseEvent('START_OK', {
    id: '2026-05-08T143200',
    startedAt: '2026-05-08T14:32:00Z',
    files: { mic: '/abs/path.mic.wav' },
  }));
  assert.equal(next.status, 'recording');
  assert.equal(next.id, '2026-05-08T143200');
  assert.equal(next.startedAt, '2026-05-08T14:32:00Z');
  assert.deepEqual(next.files, { mic: '/abs/path.mic.wav' });
});

test('starting + START_ERR → idle with error', () => {
  const s = reduce(initialState, baseEvent('RECORD_CLICK', { sources: ['mic'] }));
  const next = reduce(s, baseEvent('START_ERR', { message: 'permission denied' }));
  assert.equal(next.status, 'idle');
  assert.equal(next.error, 'permission denied');
  assert.equal(next.id, null);
});

test('recording + METER → updates meter only', () => {
  const s = recordingState();
  const next = reduce(s, baseEvent('METER', { system: 0.4, mic: 0.7 }));
  assert.equal(next.status, 'recording');
  assert.deepEqual(next.meter, { system: 0.4, mic: 0.7 });
  // Other fields unchanged
  assert.equal(next.id, s.id);
  assert.equal(next.startedAt, s.startedAt);
});

test('recording + ELAPSED → updates elapsed', () => {
  const s = recordingState();
  const next = reduce(s, baseEvent('ELAPSED', { seconds: 12 }));
  assert.equal(next.elapsed, 12);
  assert.equal(next.status, 'recording');
});

test('recording + STOP_CLICK → stopping', () => {
  const s = recordingState();
  const next = reduce(s, baseEvent('STOP_CLICK'));
  assert.equal(next.status, 'stopping');
});

test('stopping + STOP_OK → creating', () => {
  let s = recordingState();
  s = reduce(s, baseEvent('STOP_CLICK'));
  const next = reduce(s, baseEvent('STOP_OK', {
    durationSeconds: 30,
    files: { mic: '/abs/path.mic.wav' },
  }));
  assert.equal(next.status, 'creating');
  assert.equal(next.elapsed, 30);
  assert.deepEqual(next.files, { mic: '/abs/path.mic.wav' });
});

test('creating + CREATE_OK → transcribing', () => {
  let s = recordingState();
  s = reduce(s, baseEvent('STOP_CLICK'));
  s = reduce(s, baseEvent('STOP_OK', { durationSeconds: 30, files: s.files }));
  const next = reduce(s, baseEvent('CREATE_OK'));
  assert.equal(next.status, 'transcribing');
});

test('creating + CREATE_ERR → idle with error, retains id and files', () => {
  let s = recordingState();
  s = reduce(s, baseEvent('STOP_CLICK'));
  s = reduce(s, baseEvent('STOP_OK', { durationSeconds: 30, files: s.files }));
  const next = reduce(s, baseEvent('CREATE_ERR', { message: 'spawn failed' }));
  assert.equal(next.status, 'idle');
  assert.equal(next.error, 'spawn failed');
});

test('transcribing + TRANSCRIBE_OK → idle, clears active id', () => {
  let s = transcribingState();
  const next = reduce(s, baseEvent('TRANSCRIBE_OK'));
  assert.equal(next.status, 'idle');
  assert.equal(next.id, null);
  assert.equal(next.error, null);
});

test('transcribing + TRANSCRIBE_ERR → idle with error, clears active id', () => {
  let s = transcribingState();
  const next = reduce(s, baseEvent('TRANSCRIBE_ERR', { message: 'whisper failed' }));
  assert.equal(next.status, 'idle');
  assert.equal(next.id, null);
  assert.equal(next.error, 'whisper failed');
});

test('recording + ERROR_EVENT → idle with error', () => {
  const s = recordingState();
  const next = reduce(s, baseEvent('ERROR_EVENT', { message: 'sidecar exploded' }));
  assert.equal(next.status, 'idle');
  assert.equal(next.error, 'sidecar exploded');
});

test('recording + TERMINATED_EVENT → idle', () => {
  const s = recordingState();
  const next = reduce(s, baseEvent('TERMINATED_EVENT'));
  assert.equal(next.status, 'idle');
});

test('idle + unhandled event types → unchanged', () => {
  const next = reduce(initialState, baseEvent('METER', { system: 0.1, mic: 0.1 }));
  assert.deepEqual(next, initialState);
});

test('reducer never mutates input state', () => {
  const s = recordingState();
  const snapshot = JSON.parse(JSON.stringify(s));
  reduce(s, baseEvent('METER', { system: 0.9, mic: 0.9 }));
  reduce(s, baseEvent('STOP_CLICK'));
  assert.deepEqual(s, snapshot);
});

// ── helpers ──
function recordingState() {
  let s = reduce(initialState, baseEvent('RECORD_CLICK', { sources: ['system', 'mic'] }));
  s = reduce(s, baseEvent('START_OK', {
    id: '2026-05-08T143200',
    startedAt: '2026-05-08T14:32:00Z',
    files: { system: '/a.system.wav', mic: '/a.mic.wav' },
  }));
  return s;
}

function transcribingState() {
  let s = recordingState();
  s = reduce(s, baseEvent('STOP_CLICK'));
  s = reduce(s, baseEvent('STOP_OK', { durationSeconds: 30, files: s.files }));
  s = reduce(s, baseEvent('CREATE_OK'));
  return s;
}
