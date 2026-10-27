"use client";
import { X, Plus, ArrowUpRight } from "lucide-react";
import { Task, quadrant, quadrants } from "../../lib/domain";
import { projectGroups } from "../../lib/projects";
export function ProjectFlow({
  tasks,
  onOpen,
  onAdd,
  onClose,
}: {
  tasks: Task[];
  onOpen: (task: Task) => void;
  onAdd: (project: string) => void;
  onClose: () => void;
}) {
  const groups = projectGroups(tasks);
  return (
    <div className="overlay" onClick={onClose}>
      <section
        className="project-panel"
        role="dialog"
        aria-modal="true"
        aria-label="고객사·프로젝트 업무 연결"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-head">
          <h2>고객사·프로젝트 흐름</h2>
          <button aria-label="닫기" onClick={onClose}>
            <X />
          </button>
        </div>
        <p>
          같은 프로젝트의 업무를 등록 순서로 연결했어요. 노드를 누르면 상세와
          히스토리가 열립니다.
        </p>
        {!groups.length && (
          <p>업무에 고객사나 프로젝트를 입력하면 여기에 연결됩니다.</p>
        )}
        <div className="project-groves">
          {groups.map((g) => (
            <article className="project-tree" key={g.key}>
              <div className="project-root">
                <strong>{g.name}</strong>
                <span>{g.tasks.length}개 업무</span>
                <button
                  aria-label={`${g.name} 업무 추가`}
                  onClick={() => onAdd(g.name)}
                >
                  <Plus size={18} />
                </button>
              </div>
              <ol>
                {g.tasks.map((t) => (
                  <li key={t.id}>
                    <button className="project-task" onClick={() => onOpen(t)}>
                      <span className="flow-dot" />
                      <span>
                        <strong>{t.title}</strong>
                        <small>
                          {t.status} ·{" "}
                          {quadrants.find((q) => q.id === quadrant(t))?.title}
                        </small>
                      </span>
                      <ArrowUpRight size={16} />
                    </button>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
