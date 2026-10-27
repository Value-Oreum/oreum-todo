import test from "node:test";
import assert from "node:assert/strict";
import { blank } from "./domain.ts";
import {
  projectGroups,
  projectKey,
  scoreGroups,
  axisPosition,
} from "./projects.ts";
test("project suggestions deduplicate whitespace, case and unicode; archive stays linked but trash excluded", () => {
  const first = {
      ...blank(),
      company: " Oreum ",
      history: [{ at: "2026-01-01", actor: "a", text: "new" }],
    },
    second = {
      ...blank(),
      company: "OREUM",
      status: "완료",
      history: [{ at: "2026-02-01", actor: "a", text: "new" }],
    },
    deleted = { ...blank(), company: "삭제", deleted: true };
  const g = projectGroups([second, deleted, first]);
  assert.equal(g.length, 1);
  assert.equal(projectGroups([second, deleted, first], true).length, 2);
  assert.equal(g[0].tasks[0].id, first.id);
  assert.equal(g[0].tasks.length, 2);
  assert.equal(projectKey("ＯＲＥＵＭ"), projectKey("oreum"));
});
test("same score tasks form clusters; all scores stay in correct side of centered 2.5 axes", () => {
  const a = blank(),
    b = { ...blank() },
    c = { ...blank(), urgency: 5 };
  assert.deepEqual(
    scoreGroups([a, b, c]).map((g) => g.length),
    [2, 1],
  );
  for (const n of [1, 2]) assert.ok(axisPosition(n) < 50);
  for (const n of [3, 4, 5]) assert.ok(axisPosition(n) > 50);
  assert.ok(axisPosition(5) < 100);
});
