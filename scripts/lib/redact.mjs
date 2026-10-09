const SECRET_PATTERNS = [
  /\bsk-ant-[A-Za-z0-9_-]{10,}/g,
  /\bsk-[A-Za-z0-9_-]{20,}/g,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /\bxox[abpr]-[A-Za-z0-9-]{10,}/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /\b[0-9a-fA-F]{32,}\b/g,
  /(?<![\w/.:-])[A-Za-z0-9+/_-]{40,}={0,2}/g,
];

const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// Unix paths with 2+ segments, or ~/..., only when not part of a URL.
const UNIX_PATH = /(?<=^|[\s"'`(=])(?:~\/[^\s"'`)]+|\/[\w.@-]+(?:\/[\w.@-]+)+\/?)/g;
const WIN_PATH = /\b[A-Za-z]:\\[^\s"'`)]+/g;
const CODE_FENCE = /```[\s\S]*?(?:```|$)/g;
const INLINE_CODE = /`[^`\n]{30,}`/g;

export function redact(input) {
  let s = String(input);
  s = s.replace(CODE_FENCE, '<code removed>');
  s = s.replace(INLINE_CODE, '<code removed>');
  for (const re of SECRET_PATTERNS) s = s.replace(re, '<secret>');
  s = s.replace(EMAIL, '<email>');
  s = s.replace(UNIX_PATH, '<path>');
  s = s.replace(WIN_PATH, '<path>');
  return s.replace(/[ \t]+\n/g, '\n').trim();
}

const SWEARS = ['fuck', 'shit', 'cunt', 'bitch', 'bastard', 'asshole', 'arsehole', 'dick', 'piss', 'bollock', 'wank', 'twat', 'prick', 'damn', 'crap'];
const SWEAR_RE = new RegExp(`\\b(${SWEARS.join('|')})`, 'gi');

// "fucking" -> "f***ing"
export function soften(input) {
  return String(input).replace(SWEAR_RE, (w) => w[0] + '*'.repeat(w.length - 1));
}
