const { chromium } = require("playwright");
const assert = require("node:assert/strict");
module.exports = async function run(mobile = false) {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: mobile ? 390 : 1366, height: mobile ? 844 : 768 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(process.env.TEST_BASE_URL || "http://127.0.0.1:3001");
    assert.equal(await page.locator(".landing button").count(), 1);
    await page.getByRole("button", { name: "시작하기", exact: true }).click();
    await page.locator(".priority-card").first().waitFor();
    for (const [width, height] of mobile
      ? [
          [320, 568],
          [360, 640],
          [390, 844],
          [430, 932],
          [844, 390],
        ]
      : [
          [1366, 768],
          [1280, 720],
          [1920, 1080],
        ]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(150);
      const box = await page.locator(".priority-board").boundingBox();
      assert.ok(
        box && box.y >= 0 && box.y + box.height <= height + 1,
        `matrix outside ${width}x${height}: ${JSON.stringify(box)}`,
      );
      assert.equal(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth > innerWidth ||
            document.documentElement.scrollHeight > innerHeight,
        ),
        false,
        "page overflow",
      );
      const counts = await page.locator(".priority-region").count();
      assert.equal(counts, 4);
    }
    await page.setViewportSize({
      width: mobile ? 390 : 1366,
      height: mobile ? 844 : 768,
    });
    await page.screenshot({
      path: mobile
        ? "/tmp/oreum-priority-mobile.png"
        : "/tmp/oreum-priority-desktop.png",
    });
    await page.getByRole("button", { name: "업무 등록", exact: true }).click();
    await page.getByLabel("어떤 일인가요?").fill("새 우선순위 테스트");
    await page.getByLabel("고객사 / 프로젝트").fill("테스트 프로젝트");
    await page
      .getByRole("combobox", { name: "중요", exact: true })
      .selectOption("yes");
    await page
      .getByRole("combobox", { name: "긴급", exact: true })
      .selectOption("no");
    await page
      .getByRole("combobox", { name: "진행상황", exact: true })
      .selectOption("이슈");
    await page.getByRole("button", { name: "업무 저장", exact: true }).click();
    const card = page.locator(".priority-card").filter({
      has: page.getByRole("button", {
        name: "새 우선순위 테스트 테스트 프로젝트",
        exact: true,
      }),
    });
    await card.waitFor();
    assert.ok((await card.getAttribute("class")).includes("issue-card"));
    const taskId = await card.getAttribute("data-task-id");
    assert.equal(
      await card.evaluate(
        (el) => el.closest("[data-quadrant]").dataset.quadrant,
      ),
      "future",
    );
    if (!mobile) {
      const grip = await card.locator(".drag-handle").boundingBox();
      const target = await page
        .locator('[data-quadrant="quick"] .region-heading')
        .boundingBox();
      await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        target.x + target.width / 2,
        target.y + target.height / 2,
        { steps: 12 },
      );
      await page.mouse.up();
    } else {
      await card.locator(".drag-handle").scrollIntoViewIfNeeded();
      const grip = await card.locator(".drag-handle").boundingBox();
      const target = await page
        .locator('[data-quadrant="quick"] .region-heading')
        .boundingBox();
      const cdp = await context.newCDPSession(page);
      const start = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
      const end = {
        x: target.x + target.width / 2,
        y: target.y + target.height / 2,
      };
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [start],
      });
      for (let step = 1; step <= 12; step++)
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [
            {
              x: start.x + ((end.x - start.x) * step) / 12,
              y: start.y + ((end.y - start.y) * step) / 12,
            },
          ],
        });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await cdp.detach();
    }
    await page.waitForFunction(
      (id) =>
        document
          .querySelector(`[data-task-id="${id}"]`)
          ?.closest("[data-quadrant]").dataset.quadrant === "quick",
      taskId,
    );
    await card.getByRole("combobox").selectOption("focus");
    await page.waitForFunction(
      (id) =>
        document
          .querySelector(`[data-task-id="${id}"]`)
          ?.closest("[data-quadrant]").dataset.quadrant === "focus",
      taskId,
    );
    if (mobile) await page.locator(".mobile-quick-toggle").click();
    await page
      .getByRole("combobox", { name: "즉시 확인 연결 업무" })
      .selectOption(taskId);
    await page
      .getByRole("textbox", { name: "즉시 확인 내용" })
      .fill("견적 회신 확인하기");
    await page
      .getByRole("button", { name: "+ 확인 항목 추가", exact: true })
      .click();
    await page
      .getByRole("button", { name: "견적 회신 확인하기 완료", exact: true })
      .click();
    await page.waitForFunction(
      () => !document.querySelector('[aria-label="견적 회신 확인하기 완료"]'),
    );
    if (mobile)
      await page.getByRole("button", { name: "닫기", exact: true }).click();
    await card.locator(".priority-open").click();
    await page.getByRole("heading", { name: "즉시 확인 완료 기록" }).waitFor();
    assert.ok(
      await page
        .locator(".completed-checks")
        .getByText("✓ 견적 회신 확인하기")
        .count(),
    );
    assert.ok(
      (await page.locator(".history").textContent()).includes("즉시 확인 완료"),
    );
    await page.getByRole("button", { name: "업무 저장", exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: "시작하기", exact: true }).click();
    await card.waitFor();
    // Dense data verifies all cards survive and regions grow without root scrolling.
    await page.evaluate(() => {
      const tasks = JSON.parse(localStorage.getItem("oreum-demo"));
      const template = tasks[0];
      for (let i = 0; i < 40; i++)
        tasks.push({
          ...template,
          id: crypto.randomUUID(),
          title: `밀집 업무 ${i}`,
          importance: 5,
          urgency: 5,
          quick_checks: [],
        });
      tasks[0].urgency = 1;
      tasks[0].due = new Date().toISOString().slice(0, 10);
      tasks[0].progress = "순항";
      tasks[0].updated_at = "2020-01-01T00:00:00Z";
      localStorage.setItem("oreum-demo", JSON.stringify(tasks));
    });
    await page.reload();
    await page.getByRole("button", { name: "시작하기", exact: true }).click();
    await page.locator(".priority-card").first().waitFor();
    assert.equal(await page.locator(".priority-card").count(), 47);
    const focus = await page.locator('[data-quadrant="focus"]').boundingBox(),
      future = await page.locator('[data-quadrant="future"]').boundingBox();
    assert.ok(focus.width > future.width);
    assert.ok(
      await page.getByRole("button", { name: /긴급 칸으로 옮길까요/ }).count(),
    );
    assert.ok(
      await page
        .getByRole("button", { name: "7일 미갱신 · 지연/병목 후보 확인" })
        .count(),
    );
    if (mobile) {
      await page
        .getByRole("button", { name: "업무 목록", exact: true })
        .click();
      assert.equal(await page.locator(".mobile-task").count(), 47);
      assert.equal(await page.locator(".priority-board").isVisible(), false);
      await page
        .getByRole("button", { name: "매트릭스 보기", exact: true })
        .click();
      await page
        .getByRole("button", { name: "업무 등록", exact: true })
        .click();
      await page.setViewportSize({ width: 390, height: 480 });
      await page.getByLabel("어떤 일인가요?").fill("키보드 화면");
      assert.equal(
        await page
          .getByLabel("어떤 일인가요?")
          .evaluate((el) => getComputedStyle(el).fontSize),
        "16px",
      );
      await page.getByRole("button", { name: "닫기", exact: true }).click();
    }
    for (const endpoint of [
      "/api/ai",
      "/api/check-summary",
      "/api/weekly-summary",
    ])
      assert.equal(
        (
          await page.request.post(new URL(endpoint, page.url()).href, {
            data: {},
          })
        ).status(),
        403,
      );
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${mobile ? "mobile touch emulation" : "desktop"}: binary CRUD, drag/menu movement, red issues, persisted quick completions/history, dense resizing, signals, viewport, API auth`,
    );
  } finally {
    await browser.close();
  }
};
