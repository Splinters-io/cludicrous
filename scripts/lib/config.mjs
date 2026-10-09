import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DEFAULTS = {
  keyword: 'vent',
  hashtag: '#ClaudeVent',
  mention: '',
  github: { repo: '' },
  mastodon: { instance: '' },
  defaults: ['x', 'bsky'],
  soften: false,
};

export function ventHome() {
  return process.env.CLAUDE_VENT_HOME || path.join(os.homedir(), '.claude-vent');
}

export function configPath() {
  return path.join(ventHome(), 'config.json');
}

function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

export function merge(base, override) {
  const out = { ...base };
  for (const [k, v] of Object.entries(override || {})) {
    out[k] = isObject(v) && isObject(base[k]) ? merge(base[k], v) : v;
  }
  return out;
}

export function loadConfig() {
  try {
    return merge(DEFAULTS, JSON.parse(fs.readFileSync(configPath(), 'utf8')));
  } catch {
    return merge(DEFAULTS, {});
  }
}

function readUserConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch {
    return {};
  }
}

// Coerce a string typed at the prompt into the type the default uses.
export function coerce(key, raw) {
  const def = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), DEFAULTS);
  if (typeof def === 'boolean') return /^(true|yes|on|1)$/i.test(raw);
  if (Array.isArray(def)) return raw.split(/[,\s]+/).filter(Boolean);
  return raw;
}

export function setConfigValue(key, raw) {
  if (!/^[a-zA-Z]+(\.[a-zA-Z]+)?$/.test(key)) throw new Error(`invalid config key "${key}"`);
  const user = readUserConfig();
  const parts = key.split('.');
  let node = user;
  for (const p of parts.slice(0, -1)) {
    if (!isObject(node[p])) node[p] = {};
    node = node[p];
  }
  node[parts.at(-1)] = coerce(key, raw);
  fs.mkdirSync(ventHome(), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(user, null, 2) + '\n');
  return merge(DEFAULTS, user);
}
