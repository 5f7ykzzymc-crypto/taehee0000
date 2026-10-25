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
    const name =
      req.url === "/" ? "작업시작.html" : decodeURIComponent(req.url.slice(1));
    if (
      ![
        "index.html",
        "작업시작.html",
        "app.js",
        "style.css",
        "typewriter.js",
      ].includes(name)
    ) {
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
  const chooser = page.waitForEvent("filechooser");
  await page.locator(`#${kind}AddImage`).click();
  await (await chooser).setFiles({ name, mimeType: "image/png", buffer: png });
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
  assert.equal(await page.locator("#episodeDetails").isVisible(), false);
  await page.locator("#toggleEpisodeDetails").click();
  assert.equal(await page.locator("#subtitle").inputValue(), "원래 소개");
  await page.locator("#subtitle").fill("고친 소개");
  await page.locator("#toggleEpisodeDetails").click();
  await page.locator("#editor").fill("고쳐 쓴 원고");
  await page.reload();
  assert.equal(await page.locator("#editor").inputValue(), "고쳐 쓴 원고");
  const saved = await backup(page);
  assert.equal(saved.episodes[0].scenes[0].images.length, 0);
  assert.equal(saved.episodes[0].subtitle, "고친 소개");
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
  assert.equal(
    await page
      .locator(
        ".references, #sceneAddImage, #sceneImageInput, #sceneImageCount",
      )
      .count(),
    0,
  );
  assert.equal(await page.locator("#sceneImages").isVisible(), false);
  await page.locator("#editor").focus();
  await page.keyboard.press("Control+V");
  await page.waitForFunction(
    () => document.querySelectorAll("#sceneImages .image-card").length === 1,
  );
  assert.equal(await page.locator("#sceneImages").isVisible(), true);
  await page.locator("#scenes .scene").nth(1).click();
  assert.equal(await page.locator("#sceneImages .image-card").count(), 0);
  assert.equal(await page.locator("#sceneImages").isVisible(), false);
  await page.locator("#scenes .scene").first().click();
  assert.equal(await page.locator("#sceneImages .image-card").count(), 1);
  const originalText = await page.locator("#editor").inputValue();
  await page.locator("#editor").evaluate((zone, bytes) => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([new Uint8Array(bytes)], "드롭.png", { type: "image/png" }),
    );
    zone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }),
    );
  }, Array.from(png));
  await page.waitForFunction(
    () => document.querySelectorAll("#sceneImages .image-card").length === 2,
  );
  assert.equal(await page.locator("#editor").inputValue(), originalText);
  await page.reload();
  assert.equal(await page.locator("#sceneImages .image-card").count(), 2);
  const data = await backup(page);
  assert.match(data.characters[0].images[0].data, /^data:image\/webp;base64,/);
  assert.equal(data.episodes[0].scenes[0].images.length, 2);
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
test("downloaded 작업시작.html works directly without a web server or network", async (t) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://**", (route) => route.abort());
  try {
    await page.goto("file://" + path.join(root, "작업시작.html"));
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

test("episode and scene panels fold independently, persist, and restore after focus mode", async () => {
  const { context, page } = await fresh();
  const checkPanels = async (library, outline) => {
    assert.equal(await page.locator("#library").isVisible(), library);
    assert.equal(await page.locator("#outline").isVisible(), outline);
    assert.equal(
      await page.locator("#toggleSidebar").getAttribute("aria-expanded"),
      String(library),
    );
    assert.equal(
      await page.locator("#toggleOutline").getAttribute("aria-expanded"),
      String(outline),
    );
  };
  await checkPanels(true, true);
  await page.locator("#toggleSidebar").click();
  await checkPanels(false, true);
  assert.equal(await page.evaluate(() => !!document.fullscreenElement), false);
  await page.locator("#toggleOutline").click();
  await checkPanels(false, false);
  await page.locator("#toggleSidebar").click();
  await checkPanels(true, false);
  await page.reload();
  await checkPanels(true, false);
  await page.locator("#focus").click();
  await page.waitForFunction(
    () => document.fullscreenElement === document.documentElement,
  );
  for (const id of ["library", "outline", "toggleSidebar", "toggleOutline"])
    assert.equal(await page.locator("#" + id).isVisible(), false);
  await page.locator("#focus").click();
  await page.waitForFunction(() => !document.fullscreenElement);
  await checkPanels(true, false);
  await page.locator("#toggleOutline").click();
  await checkPanels(true, true);
  await page.locator("#toggleSidebar").click();
  await checkPanels(false, true);
  await page.reload();
  await checkPanels(false, true);
  await page.locator("#toggleSidebar").click();
  await page.locator("#charactersNav").click();
  assert.equal(await page.locator("#toggleOutline").isVisible(), false);
  assert.equal(await page.locator("#outline").isVisible(), false);
  await page.locator("#toggleSidebar").click();
  assert.equal(await page.locator("#library").isVisible(), false);
  await page.locator("#toggleSidebar").click();
  await page.locator("#writingNav").click();
  await checkPanels(true, true);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of ["toggleSidebar", "toggleOutline"])
    assert.equal(await page.locator("#" + id).isVisible(), true);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.evaluate(() =>
    localStorage.setItem(
      "yeobaek-ui",
      JSON.stringify({ sidebarCollapsed: true }),
    ),
  );
  await page.reload();
  await checkPanels(false, false);
  await page.locator("#toggleOutline").click();
  await checkPanels(false, true);
  await page.reload();
  await checkPanels(false, true);
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

test("new launch filename and compatibility entry both run the same editor", async () => {
  const { context, page } = await fresh();
  await page.locator("#editor").fill("계속 보관할 원고");
  await page.goto(base + "/" + encodeURIComponent("작업시작.html"));
  assert.equal(await page.locator("#editor").inputValue(), "계속 보관할 원고");
  await page.goto(base + "/index.html");
  assert.equal(await page.locator("#editor").inputValue(), "계속 보관할 원고");
  await context.close();
});

async function settleLayout(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}
async function explicitLineDelta(page) {
  return page.locator("#editor").evaluate((editor) => {
    const pane = document.getElementById("documentScroll"),
      style = getComputedStyle(editor),
      height = parseFloat(style.lineHeight);
    const position =
      editor.selectionDirection === "backward"
        ? editor.selectionStart
        : editor.selectionEnd;
    const row = editor.value.slice(0, position).split("\n").length - 1;
    const caret =
      editor.getBoundingClientRect().top +
      parseFloat(style.paddingTop) +
      row * height +
      height / 2 -
      editor.scrollTop;
    return caret - (pane.getBoundingClientRect().top + pane.clientHeight / 2);
  });
}
async function moveCaret(page, position) {
  await page.locator("#editor").evaluate((editor, position) => {
    editor.focus({ preventScroll: true });
    editor.setSelectionRange(position, position);
    editor.dispatchEvent(new Event("select"));
  }, position);
  await settleLayout(page);
}
test("typewriter entry keeps episode and scene headings at the top while centering only the writing line", async () => {
  const { context, page } = await fresh();
  await page.locator("#editor").fill("첫 문장");
  const positions = () =>
    page.locator("#documentScroll").evaluate((pane) => {
      const top = pane.getBoundingClientRect().top;
      return {
        title:
          document.querySelector(".episode-heading").getBoundingClientRect()
            .top - top,
        scene:
          document.querySelector(".scene-label").getBoundingClientRect().top -
          top,
        editor:
          document.getElementById("editor").getBoundingClientRect().top - top,
        scroll: pane.scrollTop,
      };
    });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 390) await page.locator("#toggleOutline").click();
    for (const intro of [false, true]) {
      if (
        (await page
          .locator("#toggleEpisodeDetails")
          .getAttribute("aria-expanded")) !== String(intro)
      )
        await page.locator("#toggleEpisodeDetails").click();
      await moveCaret(page, 0);
      const before = await positions();
      assert.ok(
        before.title >= 0 && before.title < 24,
        "title starts at the top",
      );
      await page.locator("#typewriter").click();
      await settleLayout(page);
      const active = await positions();
      assert.ok(
        Math.abs(active.title - before.title) < 1,
        "episode heading is not pushed down",
      );
      assert.ok(
        Math.abs(active.scene - before.scene) < 1,
        "scene heading is not pushed down",
      );
      assert.ok(
        active.scroll < 1,
        "first line centers without scrolling the headings away",
      );
      assert.ok(
        Math.abs(await explicitLineDelta(page)) < 2,
        "first writing line is centered",
      );
      await page.locator("#typewriter").click();
      await settleLayout(page);
      const restored = await positions();
      assert.ok(Math.abs(restored.title - before.title) < 1);
      assert.ok(
        Math.abs(restored.editor - before.editor) < 1,
        "turning the mode off restores normal spacing",
      );
    }
  }
  await context.close();
});
test("typewriter mode centers first/middle/last lines, follows typing, and stops when off", async () => {
  const { context, page } = await fresh();
  const text = Array.from({ length: 70 }, () => "짧은 줄").join("\n");
  await page.locator("#editor").fill(text);
  await page.locator("#typewriter").click();
  assert.equal(
    await page
      .locator("#editor")
      .evaluate((el) => getComputedStyle(el).outlineStyle),
    "none",
    "active writing has no enclosing textarea frame",
  );
  for (const position of [0, 100, text.length]) {
    await moveCaret(page, position);
    assert.ok(
      Math.abs(await explicitLineDelta(page)) < 2,
      "active line centered at " + position,
    );
  }
  await page.keyboard.insertText("\n다음 줄");
  await settleLayout(page);
  assert.ok(Math.abs(await explicitLineDelta(page)) < 2);
  const before = await page
    .locator("#documentScroll")
    .evaluate((el) => el.scrollTop);
  await page.locator("#documentScroll").evaluate((el) => (el.scrollTop -= 120));
  await settleLayout(page);
  assert.ok(
    Math.abs(
      (await page.locator("#documentScroll").evaluate((el) => el.scrollTop)) -
        (before - 120),
    ) < 2,
    "manual browsing is not pulled back",
  );
  await page.keyboard.press("ArrowLeft");
  await settleLayout(page);
  assert.ok(Math.abs(await explicitLineDelta(page)) < 2);
  await page.locator("#typewriter").click();
  await settleLayout(page);
  assert.equal(
    await page.locator("#typewriter").getAttribute("aria-pressed"),
    "false",
  );
  assert.equal(
    await page.locator("#typewriterBefore").evaluate((el) => el.offsetHeight),
    0,
  );
  const stopped = await page
    .locator("#documentScroll")
    .evaluate((el) => el.scrollTop);
  await moveCaret(page, 0);
  assert.equal(
    await page.locator("#documentScroll").evaluate((el) => el.scrollTop),
    stopped,
  );
  await context.close();
});
test("typewriter mode handles soft wraps, font and viewport changes, with no autofocus on reload", async () => {
  const { context, page } = await fresh();
  const text =
    "긴 문장도 자연스럽게 이어서 작성합니다. ".repeat(100) + "마지막";
  await page.locator("#editor").fill(text);
  await page.locator("#typewriter").click();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await moveCaret(page, text.length);
    const delta = await page.locator("#editor").evaluate((editor) => {
      const pane = document.getElementById("documentScroll"),
        style = getComputedStyle(editor),
        height = parseFloat(style.lineHeight);
      const caret =
        editor.getBoundingClientRect().top +
        editor.scrollHeight -
        parseFloat(style.paddingBottom) -
        height / 2 -
        editor.scrollTop;
      return caret - (pane.getBoundingClientRect().top + pane.clientHeight / 2);
    });
    assert.ok(
      Math.abs(delta) < 2,
      "wrapped final line centered at " + width + "px: " + delta,
    );
  }
  await page.locator("#fontSize").click();
  await moveCaret(page, text.length);
  assert.equal(await page.locator("#editor").inputValue(), text);
  await page.reload();
  await settleLayout(page);
  assert.equal(
    await page.locator("#typewriter").getAttribute("aria-pressed"),
    "true",
  );
  assert.notEqual(
    await page.evaluate(() => document.activeElement.id),
    "editor",
  );
  assert.equal(
    await page.locator("#typewriterBefore").evaluate((el) => el.offsetHeight),
    0,
    "no initial whitespace until writing starts",
  );
  await page.locator("#charactersNav").click();
  assert.equal(await page.locator("#typewriter").isVisible(), false);
  await context.close();
});
test("typewriter mode waits until Korean IME composition ends before moving the viewport", async () => {
  const { context, page } = await fresh();
  await page
    .locator("#editor")
    .fill(Array.from({ length: 50 }, () => "짧은 줄").join("\n"));
  await page.locator("#typewriter").click();
  await moveCaret(page, 0);
  const before = await page
    .locator("#documentScroll")
    .evaluate((el) => el.scrollTop);
  await page.locator("#editor").evaluate((editor) => {
    editor.dispatchEvent(
      new CompositionEvent("compositionstart", { data: "ㅎ" }),
    );
    editor.setSelectionRange(editor.value.length, editor.value.length);
    editor.value += "\n한글 조합";
    editor.setSelectionRange(editor.value.length, editor.value.length);
    editor.dispatchEvent(
      new InputEvent("input", {
        inputType: "insertCompositionText",
        data: "한글 조합",
        isComposing: true,
      }),
    );
  });
  await settleLayout(page);
  assert.ok(
    Math.abs(
      (await page.locator("#documentScroll").evaluate((el) => el.scrollTop)) -
        before,
    ) < 2,
    "composition does not jump",
  );
  await page
    .locator("#editor")
    .dispatchEvent("compositionend", { data: "한글 조합" });
  await settleLayout(page);
  assert.ok(Math.abs(await explicitLineDelta(page)) < 2);
  assert.match(await page.locator("#editor").inputValue(), /한글 조합$/);
  await context.close();
});

