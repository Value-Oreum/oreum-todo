"use client";
import { useState } from "react";
import { Task, QuickCheck, activeTask } from "../../lib/domain";
export function QuickChecks({
  tasks,
  onAdd,
  onComplete,
  onOpen,
}: {
  tasks: Task[];
  onAdd: (task: Task, text: string) => Promise<boolean>;
  onComplete: (task: Task, item: QuickCheck) => Promise<void>;
  onOpen: (task: Task) => void;
}) {
  const [text, setText] = useState("");
  const [taskId, setTaskId] = useState("");
  const [busy, setBusy] = useState(false);
  const choices = tasks.filter(activeTask);
  const pending = tasks
    .filter((t) => !t.deleted)
    .flatMap((t) =>
      (t.quick_checks || [])
        .filter((c) => !c.completed_at)
        .map((c) => ({ task: t, item: c })),
    )
    .sort((a, b) => a.item.created_at.localeCompare(b.item.created_at));
  return (
    <section className="quick-panel" aria-label="즉시 확인 목록">
      <h2>
        즉시 확인 <b>{pending.length}</b>
      </h2>
      <p>
        오늘 중 확인·회신할 짧은 항목
        <br />
        여러 단계의 일은 매트릭스에 등록
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const task = choices.find((t) => t.id === taskId);
          if (!task || !text.trim() || busy) return;
          setBusy(true);
          try {
            if (await onAdd(task, text.trim())) setText("");
          } finally {
            setBusy(false);
          }
        }}
      >
        <select
          aria-label="즉시 확인 연결 업무"
          required
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
        >
          <option value="">연결할 업무 선택</option>
          {choices.map((t) => (
            <option key={t.id} value={t.id}>
              {t.company ? `${t.company} · ` : ""}
              {t.title}
            </option>
          ))}
        </select>
        <input
          aria-label="즉시 확인 내용"
          placeholder="예: 견적 회신 확인"
          required
          maxLength={240}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button disabled={busy || !text.trim() || !taskId} type="submit">
          + 확인 항목 추가
        </button>
      </form>
      <div className="quick-items">
        {pending.map(({ task, item }) => (
          <div className="quick-item" key={item.id}>
            <button
              className="quick-complete"
              aria-label={`${item.text} 완료`}
              disabled={busy}
              onClick={async () => {
                if (busy) return;
                setBusy(true);
                try {
                  await onComplete(task, item);
                } finally {
                  setBusy(false);
                }
              }}
            >
              ✓
            </button>
            <div>
              <strong>{item.text}</strong>
              <button className="quick-parent" onClick={() => onOpen(task)}>
                {task.title}
              </button>
              <small>
                {new Date(item.created_at).toLocaleDateString("ko-KR", {
                  timeZone: "Asia/Seoul",
                })}{" "}
                등록
              </small>
            </div>
          </div>
        ))}
        {!pending.length && <p>확인할 항목이 없어요.</p>}
      </div>
      <small>
        {busy ? "저장·완료 정리 중…" : "완료하면 연결 업무에 기록됩니다."}
      </small>
    </section>
  );
}
