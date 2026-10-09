import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-vent-test-'));
process.env.CLAUDE_VENT_HOME = home;
process.env.CLAUDE_VENT_DRY_RUN = '1';

const { parsePrompt, parseDestinations } = await import('../scripts/lib/parse.mjs');
const { redact, soften } = await import('../scripts/lib/redact.mjs');
const { composePost, buildShareUrl, issueTitle } = await import('../scripts/lib/destinations.mjs');
const { merge, DEFAULTS, setConfigValue, loadConfig } = await import('../scripts/lib/config.mjs');

before(() => fs.rmSync(path.join(home, 'config.json'), { force: true }));

test('parsePrompt: triggers only on a leading keyword', () => {
  assert.deepEqual(parsePrompt('vent: this is broken'), { cmd: 'draft', args: [], text: 'this is broken' });
  assert.equal(parsePrompt('VENT:  loud').cmd, 'draft');
  assert.equal(parsePrompt('/vent why').text, 'why');
  assert.equal(parsePrompt('/catharsis:vent why').text, 'why');
  assert.equal(parsePrompt('/catharsis:vent send x').cmd, 'send');
  assert.equal(parsePrompt('/other-plugin:venting x'), null);
  assert.equal(parsePrompt('catharsis:vent x'), null);
  assert.equal(parsePrompt('vent why does this suck').cmd, 'draft');
  assert.equal(parsePrompt('  vent: padded').text, 'padded');
  for (const p of ['prevent the crash', 'eventually fix it', 'please vent: no', 'venting is fine', 'ventilation', '']) {
    assert.equal(parsePrompt(p), null, p);
  }
});

test('parsePrompt: subcommands', () => {
  assert.deepEqual(parsePrompt('vent send x,bsky gh'), { cmd: 'send', args: ['x,bsky', 'gh'], text: 'x,bsky gh' });
  assert.equal(parsePrompt('vent cancel').cmd, 'cancel');
  assert.equal(parsePrompt('vent edit new words').text, 'new words');
  assert.deepEqual(parsePrompt('vent config github.repo me/r').args, ['github.repo', 'me/r']);
  assert.equal(parsePrompt('vent').cmd, 'help');
  // with a colon, "send" is just the start of a rant
  assert.equal(parsePrompt('vent: send help, this is awful').cmd, 'draft');
});

test('parsePrompt: custom keyword', () => {
  assert.equal(parsePrompt('rant: ugh', 'rant').cmd, 'draft');
  assert.equal(parsePrompt('vent: ugh', 'rant'), null);
});

test('parseDestinations: aliases, order, defaults, unknown', () => {
  assert.deepEqual(parseDestinations(['twitter,github'], []), { destinations: ['gh', 'x'], unknown: [] });
  assert.deepEqual(parseDestinations([], ['x', 'bsky']).destinations, ['x', 'bsky']);
  assert.equal(parseDestinations(['all'], []).destinations.length, 6);
  assert.deepEqual(parseDestinations(['x', 'myspace'], []).unknown, ['myspace']);
});

test('redact: secrets, paths, emails, code', () => {
  const out = redact(
    'key sk-ant-api03-abcdefghijklmnop and ghp_abcdefghijklmnopqrstuvwxyz123 ' +
      'AKIAABCDEFGHIJKLMNOP at /Users/jc/secret/project/file.ts and ~/work/x ' +
      'mail me a@b.io see https://x.com/foo/bar\n```js\nconst x = 1;\n```',
  );
  for (const leak of ['sk-ant', 'ghp_', 'AKIA', '/Users/jc', '~/work', 'a@b.io', 'const x']) {
    assert.ok(!out.includes(leak), `leaked ${leak}: ${out}`);
  }
  assert.ok(out.includes('https://x.com/foo/bar'), 'URLs should survive');
  assert.ok(out.includes('<code removed>'));
  assert.equal(redact('and/or this is fine'), 'and/or this is fine');
});

