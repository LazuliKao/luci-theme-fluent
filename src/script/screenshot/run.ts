import { execSync } from "child_process";

const args = process.argv.slice(2);
const env = { ...process.env };

// Extract language argument
const langArgIndex = args.findIndex(arg => arg.startsWith("--lang=") || arg === "-l");
let lang = "";
if (langArgIndex !== -1) {
  if (args[langArgIndex].startsWith("--lang=")) {
    lang = args[langArgIndex].split("=")[1].trim();
  } else if (langArgIndex + 1 < args.length) {
    lang = args[langArgIndex + 1].trim();
  }
}

if (lang) {
  env.SCREENSHOT_LANG = lang;
}

console.log(`[Runner] Starting screenshot workflow with language environment: ${env.SCREENSHOT_LANG || "default (en-US)"}`);

try {
  const argsStr = args.length > 0 ? " " + args.map(a => `"${a}"`).join(" ") : "";
  console.log(`[Runner] Running: tsx src/script/screenshot/screenshot.ts${argsStr}`);
  execSync(`tsx src/script/screenshot/screenshot.ts${argsStr}`, { stdio: "inherit", env });
  
  console.log(`[Runner] Running: tsx src/script/screenshot/generate-showcase.ts${argsStr}`);
  execSync(`tsx src/script/screenshot/generate-showcase.ts${argsStr}`, { stdio: "inherit", env });
  
  console.log("[Runner] Workflow finished successfully.");
} catch (error) {
  console.error("[Runner] Execution failed:", error);
  process.exit(1);
}
