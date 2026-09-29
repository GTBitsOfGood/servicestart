/* global process, console, fetch */
// Headless-Chromium driver for a running ServiceStart dev server.
// Reads one command per line from stdin; see SKILL.md for the command list.
//   node .claude/skills/run-servicestart/driver.mjs <<'EOF'
//   login member1@example.com
//   shot home
//   EOF
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { chromium } from "@playwright/test";

const SHOTS = process.env.SHOTS_DIR ?? "/tmp/servicestart/shots";
const DEFAULT_ORIGIN = "http://localhost:3000";
const PASSWORD = "password123"; // every seeded account
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({
  executablePath: fs.existsSync("/opt/pw-browsers/chromium")
    ? "/opt/pw-browsers/chromium"
    : undefined,
  args: [
    "--no-sandbox",
    // Keeps navigator.webdriver false. useActiveOrganization skips setting the
    // active org for webdriver sessions on localhost (an e2e escape hatch).
    "--disable-blink-features=AutomationControlled",
    "--host-resolver-rules=MAP *.lvh.me 127.0.0.1",
    // The sandbox's HTTPS proxy otherwise intercepts *.lvh.me traffic.
    "--no-proxy-server",
  ],
});

let context;
let page;
let origin = DEFAULT_ORIGIN;
let problems = [];
let shotCount = 0;
let failed = false;
const vars = {};

async function newPage(nextOrigin) {
  await context?.close();
  origin = nextOrigin ?? DEFAULT_ORIGIN;
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  page = await context.newPage();
  page.setDefaultTimeout(30_000);
  problems = [];
  page.on("console", (m) => {
    if (m.type() === "error")
      problems.push(`console: ${m.text().slice(0, 200)}`);
  });
  page.on("pageerror", (e) =>
    problems.push(`pageerror: ${e.message.slice(0, 200)}`),
  );
  page.on("response", (r) => {
    if (r.status() >= 500) {
      problems.push(`${r.status()} ${r.request().method()} ${r.url()}`);
    }
  });
}

const settle = () =>
  page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
const toUrl = (target) =>
  /^https?:/.test(target) ? target : `${origin}${target}`;

// Splits off the first argument; single or double quotes group a selector.
function splitFirst(text) {
  const s = text.trimStart();
  const quote = s[0];
  if (quote === "'" || quote === '"') {
    const end = s.indexOf(quote, 1);
    return [s.slice(1, end), s.slice(end + 1).trim()];
  }
  const space = s.search(/\s/);
  return space === -1
    ? [s, ""]
    : [s.slice(0, space), s.slice(space + 1).trim()];
}

// A single selector argument, optionally quoted.
const selector = (rest) => page.locator(splitFirst(rest)[0]).first();

async function screenshot(name, full = false) {
  const file = path.join(
    SHOTS,
    `${String(++shotCount).padStart(2, "0")}-${name}.png`,
  );
  await page.screenshot({ path: file, fullPage: full });
  return file;
}

const commands = {
  async login(rest) {
    const [email, loginOrigin] = splitFirst(rest);
    await newPage(loginOrigin || undefined);
    await page.goto(toUrl("/login"));
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', PASSWORD);
    await page.locator('role=button[name="Login"]').click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), {
      timeout: 60_000,
    });
    // After sign-in the app sets the active org and router.push("/")es; a
    // navigation started before that finishes gets interrupted.
    await settle();
    await page.waitForTimeout(2500);
    await settle();
    return page.url();
  },
  async anon(rest) {
    await newPage(rest || undefined);
    return `signed out, origin ${origin}`;
  },
  async nav(rest) {
    await page.goto(toUrl(rest));
    await settle();
    return page.url();
  },
  async click(rest) {
    await selector(rest).click();
    await settle();
  },
  async hover(rest) {
    await selector(rest).hover();
  },
  async fill(rest) {
    const [target, value] = splitFirst(rest);
    await page.locator(target).first().fill(value);
  },
  async press(rest) {
    await page.keyboard.press(rest);
  },
  async "wait-for"(rest) {
    await selector(rest).waitFor();
  },
  async wait(rest) {
    await page.waitForTimeout(Number(rest));
  },
  async text(rest) {
    return (await selector(rest).innerText()).trim().slice(0, 500);
  },
  async count(rest) {
    return String(await page.locator(splitFirst(rest)[0]).count());
  },
  async url() {
    return page.url();
  },
  async shot(rest) {
    const [name, flag] = splitFirst(rest);
    return screenshot(name || "shot", flag === "full");
  },
  async eval(rest) {
    return JSON.stringify(await page.evaluate(rest));
  },
  async set(rest) {
    const [name, expression] = splitFirst(rest);
    vars[name] = await page.evaluate(expression);
    return `${name}=${JSON.stringify(vars[name])}`;
  },
  async api(rest) {
    const [method, afterMethod] = splitFirst(rest);
    const [apiPath, body] = splitFirst(afterMethod);
    const result = await page.evaluate(
      async ({ method, apiPath, body }) => {
        const res = await fetch(apiPath, {
          method,
          headers: body ? { "content-type": "application/json" } : {},
          body: body || undefined,
        });
        return `${res.status} ${await res.text()}`;
      },
      { method: method.toUpperCase(), apiPath, body },
    );
    return result.slice(0, 600);
  },
  async errors() {
    const out = problems.length ? problems.join("\n") : "(none)";
    problems = [];
    return out;
  },
};

const rl = readline.createInterface({ input: process.stdin });
for await (const raw of rl) {
  const line = raw
    .trim()
    .replace(/\{\{(\w+)\}\}/g, (_, name) => vars[name] ?? "");
  if (!line || line.startsWith("#")) continue;
  if (line === "quit") break;
  const [name, rest] = splitFirst(line);
  console.log(`> ${line}`);
  const command = commands[name];
  if (!page && name !== "login" && name !== "anon") await newPage();
  try {
    if (!command) throw new Error(`unknown command "${name}"`);
    const result = await command(rest);
    if (result) console.log(`  ${String(result).replace(/\n/g, "\n  ")}`);
  } catch (error) {
    // Stop at the first failure: later steps depend on earlier ones.
    failed = true;
    console.log(`  ERR ${error.message.split("\n")[0]}`);
    const file = await screenshot("error").catch(() => null);
    if (file) console.log(`  (screenshot: ${file}; stopping)`);
    break;
  }
}

await browser.close();
process.exit(failed ? 1 : 0);
