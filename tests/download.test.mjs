// Run with: node --test tests/download.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { latestDmg } = createRequire(import.meta.url)('../download.js');
const REPO = 'Rayhanson-Git/stanza';
const asset = (name, url, size = 3570262) => ({ name, browser_download_url: url, size });
const release = (...assets) => ({ tag_name: 'v0.3.8', assets });

test('picks the disk image of the latest release, with its version and size', () => {
  const r = release(asset('appcast.xml', `https://github.com/${REPO}/releases/download/v0.3.8/appcast.xml`),
    asset('Stanza-0.3.8.dmg', `https://github.com/${REPO}/releases/download/v0.3.8/Stanza-0.3.8.dmg`));
  assert.deepEqual(latestDmg(r, REPO), { url: `https://github.com/${REPO}/releases/download/v0.3.8/Stanza-0.3.8.dmg`, version: '0.3.8', size: 3570262 });
});

test('ignores a disk image that is not served from this repository', () => {
  const r = release(asset('Stanza-0.3.8.dmg', 'https://example.com/Stanza-0.3.8.dmg'),
    asset('Stanza-0.3.8.dmg', 'https://github.com/someone-else/stanza/releases/download/v0.3.8/Stanza-0.3.8.dmg'));
  assert.equal(latestDmg(r, REPO), null);
});

test('gives nothing for a release without a disk image, a malformed answer or a bad repository name', () => {
  assert.equal(latestDmg(release(asset('appcast.xml', `https://github.com/${REPO}/releases/download/v0.3.8/appcast.xml`)), REPO), null);
  assert.equal(latestDmg({ message: 'API rate limit exceeded' }, REPO), null);
  assert.equal(latestDmg(null, REPO), null);
  assert.equal(latestDmg(release(asset('x.dmg', 'https://github.com/a/b/releases/download/v1/x.dmg')), 'a/b/../c'), null);
});
