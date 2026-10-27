const { chromium } = require("playwright");
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.getByAltText("손을 흔들며 인사하는 오름 캐릭터").waitFor();
  await page.screenshot({ path: "/tmp/oreum-landing.png", fullPage: true });
  await page
    .getByRole("button", { name: "데모 워크스페이스 둘러보기" })
    .click();
  await page.getByRole("heading", { name: /업무 매트릭스/ }).waitFor();
  await page.screenshot({
    path: "/tmp/oreum-matrix-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "업무 등록", exact: true }).click();
  await page
    .getByRole("textbox", { name: "어떤 일인가요?" })
    .fill("테스트 고객사 회신");
  await page.getByRole("button", { name: "업무 저장", exact: true }).click();
  await page
    .getByRole("button")
    .filter({
      has: page.getByRole("heading", {
        name: "테스트 고객사 회신",
        exact: true,
      }),
    })
    .click();
  await page.getByRole("slider", { name: /긴급도/ }).fill("5");
  await page.getByRole("button", { name: "업무 저장", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "우선순위가 바뀐 이유" })
    .first()
    .waitFor();
  await page
    .getByRole("textbox", { name: "기준 변경 사유" })
    .fill("고객 요청으로 오늘 회신 필요");
  await page.getByRole("button", { name: "업무 저장", exact: true }).click();
  await page
    .getByRole("button")
    .filter({
      has: page.getByRole("heading", {
        name: "테스트 고객사 회신",
        exact: true,
      }),
    })
    .click();
  await page.getByText(/고객 요청으로 오늘 회신 필요/).waitFor();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "데모 워크스페이스 둘러보기" })
    .click();
  await page
    .getByRole("heading", { name: "테스트 고객사 회신", exact: true })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/oreum-matrix-mobile.png",
    fullPage: true,
  });
  if (
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
  )
    throw Error("Mobile page overflows viewport");
  const card = () =>
    page.getByRole("button").filter({
      has: page.getByRole("heading", {
        name: "테스트 고객사 회신",
        exact: true,
      }),
    });
  await card().click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "휴지통", exact: true })
    .last()
    .click();
  if (
    await page
      .getByRole("heading", { name: "테스트 고객사 회신", exact: true })
      .count()
  )
    throw Error("Deleted task remained active");
  await page
    .locator("nav")
    .getByRole("button", { name: "휴지통", exact: true })
    .click();
  await card().click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "복원", exact: true }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "업무 매트릭스", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "테스트 고객사 회신", exact: true })
    .waitFor();
  const cron = await page.request.get(`${base}/api/reminders`);
  if (cron.status() !== 401) throw Error("Cron was not protected");
  const ai = await page.request.post(`${base}/api/ai`);
  if (ai.status() !== 403) throw Error("AI was not protected");
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "PASS: demo entry, create, score-change reason guard, history, persistence, mobile fit, trash/restore, protected APIs; no browser errors",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
