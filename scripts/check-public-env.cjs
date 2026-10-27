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
    "NEXT_PUBLIC_SUPABASE_URL 값에는 https://cvmmxhnoyhnybiniiedc.supabase.co 주소만 입력하세요. 대괄호·소괄호·따옴표·백틱 또는 변수 이름을 포함하지 마세요.",
  );
  process.exit(1);
}
