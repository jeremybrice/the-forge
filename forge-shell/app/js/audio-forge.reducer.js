/* ═══════════════════════════════════════════════════════════════
   Audio Forge — State Machine Reducer (pure)
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AudioForgeReducer = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const initialState = Object.freeze({
    status: 'idle',         // 'idle' | 'starting' | 'recording' | 'stopping' | 'creating' | 'transcribing'
    id: null,
    startedAt: null,
    files: {},
    sources: [],
    elapsed: 0,
    meter: { system: 0, mic: 0 },
    error: null,
  });

  function reduce(state, event) {
    switch (state.status) {
      case 'idle':
        if (event.type === 'RECORD_CLICK') {
          return Object.assign({}, initialState, {
            status: 'starting',
            sources: event.sources || [],
          });
        }
        return state;

      case 'starting':
        if (event.type === 'START_OK') {
          return Object.assign({}, state, {
            status: 'recording',
            id: event.id,
            startedAt: event.startedAt,
            files: event.files || {},
            elapsed: 0,
            meter: { system: 0, mic: 0 },
            error: null,
          });
        }
        if (event.type === 'START_ERR') {
          return Object.assign({}, initialState, { error: event.message || 'start failed' });
        }
        return state;

      case 'recording':
        if (event.type === 'METER') {
          return Object.assign({}, state, {
            meter: {
              system: clampUnit(event.system),
              mic: clampUnit(event.mic),
            },
          });
        }
        if (event.type === 'ELAPSED') {
          return Object.assign({}, state, { elapsed: Math.max(0, event.seconds | 0) });
        }
        if (event.type === 'STOP_CLICK') {
          return Object.assign({}, state, { status: 'stopping' });
        }
        if (event.type === 'ERROR_EVENT') {
          return Object.assign({}, initialState, { error: event.message || 'recorder error' });
        }
        if (event.type === 'TERMINATED_EVENT') {
          return Object.assign({}, initialState);
        }
        return state;

      case 'stopping':
        if (event.type === 'STOP_OK') {
          return Object.assign({}, state, {
            status: 'creating',
            elapsed: Math.max(0, event.durationSeconds | 0),
            files: event.files || state.files,
          });
        }
        if (event.type === 'STOP_ERR') {
          return Object.assign({}, initialState, { error: event.message || 'stop failed' });
        }
        return state;

      case 'creating':
        if (event.type === 'CREATE_OK') {
          return Object.assign({}, state, { status: 'transcribing' });
        }
        if (event.type === 'CREATE_ERR') {
          return Object.assign({}, initialState, { error: event.message || 'create failed' });
        }
        return state;

      case 'transcribing':
        if (event.type === 'TRANSCRIBE_OK') {
          return Object.assign({}, initialState);
        }
        if (event.type === 'TRANSCRIBE_ERR') {
          return Object.assign({}, initialState, { error: event.message || 'transcribe failed' });
        }
        return state;

      default:
        return state;
    }
  }

  function clampUnit(x) {
    if (typeof x !== 'number' || !Number.isFinite(x)) return 0;
    return Math.min(1, Math.max(0, x));
  }

  return { initialState, reduce };
});
