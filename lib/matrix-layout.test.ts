import test from "node:test";
import assert from "node:assert/strict";
import { blank } from "./domain.ts";
import { matrixLayout, intersects } from "./matrix-layout.ts";
import { axisPosition } from "./projects.ts";
test("dense maps keep all 25 score points; labels never overlap or cover other points", () => {
  const tasks = Array.from({ length: 25 }, (_, i) => ({
    ...blank(),
    importance: Math.floor(i / 5) + 1,
    urgency: (i % 5) + 1,
    title: `업무 ${i}`,
  }));
  for (const { width, height, compact } of [
    { width: 1100, height: 550, compact: false },
    { width: 344, height: 480, compact: true },
    { width: 314, height: 300, compact: true },
  ]) {
    const layout = matrixLayout(tasks, width, height, compact);
    assert.equal(layout.length, 25);
    const labels = layout.flatMap((item) => (item.label ? [item.label] : []));
    assert.ok(
      labels.length >= 4,
      "layout must show useful labels, not hide everything",
    );
    for (const item of layout) {
      const t = item.group[0];
      assert.equal(item.point.x, (axisPosition(t.urgency) * width) / 100);
      assert.equal(
        item.point.y,
        ((100 - axisPosition(t.importance)) * height) / 100,
      );
      if (!item.label) continue;
      const b = item.label;
      assert.ok(
        b.x >= 0 &&
          b.y >= 0 &&
          b.x + b.width <= width &&
          b.y + b.height <= height,
      );
      assert.ok(t.urgency >= 3 ? b.x >= width / 2 : b.x + b.width <= width / 2);
      assert.ok(
        t.importance >= 3 ? b.y + b.height <= height / 2 : b.y >= height / 2,
      );
      for (const other of layout)
        assert.ok(
          !intersects(
            b,
            {
              x: other.point.x - 7,
              y: other.point.y - 7,
              width: 14,
              height: 14,
            },
            3,
          ),
        );
    }
    for (let i = 0; i < labels.length; i++)
      for (let j = i + 1; j < labels.length; j++)
        assert.ok(!intersects(labels[i], labels[j], 6));
  }
});
