"use client";
import { useState } from "react";
import { X, Bell } from "lucide-react";
import {
  Task,
  quadrants,
  quadrant,
  changed,
  reviewNeeded,
} from "../../lib/domain";
import { scoreGroups, axisPosition } from "../../lib/projects";
export function MatrixBoard({
  tasks,
  onOpen,
}: {
  tasks: Task[];
  onOpen: (task: Task) => void;
}) {
  const [cluster, setCluster] = useState<Task[] | null>(null),
    [meaning, setMeaning] = useState<string | null>(null);
  return (
    <>
      <section
        className="matrix-board"
        aria-label="업무 매트릭스: 가로축 긴급도, 세로축 중요도, 3점부터 높음"
      >
        <div className="quadrant-backgrounds">
          {quadrants.map((q, i) => (
            <article
              key={q.id}
              className={`map-quadrant ${q.color}`}
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
        <div className="plot" aria-label="업무 위치">
          <div className="cross x-cross" />
          <div className="cross y-cross" />
          <span className="axis-label y-label">중요도 ↑</span>
          <span className="axis-label x-label">긴급도 →</span>
          <span className="axis-origin">2.5</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={`x${n}`}
              className="axis-tick x-tick"
              style={{ left: `${axisPosition(n)}%` }}
            >
              {n}
            </span>
          ))}
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={`y${n}`}
              className="axis-tick y-tick"
              style={{ top: `${100 - axisPosition(n)}%` }}
            >
              {n}
            </span>
          ))}
          {scoreGroups(tasks).map((group) => {
            const t = group[0];
            return (
              <button
                key={`${t.importance}:${t.urgency}`}
                title={group.map((task) => task.title).join(" · ")}
                className={`task-node ${[1, 3].includes(t.urgency) ? "anchor-right" : "anchor-left"} ${[2, 5].includes(t.importance) ? "label-below" : t.importance === 1 || t.importance === 3 ? "label-above" : t.urgency % 2 ? "label-below" : "label-above"} ${quadrants.find((q) => q.id === quadrant(t))?.color}`}
                style={{
                  left: `${axisPosition(t.urgency)}%`,
                  top: `${100 - axisPosition(t.importance)}%`,
                }}
                onClick={() =>
                  group.length > 1 ? setCluster(group) : onOpen(t)
                }
                aria-label={
                  group.length > 1
                    ? `${t.title} 외 ${group.length - 1}개 업무, 중요도 ${t.importance}, 긴급도 ${t.urgency}`
                    : undefined
                }
              >
                <span className="node-dot" />
                <span className="node-card">
                  <h3>{t.title}</h3>
                  <span className="node-meta">
                    {group.length > 1
                      ? `${group.length}개 업무 · 펼치기`
                      : t.company || t.status}
                    {t.reminder && <Bell size={12} />}{" "}
                    {changed(t) && (
                      <span title="최초 등록 후 기준 변경">↔</span>
                    )}
                    {reviewNeeded(t) && <span title="지속 여부 검토">!</span>}
                  </span>
                </span>
                {group.length > 1 && (
                  <span className="node-count">{group.length}</span>
                )}
                {group.some(changed) && (
                  <span
                    className="node-change"
                    title="등록 후 중요도·긴급도·난이도 변경"
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
        <div className="map-key">
          1–2 낮음 · 3–5 높음 <span>난이도는 상세에서 확인</span>
        </div>
      </section>
      {cluster && (
        <div className="overlay" onClick={() => setCluster(null)}>
          <section
            className="cluster-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="같은 위치의 업무"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              aria-label="닫기"
              onClick={() => setCluster(null)}
            >
              <X />
            </button>
            <h2>같은 위치의 업무 {cluster.length}개</h2>
            <p>
              중요도 {cluster[0].importance} · 긴급도 {cluster[0].urgency}
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
                  {t.company || "내부 업무"} · {t.status}
                  {changed(t) && " · 기준 변경"}
                </span>
              </button>
            ))}
          </section>
        </div>
      )}
      {meaning && (
        <div className="overlay" onClick={() => setMeaning(null)}>
          <section
            className="cluster-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="사분면의 사업적 의미"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              aria-label="닫기"
              onClick={() => setMeaning(null)}
            >
              <X />
            </button>
            <h2>{quadrants.find((q) => q.id === meaning)?.title}</h2>
            <h3>{quadrants.find((q) => q.id === meaning)?.business}</h3>
            <p>{quadrants.find((q) => q.id === meaning)?.note}</p>
          </section>
        </div>
      )}
    </>
  );
}