test('soften: masks swears, keeps clean words', () => {
  assert.equal(soften('this fucking tool is shit'), 'this f***ing tool is s***');
  assert.equal(soften('Scunthorpe classic'), 'Scunthorpe classic');
});

test('composePost: trims body, keeps hashtag and link', () => {
  const post = composePost('a'.repeat(400), { hashtag: '#ClaudeVent' }, 280, 'https://github.com/o/r/issues/1');
  assert.ok(post.length <= 280);
  assert.ok(post.endsWith('https://github.com/o/r/issues/1 #ClaudeVent'));
  assert.ok(post.includes('…'));
  assert.equal(composePost('short', { hashtag: '#V' }, 280), 'short #V');
});

test('buildShareUrl: encodes text per platform', () => {
  const cfg = { mastodon: { instance: 'https://mastodon.social/' } };
  assert.equal(buildShareUrl('x', 'a & b #V', cfg), 'https://x.com/intent/post?text=a%20%26%20b%20%23V');
  assert.ok(buildShareUrl('bsky', 'hi', cfg).startsWith('https://bsky.app/intent/compose?text='));
  assert.equal(buildShareUrl('mastodon', 'hi', cfg), 'https://mastodon.social/share?text=hi');
  assert.equal(buildShareUrl('mastodon', 'hi', {}), null);
});

test('issueTitle: prefixed and capped', () => {
  assert.equal(issueTitle('short'), '[vent] short');
  assert.ok(issueTitle('x'.repeat(200)).length <= 77);
});

test('config: merge and set with coercion', () => {
  assert.equal(merge(DEFAULTS, { github: { repo: 'a/b' } }).mastodon.instance, '');
  setConfigValue('github.repo', 'me/vents');
  setConfigValue('soften', 'true');
  setConfigValue('defaults', 'x,gh');
  const c = loadConfig();
  assert.equal(c.github.repo, 'me/vents');
  assert.equal(c.soften, true);
  assert.deepEqual(c.defaults, ['x', 'gh']);
  assert.throws(() => setConfigValue('__proto__.x', '1'));
  fs.rmSync(path.join(home, 'config.json'), { force: true });
});

function runHook(stdin) {
  return spawnSync('node', [path.join(root, 'scripts/vent.mjs')], {
    input: stdin,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_VENT_HOME: home, CLAUDE_VENT_DRY_RUN: '1' },
  });
}

test('hook contract: normal prompts pass, vents block, bad input passes', () => {
  const pass = runHook(JSON.stringify({ prompt: 'fix the failing test' }));
  assert.equal(pass.status, 0);
  assert.equal(pass.stdout, '');

  const bad = runHook('not json');
  assert.equal(bad.status, 0);
  assert.equal(bad.stdout, '');

  const block = runHook(JSON.stringify({ prompt: 'vent: this is fucking broken at /Users/jc/proj/a.ts' }));
  assert.equal(block.status, 0);
  const out = JSON.parse(block.stdout);
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /NOT sent to Claude/);
  assert.ok(!out.reason.includes('/Users/jc'));

  const sent = JSON.parse(runHook(JSON.stringify({ prompt: 'vent send x,bsky,facebook' })).stdout);
  assert.equal(sent.decision, 'block');
  assert.match(sent.reason, /✓ X: opened/);
  assert.match(sent.reason, /✓ Bluesky/);
  assert.match(sent.reason, /✓ Facebook: text copied/);
  assert.ok(fs.readFileSync(path.join(home, 'log.jsonl'), 'utf8').includes('fucking broken'));

  const none = JSON.parse(runHook(JSON.stringify({ prompt: 'vent send' })).stdout);
  assert.match(none.reason, /no draft/);

  runHook(JSON.stringify({ prompt: 'vent: again' }));
  const gh = JSON.parse(runHook(JSON.stringify({ prompt: 'vent send gh' })).stdout);
  assert.match(gh.reason, /no repo set/);
});
