import fs from "node:fs";
import path from "node:path";
import { type Browser, type BrowserContext, chromium, type Page } from "playwright";

// Helper to manually load .env file
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    console.warn("Warning: .env file not found at", envPath);
    return;
  }
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.substring(0, index).trim();
    let val = trimmed.substring(index + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

// Load environment variables
loadEnv();

function getLanguage(): string {
  const langArgIndex = process.argv.findIndex((arg) => arg.startsWith("--lang=") || arg === "-l");
  if (langArgIndex !== -1) {
    if (process.argv[langArgIndex].startsWith("--lang=")) {
      return process.argv[langArgIndex].split("=")[1].trim();
    } else if (langArgIndex + 1 < process.argv.length) {
      return process.argv[langArgIndex + 1].trim();
    }
  }
  return process.env.SCREENSHOT_LANG || "en-US";
}

function parseLanguage(lang: string) {
  const lower = lang.toLowerCase().replace("_", "-");
  if (lower.startsWith("zh")) {
    return {
      code: "zh-Hans",
      locale: "zh-CN",
      acceptLanguage: "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
      isChinese: true,
    };
  }
  return {
    code: "en-US",
    locale: "en-US",
    acceptLanguage: "en-US,en;q=0.9",
    isChinese: false,
  };
}

const langConfig = parseLanguage(getLanguage());

const PAGES = [
  { name: "overview", urlPath: "/cgi-bin/luci/admin/status/overview" },
  { name: "network", urlPath: "/cgi-bin/luci/admin/network/network" },
  { name: "nftables", urlPath: "/cgi-bin/luci/admin/status/nftables" },
];

const MOBILE_LIGHT_EXTRA_PAGES = [
  { name: "system_settings", urlPath: "/cgi-bin/luci/admin/system/system" },
  { name: "software_management", urlPath: "/cgi-bin/luci/admin/system/package-manager" },
] as const;

const OVERVIEW_BLUR_SELECTORS = [
  "#view > div:nth-child(1) > div:nth-child(2) > table > tr:nth-child(2) > td:nth-child(2)",
  "#view > div:nth-child(1) > div:nth-child(2) > table > tr:nth-child(6) > td:nth-child(2)",
] as const;

const MASK_BLUR_CLASS = "fluent-mask-blur";
const MASK_BLUR_STYLE = `
  .${MASK_BLUR_CLASS} {
    filter: blur(6px);
    user-select: none;
    pointer-events: none;
  }
`;

type VariantConfig = {
  prefix: string;
  viewport: { width: number; height: number };
  label: string;
  darkMode: boolean;
};

const VARIANTS: VariantConfig[] = [
  { prefix: "", viewport: { width: 1280, height: 720 }, label: "Desktop Light", darkMode: false },
  { prefix: "dark_", viewport: { width: 1280, height: 720 }, label: "Desktop Dark", darkMode: true },
  { prefix: "mobile_", viewport: { width: 390, height: 844 }, label: "Mobile Light", darkMode: false },
  { prefix: "mobile_dark_", viewport: { width: 390, height: 844 }, label: "Mobile Dark", darkMode: true },
  { prefix: "tablet_", viewport: { width: 1024, height: 720 }, label: "Tablet Light", darkMode: false },
  { prefix: "tablet_dark_", viewport: { width: 1024, height: 720 }, label: "Tablet Dark", darkMode: true },
];

/**
 * Perform the LuCI 2-step login flow and take a screenshot at the password step,
 * then complete login and capture the configured pages.
 */
async function captureVariant(browser: Browser, screenshotsDir: string, routerUrl: string, username: string, password: string, config: VariantConfig): Promise<void> {
  console.log(`\n=== ${config.label} (${config.viewport.width}×${config.viewport.height}) ===`);
  const isTouchMobileVariant = config.prefix === "mobile_" || config.prefix === "mobile_dark_";

  const context: BrowserContext = await browser.newContext({
    viewport: config.viewport,
    isMobile: isTouchMobileVariant,
    hasTouch: isTouchMobileVariant,
    ignoreHTTPSErrors: true,
    locale: langConfig.locale,
    extraHTTPHeaders: {
      "Accept-Language": langConfig.acceptLanguage,
    },
  });

  const page: Page = await context.newPage();

  if (config.darkMode) {
    await page.emulateMedia({ colorScheme: "dark" });
  }

  try {
    // ── Login ──────────────────────────────────────────────────────
    console.log("  Navigating to login page...");
    await page.goto(routerUrl, { waitUntil: "load", timeout: 30000 });

    // Wait for either the user input field (Step 1) or password field (Step 2) to load and become visible
    await page.waitForSelector("#cbi-input-user:visible, #cbi-input-password:visible", { timeout: 15000 });

    // Let any page animations or background canvas render
    await page.waitForTimeout(2000);

    console.log("  Starting login flow...");

    const userInput = page.locator("#cbi-input-user");
    const passInput = page.locator("#cbi-input-password");
    const nextBtn = page.locator("#btn-next");
    const backBtn = page.locator("#ms-back-btn");
    const loginBtn = page.locator("#btn-login");

    // First check if username input is visible. If not, we are already in password step.
    const startInPasswordStep = (await passInput.isVisible()) && !(await userInput.isVisible());

    if (startInPasswordStep) {
      console.log("  Page loaded directly into password step. Clicking back button to return to username step...");
      if (await backBtn.isVisible()) {
        await backBtn.click();
        await page.waitForTimeout(1000);
      }
    } else {
      console.log(`  Filling username: ${username}...`);
      await userInput.fill(username);
      if (await nextBtn.isVisible()) {
        console.log('  Clicking "Next" button...');
        await nextBtn.click();
        await page.waitForTimeout(1000);
      }

      console.log("  At password step. Clicking back button to return to username step and modify it...");
      if (await backBtn.isVisible()) {
        await backBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    console.log(`  Re-filling username: ${username}...`);
    await userInput.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await userInput.fill(username);

    console.log('  Clicking "Next" button to go to password step...');
    await nextBtn.click();
    await page.waitForTimeout(1000);

    // ── Login Page Screenshot ──────────────────────────────────────
    const loginScreenshotPath = path.join(screenshotsDir, `${config.prefix}login_password.png`);
    await page.screenshot({ path: loginScreenshotPath });
    console.log(`  Saved: ${config.prefix}login_password.png`);

    // ── Fill password and login ────────────────────────────────────
    if (await passInput.isVisible()) {
      console.log("  Filling password...");
      await passInput.fill(password);

      console.log("  Submitting login form...");
      if (await loginBtn.isVisible()) {
        await loginBtn.click();
      } else {
        await passInput.press("Enter");
      }
    } else {
      throw new Error("Password input field was not found or visible after returning to username step.");
    }

    // Wait for login redirect
    console.log("  Waiting for authentication...");
    try {
      await page.waitForSelector("#mainmenu, .main, #tabmenu", { timeout: 15000 });
    } catch (e) {
      const errorMsg = page.locator(".errorbox");
      if (await errorMsg.isVisible()) {
        const text = await errorMsg.innerText();
        throw new Error(`Login failed. Router error message: "${text.trim()}"`);
      }
      throw e;
    }
    console.log("  Successfully logged in!");

    // ── Authenticated Page Screenshots ─────────────────────────────
    for (const pageConfig of PAGES) {
      const url = `${routerUrl}${pageConfig.urlPath}`;
      console.log(`  Navigating to ${pageConfig.name}...`);
      await page.goto(url, { waitUntil: "load", timeout: 30000 });
      await page.waitForLoadState("networkidle");
      await page.waitForSelector(".main, #mainmenu", { timeout: 15000 });
      await page.waitForTimeout(2500); // Let transitions/charts render

      if (pageConfig.name === "overview") {
        await applyOverviewBlurMask(page);
      }

      // Simulate mouse hover to trigger tooltips
      if (pageConfig.name === "network") {
        const badge = page.locator('td[data-name="_ifacebox"] .ifacebox-body .cbi-tooltip-container, .td[data-name="_ifacebox"] .ifacebox-body .cbi-tooltip-container').first();
        if ((await badge.count()) > 0 && (await badge.isVisible())) {
          console.log("  Simulating hover over network interface badge to show tooltip...");
          await badge.scrollIntoViewIfNeeded();
          await badge.hover();
          try {
            await page.waitForSelector("#fluent-global-tooltip:visible, .cbi-tooltip:visible", { timeout: 5000 });
            await page.waitForTimeout(1000); // Wait for transition/positioning to stabilize
          } catch (_e) {
            console.log("  Note: Tooltip did not become visible in 5s (may not exist or already visible)");
          }
        }
      }

      const screenshotPath = path.join(screenshotsDir, `${config.prefix}${pageConfig.name}.png`);
      await page.screenshot({ path: screenshotPath });
      console.log(`  Saved: ${config.prefix}${pageConfig.name}.png`);
    }

    if (config.prefix === "mobile_" || config.prefix === "mobile_dark_") {
      await captureMobileSidebarOpen(page, screenshotsDir, config.prefix);
      await captureMobileExtraPages(page, screenshotsDir, routerUrl, config.prefix);
    }
  } catch (error) {
    console.error(`  [${config.label}] Error:`, error);
    try {
      const failPath = path.join(screenshotsDir, `${config.prefix}failure.png`);
      await page.screenshot({ path: failPath });
      console.error(`  Saved failure screenshot: ${config.prefix}failure.png`);
    } catch {
      /* ignore */
    }
    throw error;
  } finally {
    await context.close();
  }
}

async function applyOverviewBlurMask(page: Page): Promise<void> {
  await page.addStyleTag({ content: MASK_BLUR_STYLE });

  for (const selector of OVERVIEW_BLUR_SELECTORS) {
    const cell = page.locator(selector);
    await cell.evaluate((element, className) => {
      element.classList.add(className);
    }, MASK_BLUR_CLASS);
  }
}

async function captureMobileSidebarOpen(page: Page, screenshotsDir: string, prefix = "mobile_"): Promise<void> {
  const sidebarToggle = page.locator("a.showSide");

  await sidebarToggle.waitFor({ state: "visible", timeout: 15000 });
  await sidebarToggle.click();
  await page.waitForSelector("#mainmenu.active", { timeout: 15000 });
  await page.waitForSelector(".darkMask.active", { timeout: 15000 });
  await page.waitForTimeout(300);

  const screenshotPath = path.join(screenshotsDir, `${prefix}sidebar_open.png`);
  await page.screenshot({ path: screenshotPath });
  console.log(`  Saved: ${prefix}sidebar_open.png`);

  await sidebarToggle.evaluate((element) => {
    if (element instanceof HTMLElement) {
      element.click();
      return;
    }

    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await page.waitForSelector("#mainmenu:not(.active)", { timeout: 15000 });
  await page.waitForSelector(".darkMask:not(.active)", { timeout: 15000 });
  await page.waitForTimeout(300);
}

async function captureMobileExtraPages(page: Page, screenshotsDir: string, routerUrl: string, prefix = "mobile_"): Promise<void> {
  for (const pageConfig of MOBILE_LIGHT_EXTRA_PAGES) {
    const url = `${routerUrl}${pageConfig.urlPath}`;
    console.log(`  Navigating to mobile ${pageConfig.name}...`);
    await page.goto(url, { waitUntil: "load", timeout: 30000 });
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(".main, #mainmenu", { timeout: 15000 });
    await page.waitForTimeout(2500);

    const screenshotPath = path.join(screenshotsDir, `${prefix}${pageConfig.name}.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`  Saved: ${prefix}${pageConfig.name}.png`);
  }
}

async function main() {
  // Determine router URL
  let routerUrl = process.env.ROUTER_URL || "";
  if (!routerUrl && process.env.SSH_HOST) {
    routerUrl = `http://${process.env.SSH_HOST}`;
  }

  if (!routerUrl) {
    console.error("Error: ROUTER_URL or SSH_HOST must be specified in the .env file.");
    process.exit(1);
  }

  if (!routerUrl.startsWith("http://") && !routerUrl.startsWith("https://")) {
    routerUrl = `http://${routerUrl}`;
  }

  const username = process.env.ROUTER_USERNAME || process.env.SSH_USERNAME || "root";
  const password = process.env.ROUTER_PASSWORD || process.env.SSH_PASSWORD || "";

  if (!password) {
    console.error("Error: ROUTER_PASSWORD or SSH_PASSWORD must be specified in the .env file.");
    process.exit(1);
  }

  console.log(`Configured Router URL: ${routerUrl}`);
  console.log(`Username: ${username}`);

  // Ensure screenshots directory exists
  const screenshotsOutput = langConfig.isChinese ? path.resolve(process.cwd(), "screenshots", langConfig.code) : path.resolve(process.cwd(), "screenshots");
  const screenshotsDir = path.resolve(screenshotsOutput, ".cache");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
    console.log(`Created screenshots directory: ${screenshotsDir}`);
  }

  console.log("Launching browser...");
  const browser = await chromium.launch({
    headless: false,
  });

  let totalErrors = 0;

  try {
    for (const variant of VARIANTS) {
      try {
        await captureVariant(browser, screenshotsDir, routerUrl, username, password, variant);
      } catch (error) {
        console.error(`\n✗ ${variant.label} failed:`, error);
        totalErrors++;
        // Continue with next variant
      }
    }

    if (totalErrors === 0) {
      console.log("\n✓ All screenshots captured successfully!");
    } else {
      console.log(`\n⚠ ${totalErrors}/${VARIANTS.length} variant(s) failed.`);
    }
  } finally {
    await browser.close();
    console.log("Browser closed.");
  }
}

main();
