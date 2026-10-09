const SUBCOMMANDS = new Set(['send', 'cancel', 'edit', 'config', 'help', 'show']);

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Returns null when the prompt is not a vent, otherwise { cmd, args, text }.
// Only a prompt that *starts* with the keyword counts:
//   "vent: <rant>" / "vent <rant>" / "/vent <rant>"  -> draft
//   "vent send x,bsky" / "vent cancel" / "vent edit <text>" / "vent config k v" / "vent show" / "vent help"
export function parsePrompt(prompt, keyword = 'vent') {
  if (typeof prompt !== 'string') return null;
  const trimmed = prompt.trim();
  const re = new RegExp(`^/?${escapeRe(keyword)}(?::|(?=\\s)|$)\\s*`, 'i');
  const m = trimmed.match(re);
  if (!m) return null;
  const rest = trimmed.slice(m[0].length);
  const usedColon = m[0].includes(':');

  if (!usedColon) {
    const [first = '', ...others] = rest.split(/\s+/);
    const sub = first.toLowerCase();
    if (SUBCOMMANDS.has(sub)) {
      const tail = rest.slice(first.length).trim();
      return { cmd: sub, args: others.filter(Boolean), text: tail };
    }
  }
  if (!rest) return { cmd: 'help', args: [], text: '' };
  return { cmd: 'draft', args: [], text: rest };
}

export const ALL_DESTINATIONS = ['gh', 'x', 'bsky', 'mastodon', 'linkedin', 'facebook'];

const ALIASES = {
  github: 'gh', gh: 'gh',
  x: 'x', twitter: 'x',
  bsky: 'bsky', bluesky: 'bsky',
  mastodon: 'mastodon', masto: 'mastodon',
  linkedin: 'linkedin', li: 'linkedin',
  facebook: 'facebook', fb: 'facebook',
};

// Turn "x,bsky gh" into canonical names in send order (GitHub first so others can link to it).
export function parseDestinations(args, defaults) {
  const raw = args.join(',').split(/[,\s]+/).map((s) => s.toLowerCase()).filter(Boolean);
  const wanted = new Set();
  const unknown = [];
  for (const r of raw.length ? raw : defaults) {
    if (r === 'all') ALL_DESTINATIONS.forEach((d) => wanted.add(d));
    else if (ALIASES[r]) wanted.add(ALIASES[r]);
    else unknown.push(r);
  }
  return { destinations: ALL_DESTINATIONS.filter((d) => wanted.has(d)), unknown };
}
