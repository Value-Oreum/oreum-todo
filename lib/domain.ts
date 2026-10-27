export const progressStages = [
  { name: "원활", description: "계획대로 진행되고 있습니다." },
  {
    name: "유지",
    description: "합의된 일정에 따라 경과·회신을 확인하고 있습니다.",
  },
  { name: "지연", description: "약속한 일정이 지나 후속 조치가 필요합니다." },
  {
    name: "막힘",
    description: "결정·지원·외부 조치 없이는 진행하기 어렵습니다.",
  },
  {
    name: "미해결",
    description: "조치 후에도 문제가 남아 해결 방향을 다시 정해야 합니다.",
  },
] as const;
export type Progress = (typeof progressStages)[number]["name"];
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
    title: "흐름을 이어갈 일",
    label: "중요도 높음 · 원활/유지",
    business: "핵심 업무 · 꾸준한 지원",
    note: "중요도가 높고 흐름이 안정적인 업무입니다. 계획과 고객 관계를 꾸준히 살피며 지원하세요.",
    color: "mint",
  },
  {
    id: "focus",
    title: "집중해서 풀어갈 일",
    label: "중요도 높음 · 지연/막힘/미해결",
    business: "중요도 3~5 + 지연·막힘·미해결",
    note: "집중 관리 기준: 중요도 3~5점이며 진행상황이 지연·막힘·미해결인 미완료 업무입니다. 필요한 결정·지원·후속 대응을 확인하세요. 점과 테두리를 강조합니다.",
    color: "peach",
  },
  {
    id: "review",
    title: "안정적으로 유지할 일",
    label: "중요도 낮음 · 원활/유지",
    business: "반복 운영 · 표준화",
    note: "흐름이 안정적인 보조 업무입니다. 적정 수준으로 유지하고 표준화·자동화할 부분을 살펴보세요.",
    color: "lavender",
  },
  {
    id: "quick",
    title: "방식을 점검할 일",
    label: "중요도 낮음 · 지연/막힘/미해결",
    business: "관리 부담 · 지속 여부 검토",
    note: "중요도에 비해 진행이 어려운 업무입니다. 범위·방식·자원 배분을 점검하고 필요하면 보류나 종료를 검토하세요. 자동으로 드롭하지 않습니다.",
    color: "butter",
  },
];
export function progressRank(value: unknown) {
  const index = progressStages.findIndex((stage) => stage.name === value);
  return index < 0 ? null : index + 1;
}
export function quadrant(t: {
  importance: number;
  progress?: Progress | null;
}) {
  const rank = progressRank(t.progress);
  if (!rank) return "unclassified";
  return t.importance >= 3
    ? rank >= 3
      ? "focus"
      : "future"
    : rank >= 3
      ? "quick"
      : "review";
}
export function needsAttention(t: Task) {
  return (
    !t.deleted &&
    !["완료", "드롭"].includes(t.status) &&
    t.importance >= 3 &&
    (progressRank(t.progress) || 0) >= 3
  );
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
    quadrant(t) === "quick" &&
    !["완료", "드롭"].includes(t.status) &&
    now - Date.parse(t.updated_at) >= 14 * 86400000
  );
}
export function describeChanges(old: Task, next: Task) {
  const changes: string[] = [];
  for (const [key, label] of [
    ["importance", "중요도"],
    ["progress", "진행상황"],
    ["processing_type", "처리 유형"],
    ["effort", "예상시간"],
    ["status", "업무 상태"],
  ] as const) {
    if (old[key] !== next[key])
      changes.push(`${label} ${old[key] ?? "미분류"}→${next[key] ?? "미분류"}`);
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
    progress: "원활",
    initial_progress: "원활",
    processing_type: "바로 처리",
    effort: "미정",
    title: "",
    company: "",
    owner: members[0],
    status: "예정",
    description: "",
    due: "",
    importance: 3,
    urgency: 2,
    difficulty: 2,
    initial: { importance: 3, urgency: 2, difficulty: 2 },
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
    progress: progressStages[Number(a[4]) - 1].name,
    initial_progress: progressStages[Number(a[4]) - 1].name,
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
