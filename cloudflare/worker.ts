import { dispatchReminders } from "../lib/mail";
interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RESEND_API_KEY: string;
  RESEND_FROM: string;
  APP_URL: string;
}
export default {
  // No public endpoint can trigger mail delivery or expose secret values.
  async fetch() {
    return new Response("Not found", { status: 404 });
  },
  async scheduled(_event: unknown, env: Env) {
    if (
      !env.SUPABASE_URL ||
      !env.SUPABASE_SERVICE_ROLE_KEY ||
      !env.RESEND_API_KEY ||
      !env.RESEND_FROM ||
      !env.APP_URL
    )
      throw Error(
        "Configure required Worker secrets before enabling reminders.",
      );
    const db = {
      async rpc(name: string, args?: Record<string, unknown>) {
        const response = await fetch(
          new URL(`/rest/v1/rpc/${name}`, env.SUPABASE_URL),
          {
            method: "POST",
            headers: {
              apikey: env.SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(args || {}),
            signal: AbortSignal.timeout(10000),
          },
        );
        if (!response.ok)
          return { data: null, error: new Error("Database RPC failed") };
        const text = await response.text();
        return { data: text ? JSON.parse(text) : null, error: null };
      },
    };
    // Small batches fit the free-plan limits. Errors are visible in Worker logs.
    const outcome = await dispatchReminders(db, {
      apiKey: env.RESEND_API_KEY,
      from: env.RESEND_FROM,
      appUrl: env.APP_URL,
    });
    console.log(JSON.stringify({ event: "daily_reminders", ...outcome }));
    if (outcome.uncertain)
      throw Error(
        "Some deliveries need review in reminder_jobs; no automatic resend.",
      );
  },
};
