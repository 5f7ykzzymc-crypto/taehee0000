// Optional development checks: install Playwright, then node --test tests/browser.test.cjs.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { existsSync } = require("node:fs");
const root = path.resolve(__dirname, "..");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGAAAAABJRU5ErkJggg==",
  "base64",
);
let browser, server, base;
before(async () => {
  server = http.createServer(async (req, res) => {
    const name = req.url === "/" ? "index.html" : req.url.slice(1);
    if (!["index.html", "app.js", "style.css", "proofread.js"].includes(name)) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader(
      "Content-Type",
      name.endsWith(".js")
        ? "application/javascript"
        : name.endsWith(".css")
          ? "text/css"
          : "text/html",
    );
    res.end(await fs.readFile(path.join(root, name)));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const executablePath =
    process.env.BROWSER_EXECUTABLE_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox"],
  });
});
after(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
});
async function fresh() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await page.goto(base);
  return { context, page };
}
async function makeCharacter(page, name = "서연") {
  await page.locator("#charactersNav").click();
  await page.locator("#newCharacter").click();
  await page.locator("#characterName").fill(name);
}
async function upload(page, kind = "character", name = "인물.png") {
  const before = await page.locator(`#${kind}Images .image-card`).count();
  await page
    .locator(`#${kind}ImageInput`)
    .setInputFiles({ name, mimeType: "image/png", buffer: png });
  await page.waitForFunction(
    ({ kind, before }) =>
      document.querySelectorAll(`#${kind}Images .image-card`).length ===
      before + 1,
    { kind, before },
  );
}
async function backup(page) {
  const pending = page.waitForEvent("download");
  await page.locator("#backup").click();
  return JSON.parse(await fs.readFile(await (await pending).path(), "utf8"));
}
async function restore(page, data, confirm = true) {
  await page.locator("#restoreFile").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data)),
  });
  if (confirm) await page.locator("#confirmAction").click();
}
test("existing v1 draft migrates without losing scenes, and edits persist after reload", async () => {
  const { context, page } = await fresh();
  const legacy = [
    {
      title: "기존 원고",
      subtitle: "원래 소개",
      scenes: [{ title: "원래 장면", text: "잃으면 안 되는 글" }],
    },
  ];
  await page.evaluate(
    (data) => localStorage.setItem("yeobaek-v1", JSON.stringify(data)),
    legacy,
  );
  await page.reload();
  assert.equal(await page.locator("#editor").inputValue(), "잃으면 안 되는 글");
  await page.locator("#editor").fill("고쳐 쓴 원고");
  await page.reload();
  assert.equal(await page.locator("#editor").inputValue(), "고쳐 쓴 원고");
  assert.equal((await backup(page)).episodes[0].scenes[0].images.length, 0);
  await context.close();
});
test("character sheets save every field and stay independent from each other", async () => {
  const { context, page } = await fresh();
  await makeCharacter(page);
  const fields = [
    "Tagline",
    "Role",
    "Age",
    "Appearance",
    "Personality",
    "Backstory",
    "Motivation",
    "Relationships",
    "Notes",
  ];
  for (const field of fields)
    await page.locator("#character" + field).fill("설정 " + field);
  await page.locator("#newCharacter").click();
  await page.locator("#characterName").fill("도윤");
  await page.locator("#items .item").first().click();
  for (const field of fields)
    assert.equal(
      await page.locator("#character" + field).inputValue(),
      "설정 " + field,
    );
  await page.reload();
  await page.locator("#charactersNav").click();
  assert.equal(await page.locator("#characterName").inputValue(), "서연");
  assert.equal(await page.locator("#characterTotal").textContent(), "2");
  await context.close();
});
test("image upload, actual clipboard paste, deletion and reload preserve the correct sheet", async () => {
  const { context, page } = await fresh();
  await makeCharacter(page);
  await upload(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: base,
  });
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 12;
    canvas.height = 12;
    canvas.getContext("2d").fillRect(0, 0, 12, 12);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  });
  await page.locator("#characterNotes").focus();
  await page.keyboard.press("Control+V");
  await page.waitForFunction(
    () =>
      document.querySelectorAll("#characterImages .image-card").length === 2,
  );
  await page.reload();
  await page.locator("#charactersNav").click();
  assert.equal(await page.locator("#characterImages .image-card").count(), 2);
  await page.locator("#characterImages .image-open").first().click();
  assert.equal(await page.locator("#imageDialog").isVisible(), true);
  await page.keyboard.press("Escape");
  await page.locator("#characterImages .image-delete").first().click();
  await page.locator("#confirmCancel").click();
  assert.equal(await page.locator("#characterImages .image-card").count(), 2);
  await page.locator("#characterImages .image-delete").first().click();
  await page.locator("#confirmAction").click();
  assert.equal(await page.locator("#characterImages .image-card").count(), 1);
  await page.locator("#writingNav").click();
  await upload(page, "scene", "장면.png");
  await page.locator("#scenes .scene").nth(1).click();
  assert.equal(await page.locator("#sceneImages .image-card").count(), 0);
  await page.locator("#scenes .scene").first().click();
  assert.equal(await page.locator("#sceneImages .image-card").count(), 1);
  const data = await backup(page);
  assert.match(data.characters[0].images[0].data, /^data:image\/webp;base64,/);
  assert.equal(data.episodes[0].scenes[0].images.length, 1);
  await context.close();
});
test("image limit and unsupported file rejection leave existing images intact", async () => {
  const { context, page } = await fresh();
  await makeCharacter(page);
  await page.locator("#characterImageInput").setInputFiles({
    name: "unsafe.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  });
  await page.waitForFunction(() =>
    document.getElementById("toast").textContent.includes("PNG"),
  );
  assert.equal(await page.locator("#characterImages .image-card").count(), 0);
  await page.locator("#characterImageInput").setInputFiles(
    Array.from({ length: 6 }, (_, i) => ({
      name: i + ".png",
      mimeType: "image/png",
      buffer: png,
    })),
  );
  await page.waitForFunction(
    () =>
      document.querySelectorAll("#characterImages .image-card").length === 6,
  );
  await page
    .locator("#characterImageInput")
    .setInputFiles({ name: "extra.png", mimeType: "image/png", buffer: png });
  await page.waitForFunction(() =>
    document.getElementById("toast").textContent.includes("최대 6장"),
  );
  assert.equal(await page.locator("#characterImages .image-card").count(), 6);
  await context.close();
});
test("proofread reviews, applies individual/all changes and undoes the last change", async () => {
  const { context, page } = await fresh();
  const original = "😀 오랫만에 역활을 맡았다. 내가 할께. 그는 이미 도착했다.";
  await page.locator("#editor").fill(original);
  await page.locator("#proofread").click();
  assert.equal(await page.locator(".review-row").count(), 3);
  assert.equal(await page.locator("#editor").inputValue(), original);
  await page.locator(".review-change button").first().click();
  assert.match(await page.locator("#editor").inputValue(), /오랜만/);
  assert.equal(await page.locator(".review-row").count(), 2);
  await page.locator("#applyAll").click();
  assert.equal(await page.locator(".review-row").count(), 0);
  assert.match(await page.locator("#editor").inputValue(), /역할.*할게/);
  await page.locator(".undo-button").click();
  assert.equal(await page.locator(".review-row").count(), 2);
  await page.locator("#applyAll").click();
  await page.locator("#closeReview").click();
  await page.reload();
  assert.equal(
    await page.locator("#editor").inputValue(),
    "😀 오랜만에 역할을 맡았다. 내가 할게. 그는 이미 도착했다.",
  );
  await context.close();
});
test("full backup transfers characters and images to a fresh browser and Markdown embeds images", async () => {
  const { context, page } = await fresh();
  await makeCharacter(page, "인물 <script>");
  await upload(page);
  await page.locator("#characterNotes").fill("비밀 메모");
  const data = await backup(page);
  const next = await fresh();
  await restore(next.page, data);
  await next.page.locator("#charactersNav").click();
  assert.equal(
    await next.page.locator("#characterName").inputValue(),
    "인물 <script>",
  );
  assert.equal(
    await next.page.locator("#characterNotes").inputValue(),
    "비밀 메모",
  );
  assert.equal(
    await next.page.locator("#characterImages .image-card").count(),
    1,
  );
  const pending = next.page.waitForEvent("download");
  await next.page.locator("#export").click();
  const markdown = await fs.readFile(await (await pending).path(), "utf8");
  assert.match(markdown, /data:image\/webp;base64,/);
  assert.match(markdown, /비밀 메모/);
  await next.page.reload();
  await next.page.locator("#charactersNav").click();
  assert.equal(
    await next.page.locator("#characterImages .image-card").count(),
    1,
  );
  await context.close();
  await next.context.close();
});
test("invalid import does not replace current drafts, and character deletion requires confirmation", async () => {
  const { context, page } = await fresh();
  await makeCharacter(page, "보존할 인물");
  await restore(page, { version: 2, episodes: [], characters: [] }, false);
  assert.equal(await page.locator("#confirmDialog").isVisible(), false);
  assert.equal(
    await page.locator("#characterName").inputValue(),
    "보존할 인물",
  );
  await page.locator("#deleteCharacter").click();
  await page.locator("#confirmCancel").click();
  assert.equal(await page.locator("#characterTotal").textContent(), "1");
  await page.locator("#deleteCharacter").click();
  await page.locator("#confirmAction").click();
  assert.equal(await page.locator("#characterEmpty").isVisible(), true);
  await context.close();
});
test("storage failure leaves images unchanged and keeps edited text available for backup", async () => {
  const { context, page } = await fresh();
  await makeCharacter(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    };
  });
  await page
    .locator("#characterImageInput")
    .setInputFiles({ name: "test.png", mimeType: "image/png", buffer: png });
  await page.waitForFunction(
    () => document.getElementById("saved").textContent === "저장되지 않음",
  );
  assert.equal(await page.locator("#characterImages .image-card").count(), 0);
  await page
    .locator("#characterNotes")
    .fill("저장 실패해도 백업에 남아야 할 글");
  const data = await backup(page);
  assert.equal(data.characters[0].notes, "저장 실패해도 백업에 남아야 할 글");
  assert.equal(data.characters[0].images.length, 0);
  await context.close();
});
test("unreadable prior storage is preserved before subsequent edits", async () => {
  const { context, page } = await fresh();
  const raw = "{this is a damaged but recoverable draft";
  await page.evaluate(
    (raw) => localStorage.setItem("yeobaek-project-v2", raw),
    raw,
  );
  await page.reload();
  assert.equal(await page.locator("#recoverData").isVisible(), true);
  await page.locator("#editor").fill("새 원고");
  assert.equal(
    await page.evaluate(() => localStorage.getItem("yeobaek-recovery-v2")),
    raw,
  );
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("yeobaek-project-v2")).episodes[0]
          .scenes[0].text,
    ),
    "새 원고",
  );
  await context.close();
});
test("focus, theme, and responsive categories retain a usable layout", async () => {
  const { context, page } = await fresh();
  await page.locator("#focus").click();
  assert.equal(await page.locator(".library").isVisible(), false);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".library").isVisible(), true);
  await page.locator("#theme").click();
  await page.reload();
  assert.equal(
    await page.locator("#theme").getAttribute("aria-pressed"),
    "true",
  );
  await makeCharacter(page);
  for (const width of [1440, 1024, 768, 520, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const id of ["charactersNav", "newCharacter"])
      assert.equal(await page.locator("#" + id).isVisible(), true);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      "body width " + width,
    );
    assert.equal(
      await page
        .locator("#documentScroll")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      true,
      "sheet width " + width,
    );
    await page.locator("#writingNav").click();
    assert.equal(await page.locator("#proofread").isVisible(), true);
    assert.equal(
      await page
        .locator("#documentScroll")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      true,
      "editor width " + width,
    );
    await page.locator("#charactersNav").click();
  }
  await context.close();
});
test("downloaded index.html works directly without a web server or network", async (t) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://**", (route) => route.abort());
  try {
    await page.goto("file://" + path.join(root, "index.html"));
  } catch (error) {
    if (error.message.includes("ERR_BLOCKED_BY_ADMINISTRATOR")) {
      await context.close();
      t.skip(
        "Managed browser policy blocks file:// navigation; verify on a personal browser.",
      );
      return;
    }
    throw error;
  }
  await makeCharacter(page, "오프라인 인물");
  await upload(page);
  await page.reload();
  await page.locator("#charactersNav").click();
  assert.equal(
    await page.locator("#characterName").inputValue(),
    "오프라인 인물",
  );
  assert.equal(await page.locator("#characterImages .image-card").count(), 1);
  assert.deepEqual(errors, []);
  await context.close();
});

