"use client";
import { useEffect, useState, useRef } from "react";
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
  List,
  LayoutDashboard,
  SlidersHorizontal,
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
  progressLabel,
  type QuickCheck,
  processingTypes,
  effortOptions,
  needsAttention,
  describeChanges,
  eventHistory,
  type History,
} from "../lib/domain";
import { supabase } from "../lib/supabase";
import { Dialog } from "./components/Dialog";
import { useMobile } from "./hooks/useMobile";
import { QuickChecks } from "./components/QuickChecks";
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
  const isMobile = useMobile();
  const [entered, enter] = useState(false),
    [weekly, setWeekly] = useState<{
      summary: string;
      sources: string[];
      partial: boolean;
    } | null>(null),
    [weeklyBusy, setWeeklyBusy] = useState(false),
    [quickOpen, setQuickOpen] = useState(false),
    [flowOpen, setFlowOpen] = useState(false),
    [mobileList, setMobileList] = useState(false),
    [filtersOpen, setFiltersOpen] = useState(false),
    [aiTextOpen, setAiTextOpen] = useState(false),
    [aiText, setAiText] = useState(""),
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
  const aiRequest = useRef<AbortController | null>(null),
    selectedId = useRef<string | undefined>(selected?.id);
  selectedId.current = selected?.id;
  function closeTask() {
    aiRequest.current?.abort();
    select(null);
    setAiText("");
    setAiTextOpen(false);
  }
  useEffect(() => () => aiRequest.current?.abort(), []);
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
      return t;
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
    return saved;
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || busy) return;
    const old = tasks.find((t) => t.id === selected.id);
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
      change_reason: reason.trim() || "사용자 우선순위·상태 판단",
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
            ? `${describeChanges(old, selected).join(", ") || "업무 내용 수정"}${reason.trim() ? " · 사유: " + reason.trim() : " · 사용자 판단"}`
            : "업무 등록",
        },
      ],
    };
    if (await persist(t, selected.updated_at)) {
      select((current) => (current?.id === t.id ? null : current));
      if (selectedId.current === t.id) setReason("");
    }
    setBusy(false);
  }
  async function updateJudgment(t: Task, patch: Partial<Task>, note: string) {
    const at = new Date().toISOString();
    return persist(
      {
        ...t,
        ...patch,
        updated_at: at,
        change_reason: note,
        history: [
          ...t.history,
          {
            at,
            actor: email,
            text: `${describeChanges(t, { ...t, ...patch }).join(", ")} · ${note}`,
          },
        ],
      },
      t.updated_at,
    );
  }
  async function moveTask(t: Task, destination: string) {
    const important = ["future", "focus"].includes(destination);
    const urgent = ["focus", "quick"].includes(destination);
    await updateJudgment(
      t,
      { importance: important ? 5 : 1, urgency: urgent ? 5 : 1 },
      "사용자가 사분면 이동으로 우선순위 판단",
    );
  }
  async function addCheck(t: Task, text: string) {
    if ((t.quick_checks || []).length >= 500) {
      setError(
        "이 업무의 확인 기록이 500개에 도달했습니다. 후속 업무를 만들어 연결해주세요.",
      );
      return false;
    }
    return !!(await updateJudgment(
      t,
      {
        quick_checks: [
          ...(t.quick_checks || []),
          {
            id: crypto.randomUUID(),
            text,
            created_at: new Date().toISOString(),
          },
        ],
      },
      "즉시 확인 등록",
    ));
  }
  async function completeCheck(t: Task, item: QuickCheck) {
    const saved = await updateJudgment(
      t,
      {
        quick_checks: (t.quick_checks || []).map((c) =>
          c.id === item.id
            ? {
                ...c,
                completed_at: new Date().toISOString(),
                completed_by: email,
                ai_status: demo ? "fallback" : "pending",
              }
            : c,
        ),
      },
      "즉시 확인 완료",
    );
    if (!saved || demo) return;
    try {
      const token = (await supabase?.auth.getSession())?.data.session
        ?.access_token;
      const response = await fetch("/api/check-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ taskId: t.id, checkId: item.id }),
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok)
        throw Error(
          "AI 정리를 건너뛰었습니다. 완료 원문은 업무 기록에 저장되었습니다.",
        );
      const { summary } = await response.json();
      // Re-read to preserve changes made by a teammate while AI was running.
      const fresh = await supabase!
        .from("tasks")
        .select("data")
        .eq("id", t.id)
        .single();
      if (fresh.error)
        throw Error("완료 원문은 저장되었습니다. AI 기록 저장을 확인해주세요.");
      const current = fresh.data.data as Task;
      await updateJudgment(
        current,
        {
          quick_checks: (current.quick_checks || []).map((c) =>
            c.id === item.id ? { ...c, summary, ai_status: "done" } : c,
          ),
        },
        "AI 완료 기록 정리 · 원문 보존",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function summarizeWeek() {
    if (weeklyBusy) return;
    if (demo) {
      setWeekly({
        summary:
          "실제 로그인과 Claude 연결 후 최근 7일 완료 기록을 요약합니다. 자동 호출 없이 버튼을 눌렀을 때만 실행합니다.",
        sources: [],
        partial: false,
      });
      return;
    }
    setWeeklyBusy(true);
    try {
      const token = (await supabase?.auth.getSession())?.data.session
        ?.access_token;
      const response = await fetch("/api/weekly-summary", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(30000),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setWeekly(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWeeklyBusy(false);
    }
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
      select((current) => (current?.id === t.id ? null : current));
  }
  async function ai(file?: File, text?: string) {
    const controller = new AbortController();
    aiRequest.current?.abort();
    aiRequest.current = controller;
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
        signal: controller.signal,
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      if (!controller.signal.aborted) {
        select((current) => (current ? { ...current, ...data } : null));
        setAiText("");
        setAiTextOpen(false);
      }
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (aiRequest.current === controller) {
        aiRequest.current = null;
        setBusy(false);
      }
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
    setAiText("");
    setAiTextOpen(false);
    select({
      ...structuredClone(t),
      progress: progressRank(t.progress)
        ? (progressLabel(t.progress) as Task["progress"])
        : null,
    });
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
          OREUM <em>WORKs</em>
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
            ["active", "업무 현황판", LayoutGrid],
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
        {!isMobile && (
          <button
            className="weekly-toggle"
            disabled={weeklyBusy}
            onClick={() => void summarizeWeek()}
          >
            {weeklyBusy ? "요약 중…" : "✦ 최근 7일 완료 요약"}
          </button>
        )}
        {!isMobile && (
          <QuickChecks
            tasks={tasks}
            onAdd={addCheck}
            onComplete={completeCheck}
            onOpen={openTask}
          />
        )}
        <button
          className="profile"
          aria-label="멤버 및 알림 설정"
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
                ? "업무 현황판"
                : view === "archive"
                  ? isMobile
                    ? "완료 보관함"
                    : "잘 마무리한 일들"
                  : isMobile
                    ? "휴지통"
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
                setAiText("");
                setAiTextOpen(false);
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
          <button
            className="mobile-view-toggle"
            aria-pressed={mobileList}
            onClick={() => setMobileList(!mobileList)}
          >
            {mobileList ? <LayoutDashboard size={17} /> : <List size={17} />}{" "}
            {mobileList ? "매트릭스 보기" : "업무 목록"}
          </button>
          <div className="tools">
            <button
              className="mobile-filter-toggle"
              aria-label="검색 및 담당자 필터"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal size={16} /> 검색·필터
              {(query || filter) && <span className="filter-dot" />}
            </button>
            <button
              className="focus-toggle"
              aria-pressed={focusOnly}
              onClick={() => setFocusOnly(!focusOnly)}
              title="중요 예 + 긴급 예인 미완료 업무"
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
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
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
        <div
          className={`board-content ${mobileList ? "show-mobile-list" : ""}`}
        >
          <MatrixBoard
            tasks={visible}
            onOpen={openTask}
            onMove={moveTask}
            onProgress={async (t) => {
              if (
                confirm(
                  "진행상황을 지연/병목으로 바꿀까요? 업데이트가 없다는 이유만으로 자동 변경하지 않습니다.",
                )
              )
                await updateJudgment(
                  t,
                  { progress: "지연/병목" },
                  "7일 미갱신 후보를 사용자가 확인",
                );
            }}
          />
          <section className="mobile-task-list" aria-label="업무 목록">
            {visible.length ? (
              visible.map((t) => (
                <button
                  key={t.id}
                  className={`mobile-task ${needsAttention(t) ? "mobile-task-attention" : ""}`}
                  onClick={() => openTask(t)}
                >
                  <strong>{t.title}</strong>
                  <span>
                    {t.company || "내부 업무"} · {names[t.owner] || t.owner}
                  </span>
                  <span className="mobile-task-badges">
                    <b>{progressLabel(t.progress)}</b>
                    <b>
                      중요 {t.importance >= 3 ? "예" : "아니오"} · 긴급{" "}
                      {t.urgency >= 3 ? "예" : "아니오"}
                    </b>
                    <b>{t.processing_type || "유형 미분류"}</b>
                    {needsAttention(t) && (
                      <b className="attention-chip">집중 관리</b>
                    )}
                  </span>
                </button>
              ))
            ) : (
              <p className="mobile-list-empty">
                표시할 업무가 없어요. 검색어나 필터를 확인해주세요.
              </p>
            )}
          </section>
        </div>
        <footer>
          <span>
            <i className="live-dot" />
            {demo
              ? "예시 데이터 · 실제 팀 동기화 아님"
              : "팀 변경 사항 실시간 반영"}
          </span>
          <span>위치 = 중요·긴급 판단 · 색 = 진행상황</span>
        </footer>
      </main>
      {isMobile && (
        <button
          className="mobile-quick-toggle"
          onClick={() => setQuickOpen(true)}
        >
          즉시 확인{" "}
          {
            tasks
              .filter((t) => !t.deleted)
              .flatMap((t) =>
                (t.quick_checks || []).filter((c) => !c.completed_at),
              ).length
          }
        </button>
      )}
      {weekly && (
        <Dialog
          className="drawer"
          label="최근 7일 완료 요약"
          onClose={() => setWeekly(null)}
        >
          <h2>최근 7일 완료 요약</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{weekly.summary}</p>
          {weekly.partial && (
            <p>
              최근 변경 200건 중 완료 항목 최대 30개를 요약한 일부 결과입니다.
            </p>
          )}
          <details>
            <summary>요약에 사용한 원문 {weekly.sources.length}개</summary>
            {weekly.sources.map((source, i) => (
              <p key={i}>{source}</p>
            ))}
          </details>
          <small>
            AI 요약입니다. 실제 결과는 원문 기록과 함께 확인해주세요.
          </small>
        </Dialog>
      )}
      {quickOpen && (
        <Dialog
          className="drawer quick-dialog"
          label="즉시 확인"
          onClose={() => setQuickOpen(false)}
        >
          <QuickChecks
            tasks={tasks}
            onAdd={addCheck}
            onComplete={completeCheck}
            onOpen={(t) => {
              setQuickOpen(false);
              openTask(t);
            }}
          />
          <button
            className="weekly-toggle"
            disabled={weeklyBusy}
            onClick={() => {
              setQuickOpen(false);
              void summarizeWeek();
            }}
          >
            ✦ 최근 7일 완료 요약
          </button>
        </Dialog>
      )}
      {filtersOpen && (
        <Dialog
          className="cluster-dialog filter-dialog"
          label="검색 및 담당자 필터"
          onClose={() => setFiltersOpen(false)}
        >
          <label>
            업무·고객사 검색
            <input
              aria-label="모바일 업무 검색"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              value={query}
              onChange={(e) => search(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setFiltersOpen(false);
              }}
              placeholder="업무명 또는 고객사"
            />
          </label>
          <label>
            담당자
            <select
              aria-label="모바일 담당자 필터"
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
          </label>
          <div className="filter-actions">
            <button
              onClick={() => {
                search("");
                setFilter("");
                setFocusOnly(false);
              }}
            >
              초기화
            </button>
            <button className="primary" onClick={() => setFiltersOpen(false)}>
              업무 {visible.length}개 보기
            </button>
          </div>
        </Dialog>
      )}
      {flowOpen && (
        <ProjectFlow
          tasks={tasks}
          onClose={() => setFlowOpen(false)}
          onOpen={openTask}
          onAdd={(company) => {
            setFlowOpen(false);
            select({ ...blank(), owner: newOwner, company });
            setAiText("");
            setAiTextOpen(false);
            setReason("");
          }}
        />
      )}
      {selected && (
        <Dialog
          key={selected.id}
          className="drawer"
          label="업무 상세"
          onClose={closeTask}
          dismissOnBackdrop={false}
        >
          <form onSubmit={save}>
            <details className="ai-assist" open={!isMobile}>
              <summary>
                <Sparkles size={16} /> 캡처·대화로 입력 도움받기
              </summary>
              <div className="ai-box">
                <Sparkles size={18} />
                <span>{busy ? "처리 중…" : "대화 캡처로 빠르게 채우기"}</span>
                <label
                  className="upload"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.currentTarget.querySelector("input")?.click();
                    }
                  }}
                >
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
                  onClick={() => setAiTextOpen(!aiTextOpen)}
                >
                  텍스트
                </button>
              </div>
              {aiTextOpen && (
                <div className="ai-text-composer">
                  <label>
                    대화 내용
                    <textarea
                      aria-label="대화 내용"
                      rows={5}
                      maxLength={12000}
                      value={aiText}
                      onChange={(e) => setAiText(e.target.value)}
                      placeholder="대화 내용을 여기에 붙여넣으세요"
                    />
                  </label>
                  <button
                    type="button"
                    className="primary"
                    disabled={busy || !aiText.trim()}
                    onClick={() => void ai(undefined, aiText.trim())}
                  >
                    {busy ? "분석 중…" : "분석해 채우기"}
                  </button>
                </div>
              )}
              <small>
                캡처·텍스트는 외부 AI로 전송됩니다. 민감정보를 확인하고
                업로드하세요. AI 초안은 저장 전에 확인해주세요. 원본은 저장하지
                않습니다.
              </small>
            </details>
            <label>
              어떤 일인가요?
              <input
                autoFocus={!isMobile}
                required
                maxLength={160}
                value={selected.title}
                onChange={(e) => select({ ...selected, title: e.target.value })}
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
                  {["예정", "진행 중", "회신 대기", "보류", "완료", "드롭"].map(
                    (s) => (
                      <option key={s}>{s}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                마감일
                <input
                  type="date"
                  value={selected.due}
                  onChange={(e) => select({ ...selected, due: e.target.value })}
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
                    "카드 색상으로 표시됩니다. 직접 선택해주세요."}
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
              {(["importance", "urgency"] as const).map((key) => (
                <label key={key}>
                  {key === "importance" ? "중요한가요?" : "긴급한가요?"}
                  <select
                    aria-label={key === "importance" ? "중요" : "긴급"}
                    value={selected[key] >= 3 ? "yes" : "no"}
                    onChange={(e) =>
                      select({
                        ...selected,
                        [key]: e.target.value === "yes" ? 5 : 1,
                      })
                    }
                  >
                    <option value="yes">예</option>
                    <option value="no">아니오</option>
                  </select>
                </label>
              ))}
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
                먼저 집중할 일 · 중요 예 + 긴급 예. 담당자와 다음 행동을
                정해주세요.
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
                  과거 척도와 변경 기록은 보존됩니다. 현재 위치는 중요·긴급 각각
                  예/아니오로 판단합니다.
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
                기준 변경 메모 (선택)
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="판단 이유를 남기고 싶다면 적어주세요"
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
          {!!selected.quick_checks?.some((c) => c.completed_at) && (
            <section className="completed-checks">
              <h3>즉시 확인 완료 기록</h3>
              {selected.quick_checks
                .filter((c) => c.completed_at)
                .map((c) => (
                  <article key={c.id}>
                    <strong>✓ {c.text}</strong>
                    <p>
                      {c.summary
                        ? `AI 정리: ${c.summary}`
                        : "원문으로 완료 기록 보존"}
                    </p>
                    <small>
                      {names[c.completed_by || ""] || c.completed_by} ·{" "}
                      {new Date(c.completed_at!).toLocaleString("ko-KR")} · 업무
                      전체 완료와 별개
                    </small>
                  </article>
                ))}
            </section>
          )}
          <section className="history">
            <h3>
              <HistoryIcon size={18} /> 차곡차곡 쌓인 히스토리
            </h3>
            {historyNotice && <p className="history-notice">{historyNotice}</p>}
            {(serverHistory || selected.history).length === 0 ? (
              <p>첫 기록이 곧 시작돼요.</p>
            ) : (
              [...(serverHistory || selected.history)].reverse().map((h, i) => (
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
        </Dialog>
      )}
      {admin && (
        <Dialog
          className="admin"
          label="멤버 및 알림 설정"
          onClose={() => setAdmin(false)}
        >
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
        </Dialog>
      )}
    </div>
  );
}
