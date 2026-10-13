# Decisions (pi-idle-compact v0.2)

Why pi-idle-compact behaves the way it does. Early 0.1 measurements are summarized here. The October 12–13 Codex investigation and its raw evidence are retained in the maintainer's vault; see [Codex findings](#codex-read-before-changing-the-timer).

## Made by the user

| # | Decision |
|---|---|
| U1 | The point is convenience (no manual `/compact`), not a cheaper summary. Use pi's own compaction. |
| U2 | Never compact a cache pi is still keeping alive (its cache warming), so no plain timer for models with a known lifetime. Pi declares no Codex lifetime and does not warm its cache; the released extension uses a fixed idle time instead (U9). |
| U3 | Let pi decide what is too small to compact: no size check of our own. Its "Nothing to compact" message is fine, and such a message must still be sent. |
| U4 | If compacting before a message fails, alert and hold the message. No "send anyway" on a second Enter. |
| U5 | Success looks exactly like pi's own compaction. |
| U6 | Recognize "too small" by pi's exact error text (accepting the drift risk). |
| U7 | Lives in `~/dev/personal`, released to npm, installed from npm like the user's other pi extensions. |
| U8 | A message sent while pi is working passes without compacting first, even if the cache expired during the work. A close call: it can cost a full-price request (rare: pi's own warming usually refreshes the cache during long work), but compacting would cancel the running work, which may have run for over an hour (seen live: it broke a running tool). The work's next request meets the expired cache anyway |
| U9 | For release 0.2.0: Codex models (`openai-codex`) compact after 60 idle minutes, through the same timer and first-message fallback as Anthropic. This may compact a warm cache; the goal was to stop skipping Codex sessions altogether. On 2026-10-13 the user questioned this policy after the real-pi results. The recommendation to remove it is not implemented; see below. |

## Made by the agent

| # | Decision | Why | Alternative |
|---|---|---|---|
| A1 | Build our own instead of using pi-cachepoint | pi-cachepoint compacts 5 min *before* expiry (breaks U2), keeps its own cache-lifetime table (24 h for OpenAI), and most of its 674 lines serve a cheaper summary (not U1); that summary missed the cache in both live tries | Install or fork it |
| A2 | Last cache use = a reply's `message.timestamp` | It is the request start: equal to the previous entry's save time to within 0.01 s for 95% of 92,944 replies, including long replies and tool loops. A late stamp only makes the extension compact later, never too early | The entry's save time (up to 51 s late at p95) |
| A3 | pi's `cache_warm` usage entries move the deadline | A 5-min Opus session refreshed 6 times by pi still read its whole 205k-token cache 30 min after its real request | Ignore refreshes (breaks U2) |
| A4 | Aborted replies count as cache use; replies that failed with an error don't | An aborted request reached the provider; counting it can only delay compaction | Skip both |
| A5 | Only the current model's replies and refreshes count | Each model has its own cache | Any model |
| A6 | Lifetime lookup copies pi's: `long` if `PI_CACHE_RETENTION=long`, else `short` | pi doesn't export `getPromptCacheTtlMs`; copying its 2 lines keeps us identical. Drift risk noted in the code | Import pi-ai's `provider-env` (only adds a Bun fallback) |
| A7 | Shipped behavior: Codex uses `CODEX_IDLE_SECONDS` (60 minutes) only when pi gives the model no lifetime; other models without a lifetime are left alone | Chosen as a convenience fallback, not derived from cache expiry. The study's fallback rule retained 60 minutes when no tested delay had enough misses; that did not validate the timer. The later real-pi study still found cache reuse after 183 minutes. The clock starts at the last request (A2), and all providers share the timer/input/error paths | Removing the Codex fallback is now recommended but not implemented. Another guessed timer has no established expiry basis. A `modelOverrides` lifetime would also enable pi's warming |
| A8 | Timer only in interactive sessions | `pi -p` runs are covered by the input hook, and a timer there would race it | Timer everywhere |
| A9 | Opening a session, or switching to a model, whose cache is already dead doesn't compact on its own. A run that ends after the cache expired does (60 s later) | You may only want to read an old session; compacting costs money and hides history, and its next message compacts first anyway. In a session you're working in, the background compaction saves you the wait at your next message. (A version that never armed a dead deadline was caught by the third Codex review.) | Compact on open; never compact after a run |
| A10 | The input hook skips messages from other extensions | Holding one would put another extension's text in your editor | Treat them like typed messages |
| A11 | No state about earlier attempts | Every check rereads the session: a successful compaction ends the deadline, and a failed one is retried by the next message | Remember failed attempts |
| A12 | A held message keeps its text; the notice says how many attached images to attach again | pi has no way to put an image back into the editor, and pasted images have no name | Drop silently |
| A13 | Messages typed during a failing compaction are not special-cased | pi sends them through the input hook afterwards, which retries and holds them on failure | Intercept pi's compaction queue |
| A14 | Name `pi-idle-compact` (user's pick) | Short, says when it acts (while you're away) and what it does; the name does not promise that every provider's cache has expired | `pi-cold-compact`, `pi-afk-compact`, `pi-compact-when-cold` |
| A15 | The timer checks 60 s after the deadline | pi logs a cache refresh only when its reply arrives (~2 s after it starts, measured), so a slow refresh could still be in flight at the deadline. The input hook has no grace: a message sent then shouldn't pay for the uncompacted context | Track pi's in-flight requests |
| A16 | The input hook doesn't touch the timer | Thanks to A15 the timer fires at the earliest 60 s after a message sent before the deadline, when the run is going (busy) or done; pi counts its own compactions as busy too. Clearing the timer on each message (tried after the first Codex review) left it unarmed when another extension took the message or pi failed before the request (second Codex review) | Clear on each message, re-arm on agent_settled |

## Codex: read before changing the timer

**As of 2026-10-13, release 0.2.0 still compacts Codex-provider conversations after 60 idle minutes.** Removing that fallback is the recommendation, not an implemented change. It would preserve warm conversations but would not avoid the first uncached request after a genuine cache loss. Normal context-size and manual compaction would remain.

Here, **Codex means pi's `openai-codex` subscription connection**, tested with Astra—not OpenAI's Codex app or CLI. In the real pi 1.2.0 study, **four of five conversations still reused over 99% of their input after 183 idle minutes**. No reliable expiry cutoff or usable check before sending a request was established. This does not prove that compaction is uneconomical; future-turn usage and summary quality were not measured.

**Read the existing investigation before another paid test:** `~/main-workspace/notes/side-projects/pi-astra-cache-timing-2026-10-13.md`, especially “Before testing again.” That is the full record of the measurements, failed approaches and reasons to reopen the question. Its adjacent `-evidence.tar.gz` archive retains the raw evidence beyond scratch cleanup (maintainer's private vault).

## Checked live (0.1.0; Codex rows 0.2.0)

pi 1.0.4 in tmux, with the user's extensions loaded (`@gotgenes/pi-anthropic-auth`, `pi-minimal-tools`, `pi-hydra` with heads off), pi's real cache lifetimes, Claude Haiku 4.5 unless noted. Failures were forced by a test-only extension that cancels compaction (`session_before_compact`).

| Behaviour | Result |
|---|---|
| Idle session compacts on its own | Cache expired 22:59:34, compaction 23:00:40, pi's normal "Compacted from 91,100 tokens" |
| Not while pi's refreshes keep the cache alive (Opus, 5-min cache, `cacheWarming: "idle"`) | 6 refreshes, each reading the whole 237k-token cache, the last at 23:45:49; compaction 23:51:55 (expiry + 66 s) |
| Not mid-run | Expiry passed during a 5½-min tool call and a queued follow-up; compaction only 6 min after the run (23:07:16). Without the busy check, the timer compacted mid-run and aborted the tool |
| A run that ends after expiry (tool stopped with Escape) | Compaction 60 s after expiry (23:12:04) |
| `pi -p -c` after expiry | Compaction written before the new message |
| Compaction before a message fails | `pi -p`: exit 1, notice on stderr (with image count), nothing saved. Interactive: notice, text back in the editor, nothing saved; Enter after the fix compacts and sends. Without the hold, the message was sent |
| Message typed during a failing compaction | Held the same way, sent after a successful retry |
| Session too small | pi's red "Nothing to compact"; the next message is sent |
| Codex (gpt-6-astra, pi 1.1.0, this extension alone): open session, 4 turns, idle | Last request 21:45:28, compaction 22:46:38 (60-min idle time + 70 s), pi's normal "Compacted from 56,485 tokens" |
| Codex: `pi -p` message after 64 idle minutes | Compaction written before the new message, which was then sent (exit 0) |
| Codex: a single 56k-token message | pi's "Nothing to compact (session too small)" at the idle deadline: pi needs more than one turn |
| `/model` switch to Opus after Haiku replies | Haiku's expiry triggers nothing |
| Opus with `PI_CACHE_RETENTION=long`, the real 1-hour cache | Cache expired 23:45:09, compaction 23:46:17, pi's normal "Compacted from 124,599 tokens" |
| The npm package itself (`npm pack`) | pi lists it as loaded; the held `pi -p -c` path works from it |