test("workspace name updates logo and browser title, persists, and travels in backups", async () => {
  const { context, page } = await fresh();
  await page.locator("#renameWorkspace").click();
  await page.locator("#workspaceNameInput").fill("나의 이야기");
  await page.locator("#workspaceForm button[type=submit]").click();
  assert.equal(
    await page.locator("#workspaceName").textContent(),
    "나의 이야기",
  );
  assert.equal(await page.title(), "나의 이야기 — 스토리 스튜디오");
  await page.reload();
  assert.equal(
    await page.locator("#workspaceName").textContent(),
    "나의 이야기",
  );
  const data = await backup(page);
  assert.equal(data.workspaceName, "나의 이야기");
  const next = await fresh();
  await restore(next.page, data);
  assert.equal(
    await next.page.locator("#workspaceName").textContent(),
    "나의 이야기",
  );
  assert.equal(await next.page.title(), "나의 이야기 — 스토리 스튜디오");
  await context.close();
  await next.context.close();
});
test("workspace rename validates whitespace, cancel preserves name, and old backups use the default", async () => {
  const { context, page } = await fresh();
  await page.locator("#renameWorkspace").click();
  await page.locator("#workspaceNameInput").fill("   ");
  await page.locator("#workspaceForm button[type=submit]").click();
  assert.equal(await page.locator("#workspaceDialog").isVisible(), true);
  assert.equal(
    await page
      .locator("#workspaceNameInput")
      .evaluate((el) => el.validity.valid),
    false,
  );
  await page.locator("#workspaceNameInput").fill("취소할 이름");
  await page.locator("#cancelWorkspace").click();
  assert.equal(await page.locator("#workspaceName").textContent(), "여백");
  const old = await backup(page);
  delete old.workspaceName;
  await restore(page, old);
  assert.equal(await page.locator("#workspaceName").textContent(), "여백");
  await context.close();
});

