// Targeted Safari-like regressions on real Chromium; this is not a Safari test.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs/promises");
const { existsSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const allowed = new Set([
  "index.html",
  "작업시작.html",
  "app.js",
  "style.css",
  "proofread.js",
  "spell-engine.js",
  "typewriter.js",
  "vendor/hunspell-engine.js",
  "vendor/korean-dictionary.js",
]);
let server, browser, base;
before(async () => {
  server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const requested = decodeURIComponent(url.pathname).slice(1);
      const canonical = existsSync(path.join(root, "작업시작.html"))
        ? "작업시작.html"
        : "index.html";
      const name = requested || canonical;
      if (!allowed.has(name)) {
        res.writeHead(404).end();
        return;
      }
      const body = await fs.readFile(path.join(root, name));
      res.setHeader(
        "Content-Type",
        name.endsWith(".js")
          ? "application/javascript"
          : name.endsWith(".css")
            ? "text/css"
            : "text/html; charset=utf-8",
      );
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
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
  if (server) await new Promise((resolve) => server.close(resolve));
});
async function fresh() {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  await page.addScriptTag({ url: base + "/vendor/hunspell-engine.js" });
  await page.addScriptTag({ url: base + "/vendor/korean-dictionary.js" });
  return { context, page, errors };
}

test("real dictionary checker survives the reported Blob I/O failure and absent native gzip streams", async () => {
  const { context, page, errors } = await fresh();
  const external = [];
  context.on("request", (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith(base + "/"))
      external.push(request.url());
  });
  await page.evaluate(() => {
    const prefix = `
Blob.prototype.stream = function () {
  throw new DOMException('The I/O read operation failed.', 'NotReadableError');
};
self.DecompressionStream = undefined;
`;
    // The bridge may load these scripts again lazily. Retain the injection for
    // subsequent assignments instead of allowing a second script to erase it.
    let source = window.YeobaekHunspellWorkerSource;
    Object.defineProperty(window, "YeobaekHunspellWorkerSource", {
      configurable: true,
      get: () => prefix + source,
      set: (value) => {
        source = value;
      },
    });
  });
  const result = await page.evaluate(async () =>
    window.YeobaekSpellEngine.check("먹엇다. 않녕하세요. 괜찬아."),
  );
  assert.equal(result.checked, 3);
  assert.deepEqual(
    result.issues.map((issue) => [issue.original, issue.replacement]),
    [
      ["먹엇다", "먹었다"],
      ["않녕하세요", "안녕하세요"],
      ["괜찬아", "괜찮아"],
    ],
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  await context.close();
});

test("worker Blob URL remains live until its actual ready message and is then released", async () => {
  const { context, page, errors } = await fresh();
  await page.evaluate(() => {
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    const NativeWorker = window.Worker;
    const records = (window.__workerBlobLifetime = []);
    URL.createObjectURL = (blob) => {
      const url = create(blob);
      if (blob.type === "text/javascript")
        records.push({
          url,
          created: true,
          workerCreated: false,
          ready: false,
          revoked: false,
          earlyRevoke: false,
        });
      return url;
    };
    URL.revokeObjectURL = (url) => {
      const record = records.find((record) => record.url === url);
      if (record) {
        record.revoked = true;
        record.earlyRevoke = !record.ready;
      }
      return revoke(url);
    };
    window.Worker = class extends NativeWorker {
      constructor(url, ...options) {
        super(url, ...options);
        const record = records.find((record) => record.url === String(url));
        if (record) record.workerCreated = true;
        this.addEventListener("message", (event) => {
          if (record && event.data.type === "ready") record.ready = true;
        });
      }
    };
  });
  const result = await page.evaluate(async () =>
    window.YeobaekSpellEngine.check("먹엇다."),
  );
  assert.equal(result.issues[0].replacement, "먹었다");
  const records = await page.evaluate(() => window.__workerBlobLifetime);
  assert.equal(records.length, 1);
  assert.equal(records[0].workerCreated, true);
  assert.equal(records[0].ready, true);
  assert.equal(records[0].revoked, true);
  assert.equal(records[0].earlyRevoke, false);
  assert.deepEqual(errors, []);
  await context.close();
});
