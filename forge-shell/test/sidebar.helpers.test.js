'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('../app/js/sidebar.helpers.js');

const cfg = { min: 180, max: 480, default: 280 };

test('clampWidth: returns null below min (signals auto-collapse)', () => {
  assert.equal(helpers.clampWidth(170, cfg), null);
  assert.equal(helpers.clampWidth(0, cfg), null);
  assert.equal(helpers.clampWidth(-10, cfg), null);
});

test('clampWidth: returns min when exactly at min', () => {
  assert.equal(helpers.clampWidth(180, cfg), 180);
});

test('clampWidth: passes through values within range', () => {
  assert.equal(helpers.clampWidth(200, cfg), 200);
  assert.equal(helpers.clampWidth(320, cfg), 320);
  assert.equal(helpers.clampWidth(479, cfg), 479);
});

test('clampWidth: clamps to max', () => {
  assert.equal(helpers.clampWidth(480, cfg), 480);
  assert.equal(helpers.clampWidth(600, cfg), 480);
  assert.equal(helpers.clampWidth(9999, cfg), 480);
});

test('clampWidth: non-finite input returns default', () => {
  assert.equal(helpers.clampWidth(NaN, cfg), 280);
  assert.equal(helpers.clampWidth(Infinity, cfg), 280);
  assert.equal(helpers.clampWidth('200', cfg), 280);
  assert.equal(helpers.clampWidth(null, cfg), 280);
  assert.equal(helpers.clampWidth(undefined, cfg), 280);
});

test('clampWidth: rounds fractional values to nearest integer', () => {
  assert.equal(helpers.clampWidth(199.4, cfg), 199);
  assert.equal(helpers.clampWidth(199.6, cfg), 200);
});

test('SidebarStorage: read returns null when key absent', () => {
  helpers.SidebarStorage._reset();
  assert.equal(helpers.SidebarStorage.read('test-plugin', 'width'), null);
});

test('SidebarStorage: write then read round-trips', () => {
  helpers.SidebarStorage._reset();
  helpers.SidebarStorage.write('test-plugin', 'width', '320');
  assert.equal(helpers.SidebarStorage.read('test-plugin', 'width'), '320');
  helpers.SidebarStorage._reset();
});

test('SidebarStorage: write then read round-trips collapsed flag', () => {
  helpers.SidebarStorage._reset();
  helpers.SidebarStorage.write('test-plugin', 'collapsed', '1');
  assert.equal(helpers.SidebarStorage.read('test-plugin', 'collapsed'), '1');
  helpers.SidebarStorage._reset();
});

test('SidebarStorage: failure on read returns null (does not throw)', () => {
  helpers.SidebarStorage._reset();
  helpers.SidebarStorage._simulateFailure(true);
  assert.equal(helpers.SidebarStorage.read('test-plugin', 'width'), null);
  helpers.SidebarStorage._simulateFailure(false);
  helpers.SidebarStorage._reset();
});

test('SidebarStorage: failure on write does not throw', () => {
  helpers.SidebarStorage._reset();
  helpers.SidebarStorage._simulateFailure(true);
  assert.doesNotThrow(function () {
    helpers.SidebarStorage.write('test-plugin', 'width', '320');
  });
  helpers.SidebarStorage._simulateFailure(false);
  helpers.SidebarStorage._reset();
});