test("sidebar folds independently, persists, and restores its state after focus mode", async () => {
  const { context, page } = await fresh();
  await page.locator("#toggleSidebar").click();
  assert.equal(
    await page.locator("#toggleSidebar").getAttribute("aria-expanded"),
    "false",
  );
  assert.equal(await page.locator(".library").isVisible(), false);
  assert.equal(await page.locator("#outline").isVisible(), false);
  assert.equal(
    await page.locator("#focus").getAttribute("aria-pressed"),
    "false",
  );
  assert.equal(await page.evaluate(() => !!document.fullscreenElement), false);
  await page.reload();
  assert.equal(await page.locator(".library").isVisible(), false);
  await page.locator("#focus").click();
  await page.waitForFunction(
    () => document.fullscreenElement === document.documentElement,
  );
  assert.equal(await page.locator("#toggleSidebar").isVisible(), false);
  await page.locator("#focus").click();
  await page.waitForFunction(() => !document.fullscreenElement);
  assert.equal(await page.locator(".library").isVisible(), false);
  await page.locator("#toggleSidebar").click();
  assert.equal(await page.locator(".library").isVisible(), true);
  await page.locator("#charactersNav").click();
  await page.locator("#toggleSidebar").click();
  assert.equal(await page.locator(".library").isVisible(), false);
  await page.locator("#toggleSidebar").click();
  assert.equal(await page.locator("#outline").isVisible(), false);
  assert.equal(await page.locator(".library").isVisible(), true);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator("#toggleSidebar").isVisible(), true);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await context.close();
});

