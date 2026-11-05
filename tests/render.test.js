'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const DATA_FILE = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'repair-directory.json'), 'utf8'));
const INDEX_HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const TEMPLATE_HTML = fs.readFileSync(path.join(ROOT, 'templates', 'index.template.html'), 'utf8');

// --- helpers ---------------------------------------------------------------

function extractEmbeddedData(html) {
  const m = html.match(/<script id="repair-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(m, 'index.html contains the embedded repair-data script');
  return JSON.parse(m[1]);
}

function loadAppScript() {
  const m = INDEX_HTML.match(/<script id="app-script">([\s\S]*?)<\/script>/);
  assert.ok(m, 'index.html contains the app-script');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(m[1], sandbox); // no `document` -> init() stays skipped
  return sandbox;
}

// --- tests -----------------------------------------------------------------

test('embedded JSON in index.html matches data/repair-directory.json exactly', () => {
  const embedded = extractEmbeddedData(INDEX_HTML);
  assert.deepEqual(embedded, DATA_FILE);
});

test('index.html has no leftover build tokens', () => {
  for (const token of ['__TITLE__','__TAGLINE__','__LAST_RECHECKED__','__AFFILIATE_STATEMENT__','__COST_NOTE__','__OFFLINE_NOTE__','__DATA_JSON__']) {
    assert.ok(!INDEX_HTML.includes(token), 'no leftover token ' + token);
  }
});

test('template contains no URLs that leaked raw data inline (data travels via JSON)', () => {
  for (const card of DATA_FILE.cards) {
    assert.ok(!TEMPLATE_HTML.includes(card.official_source.url), 'template stays free of per-card URLs');
  }
});

test('app script exposes pure render helpers usable in a bare sandbox', () => {
  const sandbox = loadAppScript();
  assert.equal(typeof sandbox.escapeHTML, 'function');
  assert.equal(typeof sandbox.filterCards, 'function');
  assert.equal(typeof sandbox.cardHTML, 'function');
  assert.equal(typeof sandbox.filterBarHTML, 'function');
  assert.equal(typeof sandbox.categoryCounts, 'function');
});

test('escapeHTML neutralizes markup injection', () => {
  const sandbox = loadAppScript();
  assert.equal(sandbox.escapeHTML('<img src=x onerror=alert(1)>&"\''),
    '&lt;img src=x onerror=alert(1)&gt;&amp;&quot;&#39;');
});

test('filterCards: appliance/tech/home filters and search behave', () => {
  const sandbox = loadAppScript();
  const cards = DATA_FILE.cards;
  assert.equal(sandbox.filterCards(cards, 'all', '').length, cards.length);
  assert.ok(sandbox.filterCards(cards, 'appliance', '').length >= 3);
  assert.ok(sandbox.filterCards(cards, 'tech', '').length >= 2);
  assert.ok(sandbox.filterCards(cards, 'home', '').length >= 2);
  assert.equal(sandbox.filterCards(cards, 'appliance', '').every((c) => c.category === 'appliance'), true);
  assert.ok(sandbox.filterCards(cards, 'all', 'iPhone').length >= 1);
  assert.equal(sandbox.filterCards(cards, 'tech', 'iPhone').length >= 1, true);
  assert.equal(sandbox.filterCards(cards, 'appliance', 'iPhone').length, 0);
  assert.equal(sandbox.filterCards(cards, 'all', 'zzz-no-such-word').length, 0);
});

test('cardHTML renders all five promised fields per card', () => {
  const sandbox = loadAppScript();
  const meta = {
    categoryById: Object.fromEntries(DATA_FILE.categories.map((c) => [c.id, c])),
    verdictLabels: DATA_FILE.verdict_labels
  };
  const html = sandbox.cardHTML(DATA_FILE.cards[0], meta);
  for (const fragment of ['What it covers', 'Official source', 'Proof it is free', 'Beginner verdict', 'Recheck schedule', 'open official site']) {
    assert.ok(html.includes(fragment), 'card includes section ' + fragment);
  }
  const url = DATA_FILE.cards[0].official_source.url;
  assert.ok(html.includes('href="' + url + '"'), 'card links the official URL');
  assert.ok(!html.includes('<script'), 'card HTML embeds no nested script');
});

test('every card renders into distinct, well-formed-enough markup', () => {
  const sandbox = loadAppScript();
  const meta = {
    categoryById: Object.fromEntries(DATA_FILE.categories.map((c) => [c.id, c])),
    verdictLabels: DATA_FILE.verdict_labels
  };
  for (const card of DATA_FILE.cards) {
    const html = sandbox.cardHTML(card, meta);
    assert.ok((html.match(/<article/g) || []).length === 1, card.id + ': one article');
    assert.ok(html.startsWith('<article') && html.endsWith('</article>'), card.id + ': balanced tags');
    assert.ok(html.includes(sandbox.escapeHTML(card.id)), card.id + ': card id present');
  }
});

test('filter bar renders one chip per category plus All, with counts', () => {
  const sandbox = loadAppScript();
  const counts = sandbox.categoryCounts(DATA_FILE.cards);
  const html = sandbox.filterBarHTML(DATA_FILE, 'all', counts);
  assert.ok(html.includes('data-category="all"'));
  for (const c of DATA_FILE.categories) {
    assert.ok(html.includes('data-category="' + c.id + '"'), 'chip for ' + c.id);
  }
  const chipCount = (html.match(/<button/g) || []).length;
  assert.equal(chipCount, DATA_FILE.categories.length + 1);
});

test('every rendered card exposes an official https link with no tracking parameters', () => {
  const sandbox = loadAppScript();
  const meta = {
    categoryById: Object.fromEntries(DATA_FILE.categories.map((c) => [c.id, c])),
    verdictLabels: DATA_FILE.verdict_labels
  };
  for (const card of DATA_FILE.cards) {
    const html = sandbox.cardHTML(card, meta);
    const match = html.match(/class="offsite" href="([^"]+)"/);
    assert.ok(match, card.id + ': renders an official-source link');
    const url = match[1];
    assert.ok(url.startsWith('https://'), card.id + ': offsite link is https (' + url + ')');
    assert.ok(!url.includes('utm_') && !url.includes('tag='), card.id + ': no tracking parameters');
    assert.equal(url, card.official_source.url, card.id + ': link matches the official_source URL');
  }
});

test('page shell carries title, credit and policy text', () => {
  assert.ok(INDEX_HTML.includes('<title>' + DATA_FILE.title), 'title injected');
  assert.ok(INDEX_HTML.includes('Asdale Dynamics, LLC'), 'credits Asdale Dynamics, LLC');
  assert.ok(INDEX_HTML.includes(DATA_FILE.policy.affiliate_statement), 'affiliate policy injected');
  assert.ok(INDEX_HTML.toLowerCase().includes('no affiliate'), 'page asserts no affiliate links');
});
