const { chromium } = require("playwright");
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.getByRole("button", { name: "시작하기", exact: true }).tap();
  await page
    .getByRole("heading", { name: "업무 매트릭스", exact: true })
    .waitFor();
  for (const size of [
    { width: 320, height: 568 },
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(100);
    const box = await page.locator(".matrix-board").boundingBox();
    assert.ok(
      box && box.y >= 0 && box.y + box.height <= size.height,
      `matrix outside ${JSON.stringify(size)}`,
    );
    assert.ok(box.height >= (size.width > size.height ? 100 : 200));
    assert.equal(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth > innerWidth ||
          document.documentElement.scrollHeight > innerHeight,
      ),
      false,
      "page overflows",
    );
    for (const selector of [
      ".task-node",
      ".heading-actions .primary",
      ".mobile-view-toggle",
      ".mobile-filter-toggle",
      ".profile",
      "nav button",
    ]) {
      for (const b of await page.locator(selector).evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return { width: r.width, height: r.height };
        }),
      ))
        assert.ok(
          b.width >= 43.5 && b.height >= 43.5,
          `${selector} too small ${JSON.stringify(b)}`,
        );
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/oreum-mobile-optimized.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "업무 목록", exact: true }).tap();
  const list = page.getByRole("region", { name: "업무 목록", exact: true });
  await list.waitFor();
  assert.equal(await list.locator(".mobile-task").count(), 6);
  await page
    .getByRole("button", { name: "검색 및 담당자 필터", exact: true })
    .tap();
  const filter = page.getByRole("dialog", { name: "검색 및 담당자 필터" });
  await filter.waitFor();
  assert.equal(
    await page.evaluate(() => document.activeElement?.tagName),
    "BUTTON",
  );
  await filter
    .getByRole("searchbox", { name: "모바일 업무 검색" })
    .fill("모노랩");
  await filter.getByRole("button", { name: /업무 1개 보기/ }).tap();
  assert.equal(await list.locator(".mobile-task").count(), 1);
  await page
    .getByRole("button", { name: "검색 및 담당자 필터", exact: true })
    .tap();
  await page
    .getByRole("dialog", { name: "검색 및 담당자 필터" })
    .getByRole("button", { name: "초기화", exact: true })
    .tap();
  await page.getByRole("button", { name: /업무 6개 보기/ }).tap();
  await page.getByRole("button", { name: "업무 등록", exact: true }).tap();
  const dialog = page.getByRole("dialog", { name: "업무 상세" });
  await dialog.waitFor();
  assert.equal(
    await page.evaluate(() => document.activeElement?.tagName),
    "BUTTON",
    "opening form unexpectedly focused an input",
  );
  assert.equal(
    await dialog.locator(".ai-assist").evaluate((el) => el.open),
    false,
  );
  await dialog.locator(".ai-assist summary").tap();
  await dialog.getByRole("button", { name: "텍스트", exact: true }).tap();
  await dialog
    .getByRole("textbox", { name: "대화 내용", exact: true })
    .fill("첫 번째 대화\n두 번째 대화");
  assert.equal(
    await dialog
      .getByRole("textbox", { name: "대화 내용", exact: true })
      .inputValue(),
    "첫 번째 대화\n두 번째 대화",
  );
  await dialog.locator(".ai-assist summary").tap();
  await dialog
    .getByRole("textbox", { name: "어떤 일인가요?" })
    .fill("모바일에서도 읽기 쉬운 긴 업무 제목 확인");
  await dialog
    .getByRole("combobox", { name: "고객사 / 프로젝트", exact: true })
    .fill("모바일 프로젝트");
  for (const el of await dialog
    .locator("input:not([type=checkbox]):not([type=range]),textarea,select")
    .all()) {
    if (await el.isVisible())
      assert.ok(
        await el.evaluate(
          (n) => parseFloat(getComputedStyle(n).fontSize) >= 16,
        ),
        "input may trigger iOS automatic zoom",
      );
  }
  await dialog
    .getByRole("textbox", { name: "내용과 다음 행동" })
    .fill("휴대폰 입력과 스크롤 확인 ".repeat(50));
  await page.setViewportSize({ width: 390, height: 480 });
  await page.waitForTimeout(150);
  const close = await dialog
      .getByRole("button", { name: "닫기", exact: true })
      .boundingBox(),
    save = await dialog
      .getByRole("button", { name: "업무 저장", exact: true })
      .boundingBox();
  assert.ok(
    close && close.y >= 0 && close.y + close.height <= 480,
    "close hidden after keyboard-size resize",
  );
  assert.ok(
    save && save.y >= 0 && save.y + save.height <= 480,
    "sticky save hidden after keyboard-size resize",
  );
  await page.locator(".overlay").dispatchEvent("click");
  assert.equal(
    await dialog.count(),
    1,
    "backdrop dismissed an unfinished form",
  );
  await page.screenshot({ path: "/tmp/oreum-mobile-form.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await dialog.getByRole("button", { name: "업무 저장", exact: true }).tap();
  await dialog.waitFor({ state: "detached" });
  await list
    .getByRole("button", { name: /모바일에서도 읽기 쉬운 긴 업무 제목 확인/ })
    .waitFor();
  await page.getByRole("button", { name: "매트릭스 보기", exact: true }).tap();
  await page.locator(".matrix-board").waitFor();
  await page
    .getByRole("button", { name: "멤버 및 알림 설정", exact: true })
    .tap();
  await page.getByRole("dialog", { name: "멤버 및 알림 설정" }).waitFor();
  await page.getByRole("button", { name: "닫기", exact: true }).tap();
  await page.getByRole("button", { name: "프로젝트 흐름", exact: true }).tap();
  await page
    .getByRole("dialog", { name: "고객사·프로젝트 업무 연결" })
    .waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await page.getByRole("button", { name: "업무 등록", exact: true }).tap();
  await page.keyboard.press("Shift+Tab");
  assert.ok(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.contains(document.activeElement)),
    "focus escaped dialog",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await page.evaluate(() => {
    const template = JSON.parse(localStorage.getItem("oreum-demo"))[0];
    localStorage.setItem(
      "oreum-demo",
      JSON.stringify(
        Array.from({ length: 25 }, (_, i) => ({
          ...template,
          id: crypto.randomUUID(),
          title: `모바일 밀집 ${i}`,
          importance: Math.floor(i / 5) + 1,
          progress: ["원활", "유지", "지연", "막힘", "미해결"][i % 5],
          status: "예정",
          deleted: false,
        })),
      ),
    );
  });
  await page.reload();
  await page.getByRole("button", { name: "시작하기", exact: true }).tap();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(150);
  const target = page.locator(".task-node").first();
  const title = await target.getAttribute("title");
  const point = await target.boundingBox();
  await page.touchscreen.tap(
    point.x + point.width / 2,
    point.y + point.height / 2,
  );
  const near = page.getByRole("dialog", { name: "가까운 업무 선택" });
  await near.waitFor();
  assert.ok((await near.locator(".cluster-task").count()) > 1);
  await near
    .locator(".cluster-task")
    .filter({ has: page.getByText(title, { exact: true }) })
    .tap();
  assert.equal(
    await page.getByRole("textbox", { name: "어떤 일인가요?" }).inputValue(),
    title,
  );
  await page.getByRole("button", { name: "닫기", exact: true }).tap();
  await page.getByRole("button", { name: "업무 목록", exact: true }).tap();
  assert.equal(await page.locator(".mobile-task:visible").count(), 25);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 5 phone sizes and touch mode; 44px controls, matrix/list, search/filter, no input autofocus, 16px fields, keyboard-sized viewport, sticky save/close, backdrop protection, settings, focus trap, Escape, nearby point picker and 25-task reading list",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
