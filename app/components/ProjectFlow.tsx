"use client";
import { Plus, ArrowUpRight } from "lucide-react";
import { Task, quadrant, quadrants } from "../../lib/domain";
import { Dialog } from "./Dialog";
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
    <Dialog
      className="project-panel"
      label="고객사·프로젝트 업무 연결"
      onClose={onClose}
    >
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
                        {t.progress || "진행상황 미분류"} ·{" "}
                        {t.processing_type || "유형 미분류"} · {t.status} ·{" "}
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
    </Dialog>
  );
}
