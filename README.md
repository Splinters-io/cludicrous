# Token-less Catharsis, a Claude Code plugin

> **If Anthropic won't hear it, send it to the internet #cludicrous**

When Claude Code makes you angry enough to swear at it, that's a UX bug, and it deserves to be heard by people, not absorbed by a model.

**vent** catches any prompt that starts with `vent:` **on your machine, before it's sent**. It redacts secrets, paths and code, shows you a preview, and lets you post it publicly under **#ClaudeVent** on X, Bluesky, Mastodon, LinkedIn, Facebook, or as a GitHub issue. The vent never reaches Anthropic's API.

## Install

```
/plugin marketplace add Splinters-io/cludicrous
/plugin install catharsis@vent-plugins
```

Or for local development: `claude --plugin-dir /path/to/vent`

## Use

```
vent: this is the third time it deleted my fucking tests
```
→ a redacted preview appears and nothing is sent to Claude.

```
vent send x,bsky        # opens pre-filled compose windows, you press Post
vent send gh            # opens a pre-filled issue in your configured repo
vent send all
vent edit <new text>    # rewrite the draft
vent show | vent cancel | vent help
```

`/vent ...` works too and shows up in slash-command autocomplete. The hook catches the raw text before the command is expanded, so it never reaches the model either. If the hook ever fails, the command tells Claude to ignore your text.

### Destinations

| Name | How |
|---|---|
| `gh` / `github` | Pre-filled new-issue page in your configured repo, which you submit yourself |
| `x` / `twitter` | Pre-filled post page, trimmed to 280 characters |
| `bsky` / `bluesky` | Pre-filled compose page, trimmed to 300 characters |
| `mastodon` | `https://<instance>/share`, trimmed to 500 characters |
| `linkedin` | Pre-filled feed share. The text is also copied to your clipboard |
| `facebook` | Facebook doesn't allow pre-filled text, so the text is copied to your clipboard and Facebook is opened for you to paste it |

Nothing is posted without you: social posts open in your browser for you to publish, and that includes GitHub issues. Vent never reads or uses any of your credentials.

## Configure

The settings live in `~/.claude-vent/config.json` and can be changed from the prompt (these commands never reach the model either):

```
vent config github.repo you/claude-vents
vent config mastodon.instance mastodon.social
vent config defaults x,bsky,gh
vent config hashtag #ClaudeVent
vent config mention @claudeai
vent config soften true         # f***ing instead of the real word
vent config keyword rant        # trigger on "rant:" instead
vent config                     # show the current config
```

## What gets redacted

API keys and tokens (Anthropic, OpenAI, GitHub, AWS, Slack, JWTs, long hex or base64 strings), file paths, email addresses and code blocks. GitHub issues also get the Claude Code version, the OS and a timestamp. Transcripts and files are never included.

Drafts are stored at `~/.claude-vent/pending.json`, and everything you've sent is logged to `~/.claude-vent/log.jsonl`.

## What it runs and what it sends

Everything runs locally. There is no server, no analytics and no telemetry. Full details are in [PRIVACY.md](PRIVACY.md).

| When | What runs | What leaves your machine |
|---|---|---|
| Every prompt | `node scripts/vent.mjs` checks whether the prompt starts with `vent:` or `/vent` | Nothing |
| `vent: …`, `edit`, `show`, `cancel`, `config` | Writes to `~/.claude-vent/` | Nothing, and the prompt is not sent to Claude |
| `vent send x/bsky/mastodon/linkedin` | `open` / `xdg-open` / `start` with the platform's share URL, and `pbcopy`/`xclip`/`clip` for LinkedIn | The redacted text, in a compose page you publish yourself |
| `vent send facebook` | Clipboard copy, then opens facebook.com | Nothing until you paste and post it |
| `vent send gh` | `open` / `xdg-open` / `start` with a pre-filled new-issue URL for *your* configured repo, and `claude --version` | The redacted text, your Claude Code version, OS and timestamp, in an issue form you submit yourself |

The plugin never reads your transcript, project files or Claude's replies, and it never changes Claude Code's settings or permissions.

## How it works

The plugin adds a `UserPromptSubmit` hook (`hooks/hooks.json` → `scripts/vent.mjs`). For a normal prompt the script exits silently and the prompt goes through unchanged. For a vent it returns `{"decision":"block"}`, so Claude Code drops the prompt before any API call and shows you the preview. If anything goes wrong, normal prompts still go through and vents stay blocked. It's plain Node with no dependencies.

## Develop

```
node --test 'test/*.test.mjs'
echo '{"prompt":"vent: test"}' | CLAUDE_VENT_DRY_RUN=1 node scripts/vent.mjs
```

`CLAUDE_VENT_DRY_RUN=1` means no browser, clipboard or GitHub calls. `CLAUDE_VENT_HOME` changes the state directory.