test("spell checker is absent and old backup metadata does not affect Korean writing", async () => {
  const context = await browser.newContext();
  const page = await context.newPage(),
    requests = [],
    errors = [];
  context.on("request", (request) => requests.push(request.url()));
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  assert.equal(await page.locator("#proofread, #proofreadDialog").count(), 0);
  assert.equal(
    await page.locator("#editor").getAttribute("spellcheck"),
    "false",
  );
  assert.deepEqual(
    await page.evaluate(() => [
      typeof window.YeobaekProofread,
      typeof window.YeobaekSpellEngine,
    ]),
    ["undefined", "undefined"],
  );
  const text =
    "맞춤뻡이 틀려도 내가 쓴 원고 그대로.\n인물의 말투도 그대로 보관합니다.";
  await page.locator("#editor").fill(text);
  await page.reload();
  assert.equal(await page.locator("#editor").inputValue(), text);
  await makeCharacter(page, "이전 백업의 인물");
  await page.locator("#characterNotes").fill("보관해야 하는 인물 메모");
  const oldBackup = await backup(page);
  oldBackup.dictionary = ["예전에 등록한 단어"];
  await restore(page, oldBackup);
  assert.equal(await page.locator("#editor").inputValue(), text);
  await page.locator("#charactersNav").click();
  assert.equal(
    await page.locator("#characterName").inputValue(),
    "이전 백업의 인물",
  );
  assert.equal(
    await page.locator("#characterNotes").inputValue(),
    "보관해야 하는 인물 메모",
  );
  const refreshed = await backup(page);
  assert.equal(Object.hasOwn(refreshed, "dictionary"), false);
  assert.deepEqual(errors, []);
  assert.deepEqual(
    requests.filter((url) =>
      /proofread|spell-engine|hunspell|dictionary|\.wasm(?:$|\?)/i.test(url),
    ),
    [],
  );
  await context.close();
});
