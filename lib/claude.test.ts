import test from "node:test";
import assert from "node:assert/strict";
import { claudeRequest, claudeDraft, CLAUDE_MODEL } from "./claude.ts";
const draft = {
  title: "계약 회신",
  company: "고객사",
  description: "계약 조건 확인 필요",
  due: "2026-11-01",
  importance: 5,
  progress: "지연/병목",
  processing_type: "추적 관리",
  urgency: 1,
  difficulty: 2,
};
const response = (input: unknown, stop_reason = "tool_use") => ({
  stop_reason,
  content: [{ type: "tool_use", name: "create_task", input }],
});
test("Claude request sends image and text using Messages API format and forced extraction tool", () => {
  const content = [
    {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/png" as const,
        data: "test-image",
      },
    },
    { type: "text" as const, text: "계약 회신 요청" },
  ];
  const r = claudeRequest(content);
  assert.equal(r.model, CLAUDE_MODEL);
  assert.deepEqual(r.messages[0].content, content);
  assert.deepEqual(r.tool_choice, { type: "tool", name: "create_task" });
  assert.equal(r.max_tokens, 1200);
});
test("valid tool result returns only approved task fields", () => {
  assert.deepEqual(
    claudeDraft(response({ ...draft, owner: "injected", deleted: true })),
    draft,
  );
});
test("truncated, refused, malformed and out-of-range drafts are rejected", () => {
  assert.throws(() => claudeDraft(response(draft, "max_tokens")));
  assert.throws(() =>
    claudeDraft({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "No" }],
    }),
  );
  assert.throws(() => claudeDraft(response({ ...draft, importance: 99 })));
  assert.throws(() => claudeDraft(response({ ...draft, title: [] })));
  assert.throws(() => claudeDraft(response({ ...draft, title: " " })));
});
test("impossible or uncertain dates are not silently used", () => {
  assert.equal(claudeDraft(response({ ...draft, due: "2026-02-30" })).due, "");
  assert.equal(claudeDraft(response({ ...draft, due: "다음주" })).due, "");
});

test("uncertain progress requires manual confirmation and does not become healthy", () => {
  assert.equal(
    claudeDraft(response({ ...draft, progress: "확인 필요" })).progress,
    null,
  );
  assert.throws(() => claudeDraft(response({ ...draft, progress: "보통" })));
  assert.throws(() =>
    claudeDraft(response({ ...draft, processing_type: "알아서" })),
  );
});
