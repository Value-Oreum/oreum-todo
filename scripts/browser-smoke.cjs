const { chromium } = require("playwright");
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1366, height: 768 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.getByAltText("손을 흔들며 인사하는 오름 캐릭터").waitFor();
  await page.screenshot({ path: "/tmp/oreum-landing.png", fullPage: true });
  if ((await page.locator(".landing button").count()) !== 1)
    throw Error("Landing has extra buttons");
  if (
    await page
      .locator(".landing p,.landing small,.landing .eyebrow,.landing .brand")
      .count()
  )
    throw Error("Landing has unnecessary copy");
  if (
    (await page
      .locator(".landing-art")
      .evaluate((el) => getComputedStyle(el).animationName)) === "none"
  )
    throw Error("Mascot animation missing");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator(".landing-art").hover();
  if (
    (await page
      .locator(".landing-art")
      .evaluate((el) => getComputedStyle(el).animationName)) !== "none"
  )
    throw Error("Reduced motion ignored");
  await page.emulateMedia({ reducedMotion: "no-preference" });

  await page.getByRole("button", { name: "시작하기", exact: true }).click();
  await page.getByRole("heading", { name: /업무 매트릭스/ }).waitFor();
  for (const size of [
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
    { width: 375, height: 667 },
    { width: 360, height: 640 },
  ]) {
    await page.setViewportSize(size);
    const bounds = await page.locator(".matrix-board").boundingBox();
    if (
      !bounds ||
      bounds.y < 0 ||
      bounds.y + bounds.height > size.height ||
      bounds.height < 200
    )
      throw Error(
        `Matrix not fully visible: ${JSON.stringify(size)} ${JSON.stringify(bounds)}`,
      );
    if (
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth > innerWidth ||
          document.documentElement.scrollHeight > innerHeight,
      )
    )
      throw Error(`Page scrolls: ${JSON.stringify(size)}`);
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.evaluate(() => document.fonts.ready);
  if (
    !(await page.evaluate(() =>
      document.fonts.check('16px "Pretendard Variable"'),
    ))
  )
    throw Error("Pretendard did not load");
  await page.screenshot({
    path: "/tmp/oreum-matrix-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "업무 등록", exact: true }).click();
  await page
    .getByRole("textbox", { name: "어떤 일인가요?" })
    .fill("테스트 고객사 회신");
  await page
    .getByRole("combobox", { name: "고객사 / 프로젝트", exact: true })
    .fill("테스트 프로젝트");
  const owners = await page
    .getByRole("combobox", { name: "담당자", exact: true })
    .locator("option")
    .allTextContents();
  if (JSON.stringify(owners) !== JSON.stringify(["동수", "형원"]))
    throw Error("Unexpected assignee options " + owners);
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
  await page.getByRole("button", { name: "시작하기", exact: true }).click();
  await page
    .getByRole("heading", { name: "테스트 고객사 회신", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "업무 등록", exact: true }).click();
  const options = await page
    .locator("#project-options option")
    .evaluateAll((nodes) => nodes.map((n) => n.value));
  if (!options.includes("테스트 프로젝트"))
    throw Error("Saved project not suggested");
  await page
    .getByRole("textbox", { name: "어떤 일인가요?" })
    .fill("프로젝트 후속 업무");
  await page
    .getByRole("combobox", { name: "고객사 / 프로젝트", exact: true })
    .fill("테스트 프로젝트");
  await page.getByRole("button", { name: "업무 저장", exact: true }).click();
  await page
    .getByRole("button", { name: "프로젝트 흐름", exact: true })
    .click();
  const tree = page.locator(".project-tree").filter({
    has: page.locator(".project-root strong", { hasText: "테스트 프로젝트" }),
  });
  if ((await tree.locator("li").count()) !== 2)
    throw Error("Expected two connected project nodes");
  await page.screenshot({
    path: "/tmp/oreum-project-flow.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.getByRole("button", { name: "업무 등록", exact: true }).click();
  await page
    .getByRole("textbox", { name: "어떤 일인가요?" })
    .fill("프로젝트 연락 확인");
  await page
    .getByRole("combobox", { name: "고객사 / 프로젝트", exact: true })
    .fill("테스트 프로젝트");
  await page.getByRole("button", { name: "업무 저장", exact: true }).click();
  await page
    .getByRole("button", { name: /프로젝트 후속 업무 외 1개 업무/ })
    .click();
  const cluster = page.getByRole("dialog", { name: "같은 위치의 업무" });
  await cluster.getByRole("button", { name: /프로젝트 연락 확인/ }).click();
  await page
    .getByRole("textbox", { name: "어떤 일인가요?" })
    .filter({ visible: true })
    .waitFor();
  if (
    (await page
      .getByRole("textbox", { name: "어떤 일인가요?" })
      .inputValue()) !== "프로젝트 연락 확인"
  )
    throw Error("Wrong task opened from cluster");
  await page.getByRole("button", { name: "닫기", exact: true }).click();
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
    "PASS: demo entry, create, score-change reason guard, history, persistence, six viewport fits, Pretendard, assignees, project suggestions and linked nodes, score cluster selection, trash/restore, protected APIs; no browser errors",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
