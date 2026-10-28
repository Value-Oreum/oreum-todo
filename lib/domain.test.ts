import test from "node:test";
import assert from "node:assert/strict";
import {
  quadrant,
  progressLabel,
  dueSignal,
  staleSignal,
  quadrantSizes,
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
test("binary priority uses urgency independently of progress and preserves legacy thresholds", () => {
  for (const importance of [1, 2, 3, 4, 5])
    for (const urgency of [1, 2, 3, 4, 5]) {
      const t = { ...blank(), importance, urgency, progress: "이슈" as const };
      assert.equal(
        quadrant(t),
        importance >= 3
          ? urgency >= 3
            ? "focus"
            : "future"
          : urgency >= 3
            ? "quick"
            : "review",
      );
      assert.equal(needsAttention(t), importance >= 3 && urgency >= 3);
      assert.equal(needsAttention({ ...t, status: "완료" }), false);
      assert.equal(needsAttention({ ...t, deleted: true }), false);
    }
});
test("legacy progress maps into three card states", () => {
  assert.equal(progressLabel("원활"), "순항");
  assert.equal(progressLabel("유지"), "순항");
  assert.equal(progressLabel("막힘"), "지연/병목");
  assert.equal(progressLabel("미해결"), "이슈");
});
test("D-7 KST signal and stale candidates never change data or mark finished work", () => {
  const now = Date.parse("2026-10-28T15:00:00Z");
  const t = {
    ...blank(),
    urgency: 1,
    due: "2026-11-05",
    updated_at: "2026-10-20T00:00:00Z",
  };
  assert.ok(dueSignal(t, now));
  assert.ok(staleSignal(t, now));
  assert.equal(dueSignal({ ...t, due: "2026-11-06" }, now), false);
  assert.equal(dueSignal({ ...t, urgency: 5 }, now), false);
  assert.equal(dueSignal({ ...t, status: "완료" }, now), false);
  assert.equal(staleSignal({ ...t, progress: "이슈" }, now), false);
  assert.equal(t.urgency, 1);
  assert.equal(t.progress, "순항");
});
test("crowded quadrant grows while all regions stay accessible", () => {
  const initial = quadrantSizes([]);
  const crowded = quadrantSizes(
    Array.from({ length: 50 }, () => ({
      ...blank(),
      importance: 5,
      urgency: 5,
    })),
  );
  assert.equal(initial.top, 50);
  assert.ok(crowded.top > initial.top);
  assert.ok(crowded.upperLeft < 50);
  assert.ok(crowded.top <= 70);
  assert.ok(crowded.upperLeft >= 30);
});
test("quick completion is archived independently of parent lifecycle", () => {
  const old = {
    ...blank(),
    quick_checks: [
      { id: "c", text: "견적 회신 확인", created_at: "2026-10-28" },
    ],
  };
  const next = {
    ...old,
    quick_checks: [
      {
        ...old.quick_checks[0],
        completed_at: "2026-10-29",
        completed_by: "동수",
      },
    ],
  };
  assert.match(
    describeChanges(old, next).join(),
    /즉시 확인 완료: 견적 회신 확인/,
  );
  assert.equal(next.status, "예정");
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
