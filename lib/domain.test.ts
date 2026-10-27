import test from "node:test";
import assert from "node:assert/strict";
import {
  quadrant,
  changed,
  reviewNeeded,
  validateScores,
  blank,
  progressStages,
  progressRank,
  needsAttention,
  describeChanges,
  eventHistory,
} from "./domain.ts";
test("new axes classify by importance and progress, never by legacy urgency", () => {
  assert.equal(quadrant({ importance: 3, progress: "지연" }), "focus");
  assert.equal(quadrant({ importance: 5, progress: "유지" }), "future");
  assert.equal(quadrant({ importance: 2, progress: "원활" }), "review");
  assert.equal(quadrant({ importance: 2, progress: "막힘" }), "quick");
  const legacy = { ...blank(), progress: undefined, urgency: 5 };
  assert.equal(quadrant(legacy), "unclassified");
  assert.equal(needsAttention(legacy), false);
  assert.equal(progressRank("unknown"), null);
});
test("attention boundary is importance>=3 and delayed/blocked/unresolved; terminal/trash excluded", () => {
  for (const importance of [1, 2, 3, 4, 5])
    for (const stage of progressStages) {
      const t = { ...blank(), importance, progress: stage.name };
      assert.equal(
        needsAttention(t),
        importance >= 3 && ["지연", "막힘", "미해결"].includes(stage.name),
      );
    }
  for (const status of ["완료", "드롭"])
    assert.equal(
      needsAttention({ ...blank(), importance: 5, progress: "미해결", status }),
      false,
    );
  assert.equal(
    needsAttention({
      ...blank(),
      importance: 5,
      progress: "막힘",
      deleted: true,
    }),
    false,
  );
});
test("progress changes flagged; time alone never marks healthy work for dropping", () => {
  const t = { ...blank(), importance: 1, updated_at: "2020-01-01T00:00:00Z" };
  assert.equal(reviewNeeded(t), false);
  t.progress = "막힘";
  assert.ok(changed(t));
  assert.ok(reviewNeeded(t));
  t.status = "완료";
  assert.equal(reviewNeeded(t), false);
});
test("archived old/new data explains progress, handling and next check changes even with legacy generic notes", () => {
  const old = {
    ...blank(),
    progress: "유지" as const,
    processing_type: "바로 처리" as const,
  };
  const next = {
    ...old,
    progress: "지연" as const,
    processing_type: "추적 관리" as const,
    reminder_at: "2026-11-02T00:00:00Z",
    change_reason: "고객 일정 변경",
    history: [
      {
        at: "2026-10-27",
        actor: "eastsea.chae@gmail.com",
        text: "업무 수정 · 상태 진행 중",
      },
    ],
  };
  const h = eventHistory([
    { at: "2026-10-27", old_data: old, new_data: next },
  ])[0];
  assert.match(h.text, /유지→지연/);
  assert.match(h.text, /바로 처리→추적 관리/);
  assert.match(h.text, /다음 확인일/);
  assert.match(h.text, /고객 일정 변경/);
  assert.equal(h.actor, "eastsea.chae@gmail.com");
  assert.equal(old.progress, "유지");
  assert.ok(describeChanges(old, next).length >= 3);
});
test("system rescheduling does not reuse a prior human change reason", () => {
  const old = {
    ...blank(),
    processing_type: "추적 관리" as const,
    reminder_at: "2026-11-01T00:00:00Z",
    change_reason: "과거 사유",
  };
  const next = {
    ...old,
    reminder_at: "2026-11-08T00:00:00Z",
    history: [{ at: "2026-11-01", actor: "알림 시스템", text: "업무 수정" }],
  };
  assert.doesNotMatch(
    eventHistory([{ at: "2026-11-01", old_data: old, new_data: next }])[0].text,
    /과거 사유/,
  );
});
test("reject legacy scores outside five integer levels", () => {
  assert.equal(
    validateScores({ importance: 0, urgency: 2, difficulty: 3 }),
    false,
  );
  assert.equal(
    validateScores({ importance: 2.5, urgency: 2, difficulty: 3 }),
    false,
  );
  assert.equal(
    validateScores({ importance: 5, urgency: 1, difficulty: 3 }),
    true,
  );
});
