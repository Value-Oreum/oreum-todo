import { progressRank, type Task } from "./domain.ts";
import { scoreGroups, axisPosition, matrixX } from "./projects.ts";
export type Box = { x: number; y: number; width: number; height: number };
export const intersects = (a: Box, b: Box, gap = 0) =>
  a.x < b.x + b.width + gap &&
  a.x + a.width + gap > b.x &&
  a.y < b.y + b.height + gap &&
  a.y + a.height + gap > b.y;
// Only callout positions move. Task points always preserve their actual scores.
export function matrixLayout(
  tasks: Task[],
  width: number,
  height: number,
  compact: boolean,
) {
  const groups = scoreGroups(tasks).sort(
    (a, b) =>
      b[0].importance - a[0].importance ||
      (progressRank(a[0].progress) || 0) - (progressRank(b[0].progress) || 0),
  );
  const points = groups.map((group) => ({
    x: (matrixX(group[0]) * width) / 100,
    y: ((100 - axisPosition(group[0].importance)) * height) / 100,
  }));
  const used: Box[] = [];
  const w = compact
      ? Math.min(90, width * 0.25)
      : Math.min(180, Math.max(110, width * 0.145)),
    h = compact ? 28 : 70;
  return groups.map((group, i) => {
    const t = group[0],
      point = points[i];
    const xMin = (progressRank(t.progress) || 0) >= 3 ? width / 2 + 14 : 0,
      xMax = (progressRank(t.progress) || 0) >= 3 ? width : width / 2 - 14;
    const yMin = t.importance >= 3 ? 0 : height / 2 + 14,
      yMax = t.importance >= 3 ? height / 2 - 14 : height;
    const xs = [
      point.x + 12,
      point.x - w - 12,
      point.x - w / 2,
      xMin,
      xMax - w,
    ];
    const ys = [
      point.y + 12,
      point.y - h - 12,
      point.y - h / 2,
      yMin,
      yMax - h,
    ];
    for (let y = yMin; y + h <= yMax; y += h + 7) ys.push(y);
    for (let x = xMin; x + w <= xMax; x += w + 7) xs.push(x);
    const candidates = xs
      .flatMap((x) => ys.map((y) => ({ x, y, width: w, height: h })))
      .filter(
        (b) =>
          b.x >= xMin &&
          b.y >= yMin &&
          b.x + w <= xMax &&
          b.y + h <= yMax &&
          !used.some((other) => intersects(b, other, 6)) &&
          !points.some((p) =>
            intersects(b, { x: p.x - 7, y: p.y - 7, width: 14, height: 14 }, 3),
          ),
      );
    candidates.sort(
      (a, b) =>
        Math.hypot(a.x + w / 2 - point.x, a.y + h / 2 - point.y) -
        Math.hypot(b.x + w / 2 - point.x, b.y + h / 2 - point.y),
    );
    const label = candidates[0] || null;
    if (label) used.push(label);
    return { group, point, label };
  });
}
