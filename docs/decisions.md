# Decisions (pi-cache-expiry-compact v0.1)

Why v0.1 behaves the way it does. The measurements behind it (session scans, live cache runs) lived in a session scratch folder and are not kept; the numbers that matter are quoted here.

## Made by the user

| # | Decision |
|---|---|
| U1 | The point is convenience (no manual `/compact`), not a cheaper summary. Use pi's own compaction. |
| U2 | Never compact a cache pi is still keeping alive (its cache warming), so no plain timer. |
| U3 | Let pi decide what is too small to compact: no size check of our own. Its "Nothing to compact" message is fine, and such a message must still be sent. |
| U4 | If compacting before a message fails, alert and hold the message. No "send anyway" on a second Enter. |
| U5 | Success looks exactly like pi's own compaction. |
| U6 | Recognize "too small" by pi's exact error text (accepting the drift risk). |
| U7 | Lives in `~/dev/personal`, released to npm, installed from npm like the user's other pi extensions. |

## Made by the agent

| # | Decision | Why | Alternative |
|---|---|---|---|
| A1 | Build our own instead of using pi-cachepoint | pi-cachepoint compacts 5 min *before* expiry (breaks U2), keeps its own cache-lifetime table (24 h for OpenAI), and most of its 674 lines serve a cheaper summary (not U1); that summary missed the cache in both live tries | Install or fork it |
| A2 | Last cache use = a reply's `message.timestamp` | It is the request start: equal to the previous entry's save time to within 0.01 s for 95% of 92,944 replies, including long replies and tool loops. A late stamp only makes the extension compact later, never too early | The entry's save time (up to 51 s late at p95) |
| A3 | pi's `cache_warm` usage entries move the deadline | A 5-min Opus session refreshed 6 times by pi still read its whole 205k-token cache 30 min after its real request | Ignore refreshes (breaks U2) |
| A4 | Aborted replies count as cache use; replies that failed with an error don't | An aborted request reached the provider; counting it can only delay compaction | Skip both |
| A5 | Only the current model's replies and refreshes count | Each model has its own cache | Any model |
| A6 | Lifetime lookup copies pi's: `long` if `PI_CACHE_RETENTION=long`, else `short` | pi doesn't export `getPromptCacheTtlMs`; copying its 2 lines keeps us identical. Drift risk noted in the code | Import pi-ai's `provider-env` (only adds a Bun fallback) |
| A7 | No lifetime → do nothing (e.g. OpenAI/Codex models) | pi deliberately gives OpenAI models no lifetime. Measured on Codex gpt-6.1-sol: warm after 6–35 and 65 min, cold after 50, so no fixed time would be right | A lifetime via `modelOverrides` (also turns on pi's warming) or our own |
| A8 | Timer only in interactive sessions | `pi -p` runs are covered by the input hook, and a timer there would race it | Timer everywhere |
| A9 | Opening a session whose cache is already dead doesn't compact | You may only want to read it; compacting costs money and hides history. Its first message compacts first instead | Compact on open |
| A10 | The input hook skips messages from other extensions | Holding one would put another extension's text in your editor | Treat them like typed messages |
| A11 | No state about earlier attempts | Every check rereads the session: a successful compaction ends the deadline, and a failed one is retried by the next message | Remember failed attempts |
| A12 | A held message keeps its text; attached images are named in the notice | pi has no way to put an image back into the editor | Drop silently |
| A13 | Messages typed during a failing compaction are not special-cased | pi sends them through the input hook afterwards, which retries and holds them on failure | Intercept pi's compaction queue |
