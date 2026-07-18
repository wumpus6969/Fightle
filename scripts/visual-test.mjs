import { chromium } from "playwright-core";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});

const errors = [];
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
mobile.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
mobile.on("pageerror", (error) => errors.push(error.message));

await mobile.goto("http://localhost:4173", { waitUntil: "networkidle" });
await mobile.screenshot({ path: path.join(root, "fightle-mobile.png"), fullPage: false });

const input = mobile.getByLabel("Guess a fighter");
await input.fill("Matt");
const suggestionCount = await mobile.locator(".suggestions button").count();
await mobile.screenshot({ path: path.join(root, "fightle-mobile-search.png"), fullPage: false });
await mobile.locator(".suggestions button", { hasText: "Jake Matthews" }).click();
await mobile.screenshot({ path: path.join(root, "fightle-mobile-guess.png"), fullPage: false });

const candidates = ["Charles Oliveira", "Israel Adesanya", "Bo Nickal", "Tom Aspinall", "Max Holloway"];
for (const name of candidates) {
  if (!(await input.isVisible())) break;
  await input.fill(name);
  await mobile.locator(".suggestions button", { hasText: name }).click();
}

const finished = await mobile.locator(".result-banner").isVisible();
if (finished) {
  await mobile.screenshot({ path: path.join(root, "fightle-mobile-result.png"), fullPage: true });
  await mobile.getByRole("button", { name: "New fighter" }).click();
}
const resetWorked = await input.isVisible() && (await input.getAttribute("placeholder"))?.includes("6 left");

const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
desktop.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
desktop.on("pageerror", (error) => errors.push(error.message));
await desktop.goto("http://localhost:4173", { waitUntil: "networkidle" });
await desktop.screenshot({ path: path.join(root, "fightle-desktop.png"), fullPage: false });

await browser.close();
console.log(JSON.stringify({ suggestionCount, finished, resetWorked, consoleErrors: errors }, null, 2));
