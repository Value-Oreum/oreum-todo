const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(
    "Cloudflare Build variables에 다음 항목을 등록하세요: " +
      missing.join(", "),
  );
  process.exit(1);
}
try {
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (url.protocol !== "https:") throw Error();
} catch {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL은 유효한 HTTPS 프로젝트 URL이어야 합니다.",
  );
  process.exit(1);
}
