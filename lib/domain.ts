export const progressStages = [
  {
    name: "순항",
    description: "계획대로 진행하거나 합의된 일정에 따라 확인 중입니다.",
  },
  {
    name: "지연/병목",
    description: "일정이 늦어지거나 결정·지원이 필요합니다.",
  },
  {
    name: "이슈",
    description: "해결해야 할 문제가 있어 먼저 살펴봐야 합니다.",
  },
] as const;
export type Progress =
  | (typeof progressStages)[number]["name"]
  | "원활"
  | "유지"
  | "지연"
  | "막힘"
  | "미해결";
export function progressLabel(value: unknown): string {
  if (value === "원활" || value === "유지") return "순항";
  if (value === "지연" || value === "막힘") return "지연/병목";
  if (value === "미해결") return "이슈";
  return progressStages.some((s) => s.name === value)
    ? String(value)
    : "미분류";
}
export type QuickCheck = {
  id: string;
  text: string;
  created_at: string;
  completed_at?: string;
  completed_by?: string;
  summary?: string;
  ai_status?: "pending" | "done" | "fallback";
};
export const processingTypes = ["바로 처리", "추적 관리"] as const;
export type ProcessingType = (typeof processingTypes)[number];
export const effortOptions = [
  "미정",
  "10분",
  "30분",
  "2시간",
  "반나절",
  "하루 이상",
] as const;
export type Scores = {
  importance: number;
  urgency: number;
  difficulty: number;
};
export type History = { at: string; actor: string; text: string };
export type Task = Scores & {
  quick_checks?: QuickCheck[];
  progress?: Progress | null;
  initial_progress?: Progress | null;
  processing_type?: ProcessingType;
  effort?: string;
  change_reason?: string;
  id: string;
  title: string;
  company: string;
  owner: string;
  status: string;
  description: string;
  due: string;
  initial: Scores;
  history: History[];
  updated_at: string;
  deleted: boolean;
  reminder: boolean;
  reminder_at: string;
  repeat_days: number;
};
export const members = [
  "eastsea.chae@gmail.com",
  "unboundedvalue@gmail.com",
  "echa.value@gmail.com",
];
export const quadrants = [
  {
    id: "future",
    title: "계획하고 키울 일",
    label: "중요 예 · 긴급 아니오",
    business: "미래 성장 · 미리 투자",
    note: "당장 급하지 않아도 회사의 미래를 만드는 일입니다. 실행 시간을 확보하고 꾸준히 진척시키세요.",
    color: "mint",
  },
  {
    id: "focus",
    title: "먼저 집중할 일",
    label: "중요 예 · 긴급 예",
    business: "핵심 성과 · 즉시 집중",
    note: "중요하고 긴급한 업무·프로젝트입니다. 담당자와 다음 행동을 정하고 먼저 자원을 배분하세요. 오늘의 단순 확인·회신은 즉시 확인 목록에서 관리합니다.",
    color: "peach",
  },
  {
    id: "review",
    title: "줄이거나 재검토할 일",
    label: "중요 아니오 · 긴급 아니오",
    business: "범위 축소 · 지속 여부 검토",
    note: "우선순위가 낮은 업무입니다. 유지할 가치와 투입 시간을 비교해 간소화·보류·종료를 판단하세요. 자동으로 드롭하지 않습니다.",
    color: "lavender",
  },
  {
    id: "quick",
    title: "위임하고 정리할 일",
    label: "중요 아니오 · 긴급 예",
    business: "빠른 대응 · 위임",
    note: "기한은 가깝지만 핵심 영향은 작은 일입니다. 위임하거나 범위를 줄여 중요한 일의 시간을 확보하세요.",
    color: "butter",
  },
];
export function progressRank(value: unknown) {
  const index = progressStages.findIndex(
    (stage) => stage.name === progressLabel(value),
  );
  return index < 0 ? null : index + 1;
}
export function quadrant(t: { importance: number; urgency: number }) {
  return t.importance >= 3
    ? t.urgency >= 3
      ? "focus"
      : "future"
    : t.urgency >= 3
      ? "quick"
      : "review";
}
export const activeTask = (t: Task) =>
  !t.deleted && !["완료", "드롭"].includes(t.status);
