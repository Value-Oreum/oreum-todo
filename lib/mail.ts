import type { Task } from "./domain";
export type ReminderDB = {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
};
type Job = { id: string; task: Task };
export type MailConfig = { apiKey: string; from: string; appUrl: string };
export async function dispatchReminders(
  db: ReminderDB,
  config: MailConfig,
  fetcher: typeof fetch = fetch,
  pause = () => new Promise((resolve) => setTimeout(resolve, 600)),
) {
  const { data, error } = await db.rpc("claim_reminders");
  const jobs = data as Job[] | null;
  if (error) throw error;
  let sent = 0,
    uncertain = 0;
  for (const job of jobs || []) {
    await pause();
    const t = job.task as Task;
    try {
      const response = await fetcher("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": job.id,
        },
        body: JSON.stringify({
          from: config.from,
          to: [t.owner],
          subject: `[오름] ${t.title.slice(0, 100)} · 챙길 시간이에요`,
          text: `${t.title}\n고객사: ${t.company || "내부 업무"}\n진행상황: ${t.progress || "미분류"}\n처리 유형: ${t.processing_type || "미분류"}\n업무 상태: ${t.status}\n${t.description.slice(0, 1500)}\n\n업무 확인: ${config.appUrl}\n알림은 업무 상세에서 끌 수 있습니다.`,
        }),
        signal: AbortSignal.timeout(8000),
      });
      const result = await db.rpc("finish_reminder", {
        job_id: job.id,
        success: response.ok,
      });
      if (result.error) throw result.error;
      if (response.ok) sent++;
    } catch {
      uncertain++;
    }
  }
  return { claimed: jobs?.length || 0, sent, uncertain };
}
