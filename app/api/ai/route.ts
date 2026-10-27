import { authorize } from "../../../lib/server";
import {
  claudeRequest,
  claudeDraft,
  type ClaudeContent,
} from "../../../lib/claude";
export async function POST(req: Request) {
  try {
    const { db, user } = await authorize(req);
    if (!process.env.ANTHROPIC_API_KEY)
      return Response.json(
        { error: "Claude API 연결이 필요합니다." },
        { status: 503 },
      );
    if (Number(req.headers.get("content-length") || 0) > 6 * 1024 * 1024)
      return Response.json(
        { error: "이미지는 5MB 이하로 올려주세요." },
        { status: 413 },
      );
    const form = await req.formData();
    const image = form.get("image"),
      text = String(form.get("text") || "").slice(0, 12000);
    const content: ClaudeContent[] = [];
    if (image instanceof File) {
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(image.type) ||
        image.size > 5 * 1024 * 1024
      )
        return Response.json(
          { error: "5MB 이하 PNG/JPEG/WebP만 지원합니다." },
          { status: 400 },
        );
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: image.type as "image/png" | "image/jpeg" | "image/webp",
          data: Buffer.from(await image.arrayBuffer()).toString("base64"),
        },
      });
    }
    if (text) content.push({ type: "text", text });
    if (!content.length)
      return Response.json(
        { error: "캡처 또는 대화 내용을 입력해주세요." },
        { status: 400 },
      );
    const budget = await db.rpc("reserve_ai_call", { actor: user.id });
    if (budget.error) throw budget.error;
    if (!budget.data)
      return Response.json(
        { error: "오늘의 AI 사용 한도에 도달했습니다." },
        { status: 429 },
      );
    let result: Response;
    try {
      result = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          claudeRequest(content, process.env.ANTHROPIC_MODEL),
        ),
        signal: AbortSignal.timeout(45000),
      });
    } catch {
      return Response.json(
        {
          error:
            "Claude 분석 시간이 초과되었거나 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
        },
        { status: 502 },
      );
    }
    if (!result.ok)
      return Response.json(
        {
          error:
            result.status === 429
              ? "Claude 사용량 또는 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요."
              : "Claude 분석에 실패했습니다. API 키, 모델 접근 권한과 결제 설정을 확인해주세요.",
        },
        { status: result.status === 429 ? 429 : 502 },
      );
    try {
      return Response.json(claudeDraft(await result.json()));
    } catch {
      return Response.json(
        {
          error:
            "완전한 업무 초안을 받지 못했습니다. 내용을 줄이거나 다시 시도해주세요.",
        },
        { status: 502 },
      );
    }
  } catch {
    return Response.json(
      { error: "로그인, 멤버 권한 또는 서버 설정을 확인해주세요." },
      { status: 403 },
    );
  }
}
