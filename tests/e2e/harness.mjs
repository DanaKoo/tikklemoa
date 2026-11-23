// 브라우저 점검용 하네스: 별도 서버 없이 Playwright 라우팅으로 레포 파일을 서빙한다.
// 사용: node tests/e2e/check.mjs  (Playwright가 설치된 환경)
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

export const ROOT = normalize(join(fileURLToPath(import.meta.url), "../../.."));
export const ORIGIN = "http://tikklemoa.test";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json",
};

/** apiHandler(route, request) 로 /api/* 응답을 흉내 낼 수 있다 */
export async function openBrowser() {
  return chromium.launch();
}

export async function newPage(browser, { width = 360, height = 780, colorScheme = "light", apiHandler, blockStorage = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme, deviceScaleFactor: 1 });
  if (blockStorage) {
    await context.addInitScript(() => {
      const thrower = { get() { throw new DOMException("blocked", "SecurityError"); } };
      Object.defineProperty(window, "localStorage", thrower);
      Object.defineProperty(window, "sessionStorage", thrower);
    });
  }
  await context.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/")) {
      if (apiHandler) return apiHandler(route, route.request());
      return route.fulfill({ status: 404, body: "no api" });
    }
    const rel = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = normalize(join(ROOT, rel));
    if (!file.startsWith(ROOT)) return route.fulfill({ status: 403, body: "" });
    try {
      const body = await readFile(file);
      return route.fulfill({ status: 200, body, contentType: TYPES[extname(file)] || "application/octet-stream" });
    } catch {
      return route.fulfill({ status: 404, body: "not found" });
    }
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  return { context, page, errors };
}
