import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

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
      isChinese: true,
    };
  }
  return {
    code: "en-US",
    isChinese: false,
  };
}

const langConfig = parseLanguage(getLanguage());
const screenshotsOutput = langConfig.isChinese ? path.resolve(process.cwd(), "screenshots", langConfig.code) : path.resolve(process.cwd(), "screenshots");
const screenshotsDir = path.resolve(screenshotsOutput, ".cache");

const TRANSLATIONS: Record<string, Record<string, string>> = {
  "zh-Hans": {
    'lang="en-US"': 'lang="zh-Hans"',
    "<title>luci-theme-fluent Showcase</title>": "<title>luci-theme-fluent 效果图</title>",
    "<h1>Fluent Theme for OpenWrt</h1>": "<h1>OpenWrt FluentUI 主题</h1>",
    "<p>An elegant, responsive Fluent-style theme for modern OpenWrt LuCI</p>": "<p>专为现代 OpenWrt LuCI 设计的优雅、响应式 Fluent 风格主题</p>",
    "Multi-device": "多设备适配",
    "Fully responsive design for desktop, tablet, and mobile interactions": "完美适配桌面、平板和移动设备，提供极致的响应式交互体验",
    "Dark Mode": "深色模式",
    "Supports automatic and manual switching with high-contrast visuals": "支持自动与手动切换，具备高对比度视觉表现",
    "Smooth Motion": "流畅动画",
    "View Transitions-based loading and navigation": "基于 View Transitions 的原生级流畅加载与页面切换",
    'alt="Desktop Overview"': 'alt="桌面端概览"',
    'alt="Tablet Overview"': 'alt="平板端概览"',
    'alt="Mobile Overview"': 'alt="移动端概览"',
    "<title>luci-theme-fluent Mobile Showcase</title>": "<title>luci-theme-fluent 移动端效果图</title>",
    "<h1>FluentUI Mobile Experience</h1>": "<h1>FluentUI 移动端体验</h1>",
    "<p>Optimized, responsive, and elegant mobile interface for OpenWrt LuCI</p>": "<p>专为 OpenWrt LuCI 优化的响应式、优雅的移动端界面</p>",
    "Intuitive Navigation": "直观导航",
    "Slide-out sidebar drawer designed for quick and easy mobile access": "专为快速便捷的移动端访问设计的侧边栏抽屉",
    "Responsive Layout": "响应式布局",
    "Adaptive controls and tables optimized for single-handed touch interactions": "针对单手触摸交互优化的自适应控件和表格",
    "Lightweight & Fast": "轻量且快速",
    "Hardware-accelerated animations and minimal overhead for mobile browsers": "硬件加速动画和极低的移动端浏览器开销",
    'alt="Mobile Sidebar Open"': 'alt="移动端侧边栏展开"',
    'alt="Mobile System Settings"': 'alt="移动端系统设置"',
    'alt="Mobile Software Management"': 'alt="移动端软件管理"',
  },
};
async function generateShowcaseBanner() {
  console.log("Generating showcase banner using Playwright...");

  // Verify that required screenshot files exist
  const requiredFiles = ["dark_overview.png", "tablet_dark_overview.png", "mobile_dark_overview.png"];
  for (const file of requiredFiles) {
    const filePath = path.join(screenshotsDir, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`Warning: Required screenshot ${file} not found at ${filePath}. Showcase banner might have broken image links.`);
    }
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setViewportSize({ width: 1920, height: 1080 });

  const htmlPath = path.resolve(process.cwd(), "src/script/screenshot/showcase.html");
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`HTML template file not found at ${htmlPath}`);
  }

  let htmlContent = fs.readFileSync(htmlPath, "utf-8");

  // Localize content if Chinese is selected
  if (langConfig.isChinese) {
    const dict = TRANSLATIONS[langConfig.code];
    if (dict) {
      for (const [key, value] of Object.entries(dict)) {
        htmlContent = htmlContent.replaceAll(key, value);
      }
    }
    // Update image paths from default cache to the language-specific cache
    htmlContent = htmlContent.replaceAll("../../../screenshots/.cache/", `../../../screenshots/${langConfig.code}/.cache/`);
  }

  // Write localized content to temporary file
  const tempHtmlPath = path.resolve(process.cwd(), "src/script/screenshot/showcase_temp.html");
  fs.writeFileSync(tempHtmlPath, htmlContent, "utf-8");

  try {
    console.log(`Loading temp HTML: file://${tempHtmlPath}`);
    await page.goto(`file://${tempHtmlPath}`, { waitUntil: "networkidle" });

    // Wait a bit to ensure image rendering and layout settles
    await page.waitForTimeout(1500);

    const outputPath = path.join(screenshotsOutput, "showcase_banner.png");
    await page.screenshot({ path: outputPath, type: "png" });
    console.log(`✓ Showcase banner generated successfully at: ${outputPath}`);
  } finally {
    if (fs.existsSync(tempHtmlPath)) {
      fs.unlinkSync(tempHtmlPath);
    }
    await browser.close();
  }
}
async function generateMobilePromo() {
  console.log("Generating mobile promo banner using Playwright...");

  // Verify that required screenshot files exist
  const requiredFiles = ["mobile_sidebar_open.png", "mobile_system_settings.png", "mobile_software_management.png"];
  for (const file of requiredFiles) {
    const filePath = path.join(screenshotsDir, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`Warning: Required screenshot ${file} not found at ${filePath}. Mobile promo banner might have broken image links.`);
    }
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Set 1080P viewport size
  await page.setViewportSize({ width: 1600, height: 1080 });

  const htmlPath = path.resolve(process.cwd(), "src/script/screenshot/showcase-mobile.html");
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`HTML template file not found at ${htmlPath}`);
  }

  let htmlContent = fs.readFileSync(htmlPath, "utf-8");

  // Localize content if Chinese is selected
  if (langConfig.isChinese) {
    const dict = TRANSLATIONS[langConfig.code];
    if (dict) {
      for (const [key, value] of Object.entries(dict)) {
        htmlContent = htmlContent.replaceAll(key, value);
      }
    }
    // Update image paths from default cache to the language-specific cache
    htmlContent = htmlContent.replaceAll("../../../screenshots/.cache/", `../../../screenshots/${langConfig.code}/.cache/`);
  }

  // Write localized content to temporary file
  const tempHtmlPath = path.resolve(process.cwd(), "src/script/screenshot/showcase_mobile_temp.html");
  fs.writeFileSync(tempHtmlPath, htmlContent, "utf-8");

  try {
    console.log(`Loading temp HTML: file://${tempHtmlPath}`);
    await page.goto(`file://${tempHtmlPath}`, { waitUntil: "networkidle" });

    // Wait a bit to ensure image rendering and layout settles
    await page.waitForTimeout(1500);

    const outputPath = path.join(screenshotsOutput, "showcase_mobile_promo.png");
    await page.screenshot({ path: outputPath, type: "png" });
    console.log(`✓ Mobile promo banner generated successfully at: ${outputPath}`);
  } finally {
    if (fs.existsSync(tempHtmlPath)) {
      fs.unlinkSync(tempHtmlPath);
    }
    await browser.close();
  }
}

