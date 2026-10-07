import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { cacheDeadline } from "../index";

type Model = NonNullable<Parameters<typeof cacheDeadline>[0]>;

const opus = { provider: "anthropic", id: "claude-opus-5-5", promptCache: { short: 300, long: 3600 } } as Model;
const sol = { provider: "openai-codex", id: "gpt-6.1-sol" } as Model;
const T = Date.parse("2026-10-07T18:00:00.000Z");
const min = 60_000;

let n = 0;
const base = (at: number) => ({ id: `e${++n}`, parentId: null, timestamp: new Date(at).toISOString() });
// A reply's message.timestamp is its request start; the entry is saved when the reply ends.
const reply = (sentAt: number, over: Record<string, unknown> = {}) =>
	({
		...base(sentAt + 9_000),
		type: "message",
		message: { role: "assistant", provider: "anthropic", model: "claude-opus-5-5", stopReason: "stop", timestamp: sentAt, ...over },
	}) as unknown as SessionEntry;
const user = (at: number) => ({ ...base(at), type: "message", message: { role: "user", timestamp: at } }) as unknown as SessionEntry;
const warm = (at: number, model = "claude-opus-5-5") =>
	({ ...base(at), type: "usage", kind: "cache_warm", provider: "anthropic", model }) as unknown as SessionEntry;
const compaction = (at: number) => ({ ...base(at), type: "compaction" }) as unknown as SessionEntry;

describe("cacheDeadline", () => {
	it("is the last reply's request start plus the lifetime for the retention in use", () => {
		const branch = [user(T), reply(T)];
		expect(cacheDeadline(opus, branch, "long")).toBe(T + 60 * min);
		expect(cacheDeadline(opus, branch, "short")).toBe(T + 5 * min);
	});

	it("moves with each of pi's cache refreshes", () => {
		expect(cacheDeadline(opus, [user(T), reply(T), warm(T + 4.5 * min), warm(T + 9 * min)], "short")).toBe(T + 14 * min);
	});

	it("ignores a refresh for another model", () => {
		expect(cacheDeadline(opus, [reply(T), warm(T + 4 * min, "claude-fable-5-1")], "short")).toBe(T + 5 * min);
	});

	it("ignores failed replies and replies from another model", () => {
		const branch = [reply(T), reply(T + 10 * min, { stopReason: "error" }), reply(T + 20 * min, { model: "claude-fable-5-1" })];
		expect(cacheDeadline(opus, branch, "long")).toBe(T + 60 * min);
	});

	it("counts an aborted reply, because its request reached the provider", () => {
		expect(cacheDeadline(opus, [reply(T), reply(T + 10 * min, { stopReason: "aborted" })], "long")).toBe(T + 70 * min);
	});

	it("has none right after a compaction, and restarts with the next reply", () => {
		expect(cacheDeadline(opus, [reply(T), compaction(T + 61 * min)], "long")).toBeUndefined();
		expect(cacheDeadline(opus, [reply(T), compaction(T + 61 * min), reply(T + 70 * min)], "long")).toBe(T + 130 * min);
	});

	it("has none for a model pi gives no cache lifetime", () => {
		expect(cacheDeadline(sol, [reply(T, { provider: "openai-codex", model: "gpt-6.1-sol" })], "long")).toBeUndefined();
	});

	it("has none before the first reply", () => {
		expect(cacheDeadline(opus, [user(T)], "long")).toBeUndefined();
		expect(cacheDeadline(undefined, [reply(T)], "long")).toBeUndefined();
	});
});
