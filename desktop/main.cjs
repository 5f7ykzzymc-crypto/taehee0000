"use strict";

const {
  app,
  BrowserWindow,
  dialog,
  Menu,
  protocol,
  screen,
  session,
} = require("electron");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

const APP_NAME = "작업시작";
const APP_ORIGIN = "yeobaek://app";
const APP_URL = `${APP_ORIGIN}/index.html`;
const resources = new Map([
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/typewriter.js", ["typewriter.js", "text/javascript; charset=utf-8"]],
  ["/style.css", ["style.css", "text/css; charset=utf-8"]],
]);
const contentSecurityPolicy = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
].join("; ");

app.setName(APP_NAME);
// Keep the profile independent of the installation folder and package version.
// An isolated profile is available only to development-time integration tests.
const testProfile = !app.isPackaged && process.env.YEOBAEK_TEST_USER_DATA_DIR;
app.setPath(
  "userData",
  testProfile && path.isAbsolute(testProfile)
    ? testProfile
    : path.join(app.getPath("appData"), "YeobaekStoryStudio"),
);
protocol.registerSchemesAsPrivileged([
  { scheme: "yeobaek", privileges: { standard: true, secure: true } },
]);

let mainWindow = null;
let startupComplete = false;

function trustedPage(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "yeobaek:" &&
      parsed.host === "app" &&
      parsed.pathname === "/index.html"
    );
  } catch {
    return false;
  }
}

function trustedOrigin(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "yeobaek:" && parsed.host === "app";
  } catch {
    return false;
  }
}

function installMenu() {
  const template = [];
  if (process.platform === "darwin") {
    template.push({
      label: APP_NAME,
      submenu: [
        { role: "about", label: `${APP_NAME} 정보` },
        { type: "separator" },
        { role: "services", label: "서비스" },
        { type: "separator" },
        { role: "hide", label: `${APP_NAME} 가리기` },
        { role: "hideOthers", label: "기타 가리기" },
        { role: "unhide", label: "모두 보기" },
        { type: "separator" },
        { role: "quit", label: `${APP_NAME} 종료` },
      ],
    });
  } else {
    template.push({
      label: "파일",
      submenu: [
        { role: "close", label: "창 닫기" },
        { role: "quit", label: "종료" },
      ],
    });
  }
  template.push(
    {
      label: "편집",
      submenu: [
        { role: "undo", label: "실행 취소" },
        { role: "redo", label: "실행 복귀" },
        { type: "separator" },
        { role: "cut", label: "오려두기" },
        { role: "copy", label: "복사하기" },
        { role: "paste", label: "붙여넣기" },
        { role: "pasteAndMatchStyle", label: "스타일을 맞추어 붙여넣기" },
        { role: "delete", label: "삭제" },
        { role: "selectAll", label: "전체 선택" },
      ],
    },
    {
      label: "보기",
      submenu: [
        { role: "resetZoom", label: "실제 크기" },
        { role: "zoomIn", label: "확대" },
        { role: "zoomOut", label: "축소" },
        { type: "separator" },
        { role: "togglefullscreen", label: "전체 화면" },
      ],
    },
    {
      label: "윈도우",
      submenu: [
        { role: "minimize", label: "최소화" },
        { role: "zoom", label: "확대/축소" },
        { role: "close", label: "창 닫기" },
      ],
    },
  );
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function installProtocol() {
  await protocol.handle("yeobaek", async (request) => {
    const url = new URL(request.url);
    const resource =
      url.protocol === "yeobaek:" &&
      url.host === "app" &&
      resources.get(url.pathname);
    if (request.method !== "GET" || !resource)
      return new Response("Not found", { status: 404 });
    try {
      return new Response(
        await readFile(path.join(__dirname, "..", resource[0])),
        {
          headers: {
            "Content-Type": resource[1],
            "Content-Security-Policy": contentSecurityPolicy,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
          },
        },
      );
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
  const allowedPermissions = new Set([
    "clipboard-sanitized-write",
    "fullscreen",
  ]);
  session.defaultSession.setPermissionRequestHandler(
    (contents, permission, callback, details) => {
      callback(
        allowedPermissions.has(permission) &&
          trustedPage(contents.getURL()) &&
          (!details.requestingUrl || trustedPage(details.requestingUrl)),
      );
    },
  );
  session.defaultSession.setPermissionCheckHandler(
    (contents, permission, origin) =>
      allowedPermissions.has(permission) &&
      !!contents &&
      trustedPage(contents.getURL()) &&
      trustedOrigin(origin),
  );
  session.defaultSession.on("will-download", (_event, item) => {
    item.setSaveDialogOptions({
      title: "파일 저장",
      defaultPath: path.join(
        app.getPath("downloads"),
        path.basename(item.getFilename()),
      ),
      properties: ["createDirectory", "showOverwriteConfirmation"],
    });
    item.once("done", (_doneEvent, state) => {
      if (state === "interrupted")
        dialog.showErrorBox(
          "파일 저장 실패",
          "파일을 저장하지 못했습니다. 저장 위치를 확인한 뒤 다시 시도해 주세요.",
        );
    });
  });
}

function createWindow() {
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    width: Math.max(760, Math.min(1360, workArea.width - 80)),
    height: Math.max(520, Math.min(900, workArea.height - 80)),
    minWidth: 760,
    minHeight: 520,
    title: APP_NAME,
    backgroundColor: "#fffefa",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      spellcheck: false,
      navigateOnDragDrop: false,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!trustedPage(url)) event.preventDefault();
  });
  mainWindow.webContents.on("will-redirect", (event, url) => {
    if (!trustedPage(url)) event.preventDefault();
  });
  mainWindow.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  mainWindow.webContents.on("will-prevent-unload", (event) => {
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: "warning",
      title: "저장하지 못한 원고",
      message: "아직 저장하지 못한 원고가 있습니다.",
      detail: "돌아가서 전체 백업으로 보관할 수 있습니다.",
      buttons: ["돌아가기", "저장하지 않고 닫기"],
      defaultId: 0,
      cancelId: 0,
    });
    // Electron uses preventDefault here to allow the user's confirmed close.
    if (choice === 1) event.preventDefault();
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  void mainWindow.loadURL(APP_URL);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) {
      if (startupComplete) createWindow();
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app
    .whenReady()
    .then(async () => {
      await installProtocol();
      installMenu();
      startupComplete = true;
      createWindow();
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
    })
    .catch((error) => {
      dialog.showErrorBox("실행 실패", error.message);
      app.quit();
    });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