/**
 * Generic helper to generate a split-screen (slider) comparison image from Light and Dark mode screenshots.
 */
async function createSplitComparison(lightName: string, darkName: string, outputName: string, label: string, isChinese: boolean) {
  console.log(`Generating 45-degree split comparison for ${label}...`);

  const lightPath = path.join(screenshotsDir, lightName);
  const darkPath = path.join(screenshotsDir, darkName);
  const outPath = path.join(screenshotsOutput, outputName);

  if (!fs.existsSync(lightPath) || !fs.existsSync(darkPath)) {
    console.warn(`Warning: Missing ${lightName} or ${darkName}. Skipping split comparison for ${label}.`);
    return;
  }

  try {
    const lightMeta = await sharp(lightPath).metadata();
    const width = lightMeta.width || 1280;
    const height = lightMeta.height || 720;

    // Calculate a true 45-degree line passing through the center of the image.
    // At 45 degrees, dx = dy.
    // To rotate 90 degrees, we slope from top-right (centerX + centerY) to bottom-left (centerX - centerY).
    const centerX = width / 2;
    const centerY = height / 2;
    const topX = Math.round(centerX + centerY);
    const bottomX = Math.round(centerX - centerY);

    // 1. Create a 45-degree angle mask (left half) for the Light mode image
    const maskSvg = `<svg width="${width}" height="${height}">
      <polygon points="0,0 ${topX},0 ${bottomX},${height} 0,${height}" fill="white" />
    </svg>`;

    const maskedLight = await sharp(lightPath)
      .ensureAlpha()
      .composite([{ input: Buffer.from(maskSvg), blend: "dest-in" }])
      .png()
      .toBuffer();

    const lightLabel = isChinese ? "浅色模式" : "Light Mode";
    const darkLabel = isChinese ? "深色模式" : "Dark Mode";
    const fontFamily = "-apple-system, BlinkMacSystemFont, 'Microsoft YaHei', 'PingFang SC', 'Segoe UI', Roboto, sans-serif";

    // 2. Create modern premium labels overlay SVG (no dividing line)
    // Structured to match Microsoft Fluent 2 Design UI cards (rx=8, Fluent color tokens & Segoe UI typography)
    const overlaySvg = `<svg width="${width}" height="${height}">
      <defs>
        <filter id="fluent-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#000000" flood-opacity="0.18" />
        </filter>
      </defs>

      <!-- Light Mode Badge (Top-Left) -->
      <g transform="translate(80, 80)" filter="url(#fluent-shadow)">
        <!-- Card Container -->
        <rect width="176" height="56" rx="9" fill="#ffffff" stroke="#e6e6e6" stroke-width="1" />
        <!-- Label Text -->
        <text x="88" y="28" dy="0.32em" font-family="${fontFamily}" font-size="17px" font-weight="650" fill="#242424" text-anchor="middle">${lightLabel}</text>
      </g>

      <!-- Dark Mode Badge (Bottom-Right) -->
      <g transform="translate(${width - 250}, ${height - 134})" filter="url(#fluent-shadow)">
        <!-- Card Container -->
        <rect width="176" height="56" rx="9" fill="#292929" stroke="#404040" stroke-width="1" />
        <!-- Label Text -->
        <text x="88" y="28" dy="0.32em" font-family="${fontFamily}" font-size="17px" font-weight="650" fill="#ffffff" text-anchor="middle">${darkLabel}</text>
      </g>
    </svg>`;

    // 3. Composite Dark Mode as background and the masked Light Mode + labels on top
    await sharp(darkPath)
      .composite([
        { input: maskedLight, left: 0, top: 0 },
        { input: Buffer.from(overlaySvg), left: 0, top: 0 },
      ])
      .png()
      .toFile(outPath);

    console.log(`✓ Split comparison image saved: ${outputName}`);
  } catch (err) {
    console.error(`Error generating split comparison for ${label}:`, err);
  }
}

