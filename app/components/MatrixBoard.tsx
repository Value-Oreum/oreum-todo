"use client";
import { useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import {
  Task,
  quadrants,
  quadrant,
  quadrantSizes,
  progressLabel,
  changed,
  dueSignal,
  staleSignal,
  activeTask,
} from "../../lib/domain";
import { Dialog } from "./Dialog";
import { useMobile } from "../hooks/useMobile";
export function MatrixBoard({
  tasks,
  onOpen,
  onMove,
  onProgress,
}: {
  tasks: Task[];
  onOpen: (task: Task) => void;
  onMove: (task: Task, quadrant: string) => Promise<void>;
  onProgress: (task: Task) => Promise<void>;
}) {
  const [meaning, setMeaning] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(
    null,
  );
  const [target, setTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [announcement, announce] = useState("");
  const [now, setNow] = useState(Date.now());
  const locked = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const compact = useMobile();
  const weights = quadrantSizes(tasks);
  const keepReadable = (size: number) =>
    compact ? Math.max(40, Math.min(60, size)) : size;
  const sizes = {
    top: keepReadable(weights.top),
    upperLeft: keepReadable(weights.upperLeft),
    lowerLeft: keepReadable(weights.lowerLeft),
  };
  async function move(task: Task, q: string) {
    if (locked.current || quadrant(task) === q) return;
    locked.current = true;
    setSaving(task.id);
    try {
      await onMove(task, q);
      announce("이동 요청 처리 완료. 오류가 있으면 상단에 표시됩니다.");
    } finally {
      setSaving(null);
      locked.current = false;
    }
  }
  const regionAt = (x: number, y: number) =>
    document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-quadrant]")
      ?.dataset.quadrant || null;
  return (
    <>
      <div className="priority-legend">
        <span className="state-good">● 순항</span>
        <span className="state-delay">● 지연/병목</span>
        <span className="state-issue">● 이슈 · 빨간 테두리</span>
        <span>⠿ 끌어 이동</span>
      </div>
      <section
        className="matrix-board priority-board"
        aria-label="우선순위 매트릭스: 가로 긴급, 세로 중요"
        style={{ gridTemplateRows: `${sizes.top}fr ${100 - sizes.top}fr` }}
      >
        {[quadrants.slice(0, 2), quadrants.slice(2)].map((row, r) => (
          <div
            className="priority-row"
            key={r}
            style={{
              gridTemplateColumns: `${r === 0 ? sizes.upperLeft : sizes.lowerLeft}fr ${100 - (r === 0 ? sizes.upperLeft : sizes.lowerLeft)}fr`,
            }}
          >
            {row.map((q) => (
              <article
                key={q.id}
                data-quadrant={q.id}
                className={`priority-region ${q.color} ${target === q.id ? "drop-target" : ""}`}
              >
                <div className="region-heading">
                  <strong>
                    {q.title}{" "}
                    <b>{tasks.filter((t) => quadrant(t) === q.id).length}</b>
                  </strong>
                  <small>{q.business}</small>
                </div>
                <button
                  className="region-meaning"
                  aria-label={`${q.label} · 영역 설명`}
                  onClick={() => setMeaning(q.id)}
                  title={q.note}
                >
                  <span>
                    중요{" "}
                    <b>
                      {q.id === "future" || q.id === "focus" ? "예" : "아니오"}
                    </b>
                  </span>
                  <span>
                    긴급{" "}
                    <b>
                      {q.id === "focus" || q.id === "quick" ? "예" : "아니오"}
                    </b>
                  </span>
                  <span className="meaning-icon" aria-hidden="true">
                    ⓘ
                  </span>
                </button>
                <div
                  className="priority-cards"
                  tabIndex={0}
                  aria-label={`${q.title} 업무 목록`}
                >
                  {tasks
                    .filter((t) => quadrant(t) === q.id)
                    .map((t) => {
                      const progress = progressLabel(t.progress);
                      return (
                        <div
                          key={t.id}
                          data-task-id={t.id}
                          className={`priority-card ${progress === "이슈" ? "issue-card" : progress === "지연/병목" ? "delay-card" : progress === "순항" ? "good-card" : "unknown-card"} ${drag?.id === t.id ? "dragging-card" : ""}`}
                        >
                          <div className="priority-card-top">
                            <button
                              className="drag-handle"
                              aria-label={`${t.title} 끌어 이동`}
                              disabled={!!saving || !activeTask(t)}
                              onPointerDown={(e) => {
                                if (e.button !== 0 || locked.current) return;
                                e.currentTarget.setPointerCapture(e.pointerId);
                                setDrag({
                                  id: t.id,
                                  x: e.clientX,
                                  y: e.clientY,
                                });
                                setTarget(q.id);
                              }}
                              onPointerMove={(e) => {
                                if (
                                  !e.currentTarget.hasPointerCapture(
                                    e.pointerId,
                                  )
                                )
                                  return;
                                setDrag({
                                  id: t.id,
                                  x: e.clientX,
                                  y: e.clientY,
                                });
                                setTarget(regionAt(e.clientX, e.clientY));
                              }}
                              onPointerUp={(e) => {
                                if (
                                  !e.currentTarget.hasPointerCapture(
                                    e.pointerId,
                                  )
                                )
                                  return;
                                const destination = regionAt(
                                  e.clientX,
                                  e.clientY,
                                );
                                e.currentTarget.releasePointerCapture(
                                  e.pointerId,
                                );
                                setDrag(null);
                                setTarget(null);
                                if (destination) void move(t, destination);
                              }}
                              onPointerCancel={() => {
                                setDrag(null);
                                setTarget(null);
                              }}
                              onLostPointerCapture={() => {
                                setDrag(null);
                                setTarget(null);
                              }}
                            >
                              <GripVertical size={18} />
                            </button>
                            <button
                              className="priority-open"
                              onClick={() => onOpen(t)}
                            >
                              <strong>{t.title}</strong>
                              <small>{t.company || "내부 업무"}</small>
                            </button>
                          </div>
                          <div className="priority-card-meta">
                            <span>● {progress}</span>
                            {changed(t) && (
                              <span title="최초 등록 후 기준 변경">
                                ↔ 변경
                              </span>
                            )}
                          </div>
                          {dueSignal(t, now) && (
                            <button
                              className="watch-signal"
                              disabled={!!saving}
                              onClick={() =>
                                void move(
                                  t,
                                  t.importance >= 3 ? "focus" : "quick",
                                )
                              }
                            >
                              마감 {t.due} · 긴급 칸으로 옮길까요? →
                            </button>
                          )}
                          {staleSignal(t, now) && (
                            <button
                              className="watch-signal"
                              disabled={!!saving}
                              onClick={async () => {
                                if (locked.current) return;
                                locked.current = true;
                                setSaving(t.id);
                                try {
                                  await onProgress(t);
                                } finally {
                                  locked.current = false;
                                  setSaving(null);
                                }
                              }}
                            >
                              7일 미갱신 · 지연/병목 후보 확인
                            </button>
                          )}
                          {activeTask(t) && (
                            <select
                              aria-label={`${t.title} 사분면 이동`}
                              value={q.id}
                              disabled={!!saving}
                              onChange={(e) => void move(t, e.target.value)}
                            >
                              {quadrants.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      );
                    })}
                  {!tasks.some((t) => quadrant(t) === q.id) && (
                    <p className="region-empty">카드를 이곳으로 옮겨보세요</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        ))}
      </section>
      {drag && (
        <div
          className="drag-preview"
          style={{ left: drag.x + 12, top: drag.y + 12 }}
        >
          놓아서 우선순위 변경
        </div>
      )}
      <span className="sr-only" role="status">
        {announcement}
      </span>
      {meaning && (
        <Dialog
          className="cluster-dialog"
          label="사분면 의미"
          onClose={() => setMeaning(null)}
        >
          <h2>{quadrants.find((q) => q.id === meaning)?.title}</h2>
          <p>{quadrants.find((q) => q.id === meaning)?.note}</p>
          <p>
            업무 수에 따라 공간이 늘어납니다. 넘치는 카드는 각 영역 안에서
            스크롤하세요.
          </p>
        </Dialog>
      )}
    </>
  );
}
