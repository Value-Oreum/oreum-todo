import test from "node:test";
import assert from "node:assert/strict";
import {
  quadrant,
  changed,
  reviewNeeded,
  validateScores,
  blank,
} from "./domain.ts";
test("all business quadrants and threshold", () => {
  assert.equal(quadrant({ importance: 3, urgency: 3, difficulty: 1 }), "focus");
  assert.equal(
    quadrant({ importance: 5, urgency: 2, difficulty: 5 }),
    "future",
  );
  assert.equal(
    quadrant({ importance: 2, urgency: 2, difficulty: 1 }),
    "review",
  );
  assert.equal(quadrant({ importance: 2, urgency: 3, difficulty: 1 }), "quick");
});
test("difficulty changes flagged without moving quadrant", () => {
  const t = blank();
  t.difficulty = 5;
  assert.ok(changed(t));
  assert.equal(quadrant(t), quadrant(t.initial));
});
test("staleness alone never recommends dropping high importance work", () => {
  const t = { ...blank(), updated_at: "2020-01-01T00:00:00Z" };
  assert.equal(reviewNeeded(t), false);
  t.importance = 1;
  t.urgency = 1;
  assert.equal(reviewNeeded(t), true);
  t.status = "완료";
  assert.equal(reviewNeeded(t), false);
});
test("reject scores outside five integer levels", () => {
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
