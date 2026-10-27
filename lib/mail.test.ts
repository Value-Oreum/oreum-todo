import test from "node:test";
import assert from "node:assert/strict";
import { dispatchReminders } from "./mail.ts";
import { blank } from "./domain.ts";
test("free daily batch uses idempotency, reports success and never confirms unknown delivery", async () => {
  const task = { ...blank(), title: "Check reply", owner: "test@example.com" };
  const jobs = [
    { id: "one", task },
    { id: "two", task },
    { id: "three", task },
  ];
  const finished: Record<string, unknown>[] = [];
  const db = {
    async rpc(name: string, args?: Record<string, unknown>) {
      if (name === "claim_reminders") return { data: jobs, error: null };
      finished.push(args!);
      return { data: null, error: null };
    },
  };
  const headers: string[] = [];
  let index = 0;
  const fetcher: typeof fetch = async (_url, init) => {
    headers.push((init!.headers as Record<string, string>)["Idempotency-Key"]);
    index++;
    if (index === 3) throw Error("timeout");
    return new Response("{}", { status: index === 1 ? 200 : 429 });
  };
  const result = await dispatchReminders(
    db,
    {
      apiKey: "test-only",
      from: "test@example.com",
      appUrl: "https://example.com",
    },
    fetcher,
    async () => {},
  );
  assert.deepEqual(result, { claimed: 3, sent: 1, uncertain: 1 });
  assert.deepEqual(headers, ["one", "two", "three"]);
  assert.deepEqual(finished, [
    { job_id: "one", success: true },
    { job_id: "two", success: false },
  ]);
});
test("no due jobs sends no mail", async () => {
  const db = {
    async rpc() {
      return { data: [], error: null };
    },
  };
  const result = await dispatchReminders(
    db,
    { apiKey: "test-only", from: "x", appUrl: "x" },
    async () => {
      throw Error("must not send");
    },
    async () => {},
  );
  assert.deepEqual(result, { claimed: 0, sent: 0, uncertain: 0 });
});