test("browser fullscreen exit synchronizes focus mode and restores navigation", async () => {
  const { context, page } = await fresh();
  await page.locator("#focusNav").click();
  await page.waitForFunction(() => !!document.fullscreenElement);
  assert.equal(
    await page.locator("#focus").getAttribute("aria-pressed"),
    "true",
  );
  await page.evaluate(() => document.exitFullscreen());
  await page.waitForFunction(() => !document.body.classList.contains("focus"));
  assert.equal(
    await page.locator("#focus").getAttribute("aria-pressed"),
    "false",
  );
  assert.equal(await page.locator(".library").isVisible(), true);
  assert.equal(
    await page.locator("#toggleSidebar").getAttribute("aria-expanded"),
    "true",
  );
  await context.close();
});

test("fullscreen rejection or missing API keeps usable focus mode with an explanation", async () => {
  const { context, page } = await fresh();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.evaluate(() => {
    document.documentElement.requestFullscreen = () =>
      Promise.reject(new Error("Permission denied"));
  });
  await page.locator("#focus").click();
  await page.waitForFunction(() =>
    document.getElementById("toast").textContent.includes("허용되지"),
  );
  assert.equal(
    await page.locator("#focus").getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(await page.locator(".library").isVisible(), false);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".library").isVisible(), true);
  await page.evaluate(() => {
    document.documentElement.requestFullscreen = undefined;
    document.documentElement.webkitRequestFullscreen = undefined;
  });
  await page.locator("#focus").click();
  await page.waitForFunction(() =>
    document.getElementById("toast").textContent.includes("브라우저 메뉴"),
  );
  await page.locator("#focus").click();
  assert.equal(await page.locator(".library").isVisible(), true);
  assert.deepEqual(errors, []);
  await context.close();
});
