import { createClient } from "@supabase/supabase-js";
export function service() {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL,
    k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!u || !k) throw Error("Supabase 서버 설정이 필요합니다.");
  return createClient(u, k, { auth: { persistSession: false } });
}
export async function authorize(request: Request) {
  const db = service();
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) throw Error("로그인이 필요합니다.");
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw Error("로그인이 만료되었습니다.");
  const member = await db
    .from("members")
    .select("approved")
    .eq("id", data.user.id)
    .single();
  if (!member.data?.approved) throw Error("멤버 승인이 필요합니다.");
  return { db, user: data.user };
}
