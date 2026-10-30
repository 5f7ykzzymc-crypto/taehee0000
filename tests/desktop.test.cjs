"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { _electron: electron } = require("playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");

const root = path.resolve(__dirname, "..");

async function savedJSON(file) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      return JSON.parse(await fs.readFile(file, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT" && !(error instanceof SyntaxError))
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw new Error("The desktop backup did not finish saving.");
}

async function armMacFullscreen(desktop, eventName) {
  if (process.platform !== "darwin") return;
  await desktop.evaluate(({ BrowserWindow }, name) => {
    const window = BrowserWindow.getAllWindows()[0];
    window.__yeobaekTestFullscreen = new Promise((resolve) => {
      window.once(name, () => resolve(true));
    });
  }, eventName);
}

async function settleMacFullscreen(desktop, expected) {
  if (process.platform !== "darwin") return;
  const fullscreen = await desktop.evaluate(async ({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    await window.__yeobaekTestFullscreen;
    delete window.__yeobaekTestFullscreen;
    return window.isFullScreen();
  });
  assert.equal(
    fullscreen,
    expected,
    "native macOS fullscreen transition settled",
  );
}

test(
  "desktop runs offline, isolates Node, keeps drafts after relaunch, and saves full backups",
  { timeout: 60000 },
  async () => {
    const temporary = await fs.mkdtemp(
      path.join(os.tmpdir(), "yeobaek-desktop-"),
    );
    const profile = path.join(temporary, "profile");
    const backupPath = path.join(temporary, "desktop-backup.json");
    const main = path.join(root, "desktop", "main.cjs");
    // CI containers lack the privileged Chromium sandbox helper. The packaged
    // app itself never disables its sandbox or supplies these test-only flags.
    const args = process.platform === "linux" ? ["--no-sandbox"] : [];
    if (process.platform === "linux" && !process.env.DISPLAY)
      args.push("--ozone-platform=headless");
    args.push(main);
    const launch = () =>
      electron.launch({
        args,
        env: { ...process.env, YEOBAEK_TEST_USER_DATA_DIR: profile },
      });
    let desktop;
    try {
      desktop = await launch();
      let page = await desktop.firstWindow();
      const pageErrors = [],
        remoteRequests = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("request", (request) => {
        if (/^https?:/.test(request.url())) remoteRequests.push(request.url());
      });
      await page.locator("#editor").waitFor();
      assert.equal(page.url(), "yeobaek://app/index.html");
      assert.deepEqual(
        await page.evaluate(() => [
          isSecureContext,
          typeof require,
          typeof process,
          typeof module,
        ]),
        [true, "undefined", "undefined", "undefined"],
      );
      assert.deepEqual(
        await desktop.evaluate(({ BrowserWindow }) => {
          const preferences =
            BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
          return [
            preferences.nodeIntegration,
            preferences.contextIsolation,
            preferences.sandbox,
            preferences.webSecurity,
            preferences.webviewTag,
          ];
        }),
        [false, true, true, true, false],
      );

      await page.locator("#addWork").click();
      await page.locator("#workNameInput").fill("앱에서 만든 작품");
      await page.locator("#saveWork").click();
      assert.equal(await page.locator("#workSelect option").count(), 2);
      assert.equal(await page.locator("#editor").inputValue(), "");
      await page.locator("#editor").fill("브라우저 없이 앱에서 작성한 원고");
      await page.keyboard.insertText(" 임시 수정");
      await page.keyboard.press(
        process.platform === "darwin" ? "Meta+Z" : "Control+Z",
      );
      assert.equal(
        await page.locator("#editor").inputValue(),
        "브라우저 없이 앱에서 작성한 원고",
      );
      const clipboardImage = await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 12;
        canvas.height = 12;
        canvas.getContext("2d").fillRect(0, 0, 12, 12);
        return canvas.toDataURL("image/png");
      });
      await desktop.evaluate(
        ({ clipboard, ClipboardItem }, data) =>
          clipboard.write([
            new ClipboardItem({
              "image/png": new Blob(
                [Buffer.from(data.split(",")[1], "base64")],
                { type: "image/png" },
              ),
            }),
          ]),
        clipboardImage,
      );
      await page.locator("#editor").focus();
      await page.keyboard.press(
        process.platform === "darwin" ? "Meta+V" : "Control+V",
      );
      await page.waitForFunction(
        () =>
          document.querySelectorAll("#sceneImages .image-card").length === 1,
      );

      await armMacFullscreen(desktop, "enter-full-screen");
      await page.locator("#focus").click();
      await page.waitForFunction(
        () => document.fullscreenElement === document.documentElement,
      );
      await settleMacFullscreen(desktop, true);
      assert.equal(
        await page.locator("#focus").getAttribute("aria-pressed"),
        "true",
      );
      await armMacFullscreen(desktop, "leave-full-screen");
      await page.locator("#focus").click();
      assert.equal(
        await page.locator("#focus").getAttribute("aria-pressed"),
        "false",
        "the fullscreen exit click reaches the writing application",
      );
      await page.waitForFunction(() => !document.fullscreenElement);
      await settleMacFullscreen(desktop, false);

      await desktop.evaluate(({ session }, destination) => {
        session.defaultSession.once("will-download", (_event, item) =>
          item.setSavePath(destination),
        );
      }, backupPath);
      await page.locator("#backup").click();
      const backup = await savedJSON(backupPath);
      assert.equal(backup.version, 3);
      assert.equal(backup.works.length, 2);
      const active = backup.works.find(
        (work) => work.id === backup.activeWorkId,
      );
      assert.equal(
        active.project.episodes[0].scenes[0].text,
        "브라우저 없이 앱에서 작성한 원고",
      );
      assert.equal(active.project.episodes[0].scenes[0].images.length, 1);

      await page.locator("#editor").fill("백업으로 교체할 임시 원고");
      await page.locator("#restoreFile").setInputFiles(backupPath);
      await page.locator("#confirmAction").click();
      assert.equal(
        await page.locator("#editor").inputValue(),
        "브라우저 없이 앱에서 작성한 원고",
      );

      await page.evaluate(() => {
        window.open("https://example.com");
      });
      await page.evaluate(() => {
        location.href = "https://example.com";
      });
      assert.equal(page.url(), "yeobaek://app/index.html");
      assert.equal(
        await desktop.evaluate(
          ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
        ),
        1,
      );
      assert.deepEqual(remoteRequests, []);
      assert.deepEqual(pageErrors, []);

      await desktop.close();
      desktop = await launch();
      page = await desktop.firstWindow();
      await page.locator("#editor").waitFor();
      assert.equal(
        await page.locator("#workSelect option:checked").textContent(),
        "앱에서 만든 작품",
      );
      assert.equal(
        await page.locator("#editor").inputValue(),
        "브라우저 없이 앱에서 작성한 원고",
      );
      assert.equal(await page.locator("#sceneImages .image-card").count(), 1);
    } finally {
      await desktop?.close();
      await fs.rm(temporary, { recursive: true, force: true });
    }
  },
);
