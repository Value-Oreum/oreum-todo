import test from "node:test";
import assert from "node:assert/strict";
import { blank } from "./domain.ts";
import { projectGroups, projectKey } from "./projects.ts";
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
