#!/usr/bin/env node
// UserPromptSubmit hook. Prompts starting with the vent keyword are handled here and
// blocked, so they are never sent to the model. Every other prompt passes through untouched.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig, setConfigValue, ventHome } from './lib/config.mjs';
import { parsePrompt, parseDestinations } from './lib/parse.mjs';
import { redact, soften } from './lib/redact.mjs';
import { LIMITS, LABELS, sendGithub, sendSocial } from './lib/destinations.mjs';

const pendingPath = () => path.join(ventHome(), 'pending.json');
const logPath = () => path.join(ventHome(), 'log.jsonl');

function readPending() {
  try {
    return JSON.parse(fs.readFileSync(pendingPath(), 'utf8'));
  } catch {
    return null;
  }
}

function writePending(text) {
  fs.mkdirSync(ventHome(), { recursive: true });
  fs.writeFileSync(pendingPath(), JSON.stringify({ text, created: new Date().toISOString() }, null, 2));
}

function clearPending() {
  fs.rmSync(pendingPath(), { force: true });
}

const HELP = (kw) => [
  '[vent] this prompt stayed on your machine and was not sent to Claude.',
  '',
  `  ${kw}: <your rant>           save a redacted draft and preview it`,
  `  ${kw} send [x,bsky,...|all]  post the draft (default: your configured defaults)`,
  `  ${kw} edit <new text>        replace the draft`,
  `  ${kw} show                   show the current draft`,
  `  ${kw} cancel                 throw the draft away`,
  `  ${kw} config <key> <value>   e.g. github.repo you/claude-vents, mastodon.instance mastodon.social`,
  '',
  'Destinations: gh, x, bsky, mastodon, linkedin, facebook (or all)',
].join('\n');

function preview(text, config) {
  const kw = config.keyword;
  const lines = [
    '[vent] draft saved locally. It was NOT sent to Claude.',
    '',
    '──────── preview (redacted) ────────',
    text,
    `${config.hashtag}${config.mention ? ' ' + config.mention : ''}`,
    '────────────────────────────────────',
    '',
  ];
  const sizes = Object.entries(LIMITS)
    .filter(([d]) => d !== 'facebook')
    .map(([d, lim]) => {
      const len = text.length + config.hashtag.length + 1;
      return `${LABELS[d]} ${len}/${lim}${len > lim ? ' (will be trimmed)' : ''}`;
    });
  lines.push(sizes.join(' · '), '');
  lines.push(`Post it:   ${kw} send ${config.defaults.join(',')}    (or: ${kw} send all)`);
  lines.push(`Change it: ${kw} edit <text>    Drop it: ${kw} cancel`);
  if (!config.github?.repo) lines.push(`GitHub not set up yet: ${kw} config github.repo <owner/repo>`);
  return lines.join('\n');
}

function makeDraft(raw, config) {
  let text = redact(raw);
  if (config.soften) text = soften(text);
  return text;
}

function send(args, config) {
  const pending = readPending();
  if (!pending?.text) return `[vent] no draft to send. Start one with \`${config.keyword}: <your rant>\`.`;
  const { destinations, unknown } = parseDestinations(args, config.defaults);
  if (!destinations.length) return `[vent] no valid destinations. ${unknown.length ? `Unknown: ${unknown.join(', ')}` : ''}`;

  const results = [];
  let link = '';
  for (const dest of destinations) {
    let r;
    try {
      r = dest === 'gh' ? sendGithub(pending.text, config) : sendSocial(dest, pending.text, config, link);
    } catch (e) {
      r = { ok: false, line: `${LABELS[dest]}: failed (${e.message})` };
    }
    if (dest === 'gh' && r.url) link = r.url;
    results.push({ dest, ...r });
  }

  fs.mkdirSync(ventHome(), { recursive: true });
  fs.appendFileSync(
    logPath(),
    JSON.stringify({ ts: new Date().toISOString(), text: pending.text, results: results.map(({ dest, ok, url }) => ({ dest, ok, url })) }) + '\n',
  );
  if (results.some((r) => r.ok)) clearPending();

  const out = ['[vent] sent. Nothing was sent to Claude.', '', ...results.map((r) => `${r.ok ? '✓' : '✗'} ${r.line}`)];
  if (unknown.length) out.push('', `Ignored unknown destinations: ${unknown.join(', ')}`);
  return out.join('\n');
}

export function handle(prompt) {
  const config = loadConfig();
  const parsed = parsePrompt(prompt, config.keyword);
  if (!parsed) return null;
  const kw = config.keyword;

  switch (parsed.cmd) {
    case 'draft':
    case 'edit': {
      if (!parsed.text) return HELP(kw);
      const text = makeDraft(parsed.text, config);
      writePending(text);
      return preview(text, config);
    }
    case 'show': {
      const p = readPending();
      return p?.text ? preview(p.text, config) : `[vent] no draft. Start one with \`${kw}: <your rant>\`.`;
    }
    case 'cancel':
      clearPending();
      return '[vent] draft discarded. Nothing was posted or sent to Claude.';
    case 'send':
      return send(parsed.args, config);
    case 'config': {
      const [key, ...rest] = parsed.args;
      if (!key) return `[vent] config:\n${JSON.stringify(config, null, 2)}`;
      if (!rest.length) return `[vent] usage \`${kw} config ${key} <value>\``;
      const next = setConfigValue(key, rest.join(' '));
      return `[vent] set ${key}. Current config:\n${JSON.stringify(next, null, 2)}`;
    }
    default:
      return HELP(kw);
  }
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  let reason;
  try {
    reason = handle(JSON.parse(input).prompt);
  } catch (e) {
    // A prompt we recognised as a vent must still never reach the model, even on error.
    try {
      if (parsePrompt(JSON.parse(input).prompt, loadConfig().keyword)) {
        reason = `[vent] something went wrong (${e.message}). Your prompt was NOT sent to Claude.`;
      }
    } catch {}
  }
  if (reason) process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
