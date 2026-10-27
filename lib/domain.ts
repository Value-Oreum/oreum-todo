export type Scores = {
  importance: number;
  urgency: number;
  difficulty: number;
};
export type History = { at: string; actor: string; text: string };
export type Task = Scores & {
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
    title: "미래를 심는 일",
    label: "높은 중요도 · 낮은 긴급도",
    business: "미래 먹거리 · 전략 투자",
    note: "당장 급하지 않아도 회사의 다음 성장을 만듭니다. 시간을 미리 확보하고 작은 진전을 이어가세요.",
    color: "mint",
  },
  {
    id: "focus",
    title: "지금 집중할 일",
    label: "높은 중요도 · 높은 긴급도",
    business: "매출 · 고객 신뢰 지키기",
    note: "핵심 고객과 중요한 마감에 직접 영향을 줍니다. 담당자와 다음 행동을 명확히 정하세요.",
    color: "peach",
  },
  {
    id: "review",
    title: "가볍게 덜어낼 일",
    label: "낮은 중요도 · 낮은 긴급도",
    business: "기회비용 · 지속 여부 검토",
    note: "관성적으로 유지하는 일을 살펴보세요. 오래 멈췄고 가치도 낮다면 보류·드롭을 함께 검토하세요.",
    color: "lavender",
  },
  {
    id: "quick",
    title: "빠르게 풀어낼 일",
    label: "낮은 중요도 · 높은 긴급도",
    business: "운영 효율 · 병목 해소",
    note: "작은 요청이 팀의 시간을 잡아먹지 않게, 짧게 처리하거나 위임·자동화하세요.",
    color: "butter",
  },
];
export function quadrant(t: Scores) {
  return t.importance >= 3
    ? t.urgency >= 3
      ? "focus"
      : "future"
    : t.urgency >= 3
      ? "quick"
      : "review";
}
export function changed(t: Task) {
  return ["importance", "urgency", "difficulty"].some(
    (k) => t[k as keyof Scores] !== t.initial[k as keyof Scores],
  );
}
export function reviewNeeded(t: Task, now = Date.now()) {
  return (
    quadrant(t) === "review" &&
    !["완료", "드롭"].includes(t.status) &&
    now - Date.parse(t.updated_at) >= 14 * 86400000
  );
}
export function validateScores(t: Scores) {
  return Object.values(t).every((v) => Number.isInteger(v) && v >= 1 && v <= 5);
}
export function blank(): Task {
  return {
    id: crypto.randomUUID(),
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
