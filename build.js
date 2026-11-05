#!/usr/bin/env node
'use strict';
// Build: inject data/repair-directory.json into templates/index.template.html
// to produce the offline single file index.html.
//
// Usage:
//   node build.js          regenerate index.html
//   node build.js --check  verify index.html is up to date (exit 1 if stale)

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'repair-directory.json');
const TEMPLATE_FILE = path.join(ROOT, 'templates', 'index.template.html');
const OUT_FILE = path.join(ROOT, 'index.html');

function loadJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function render() {
  const data = loadJSON(DATA_FILE);
  const template = fs.readFileSync(TEMPLATE_FILE, 'utf8');
  const replacements = [
    ['__TITLE__', data.title],
    ['__TAGLINE__', data.tagline],
    ['__LAST_RECHECKED__', data.last_rechecked],
    ['__AFFILIATE_STATEMENT__', data.policy.affiliate_statement],
    ['__COST_NOTE__', data.policy.cost_note],
    ['__OFFLINE_NOTE__', data.policy.offline],
    ['__DATA_JSON__', JSON.stringify(data).replace('</scr' + 'ipt>', '<\\/scr' + 'ipt>')]
  ];
  let out = template;
  for (const [token, value] of replacements) {
    if (!out.includes(token)) {
      throw new Error('Template is missing the token ' + token);
    }
    out = out.split(token).join(value);
  }
  return out;
}

function main() {
  const checkMode = process.argv.includes('--check');
  const rendered = render();
  if (checkMode) {
    const onDisk = fs.readFileSync(OUT_FILE, 'utf8');
    if (onDisk === rendered) {
      console.log('OK: index.html is up to date with data/repair-directory.json');
      process.exit(0);
    }
    console.error('STALE: index.html does not match data/repair-directory.json');
    console.error('Run: node build.js');
    process.exit(1);
  }
  fs.writeFileSync(OUT_FILE, rendered);
  const data = loadJSON(DATA_FILE);
  console.log('Wrote index.html (' + data.cards.length + ' cards, last rechecked ' + data.last_rechecked + ')');
}

main();
