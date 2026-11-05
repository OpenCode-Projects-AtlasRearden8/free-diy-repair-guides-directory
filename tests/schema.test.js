'use strict';
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { validate } = require('./lib/validator');

const ROOT = path.join(__dirname, '..');
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'repair-directory.json'), 'utf8'));
const SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT, 'schema', 'repair-directory.schema.json'), 'utf8'));

beforeEach(() => {});

test('schema file is loadable JSON with the expected top-level shape', () => {
  assert.equal(SCHEMA.type, 'object');
  assert.ok(Array.isArray(SCHEMA.required));
  assert.ok(SCHEMA.required.includes('cards'));
});

test('dataset validates against the JSON schema', () => {
  const errors = validate(DATA, SCHEMA);
  assert.deepEqual(errors, []);
});

test('schema covers the filter categories the page promises', () => {
  const categoryEnum = SCHEMA.properties.cards.items.properties.category.enum;
  assert.equal(categoryEnum.length, DATA.categories.length);
  for (const c of DATA.categories) {
    assert.ok(categoryEnum.includes(c.id), 'category ' + c.id + ' present in schema enum');
  }
});

test('schema verdict labels match the dataset labels', () => {
  assert.deepEqual(
    Object.keys(SCHEMA.properties.cards.items.properties.beginner_verdict.properties.label.enum).length,
    Object.keys(DATA.verdict_labels).length
  );
});

test('every card ID is unique', () => {
  const ids = DATA.cards.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every card satisfies the core per-card promises', () => {
  for (const card of DATA.cards) {
    assert.ok(card.covers.length >= 20, card.id + ': explains what it covers');
    assert.ok(card.official_source.name.length > 0, card.id + ': names the official source');
    assert.ok(card.official_source.url.startsWith('https://'), card.id + ': official source is https');
    assert.ok(card.free_proof.length >= 40, card.id + ': states proof it is free');
    assert.ok(card.beginner_verdict.text.length >= 20, card.id + ': gives a beginner verdict');
    assert.ok(typeof card.recheck_date === 'string', card.id + ': has recheck_date');
  }
});

test('recheck dates are in the future relative to source_checked_date and within 12 months', () => {
  for (const card of DATA.cards) {
    const checked = Date.parse(card.source_checked_date);
    const recheck = Date.parse(card.recheck_date);
    assert.ok(recheck > checked, card.id + ': recheck_date is after source_checked_date');
    const months = (recheck - checked) / (1000 * 60 * 60 * 24 * 30.44);
    assert.ok(months <= 12 && months >= 1, card.id + ': recheck is 1-12 months out');
  }
});

test('no affiliate or tracking parameters hide in any card URL', () => {
  for (const card of DATA.cards) {
    const url = card.official_source.url.toLowerCase();
    for (const forbidden of ['amzn', '/shopmy', 'tag=', 'aff=', 'affiliate_id', 'utm_', 'ref=']) {
      assert.ok(!url.includes(forbidden), card.id + ': URL contains forbidden token ' + forbidden);
    }
  }
  assert.equal(DATA.policy.affiliate_links, false);
});

test('required categories from the brief all have at least one card', () => {
  const present = new Set(DATA.cards.map((c) => c.category));
  for (const needed of ['appliance', 'tech', 'home']) {
    assert.ok(present.has(needed), 'category ' + needed + ' is represented');
  }
});

test('schema rejects an obviously broken card (negative test)', () => {
  const broken = JSON.parse(JSON.stringify(DATA));
  broken.cards[3] = {
    ...broken.cards[3],
    id: 'BROKEN ID',
    official_source: { ...broken.cards[3].official_source, url: 'http://insecure.example.com/' }
  };
  const errors = validate(broken, SCHEMA);
  assert.ok(errors.length >= 2, 'validator catches id pattern + http URL');
});
