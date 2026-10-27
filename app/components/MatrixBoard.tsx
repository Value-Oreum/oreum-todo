"use client";
import { useState, useEffect, useRef, Fragment } from "react";
import { Bell } from "lucide-react";
import {
  Task,
  quadrants,
  quadrant,
  changed,
  reviewNeeded,
  progressStages,
  progressRank,
  needsAttention,
} from "../../lib/domain";
import { axisPosition, matrixX } from "../../lib/projects";
import { MOBILE_QUERY } from "../hooks/useMobile";
import { Dialog } from "./Dialog";
import { matrixLayout } from "../../lib/matrix-layout";
export function MatrixBoard({
  tasks,
  onOpen,
}: {
  tasks: Task[];
  onOpen: (task: Task) => void;
}) {
  const [cluster, setCluster] = useState<Task[] | null>(null),
    [nearbySelection, setNearbySelection] = useState(false),
    [meaning, setMeaning] = useState<string | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0, compact: false });
  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({
        width: rect.width,
        height: rect.height,
        compact: matchMedia(MOBILE_QUERY).matches,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const layout = matrixLayout(tasks, size.width, size.height, size.compact);
  function activatePoint(index: number) {
    const item = layout[index];
    const nearby = size.compact
      ? layout
          .filter(
            (other) =>
              Math.abs(other.point.x - item.point.x) < 44 &&
              Math.abs(other.point.y - item.point.y) < 44,
          )
          .flatMap((other) => other.group)
      : item.group;
    if (nearby.length > item.group.length) {
      setNearbySelection(true);
      setCluster(nearby);
    } else if (item.group.length > 1) {
      setNearbySelection(false);
      setCluster(item.group);
    } else onOpen(item.group[0]);
  }

  return (
    <>
      <section
        className="matrix-board"
        aria-label="업무 매트릭스: 가로축 진행상황, 세로축 중요도"
      >
        {tasks.some((t) => !progressRank(t.progress)) && (
          <button
            className="unclassified-toggle"
            onClick={() => (
              setNearbySelection(false),
              setCluster(tasks.filter((t) => !progressRank(t.progress)))
            )}
          >
            미분류 {tasks.filter((t) => !progressRank(t.progress)).length} ·
            설정하기
          </button>
        )}
        <div className="quadrant-backgrounds">
          {quadrants.map((q, i) => (
            <article
              key={q.id}
              className={`map-quadrant ${q.color} ${q.id === "focus" ? "focus-quadrant" : ""}`}
              aria-label={q.title}
            >
              <button
                className="quadrant-caption"
                onClick={() => setMeaning(q.id)}
                title={q.note}
              >
                <span>
                  {["Ⅱ", "Ⅰ", "Ⅲ", "Ⅳ"][i]} · {q.title}
                </span>
                <small>{q.business} ⓘ</small>
                <b>{tasks.filter((t) => quadrant(t) === q.id).length}</b>
              </button>
            </article>
          ))}
        </div>
        <div className="plot" ref={plotRef} aria-label="업무 위치">
          <div className="cross x-cross" />
          <div className="cross y-cross" />
          <span className="axis-label y-label">중요도 ↑</span>
          <span className="axis-label x-label">진행상황 →</span>

          {progressStages.map((stage, index) => (
            <span
              key={stage.name}
              className="axis-tick x-tick progress-tick"
              title={stage.description}
              style={{ left: `${axisPosition(index + 1)}%` }}
            >
              {stage.name}
            </span>
          ))}
          {tasks.some((t) => !progressRank(t.progress)) && (
            <span
              className="axis-tick x-tick progress-tick"
              style={{ left: "6%" }}
            >
              미분류
            </span>
          )}
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={`y${n}`}
              className="axis-tick y-tick"
              style={{ top: `${100 - axisPosition(n)}%` }}
            >
              {n}
            </span>
          ))}
          <svg className="node-connectors" aria-hidden="true">
            {layout
              .filter((item) => item.label)
              .map(({ group, point, label }) => (
                <line
                  key={group[0].id}
                  x1={point.x}
                  y1={point.y}
                  x2={Math.max(
                    label!.x,
                    Math.min(point.x, label!.x + label!.width),
                  )}
                  y2={Math.max(
                    label!.y,
                    Math.min(point.y, label!.y + label!.height),
                  )}
                />
              ))}
          </svg>
          {layout.map(({ group, point, label }, index) => {
            const t = group[0];
            return (
              <Fragment key={`${t.importance}:${t.progress || "unclassified"}`}>
                <button
                  data-node-key={t.id}
                  title={group.map((task) => task.title).join(" · ")}
                  className={`task-node ${label ? "" : "label-hidden"} ${quadrants.find((q) => q.id === quadrant(t))?.color || "unclassified"} ${group.some(needsAttention) ? "attention-node" : ""}`}
                  style={{
                    left: `${matrixX(t)}%`,
                    top: `${100 - axisPosition(t.importance)}%`,
                  }}
                  onClick={() => activatePoint(index)}
                  aria-label={
                    group.length > 1
                      ? `${t.title} 외 ${group.length - 1}개 업무, 중요도 ${t.importance}, 진행상황 ${t.progress || "미분류"}`
                      : t.title
                  }
                >
                  <span className="node-dot" />
                  {group.length > 1 && (
                    <span className="node-count">{group.length}</span>
                  )}
                  {group.some(changed) && (
                    <span
                      className="node-change"
                      title="등록 후 분류 기준 변경"
                      aria-label="기준 변경"
                    >
                      ↔
                    </span>
                  )}
                  {group.some((t) => reviewNeeded(t)) && (
                    <span
                      className="node-review"
                      title="14일 이상 정체 · 지속 여부 검토"
                    >
                      !
                    </span>
                  )}
                </button>
                {label && (
                  <button
                    data-node-key={t.id}
                    className={`task-callout ${quadrants.find((q) => q.id === quadrant(t))?.color || "unclassified"} ${group.some(needsAttention) ? "attention-node" : ""}`}
                    style={{
                      left: label.x,
                      top: label.y,
                      width: label.width,
                      height: label.height,
                    }}
                    onClick={() =>
                      group.length > 1
                        ? (setNearbySelection(false), setCluster(group))
                        : onOpen(t)
                    }
                    title={group.map((task) => task.title).join(" · ")}
                  >
                    <span
                      className="node-card"
                      style={{
                        position: "static",
                        width: "100%",
                        height: "100%",
                      }}
                    >
                      <div className="node-title">
                        <span
                          className="processing-mark"
                          title={t.processing_type || "처리 유형 미분류"}
                          aria-label={t.processing_type || "처리 유형 미분류"}
                        >
                          {t.processing_type === "추적 관리"
                            ? "↻"
                            : t.processing_type === "바로 처리"
                              ? "⚡"
                              : "?"}
                        </span>
                        <h3>{t.title}</h3>
                      </div>
                      <span className="node-meta">
                        {group.length > 1
                          ? `${group.length}개 업무 · 펼치기`
                          : `${t.progress || "미분류"} · ${t.processing_type || "유형 미분류"}`}
                        {t.reminder && <Bell size={12} />}{" "}
                        {changed(t) && (
                          <span title="최초 등록 후 기준 변경">↔</span>
                        )}
                        {reviewNeeded(t) && (
                          <span title="지속 여부 검토">!</span>
                        )}
                      </span>
                    </span>
                  </button>
                )}
              </Fragment>
            );
          })}
          {!tasks.length && (
            <div className="empty-map">
              등록된 업무가 없어요.
              <br />
              상단의 업무 등록으로 시작하세요.
            </div>
          )}
        </div>
      </section>
      {cluster && (
        <Dialog
          className="cluster-dialog"
          label={nearbySelection ? "가까운 업무 선택" : "같은 위치의 업무"}
          onClose={() => setCluster(null)}
        >
          <h2>
            {nearbySelection ? "가까운 업무" : "같은 위치의 업무"}{" "}
            {cluster.length}개
          </h2>
          <p>
            {nearbySelection
              ? "점들이 가까이 있어요. 열고 싶은 업무를 선택해주세요."
              : `중요도 ${cluster[0].importance} · 진행상황 ${cluster[0].progress || "미분류"}`}
          </p>
          {cluster.map((t) => (
            <button
              className="cluster-task"
              key={t.id}
              onClick={() => {
                setCluster(null);
                onOpen(t);
              }}
            >
              <strong>{t.title}</strong>
              <span>
                {t.company || "내부 업무"} · {t.progress || "미분류"} ·{" "}
                {t.processing_type || "유형 미분류"} · {t.status}
                {changed(t) && " · 기준 변경"}
              </span>
            </button>
          ))}
        </Dialog>
      )}
      {meaning && (
        <Dialog
          className="cluster-dialog"
          label="사분면의 사업적 의미"
          onClose={() => setMeaning(null)}
        >
          <h2>{quadrants.find((q) => q.id === meaning)?.title}</h2>
          <h3>{quadrants.find((q) => q.id === meaning)?.business}</h3>
          <p>{quadrants.find((q) => q.id === meaning)?.note}</p>
        </Dialog>
      )}
    </>
  );
}