export function needsAttention(t: Task) {
  return activeTask(t) && quadrant(t) === "focus";
}
export function dueSignal(t: Task, now = Date.now()) {
  if (!activeTask(t) || t.urgency >= 3 || !/^\d{4}-\d{2}-\d{2}$/.test(t.due))
    return false;
  const today = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
  const days = (Date.parse(t.due) - Date.parse(today)) / 86400000;
  return Number.isFinite(days) && days <= 7;
}
export function staleSignal(t: Task, now = Date.now()) {
  return (
    activeTask(t) &&
    progressLabel(t.progress) === "순항" &&
    now - Date.parse(t.updated_at) >= 7 * 86400000
  );
}
// Bounded weights keep all four regions visible, even when one region dominates.
export function quadrantSizes(tasks: Task[]) {
  const weight = (id: string) =>
    Math.sqrt(tasks.filter((t) => quadrant(t) === id).length + 1);
  const split = (a: number, b: number) =>
    Math.max(30, Math.min(70, (100 * a) / (a + b)));
  return {
    top: split(
      weight("future") + weight("focus"),
      weight("review") + weight("quick"),
    ),
    upperLeft: split(weight("future"), weight("focus")),
    lowerLeft: split(weight("review"), weight("quick")),
  };
}
export function changed(t: Task) {
  return (
    ["importance", "urgency", "difficulty"].some(
      (k) => t[k as keyof Scores] !== t.initial[k as keyof Scores],
    ) || !!(t.initial_progress && t.progress !== t.initial_progress)
  );
}
export function reviewNeeded(t: Task, now = Date.now()) {
  return (
    activeTask(t) &&
    quadrant(t) === "review" &&
    now - Date.parse(t.updated_at) >= 14 * 86400000
  );
}
export function describeChanges(old: Task, next: Task) {
  const changes: string[] = [];
  for (const [key, label] of [
    ["importance", "중요"],
    ["urgency", "긴급"],
    ["progress", "진행상황"],
    ["processing_type", "처리 유형"],
    ["effort", "예상시간"],
    ["status", "업무 상태"],
  ] as const) {
    if (old[key] !== next[key])
      changes.push(
        `${label} ${key === "importance" || key === "urgency" ? (old[key] >= 3 ? "예" : "아니오") : (old[key] ?? "미분류")}→${key === "importance" || key === "urgency" ? (next[key] >= 3 ? "예" : "아니오") : (next[key] ?? "미분류")}`,
      );
  }
  if (
    old.reminder_at !== next.reminder_at &&
    (old.processing_type === "추적 관리" ||
      next.processing_type === "추적 관리")
  )
    changes.push(
      `다음 확인일 ${formatCheckDate(old.reminder_at)}→${formatCheckDate(next.reminder_at)}`,
    );
  if (old.reminder !== next.reminder)
    changes.push(`이메일 알림 ${next.reminder ? "켜짐" : "꺼짐"}`);
  for (const check of next.quick_checks || []) {
    const before = old.quick_checks?.find((c) => c.id === check.id);
    if (!before) changes.push(`즉시 확인 추가: ${check.text}`);
    else if (!before.completed_at && check.completed_at)
      changes.push(`즉시 확인 완료: ${check.text}`);
    else if (check.summary && check.summary !== before.summary)
      changes.push(`AI 완료 정리: ${check.summary} (원문: ${check.text})`);
  }
  return changes;
}
export function formatCheckDate(value: string) {
  return value && !Number.isNaN(Date.parse(value))
    ? new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
    : "미설정";
}
export function eventHistory(
  events: { at: string; old_data: Task | null; new_data: Task }[],
): History[] {
  return events.map((event) => {
    const tail = event.new_data.history?.at(-1);
    const changes = event.old_data
      ? describeChanges(event.old_data, event.new_data)
      : [];
    return {
      at: event.at,
      actor: tail?.actor || "시스템",
      text: changes.length
        ? `${changes.join(", ")}${event.new_data.change_reason && !["알림 시스템", "시스템"].includes(tail?.actor || "") ? " · 사유: " + event.new_data.change_reason : ""}`
        : tail?.text || "업무 기록",
    };
  });
}
export function validateScores(t: Scores) {
  return Object.values(t).every((v) => Number.isInteger(v) && v >= 1 && v <= 5);
}
export function blank(): Task {
  return {
    id: crypto.randomUUID(),
    progress: "순항",
    initial_progress: "순항",
    processing_type: "바로 처리",
    effort: "미정",
    title: "",
    company: "",
    owner: members[0],
    status: "예정",
    description: "",
    due: "",
    importance: 5,
    urgency: 1,
    difficulty: 2,
    initial: { importance: 5, urgency: 1, difficulty: 2 },
    history: [],
    updated_at: new Date().toISOString(),
    deleted: false,
    reminder: false,
    reminder_at: "",
    repeat_days: 0,
  };
}
export function samples(): Task[] {
  return [
    ["브랜드 리뉴얼 방향 잡기", "OREUM", "future", 5, 2, "진행 중"],
    ["신규 파트너십 제안서", "블루포인트", "future", 4, 1, "예정"],
    ["하반기 계약 조건 회신", "모노랩", "focus", 5, 5, "회신 대기"],
    ["런칭 페이지 최종 확인", "스튜디오 온", "focus", 4, 4, "진행 중"],
    ["지난 캠페인 자료 정리", "OREUM", "review", 2, 1, "보류"],
    ["미팅 일정 확정하기", "그린웍스", "quick", 2, 4, "예정"],
  ].map((a, i) => ({
    ...blank(),
    title: String(a[0]),
    company: String(a[1]),
    importance: Number(a[3]),
    urgency: Number(a[4]),
    progress: progressStages[i % 3].name,
    initial_progress: progressStages[i % 3].name,
    processing_type: i % 2 ? "추적 관리" : "바로 처리",
    reminder_at: i % 2 ? new Date(Date.now() + 86400000).toISOString() : "",
    difficulty: (i % 3) + 1,
    status: String(a[5]),
    owner: members[i % 3],
    initial: {
      importance: Number(a[3]),
      urgency: Number(a[4]),
      difficulty: (i % 3) + 1,
    },
    history: [
      { at: new Date().toISOString(), actor: "데모", text: "예시 업무 등록" },
    ],
  }));
}
