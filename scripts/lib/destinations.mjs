import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';

export const LIMITS = { x: 280, bsky: 300, mastodon: 500, linkedin: 3000, facebook: 5000 };
export const LABELS = { gh: 'GitHub', x: 'X', bsky: 'Bluesky', mastodon: 'Mastodon', linkedin: 'LinkedIn', facebook: 'Facebook' };

const DRY_RUN = () => process.env.CLAUDE_VENT_DRY_RUN === '1';

// Rant body + hashtag/mention/link, trimming only the body so the tags always survive.
export function composePost(text, { hashtag = '', mention = '' } = {}, limit = Infinity, link = '') {
  const tail = [link, hashtag, mention].filter(Boolean).join(' ');
  const room = limit - (tail ? tail.length + 1 : 0);
  let body = text.replace(/\s+/g, ' ').trim();
  if (body.length > room) body = body.slice(0, Math.max(0, room - 1)).trimEnd() + '…';
  return tail ? `${body} ${tail}` : body;
}

export function buildShareUrl(dest, post, config) {
  const t = encodeURIComponent(post);
  switch (dest) {
    case 'x': return `https://x.com/intent/post?text=${t}`;
    case 'bsky': return `https://bsky.app/intent/compose?text=${t}`;
    case 'mastodon': {
      const inst = (config.mastodon?.instance || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
      return inst ? `https://${inst}/share?text=${t}` : null;
    }
    case 'linkedin': return `https://www.linkedin.com/feed/?shareActive=true&text=${t}`;
    default: return null;
  }
}

export function issueTitle(text) {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return `[vent] ${oneLine.length > 70 ? oneLine.slice(0, 69).trimEnd() + '…' : oneLine}`;
}

export function issueBody(text, config, meta) {
  return [
    text,
    '',
    '---',
    `${config.hashtag} · filed via the vent plugin for Claude Code, so it never reached the model.`,
    '',
    `- Claude Code: ${meta.version || 'unknown'}`,
    `- OS: ${meta.os}`,
    `- When: ${meta.when}`,
  ].join('\n');
}

export function newIssueUrl(repo, title, body) {
  return `https://github.com/${repo}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=vent`;
}

export function collectMeta() {
  let version = '';
  try {
    const r = spawnSync('claude', ['--version'], { encoding: 'utf8', timeout: 3000 });
    version = (r.stdout || '').trim();
  } catch {}
  return { version, os: `${os.type()} ${os.release()}`, when: new Date().toISOString() };
}

export function openUrl(url) {
  if (DRY_RUN()) return;
  const [cmd, args] =
    process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]]
    : ['xdg-open', [url]];
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
}

export function copyToClipboard(text) {
  if (DRY_RUN()) return true;
  const candidates =
    process.platform === 'darwin' ? [['pbcopy', []]]
    : process.platform === 'win32' ? [['clip', []]]
    : [['wl-copy', []], ['xclip', ['-selection', 'clipboard']], ['xsel', ['--clipboard', '--input']]];
  for (const [cmd, args] of candidates) {
    const r = spawnSync(cmd, args, { input: text, timeout: 3000 });
    if (r.status === 0) return true;
  }
  return false;
}

// Returns { ok, line, url? } for each destination. GitHub opens a pre-filled issue page
// rather than using the installer's gh credentials, so the user always submits it themselves.
export function sendGithub(text, config) {
  const repo = config.github?.repo;
  if (!repo) {
    return { ok: false, line: 'GitHub: no repo set. Run `vent config github.repo <owner/repo>` first.' };
  }
  const url = newIssueUrl(repo, issueTitle(text), issueBody(text, config, collectMeta()));
  openUrl(url);
  return { ok: true, line: `GitHub: opened a pre-filled issue in ${repo} (press Submit to post)` };
}

export function sendSocial(dest, text, config, link) {
  const post = composePost(text, config, LIMITS[dest], link);
  if (dest === 'facebook') {
    const copied = copyToClipboard(post);
    openUrl(link ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}` : 'https://www.facebook.com/');
    return {
      ok: copied,
      line: copied
        ? 'Facebook: text copied to clipboard, paste it into the post (Facebook does not allow pre-filled text)'
        : 'Facebook: could not copy to clipboard; opened Facebook, copy the text from `vent show`',
    };
  }
  const url = buildShareUrl(dest, post, config);
  if (!url) {
    return { ok: false, line: `${LABELS[dest]}: no instance set. Run \`vent config mastodon.instance <host>\` first.` };
  }
  if (dest === 'linkedin') copyToClipboard(post); // fallback if LinkedIn ignores the pre-fill
  openUrl(url);
  const extra = dest === 'linkedin' ? ' (also copied to clipboard in case it does not pre-fill)' : '';
  return { ok: true, line: `${LABELS[dest]}: opened compose window, press Post to publish${extra}`, url };
}
