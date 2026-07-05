#!/usr/bin/env tsx
/**
 * Discover and/or generate translatable strings from ucode templates.
 *
 * The `luci-types i18n` CLI uses TypeScript AST and cannot parse .ut files.
 * This script serves as the bridge: it scans .ut templates for `_('...')`
 * calls, filters out standard LuCI core strings, and generates a JS file
 * that `luci-types i18n` CAN parse via its standard -i input.
 *
 * Usage:
 *   tsx src/script/extract-ucode.ts           # print custom strings only
 *   tsx src/script/extract-ucode.ts --all     # print ALL translatable strings
 *   tsx src/script/extract-ucode.ts --generate  # regenerate extra-strings.js
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { globSync } from "node:fs";
import { dirname } from "node:path";

const UCODE_GLOB = "package/luci-theme-fluent/ucode/template/themes/fluent/*.ut";
const EXTRA_STRINGS_PATH = "src/script/.cache/extra-strings.js";
const EXTRACT_RE = /\{\{\s*_\(['"]([^'"]+)['"]\)\s*\}\}/g;

// URL for LuCI base POT file — source of standard translatable strings.
const STANDARD_POT_URL =
	"https://raw.githubusercontent.com/openwrt/luci/master/modules/luci-base/po/templates/base.pot";
const STANDARD_POT_CACHE = "src/script/.cache/base.pot";

/** Parse a PO/POT string into a Set of msgid strings. */
function parsePoMsgids(source: string): Set<string> {
	const msgids = new Set<string>();
	const lines = source.split(/\r?\n/);
	let currentKey: "msgid" | "msgstr" | undefined;
	let msgid: string | undefined;

	const flush = (): void => {
		if (msgid !== undefined && msgid !== "") {
			msgids.add(msgid);
		}
		currentKey = undefined;
		msgid = undefined;
	};

	for (const line of lines) {
		if (line.startsWith("msgid ")) {
			flush();
			currentKey = "msgid";
			msgid = JSON.parse(line.slice("msgid ".length)) as string;
			continue;
		}
		if (line.startsWith("msgstr ")) {
			currentKey = "msgstr";
			continue;
		}
		if (line.startsWith('"') && currentKey === "msgid" && msgid !== undefined) {
			msgid += JSON.parse(line) as string;
		}
	}
	flush();
	return msgids;
}

/** Download (or load from cache) the LuCI base.pot and return its msgid set. */
async function fetchStandardStrings(): Promise<Set<string>> {
	// Try reading from cache first.
	try {
		const cached = readFileSync(STANDARD_POT_CACHE, "utf-8");
		return parsePoMsgids(cached);
	} catch {
		// Cache miss — will download.
	}

	const response = await fetch(STANDARD_POT_URL);
	if (!response.ok) {
		throw new Error(
			`Failed to download base.pot: ${response.status} ${response.statusText}`,
		);
	}
	const content = await response.text();

	// Persist to cache for offline use.
	try {
		mkdirSync(dirname(STANDARD_POT_CACHE), { recursive: true });
		writeFileSync(STANDARD_POT_CACHE, content, "utf-8");
	} catch {
		// Non-fatal cache write failure.
	}

	return parsePoMsgids(content);
}

/** Extract all unique translatable strings from ucode templates. */
function extractAll(): string[] {
	const ucodeFiles = globSync(UCODE_GLOB);
	const seen = new Set<string>();

	for (const file of ucodeFiles) {
		const content = readFileSync(file, "utf-8");
		EXTRACT_RE.lastIndex = 0;
		let match: RegExpExecArray | null;
		// biome-ignore lint/suspicious/noAssignInExpressions: common pattern for regex extraction loops
		while ((match = EXTRACT_RE.exec(content)) !== null) {
			seen.add(match[1]);
		}
	}

	return [...seen];
}

/** Filter to custom (non-LuCI-core) strings. */
function customStrings(strings: string[], standard: Set<string>): string[] {
	// Note: this intentionally keeps sorting stable for deterministic output.
	return strings.filter((s) => !standard.has(s)).sort();
}

function printAll(
	strings: string[],
	showAll: boolean,
	standard: Set<string>,
): void {
	const ucodeFiles = globSync(UCODE_GLOB);
	const fileContent = new Map<string, string>();
	for (const f of ucodeFiles) {
		fileContent.set(f, readFileSync(f, "utf-8"));
	}

	const seen = new Set<string>();
	for (const file of ucodeFiles) {
		const content = fileContent.get(file)!;
		EXTRACT_RE.lastIndex = 0;
		let match: RegExpExecArray | null;
		// biome-ignore lint/suspicious/noAssignInExpressions: common pattern for regex extraction loops
		while ((match = EXTRACT_RE.exec(content)) !== null) {
			const msgid = match[1];
			if (seen.has(msgid)) continue;
			seen.add(msgid);

			if (showAll || !standard.has(msgid)) {
				const tag = standard.has(msgid) ? " (standard)" : " (custom)";
				console.log(`# ${file}${tag}`);
				console.log(`msgid "${msgid}"`);
				console.log('msgstr ""');
				console.log();
			}
		}
	}

	if (seen.size === 0) {
		console.log("No translatable strings found in ucode templates.");
		return;
	}

	const customCount = [...seen].filter((s) => !standard.has(s)).length;
	console.log(`---`);
	console.log(`Found ${seen.size} unique string(s) in ucode templates.`);
	console.log(`  Custom:   ${customCount}`);
	console.log(`  Standard: ${seen.size - customCount}`);

	if (customCount === 0) {
		console.log("(No extra-strings.js needed; run with --generate to update)");
	}
}

function generate(standard: Set<string>): void {
	const all = extractAll();
	const custom = customStrings(all, standard);

	const lines: string[] = [
		"// Auto-generated by src/script/extract-ucode.ts -- do not edit manually.",
		"// Regenerate with: pnpm run i18n:extract-ucode -- --generate",
		"//",
		"// These are custom translatable strings found in ucode templates (.ut)",
		"// that the TypeScript AST parser cannot reach directly. They are injected",
		"// into the extraction pipeline as an additional -i input.",
		"",
	];

	if (custom.length === 0) {
		lines.push("// No custom ucode strings found.");
	} else {
		lines.push("// Custom ucode-only strings (not in LuCI core):");
		for (const msgid of custom) {
			lines.push(`_(${JSON.stringify(msgid)});`);
		}
	}

	lines.push("");

	writeFileSync(EXTRA_STRINGS_PATH, lines.join("\n"), "utf-8");
	console.log(`Generated ${EXTRA_STRINGS_PATH} (${custom.length} custom string(s)).`);
}

async function main(): Promise<void> {
	const standard = await fetchStandardStrings();
	const args = process.argv.slice(2);

	if (args.includes("--generate")) {
		generate(standard);
		return;
	}

	const showAll = args.includes("--all");
	const all = extractAll();
	printAll(all, showAll, standard);
}

await main();
