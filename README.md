# pi-idle-compact

Compacts a [pi](https://pi.dev) session for you once its prompt cache has expired, so you don't have to type `/compact`. "Idle" because that happens while you're away; the trigger is the provider's cache running out, not a fixed idle time.

**Why then:** once the provider's cache is gone, your next message pays to cache the whole conversation again anyway. Compacting right at that point gives you a short, fresh context for that next message, and you never compact a cache that's still paid for.

| Situation | What happens |
|---|---|
| You leave a session open and the cache expires | About a minute later it compacts on its own, with pi's normal compaction message |
| pi's cache warming is still refreshing the cache (`cacheWarming: "idle"`) | It waits, and only compacts once the last refresh has expired too |
| pi is busy when the cache expires (a long reply, a running tool, a queued message) | It waits until pi is done, then checks again |
| You send a message after the cache expired, or run `pi -p -c "…"` | It compacts first, then sends |
| That compaction fails | Your message is **not sent**: it goes back into the editor with an error (`pi -p`: error on stderr, exit code 1). Press Enter to try again, or run `/compact`. |
| The session is too small to compact | pi shows its own "Nothing to compact" line, and your messages are sent as usual |
| You open a session (`/resume`, `pi -c`) or switch to a model whose cache already expired | Nothing until you send a message, which compacts first: you may only want to read it |

## Install

```sh
pi install npm:pi-idle-compact
```

Requires **pi 1.0.4 or newer**. Tested with pi 1.0.4, loaded alongside `@gotgenes/pi-anthropic-auth`, `pi-minimal-tools` and `pi-hydra` (with its heads off).

## Good to know

- **Only models with a known cache lifetime.** The extension uses the same lifetime as pi's cache warming: the model's `promptCache` value for the retention in use (`long` with `PI_CACHE_RETENTION=long`, otherwise `short`). In pi 1.0.4 only direct Anthropic models have one (5 min, or 1 hour with `long`). Other models are left alone. pi leaves OpenAI out on purpose, and a Codex test showed no fixed lifetime: warm after 65 min in one run, cold after 50 in another.
- **On a 1-hour cache, pi's cache warming doesn't refresh while you're idle** (its idle warming stops after 30 minutes, and the first refresh would come at 54). So in practice the session compacts about an hour after your last message.
- **A message sent while pi is still working is never held or compacted first**, even if the cache expired during the run: compacting would abort the run, and the run's next request meets the expired cache anyway.
- **A compaction costs a summary request**, like `/compact`. That's the trade: you pay it when the cache is already gone instead of typing `/compact` yourself.
- **"Too small" is recognized by pi's exact error text.** If a pi update changes that text, small sessions start holding messages with a visible error, rather than failing silently.
- **`pi -p` with a held message still prints the previous reply** to stdout: pi always prints the last reply in print mode. Check the exit code (1) and stderr.
- **Attached images can't be put back** into the editor when a message is held; the error says how many to attach again.

## Decisions

Why it behaves this way: [docs/decisions.md](docs/decisions.md).

## Develop

```sh
npm install
npm run check       # types
npm run test:unit   # what CI runs on every push and pull request
```

There is no automated test against real pi. Before a release, the behaviour is checked live in tmux; what was checked for 0.1.0 is listed at the end of [docs/decisions.md](docs/decisions.md). A change users notice gets an entry under `Unreleased` in [CHANGELOG.md](CHANGELOG.md), in the same change.

## Releasing

Pushing a `v<version>` tag makes GitHub Actions publish to npm, with a provenance record and no token.