async function createMultiDiagonalComparison(lightName: string, darkName: string, outputName: string, label: string, isChinese: boolean) {
  console.log(`Generating multi-diagonal comparison for ${label}...`);

  const lightPath = path.join(screenshotsDir, lightName);
  const darkPath = path.join(screenshotsDir, darkName);
  const outPath = path.join(screenshotsOutput, outputName);

  if (!fs.existsSync(lightPath) || !fs.existsSync(darkPath)) {
    console.warn(`Warning: Missing ${lightName} or ${darkName}. Skipping multi-diagonal comparison for ${label}.`);
    return;
  }

  try {
    const lightMeta = await sharp(lightPath).metadata();
    const width = lightMeta.width || 1280;
    const height = lightMeta.height || 720;
    const diagonalSpan = width + height;

    const buildBandPolygon = (start: number, end: number) => {
      const points: Array<{ x: number; y: number }> = [];
      const addPoint = (x: number, y: number) => {
        if (x < 0 || x > width || y < 0 || y > height) {
          return;
        }

        const exists = points.some((point) => Math.abs(point.x - x) < 0.5 && Math.abs(point.y - y) < 0.5);
        if (!exists) {
          points.push({ x, y });
        }
      };

      const corners = [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: height },
        { x: 0, y: height },
      ];

      for (const corner of corners) {
        const sum = corner.x + corner.y;
        if (sum >= start && sum <= end) {
          addPoint(corner.x, corner.y);
        }
      }

      for (const boundary of [start, end]) {
        addPoint(boundary, 0);
        addPoint(0, boundary);
        addPoint(boundary - height, height);
        addPoint(width, boundary - width);
      }

      const center = points.reduce((acc, point) => ({ x: acc.x + point.x / points.length, y: acc.y + point.y / points.length }), { x: 0, y: 0 });

      if (points.length < 3) {
        return "0,0 0,0 0,0";
      }

      const sorted = points.sort((a, b) => Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x));

      return sorted.map((point) => `${Math.round(point.x)},${Math.round(point.y)}`).join(" ");
    };

    const bandRatios = [0, 0.2, 0.42, 0.68, 1];
    const bandRanges = bandRatios.slice(0, -1).map((ratio, index) => ({
      start: diagonalSpan * ratio,
      end: diagonalSpan * bandRatios[index + 1],
    }));

    const buildMaskSvg = (indices: number[]) => {
      const polygons = indices.map((index) => `<polygon points="${buildBandPolygon(bandRanges[index].start, bandRanges[index].end)}" fill="white" />`).join("");

      return `<svg width="${width}" height="${height}">${polygons}</svg>`;
    };

    const lightMaskSvg = buildMaskSvg([0, 2]);
    const darkMaskSvg = buildMaskSvg([1, 3]);

    const lightLabel = isChinese ? "浅色模式" : "Light Mode";
    const darkLabel = isChinese ? "深色模式" : "Dark Mode";
    const fontFamily = "-apple-system, BlinkMacSystemFont, 'Microsoft YaHei', 'PingFang SC', 'Segoe UI', Roboto, sans-serif";

    const labelsSvg = `<svg width="${width}" height="${height}">
      <defs>
        <filter id="fluent-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#000000" flood-opacity="0.18" />
        </filter>
      </defs>

      <g transform="translate(56, 72)" filter="url(#fluent-shadow)">
        <rect width="176" height="56" rx="9" fill="#ffffff" stroke="#e6e6e6" stroke-width="1" />
        <text x="88" y="28" dy="0.32em" font-family="${fontFamily}" font-size="17px" font-weight="650" fill="#242424" text-anchor="middle">${lightLabel}</text>
      </g>

      <g transform="translate(${width - 228}, ${height - 126})" filter="url(#fluent-shadow)">
        <rect width="176" height="56" rx="9" fill="#292929" stroke="#404040" stroke-width="1" />
        <text x="88" y="28" dy="0.32em" font-family="${fontFamily}" font-size="17px" font-weight="650" fill="#ffffff" text-anchor="middle">${darkLabel}</text>
      </g>
    </svg>`;

    const maskedLight = await sharp(lightPath)
      .ensureAlpha()
      .composite([{ input: Buffer.from(lightMaskSvg), blend: "dest-in" }])
      .png()
      .toBuffer();

    const maskedDark = await sharp(darkPath)
      .ensureAlpha()
      .composite([{ input: Buffer.from(darkMaskSvg), blend: "dest-in" }])
      .png()
      .toBuffer();

    await sharp(darkPath)
      .composite([
        { input: maskedLight, left: 0, top: 0 },
        { input: maskedDark, left: 0, top: 0 },
        { input: Buffer.from(labelsSvg), left: 0, top: 0 },
      ])
      .png()
      .toFile(outPath);

    console.log(`✓ Multi-diagonal comparison image saved: ${outputName}`);
  } catch (err) {
    console.error(`Error generating multi-diagonal comparison for ${label}:`, err);
  }
}

async function main() {
  if (!fs.existsSync(screenshotsOutput)) {
    fs.mkdirSync(screenshotsOutput, { recursive: true });
  }
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  try {
    // 1. Generate showcase banner with Playwright
    await generateShowcaseBanner();

    // 2. Generate mobile promo banner with Playwright
    await generateMobilePromo();

    // 2. Generate theme comparison for Login page (Scheme B)
    await createSplitComparison("login_password.png", "dark_login_password.png", "login_theme_comparison.png", "Login Page", langConfig.isChinese);

    await createMultiDiagonalComparison("overview.png", "dark_overview.png", "overview_theme_comparison.png", "Overview Dashboard", langConfig.isChinese);

    console.log("\n★ Processing and compilation of promotional images completed!");
  } catch (error) {
    console.error("Error processing screenshots:", error);
    process.exit(1);
  }
}

main();
