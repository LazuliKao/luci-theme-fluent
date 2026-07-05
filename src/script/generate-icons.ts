import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";

// Use relative paths from the repository root
const svgPath = "./package/luci-theme-fluent/htdocs/luci-static/fluent/img/fluent.svg";
const iconDir = "./package/luci-theme-fluent/htdocs/luci-static/fluent/icon";
const themeDir = "./package/luci-theme-fluent/htdocs/luci-static/fluent";

interface Target {
  file: string;
  size: number;
}

const targets: Target[] = [
  { file: "icon-192.png", size: 192 },
  { file: "favicon-32.png", size: 32 }
];

const keepFiles = new Set<string>([
  "manifest.json",
  "favicon.ico",
  "icon-192.png",
  "favicon-32.png"
]);

async function generate(): Promise<void> {
  // Check if source SVG exists
  if (!fs.existsSync(svgPath)) {
    console.error(`Source SVG not found at: ${svgPath}`);
    process.exit(1);
  }

  const svgBuffer = fs.readFileSync(svgPath);

  // Ensure icon directory exists
  if (!fs.existsSync(iconDir)) {
    fs.mkdirSync(iconDir, { recursive: true });
  }

  // Generate optimized PNGs
  for (const target of targets) {
    const dest = path.join(iconDir, target.file);
    console.log(`Generating ${target.file} (${target.size}x${target.size})...`);
    await sharp(svgBuffer)
      .resize(target.size, target.size)
      .png({
        palette: true,
        compressionLevel: 9,
        quality: 85,
        effort: 10
      })
      .toFile(dest);
  }

  // Generate favicon.ico at themeDir root (32x32 compressed PNG)
  console.log("Generating favicon.ico in root...");
  await sharp(svgBuffer)
    .resize(32, 32)
    .png({
      palette: true,
      compressionLevel: 9,
      quality: 85,
      effort: 10
    })
    .toFile(path.join(themeDir, "favicon.ico"));

  // Generate favicon.ico inside icon directory
  console.log("Generating favicon.ico in icon directory...");
  await sharp(svgBuffer)
    .resize(32, 32)
    .png({
      palette: true,
      compressionLevel: 9,
      quality: 85,
      effort: 10
    })
    .toFile(path.join(iconDir, "favicon.ico"));

  // Clean up all other files in the icon directory
  const files = fs.readdirSync(iconDir);
  for (const file of files) {
    if (!keepFiles.has(file)) {
      console.log(`Deleting file: ${file}`);
      fs.unlinkSync(path.join(iconDir, file));
    }
  }

  console.log("All icons generated, minimized, and optimized successfully!");
}

generate().catch((err: unknown) => {
  console.error("Error generating icons:", err);
  process.exit(1);
});
