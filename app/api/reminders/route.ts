import { service } from "../../../lib/server";
import { dispatchReminders } from "../../../lib/mail";
export const maxDuration = 60;
// Optional authenticated manual endpoint. Automatic scheduling is in Cloudflare.
export async function GET(req: Request) {
  const key = process.env.CRON_SECRET;
  if (!key || req.headers.get("authorization") !== `Bearer ${key}`)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM)
    return Response.json(
      { error: "Resend configuration required" },
      { status: 503 },
    );
  try {
    return Response.json(
      await dispatchReminders(service(), {
        apiKey: process.env.RESEND_API_KEY,
        from: process.env.RESEND_FROM,
        appUrl: process.env.NEXT_PUBLIC_APP_URL || "",
      }),
    );
  } catch {
    return Response.json(
      {
        error:
          "Reminder processing failed; inspect server and database configuration.",
      },
      { status: 500 },
    );
  }
}
