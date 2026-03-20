import { chromium } from "playwright-extra";
import type { Browser, BrowserContext, Page } from "playwright";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { FetchError } from "./fetcher";

chromium.use(StealthPlugin());

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
] as const;

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

const COMMON_HEADERS = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

/** Try a plain HTTP fetch with realistic browser headers.
 *  Much less detectable than a headless browser for SSR pages. */
export async function fetchHtml(url: string): Promise<string> {
  const ua = randomUA();
  const response = await fetch(url, {
    headers: { ...COMMON_HEADERS, "User-Agent": ua },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });

  if (response.status === 403 || response.status === 429) {
    throw new FetchError(
      "blocked",
      "http",
      `HTTP ${response.status} from ${url}`,
      url
    );
  }
  if (response.status === 404 || response.status === 410) {
    throw new FetchError(
      "notFound",
      "http",
      `HTTP ${response.status} from ${url}`,
      url
    );
  }
  if (!response.ok) {
    throw new FetchError(
      "networkError",
      "http",
      `HTTP ${response.status} from ${url}`,
      url
    );
  }

  return response.text();
}

interface BrowserFetchOpts {
  maxRetries?: number;
  baseDelayMs?: number;
  jitterMs?: number;
  /** CSS selector to wait for before capturing content (for SPAs). */
  waitForSelector?: string;
  /** Max ms to wait for the selector before falling back. */
  waitForSelectorTimeout?: number;
}

let _browser: Browser | null = null;
let _context: BrowserContext | null = null;

async function getContext(): Promise<BrowserContext> {
  if (_context !== null) return _context;

  _browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--window-size=1280,800",
    ],
  });

  const ua = randomUA();
  _context = await _browser.newContext({
    userAgent: ua,
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  });

  return _context;
}

export async function closeBrowser(): Promise<void> {
  if (_context !== null) {
    await _context.close().catch(() => {});
    _context = null;
  }
  if (_browser !== null) {
    await _browser.close().catch(() => {});
    _browser = null;
  }
}

const BLOCK_TITLE_PATTERNS = [
  "access denied",
  "captcha",
  "just a moment",
  "pardon our interruption",
  "are you a robot",
  "blocked",
];

const BLOCK_PATH_SEGMENTS = ["/captcha", "/challenge", "/blocked"];

/** Fast check using only URL + title (no body/scripts). Use right after goto to fail fast when blocked. */
async function quickBlockCheck(page: Page): Promise<string | null> {
  const pageUrl = page.url();
  for (const seg of BLOCK_PATH_SEGMENTS) {
    if (pageUrl.includes(seg)) return `URL contains ${seg}`;
  }
  const title = (await page.title()).toLowerCase();
  for (const pattern of BLOCK_TITLE_PATTERNS) {
    if (title.includes(pattern)) return `Page title: "${title}"`;
  }
  return null;
}

async function detectBlock(page: Page): Promise<string | null> {
  const pageUrl = page.url();
  for (const seg of BLOCK_PATH_SEGMENTS) {
    if (pageUrl.includes(seg)) return `URL contains ${seg}`;
  }

  const title = (await page.title()).toLowerCase();
  for (const pattern of BLOCK_TITLE_PATTERNS) {
    if (title.includes(pattern)) return `Page title: "${title}"`;
  }

  const pxScripts = await page.locator('script[src*="px-cdn"]').count();
  if (pxScripts > 0) return "PerimeterX script detected";

  const bodyLen = (
    await page
      .locator("body")
      .innerText()
      .catch(() => "")
  ).length;
  if (bodyLen < 500) return `Body too short (${bodyLen} chars)`;

  return null;
}

function jitter(ms: number): number {
  return Math.floor(Math.random() * ms);
}

/** Fetch fully-rendered HTML with retry, jitter, and challenge detection.
 *  Reuses a singleton browser across calls within a batch. */
export async function fetchPageHtml(
  url: string,
  opts?: BrowserFetchOpts
): Promise<string> {
  const maxRetries = opts?.maxRetries ?? 2;
  const baseDelayMs = opts?.baseDelayMs ?? 3000;
  const jitterMs = opts?.jitterMs ?? 2000;

  const context = await getContext();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const page = await context.newPage();
    try {
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      const status = response?.status() ?? 0;
      if (status === 403 || status === 429) {
        throw new FetchError(
          "blocked",
          "browser",
          `HTTP ${status} from ${url}`,
          url
        );
      }
      if (status === 404 || status === 410) {
        throw new FetchError(
          "notFound",
          "browser",
          `HTTP ${status} from ${url}`,
          url
        );
      }

      // Quick block check before long waits (saves 15s+ when blocked)
      await page.waitForTimeout(1500);
      const quickBlock = await quickBlockCheck(page);
      if (quickBlock !== null) {
        if (attempt < maxRetries) {
          const backoff = baseDelayMs * Math.pow(2, attempt) + jitter(jitterMs);
          console.log(
            `[RETRY]   Blocked (attempt ${attempt + 1}/${maxRetries + 1}): ${quickBlock}. Waiting ${backoff}ms...`
          );
          await page.close().catch(() => {});
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        throw new FetchError("blocked", "browser", quickBlock, url);
      }

      // Give SPA JS time to hydrate (soft — won't throw on timeout)
      await page
        .waitForLoadState("networkidle", { timeout: 15_000 })
        .catch(() => {});

      if (opts?.waitForSelector !== undefined) {
        try {
          await page.waitForSelector(opts.waitForSelector, {
            timeout: opts?.waitForSelectorTimeout ?? 10_000,
          });
        } catch {
          console.log(
            `[WARN]    Selector "${opts.waitForSelector}" not found within timeout — continuing`
          );
        }
      }

      await page.waitForTimeout(baseDelayMs + jitter(jitterMs));

      const blockReason = await detectBlock(page);
      if (blockReason !== null) {
        if (attempt < maxRetries) {
          const backoff = baseDelayMs * Math.pow(2, attempt) + jitter(jitterMs);
          console.log(
            `[RETRY]   Blocked (attempt ${attempt + 1}/${maxRetries + 1}): ${blockReason}. Waiting ${backoff}ms...`
          );
          await page.waitForTimeout(backoff);
          continue;
        }
        throw new FetchError("blocked", "browser", blockReason, url);
      }

      return await page.content();
    } catch (err) {
      if (err instanceof FetchError) {
        if (attempt < maxRetries && err.code === "blocked") {
          const backoff = baseDelayMs * Math.pow(2, attempt) + jitter(jitterMs);
          console.log(`[RETRY]   ${err.message}. Waiting ${backoff}ms...`);
          await page.close().catch(() => {});
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        throw err;
      }
      const msg = (err as Error).message ?? String(err);
      if (msg.includes("timeout") || msg.includes("ERR_TIMED_OUT")) {
        throw new FetchError("timeout", "browser", msg, url);
      }
      throw new FetchError("networkError", "browser", msg, url);
    } finally {
      await page.close().catch(() => {});
    }
  }

  throw new FetchError(
    "blocked",
    "browser",
    `All ${maxRetries + 1} attempts blocked for ${url}`,
    url
  );
}
