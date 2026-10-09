# Privacy policy: Vent (Claude Code plugin)

_Last updated: 9 October 2026_

Vent runs entirely on your own computer. It has no server, no analytics and no telemetry, and the author receives no data from it.

## What it reads
- **Prompts you type in Claude Code.** The hook checks whether each prompt starts with `vent:` or `/vent`. Prompts that don't match are left alone: they aren't read further, stored or changed.
- **Vent prompts.** The text after the keyword is redacted (API keys, tokens, file paths, email addresses and code blocks are removed) and handled locally. It is **not** sent to Claude or Anthropic.

Vent never reads your conversation transcript, project files or Claude's responses.

## What it stores (on your machine only)
- `~/.claude-vent/pending.json`: your current redacted draft. It's deleted after you send it or run `vent cancel`.
- `~/.claude-vent/log.jsonl`: a record of the vents you've sent and where they went.
- `~/.claude-vent/config.json`: your settings.

Delete `~/.claude-vent/` at any time to remove all of it.

## What leaves your machine, and only when you run `vent send`
- **X, Bluesky, Mastodon, LinkedIn:** your browser opens that site's compose page with the redacted text filled in. Nothing is posted until you press Post on the site.
- **Facebook:** the redacted text is copied to your clipboard and Facebook opens in your browser. You paste it and post it yourself.
- **GitHub:** an issue is created in the repository *you* set (`vent config github.repo`). It uses your own GitHub CLI login, or opens a pre-filled issue page in your browser. The issue includes the redacted text, your Claude Code version, your operating system and a timestamp.

Once something is posted, that platform's own privacy policy applies to it. Posts are public.

## Contact
Questions or issues: https://github.com/Splinters-io/cludicrous/issues
