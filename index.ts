import type { ExtensionAPI, ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";

type Model = NonNullable<ExtensionContext["model"]>;

/** pi's own error for a session too small to compact (agent-session.js:2184 in pi 1.0.4). */
export const NOTHING_TO_COMPACT = "Nothing to compact (session too small)";

/**
 * The timer checks this long after the deadline. pi starts a cache refresh shortly before expiry
 * (cache-warmer.js:16) but logs it only once its reply arrives, usually ~2 s later; this covers
 * a slow one. It also means a timer never fires while a message sent before the deadline is still
 * being prepared (pi counts as idle until the request starts).
 */
const REFRESH_GRACE_MS = 60_000;

/**
 * When the provider's prompt cache for `model` dies: the last time anything used it, plus its
 * lifetime. Undefined when pi gives the model no cache lifetime, or when nothing has used the
 * cache since the last compaction.
 */
export function cacheDeadline(
	model: Model | undefined,
	branch: SessionEntry[],
	retention: string | undefined,
): number | undefined {
	// Same lookup as pi's cache warming (getPromptCacheTtlMs, cache-warmer.js:26 in pi 1.0.4), which pi doesn't export.
	const seconds = model?.promptCache?.[retention === "long" ? "long" : "short"];
	if (model === undefined || seconds === undefined) return undefined;
	let lastUse: number | undefined;
	for (const entry of branch) {
		if (entry.type === "compaction") {
			lastUse = undefined;
		} else if (
			entry.type === "message" &&
			entry.message.role === "assistant" &&
			entry.message.stopReason !== "error" &&
			entry.message.provider === model.provider &&
			entry.message.model === model.id
		) {
			lastUse = entry.message.timestamp; // when the request was sent
		} else if (
			entry.type === "usage" &&
			entry.kind === "cache_warm" &&
			entry.provider === model.provider &&
			entry.model === model.id
		) {
			lastUse = Date.parse(entry.timestamp); // pi's cache warming refreshed the cache
		}
	}
	return lastUse === undefined ? undefined : lastUse + seconds * 1000;
}

export default function (pi: ExtensionAPI) {
	let timer: ReturnType<typeof setTimeout> | undefined;

	const deadline = (ctx: ExtensionContext) =>
		cacheDeadline(ctx.model, ctx.sessionManager.getBranch(), process.env.PI_CACHE_RETENTION);

	// The timer runs only while the cache is alive, and only in interactive sessions (`pi -p` runs
	// are covered by the input hook alone). A session or model whose cache is already dead doesn't
	// compact on its own: you may only want to read it. Its next message compacts first instead.
	function arm(ctx: ExtensionContext) {
		clearTimeout(timer);
		const at = deadline(ctx);
		if (!ctx.hasUI || at === undefined || at <= Date.now()) return;
		timer = setTimeout(() => onDeadline(ctx), Math.max(0, at + REFRESH_GRACE_MS - Date.now()));
	}

	function onDeadline(ctx: ExtensionContext) {
		const at = deadline(ctx);
		if (at === undefined) return;
		if (Date.now() < at) return arm(ctx); // a cache refresh moved the deadline
		if (!ctx.isIdle() || ctx.hasPendingMessages()) return; // agent_settled re-arms
		ctx.compact(); // pi shows its own success or failure message
	}

	pi.on("session_start", (_event, ctx) => arm(ctx));
	pi.on("model_select", (_event, ctx) => arm(ctx));
	pi.on("agent_settled", (_event, ctx) => arm(ctx));
	pi.on("session_shutdown", () => clearTimeout(timer));

	// A message sent after the cache died compacts first. If that fails, the message is held,
	// because sending it would pay for the whole uncompacted conversation.
	pi.on("input", async (event, ctx) => {
		const at = deadline(ctx);
		// Extension messages pass: holding one would put another extension's text in the editor.
		if (event.source === "extension" || !ctx.isIdle() || at === undefined || Date.now() < at) {
			return { action: "continue" };
		}
		const error = await new Promise<Error | undefined>((resolve) =>
			ctx.compact({ onComplete: () => resolve(undefined), onError: resolve }),
		);
		if (error === undefined || error.message === NOTHING_TO_COMPACT) return { action: "continue" };
		const images = event.images?.length ? ` Attach your ${event.images.length} image(s) again: they can't be put back.` : "";
		const notice = `Message not sent, because compacting first failed: ${error.message}. Press Enter to try again, or run /compact.${images}`;
		if (ctx.hasUI) {
			ctx.ui.notify(notice, "error");
			ctx.ui.setEditorText(event.text);
		} else {
			console.error(notice);
			process.exitCode = 1;
		}
		return { action: "handled" };
	});
}
