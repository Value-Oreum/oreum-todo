"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Plus,
  Search,
  ArrowRight,
  Bell,
  X,
  ChevronRight,
  Check,
  History as HistoryIcon,
  Sparkles,
  LayoutGrid,
  Archive,
  LogOut,
  Users,
  Trash2,
  RotateCcw,
} from "lucide-react";
import {
  Task,
  Scores,
  blank,
  samples,
  quadrants,
  quadrant,
  members,
  progressStages,
  progressRank,
  processingTypes,
  effortOptions,
  needsAttention,
  describeChanges,
  eventHistory,
  type History,
} from "../lib/domain";
import { supabase } from "../lib/supabase";
import { MatrixBoard } from "./components/MatrixBoard";
import { ProjectFlow } from "./components/ProjectFlow";
import { projectGroups, projectKey } from "../lib/projects";
const assignees = [members[0], members[2]];
const names: Record<string, string> = {
  "eastsea.chae@gmail.com": "동수",
  "unboundedvalue@gmail.com": "공용 계정",
  "echa.value@gmail.com": "형원",
};
export default function Home() {
  const [entered, enter] = useState(false),
    [flowOpen, setFlowOpen] = useState(false),
    [focusOnly, setFocusOnly] = useState(false),
    [serverHistory, setServerHistory] = useState<History[] | null>(null),
    [historyNotice, setHistoryNotice] = useState(""),
    [demo, setDemo] = useState(false),
    [email, setEmail] = useState(""),
    [approved, setApproved] = useState(false),
    [tasks, setTasks] = useState<Task[]>([]),
    [selected, select] = useState<Task | null>(null),
    [query, search] = useState(""),
    [view, setView] = useState("active"),
    [filter, setFilter] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(""),
    [admin, setAdmin] = useState(false),
    [pending, setPending] = useState<{ email: string; id: string }[]>([]),
    [memberList, setMemberList] = useState(members),
    [mailJobs, setMailJobs] = useState<
      { id: string; state: string; created_at: string }[]
    >([]);
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    async function load() {
      const {
        data: { session },
      } = await client.auth.getSession();
      if (!session) return;
      setEmail((session.user.email || "").toLowerCase());
      const { data, error } = await client
        .from("members")
        .select("approved,role")
        .eq("id", session.user.id)
        .single();
      if (error) {
        setError(error.message);
        return;
      }
      setApproved(!!data?.approved);
      enter(true);
      if (data?.approved) {
        const roster = await client
          .from("members")
          .select("email")
          .eq("approved", true);
        if (roster.data) setMemberList(roster.data.map((m) => m.email));
        const r = await client.from("tasks").select("data");
        if (r.error) setError(r.error.message);
        else setTasks((r.data || []).map((t) => t.data));
      }
    }
    void load();
    const { data: auth } = client.auth.onAuthStateChange(() => {
      setTimeout(() => void load(), 0);
    });
    const ch = client
      .channel("tasks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => void load(),
      )
      .subscribe();
    return () => {
      auth.subscription.unsubscribe();
      void client.removeChannel(ch);
    };
  }, []);
  useEffect(() => {
    setServerHistory(null);
    setHistoryNotice("");
    if (
      demo ||
      !supabase ||
      !selected ||
      !tasks.some((t) => t.id === selected.id)
    )
      return;
    let active = true;
    void supabase
      .from("task_events")
      .select("at,old_data,new_data")
      .eq("task_id", selected.id)
      .order("id", { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setHistoryNotice(
            "상세 변경 이력을 불러오지 못해 저장된 기록을 표시합니다.",
          );
          return;
        }
        const current = eventHistory((data || []).reverse());
        const earliest = current.length ? Date.parse(current[0].at) : Infinity;
        setServerHistory([
          ...selected.history.filter((h) => Date.parse(h.at) < earliest),
          ...current,
        ]);
      });
    return () => {
      active = false;
    };
  }, [demo, selected?.id, tasks]);
  function startDemo() {
    setDemo(true);
    setApproved(true);
    setEmail(members[0]);
    try {
      const saved = localStorage.getItem("oreum-demo");
      setTasks(saved ? JSON.parse(saved) : samples());
    } catch {
      setTasks(samples());
    }
    enter(true);
  }
  async function persist(t: Task, expectedUpdate?: string) {
    setError("");
    if (demo) {
      setTasks((old) => {
        const next = old.some((x) => x.id === t.id)
          ? old.map((x) => (x.id === t.id ? t : x))
          : [...old, t];
        localStorage.setItem("oreum-demo", JSON.stringify(next));
        return next;
      });
      return true;
    }
    if (!supabase) return false;
    const existing = tasks.find((x) => x.id === t.id);
    const payload = { id: t.id, data: t, updated_at: t.updated_at };
    const result = existing
      ? await supabase
          .from("tasks")
          .update(payload)
          .eq("id", t.id)
          .eq("updated_at", expectedUpdate || existing.updated_at)
          .select("data")
          .maybeSingle()
      : await supabase.from("tasks").insert(payload).select("data").single();
    if (result.error || !result.data) {
      setError(
        result.error?.message ||
          "다른 팀원이 먼저 변경했습니다. 최신 내용을 열어 다시 저장해주세요.",
      );
      return false;
    }
    const saved = result.data.data as Task;
    setTasks((old) =>
      old.some((x) => x.id === t.id)
        ? old.map((x) => (x.id === t.id ? saved : x))
        : [...old, saved],
    );
    return true;
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || busy) return;
    const old = tasks.find((t) => t.id === selected.id);
    const criterionChanged =
      !!old &&
      (old.importance !== selected.importance ||
        (!!progressRank(old.progress) && old.progress !== selected.progress));
    if (!progressRank(selected.progress)) {
      setError("진행상황을 선택해주세요.");
      return;
    }
    if (!selected.processing_type) {
      setError("처리 유형을 선택해주세요.");
      return;
    }
    if (
      selected.processing_type === "추적 관리" &&
      (!selected.reminder_at || Number.isNaN(Date.parse(selected.reminder_at)))
    ) {
      setError("추적 관리 업무의 다음 확인일을 입력해주세요.");
      return;
    }
    if (criterionChanged && !reason.trim()) {
      setError("중요도나 진행상황이 바뀐 이유를 짧게 남겨주세요.");
      return;
    }
    setBusy(true);
    const at = new Date().toISOString();
    const t = {
      ...selected,
      title: selected.title.trim(),
      company:
        projectOptions.find((p) => p.key === projectKey(selected.company))
          ?.name || selected.company.trim(),
      updated_at: at,
      initial_progress:
        old?.initial_progress || old?.progress || selected.progress,
      change_reason: reason.trim(),
      initial: old?.initial || {
        importance: selected.importance,
        urgency: selected.urgency,
        difficulty: selected.difficulty,
      },
      history: [
        ...(old?.history || []),
        {
          at,
          actor: email,
          text: old
            ? `${describeChanges(old, selected).join(", ") || "업무 내용 수정"}${reason.trim() ? " · 사유: " + reason.trim() : ""}`
            : "업무 등록",
        },
      ],
    };
    if (await persist(t, selected.updated_at)) {
      select(null);
      setReason("");
    }
    setBusy(false);
  }
  async function remove(t: Task) {
    if (
      !confirm(
        t.deleted
          ? "이 업무를 복원할까요?"
          : "휴지통으로 이동할까요? 히스토리는 보존됩니다.",
      )
    )
      return;
    const at = new Date().toISOString();
    if (
      await persist({
        ...t,
        deleted: !t.deleted,
        updated_at: at,
        history: [
          ...t.history,
          { at, actor: email, text: t.deleted ? "업무 복원" : "휴지통 이동" },
        ],
      })
    )
      select(null);
  }
  async function ai(file?: File, text?: string) {
    setBusy(true);
    setError("");
    try {
      if (demo)
        throw Error(
          "AI 분석은 실제 로그인과 Claude 연결 후 사용할 수 있습니다.",
        );
      const token = (await supabase?.auth.getSession())?.data.session
        ?.access_token;
      const body = new FormData();
      if (file) body.set("image", file);
      if (text) body.set("text", text);
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      select({ ...blank(), ...data, owner: newOwner });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const visible = tasks.filter(
    (t) =>
      (view === "trash"
        ? t.deleted
        : !t.deleted &&
          (view === "archive"
            ? ["완료", "드롭"].includes(t.status)
            : !["완료", "드롭"].includes(t.status))) &&
      (!filter || t.owner === filter) &&
      (!focusOnly || needsAttention(t)) &&
      `${t.title} ${t.company}`.toLowerCase().includes(query.toLowerCase()),
  );
  const projects = projectGroups(tasks);
  const projectOptions = projectGroups(tasks, true);
  const newOwner = assignees.includes(email) ? email : assignees[0];
  function openTask(t: Task) {
    select(structuredClone(t));
    setReason("");
    setFlowOpen(false);
  }
  if (!entered)
    return (
      <main className="landing">
        <div className="landing-art">
          <Image
            src="/oreum-wave.png"
            alt="손을 흔들며 인사하는 오름 캐릭터"
            width={224}
            height={193}
            priority
          />
        </div>
        <h1>
          What to do
          <br />
          for <em>OREUM</em>
        </h1>
        <button
          className="primary"
          onClick={async () => {
            if (!supabase) {
              startDemo();
              return;
            }
            const { error } = await supabase.auth.signInWithOAuth({
              provider: "google",
              options: { redirectTo: location.origin },
            });
            if (error) setError(error.message);
          }}
        >
          시작하기 <ArrowRight size={18} />
        </button>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </main>
    );
  if (!approved)
    return (
      <main className="landing">
        <h1>조금만 기다려주세요 🌱</h1>
        <p>
          {email}
          <br />
          관리자 승인 후 함께할 수 있어요.
        </p>
        <button
          onClick={() => {
            void supabase?.auth.signOut();
            enter(false);
          }}
        >
          로그아웃
        </button>
      </main>
    );
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-icon">o.</span>
          <span>
            OREUM<small>우리의 일을, 가볍게.</small>
          </span>
        </a>
        <div className="workspace">
          <span>✳</span> 오름 워크스페이스 <ChevronRight size={15} />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {[
            ["active", "업무 매트릭스", LayoutGrid],
            ["archive", "완료 보관함", Archive],
            ["trash", "휴지통", Trash2],
          ].map(([v, label, Icon]) => (
            <button
              key={String(v)}
              className={view === v ? "active" : ""}
              onClick={() => {
                setView(String(v));
                setFocusOnly(false);
              }}
            >
              {typeof Icon !== "string" && <Icon size={18} />} {String(label)}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Image
            src="/oreum-wave.png"
            alt="응원하는 오름"
            width={85}
            height={73}
          />
          <strong>
            오늘의 작은 진전이
            <br />
            내일의 오름을 만들어요.
          </strong>
          <p>
            일을 위한 일은 줄이고,
            <br />
            중요한 일에 집중해요.
          </p>
        </div>
        <button
          className="profile"
          onClick={() => {
            setAdmin(true);
            if (!demo)
              void supabase
                ?.from("reminder_jobs")
                .select("id,state,created_at")
                .order("created_at", { ascending: false })
                .limit(30)
                .then(({ data, error }) => {
                  if (error) setError(error.message);
                  else setMailJobs(data || []);
                });
            if (!demo)
              void supabase
                ?.from("members")
                .select("id,email")
                .eq("approved", false)
                .then(({ data }) => setPending(data || []));
          }}
        >
          <span className="avatar">{names[email]?.[0] || "O"}</span>
          <span>
            {names[email] || email}
            <small>{email === members[0] ? "관리자" : "멤버"}</small>
          </span>
          <Users size={17} />
        </button>
      </aside>
      <main className="main">
        <section className="heading">
          <div>
            <h1>
              {view === "active"
                ? "업무 매트릭스"
                : view === "archive"
                  ? "잘 마무리한 일들"
                  : "잠시 내려놓은 일들"}
            </h1>
          </div>
          <div className="heading-actions">
            {demo && <span className="demo">체험 모드</span>}
            <button
              className="logout"
              aria-label="로그아웃"
              onClick={() => {
                if (!demo) void supabase?.auth.signOut();
                enter(false);
                setDemo(false);
              }}
            >
              <LogOut size={16} />
            </button>
            <button
              className="primary"
              onClick={() => {
                select({ ...blank(), owner: newOwner });
                setReason("");
              }}
            >
              <Plus size={16} /> 업무 등록
            </button>
          </div>
        </section>
        <div className="toolbar">
          <div className="tabs">
            <button
              className={!filter ? "chosen" : ""}
              onClick={() => setFilter("")}
            >
              전체 업무
            </button>
            <button
              className={filter === email ? "chosen" : ""}
              onClick={() => setFilter(email)}
            >
              내 업무
            </button>
          </div>
          <div className="tools">
            <button
              className="focus-toggle"
              aria-pressed={focusOnly}
              onClick={() => setFocusOnly(!focusOnly)}
              title="중요도 3~5 + 지연·막힘·미해결인 미완료 업무"
            >
              집중 관리 {tasks.filter(needsAttention).length}
            </button>
            <button className="flow-toggle" onClick={() => setFlowOpen(true)}>
              프로젝트 흐름
            </button>
            <label className="search">
              <Search size={16} />
              <input
                aria-label="업무 검색"
                placeholder="업무, 고객사 검색"
                value={query}
                onChange={(e) => search(e.target.value)}
              />
            </label>
            <select
              aria-label="담당자 필터"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">모든 담당자</option>
              {assignees.map((m) => (
                <option key={m} value={m}>
                  {names[m]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && (
          <div role="alert" className="error">
            {error}
            <button onClick={() => setError("")}>
              <X size={14} />
            </button>
          </div>
        )}
        <MatrixBoard tasks={visible} onOpen={openTask} />
        <footer>
          <span>
            <i className="live-dot" />
            {demo
              ? "예시 데이터 · 실제 팀 동기화 아님"
              : "팀 변경 사항 실시간 반영"}
          </span>
          <span>⚡ 바로 처리 · ↻ 추적 관리 · 밀집된 업무는 점을 눌러 확인</span>
        </footer>
      </main>
      {flowOpen && (
        <ProjectFlow
          tasks={tasks}
          onClose={() => setFlowOpen(false)}
          onOpen={openTask}
          onAdd={(company) => {
            setFlowOpen(false);
            select({ ...blank(), owner: newOwner, company });
            setReason("");
          }}
        />
      )}
      {selected && (
        <div className="overlay" onClick={() => select(null)}>
          <section
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="업무 상세"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-head">
              <span>
                {tasks.some((t) => t.id === selected.id)
                  ? "업무 살펴보기"
                  : "새로운 일의 시작"}
              </span>
              <button aria-label="닫기" onClick={() => select(null)}>
                <X />
              </button>
            </div>
            <form onSubmit={save}>
              <h2>
                {tasks.some((t) => t.id === selected.id)
                  ? "업무 상세"
                  : "가볍게 기록해요 ✦"}
              </h2>
              <div className="ai-box">
                <Sparkles size={18} />
                <span>{busy ? "처리 중…" : "대화 캡처로 빠르게 채우기"}</span>
                <label className="upload">
                  캡처 업로드
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void ai(f);
                    }}
                  />
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const text = prompt(
                      "대화 내용을 붙여넣으세요. 외부 AI로 전송됩니다.",
                    );
                    if (text) void ai(undefined, text);
                  }}
                >
                  텍스트
                </button>
              </div>
              <small>
                캡처·텍스트는 외부 AI로 전송됩니다. 민감정보를 확인하고
                업로드하세요. AI 초안은 저장 전에 확인해주세요. 원본은 저장하지
                않습니다.
              </small>
              <label>
                어떤 일인가요?
                <input
                  autoFocus
                  required
                  maxLength={160}
                  value={selected.title}
                  onChange={(e) =>
                    select({ ...selected, title: e.target.value })
                  }
                  placeholder="예: 모노랩 계약 조건 회신하기"
                />
              </label>
              <div className="form-row">
                <label>
                  고객사 / 프로젝트
                  <input
                    list="project-options"
                    maxLength={120}
                    value={selected.company}
                    onChange={(e) =>
                      select({ ...selected, company: e.target.value })
                    }
                  />
                  <datalist id="project-options">
                    {projectOptions.map((p) => (
                      <option key={p.key} value={p.name} />
                    ))}
                  </datalist>
                </label>
                <label>
                  담당자
                  <select
                    value={selected.owner}
                    onChange={(e) =>
                      select({ ...selected, owner: e.target.value })
                    }
                  >
                    {!assignees.includes(selected.owner) && (
                      <option value={selected.owner} disabled>
                        기존 담당자 ({names[selected.owner] || selected.owner})
                      </option>
                    )}
                    {assignees.map((m) => (
                      <option key={m} value={m}>
                        {names[m]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>
                  업무 상태
                  <select
                    value={selected.status}
                    onChange={(e) =>
                      select({ ...selected, status: e.target.value })
                    }
                  >
                    {[
                      "예정",
                      "진행 중",
                      "회신 대기",
                      "보류",
                      "완료",
                      "드롭",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  마감일
                  <input
                    type="date"
                    value={selected.due}
                    onChange={(e) =>
                      select({ ...selected, due: e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  진행상황
                  <select
                    aria-label="진행상황"
                    required
                    value={selected.progress || ""}
                    onChange={(e) =>
                      select({
                        ...selected,
                        progress: e.target.value as Task["progress"],
                      })
                    }
                  >
                    <option value="" disabled>
                      진행상황 선택
                    </option>
                    {progressStages.map((stage) => (
                      <option key={stage.name} value={stage.name}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                  <small>
                    {progressStages.find(
                      (stage) => stage.name === selected.progress,
                    )?.description ||
                      "기존 긴급도와 다른 기준입니다. 직접 선택해주세요."}
                  </small>
                </label>
                <label>
                  처리 유형
                  <select
                    aria-label="처리 유형"
                    required
                    value={selected.processing_type || ""}
                    onChange={(e) =>
                      select({
                        ...selected,
                        processing_type: e.target
                          .value as Task["processing_type"],
                      })
                    }
                  >
                    <option value="" disabled>
                      처리 유형 선택
                    </option>
                    {processingTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                  <small>
                    {selected.processing_type === "추적 관리"
                      ? "회신·협의·경과를 확인하면서 처리"
                      : "정보와 권한이 있어 한 번의 조치로 처리"}
                  </small>
                </label>
              </div>
              <div className="scores new-scores">
                <label>
                  중요도 <b>{selected.importance}</b>
                  <input
                    aria-label="중요도"
                    type="range"
                    min={1}
                    max={5}
                    value={selected.importance}
                    onChange={(e) =>
                      select({ ...selected, importance: +e.target.value })
                    }
                  />
                  <small>
                    1~2 일반 · 3~5 중요 / 최초 {selected.initial.importance}
                  </small>
                </label>
                <label>
                  처리 예상시간 (선택)
                  <select
                    value={selected.effort || "미정"}
                    onChange={(e) =>
                      select({ ...selected, effort: e.target.value })
                    }
                  >
                    {effortOptions.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                  <small>처리 계획을 위한 참고 정보</small>
                </label>
              </div>
              {needsAttention(selected) && (
                <div className="attention-explainer" role="note">
                  집중 관리 대상 · 중요도 3~5 + 지연·막힘·미해결. 필요한
                  결정·지원·후속 대응을 챙겨주세요.
                </div>
              )}
              {tasks.some((t) => t.id === selected.id) && (
                <details className="legacy-scores">
                  <summary>기존 분류 기록</summary>
                  <p>
                    최초 중요도 {selected.initial.importance} · 기존 긴급도{" "}
                    {selected.urgency} · 기존 난이도 {selected.difficulty}
                  </p>
                  <small>
                    긴급도·난이도 기록은 보존하며 새 좌표에는 사용하지 않습니다.
                  </small>
                </details>
              )}
              <div className="placement">
                현재 위치 ·{" "}
                {quadrants.find((q) => q.id === quadrant(selected))?.title ||
                  "진행상황 미분류"}
              </div>
              {tasks.some((t) => t.id === selected.id) && (
                <label>
                  기준 변경 사유
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="중요도·진행상황이 바뀌었다면 이유를 남겨주세요"
                  />
                </label>
              )}
              <label>
                내용과 다음 행동
                <textarea
                  rows={4}
                  value={selected.description}
                  onChange={(e) =>
                    select({ ...selected, description: e.target.value })
                  }
                  placeholder="무엇을 했고, 다음에는 무엇을 챙기면 될까요?"
                />
              </label>
              <div className="reminder-box">
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={selected.reminder}
                    onChange={(e) =>
                      select({ ...selected, reminder: e.target.checked })
                    }
                  />
                  <Bell size={16} /> 이메일로 챙겨주기
                </label>
                {(selected.reminder ||
                  selected.processing_type === "추적 관리") && (
                  <>
                    <label>
                      {selected.processing_type === "추적 관리"
                        ? "다음 확인일 (기기 시간대)"
                        : "알림 기준 시각 (기기 시간대)"}
                      <input
                        type="datetime-local"
                        required
                        value={
                          selected.reminder_at
                            ? new Date(
                                new Date(selected.reminder_at).getTime() -
                                  new Date().getTimezoneOffset() * 60000,
                              )
                                .toISOString()
                                .slice(0, 16)
                            : ""
                        }
                        onChange={(e) =>
                          select({
                            ...selected,
                            reminder_at: e.target.value
                              ? new Date(e.target.value).toISOString()
                              : "",
                          })
                        }
                      />
                    </label>
                    <small>
                      {selected.reminder
                        ? "메일은 매일 한국 시간 오전 9시에 확인해 하루 최대 5건 발송합니다. 초과분은 다음 실행으로 이월하며 예약 시각에 즉시 발송되지는 않습니다."
                        : "다음 확인일은 저장됩니다. 이메일 알림을 켠 경우에만 메일을 발송합니다."}
                    </small>
                    <label>
                      이메일 반복 주기
                      <select
                        disabled={!selected.reminder}
                        value={selected.repeat_days}
                        onChange={(e) =>
                          select({ ...selected, repeat_days: +e.target.value })
                        }
                      >
                        <option value={0}>한 번만</option>
                        <option value={7}>매주</option>
                        <option value={14}>2주마다</option>
                        <option value={30}>30일마다</option>
                      </select>
                    </label>
                    <small>
                      {demo
                        ? "체험 모드에서는 실제 메일이 발송되지 않습니다."
                        : selected.reminder
                          ? "담당자에게 발송 · 사용량 한도 초과 시 대기"
                          : "이메일 알림 꺼짐 · 다음 확인일만 관리"}
                    </small>
                  </>
                )}
              </div>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <div className="form-actions">
                {tasks.some((t) => t.id === selected.id) && (
                  <button
                    type="button"
                    className="danger"
                    onClick={() => void remove(selected)}
                  >
                    {selected.deleted ? (
                      <RotateCcw size={16} />
                    ) : (
                      <Trash2 size={16} />
                    )}{" "}
                    {selected.deleted ? "복원" : "휴지통"}
                  </button>
                )}
                <button
                  className="primary"
                  disabled={busy || !selected.title.trim()}
                >
                  <Check size={16} />
                  {busy ? "저장 중…" : "업무 저장"}
                </button>
              </div>
            </form>
            {selected.company.trim() && (
              <section className="related-flow">
                <h3>{selected.company} · 연결된 업무</h3>
                <ol>
                  {projects
                    .find((p) => p.key === projectKey(selected.company))
                    ?.tasks.map((t) => (
                      <li key={t.id}>
                        <button
                          className={t.id === selected.id ? "current" : ""}
                          onClick={() => openTask(t)}
                        >
                          <strong>{t.title}</strong>
                          <small>{t.status}</small>
                        </button>
                      </li>
                    ))}
                </ol>
                <button
                  className="flow-toggle"
                  onClick={() => {
                    setFlowOpen(true);
                    select(null);
                  }}
                >
                  프로젝트 전체 흐름 보기 →
                </button>
              </section>
            )}
            <section className="history">
              <h3>
                <HistoryIcon size={18} /> 차곡차곡 쌓인 히스토리
              </h3>
              {historyNotice && (
                <p className="history-notice">{historyNotice}</p>
              )}
              {(serverHistory || selected.history).length === 0 ? (
                <p>첫 기록이 곧 시작돼요.</p>
              ) : (
                [...(serverHistory || selected.history)]
                  .reverse()
                  .map((h, i) => (
                    <div key={i}>
                      <span className="history-dot" />
                      <strong>{h.text}</strong>
                      <small>
                        {names[h.actor] || h.actor} ·{" "}
                        {new Date(h.at).toLocaleString("ko-KR")}
                      </small>
                    </div>
                  ))
              )}
            </section>
          </section>
        </div>
      )}
      {admin && (
        <div className="overlay" onClick={() => setAdmin(false)}>
          <section className="admin" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setAdmin(false)}>
              <X />
            </button>
            <h2>함께하는 멤버</h2>
            {memberList.map((m) => (
              <p key={m}>
                {m} {m === members[0] ? "· 관리자" : "· 멤버"}
              </p>
            ))}
            {email === members[0] &&
              pending.map((m) => (
                <p key={m.id}>
                  {m.email}
                  <button
                    onClick={async () => {
                      const r = await supabase
                        ?.from("members")
                        .update({ approved: true })
                        .eq("id", m.id);
                      if (r?.error) setError(r.error.message);
                      else setPending((p) => p.filter((x) => x.id !== m.id));
                    }}
                  >
                    승인
                  </button>
                </p>
              ))}
            <h3>최근 알림 발송</h3>
            {mailJobs.map((j) => (
              <p key={j.id}>
                {new Date(j.created_at).toLocaleString("ko-KR")} ·{" "}
                {j.state === "sent"
                  ? "발송 완료"
                  : j.state === "failed"
                    ? "발송 실패 · 확인 필요"
                    : "처리 중 · 오래 지속되면 확인 필요"}
              </p>
            ))}
            <small>
              {demo
                ? "데모에서는 승인 기능을 실행하지 않습니다."
                : "신규 로그인 사용자는 관리자 승인 후 접근할 수 있습니다."}
            </small>
          </section>
        </div>
      )}
    </div>
  );
}
