#!/usr/bin/env node
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "updates.json");
const MAX_ENTRIES = 12;

function run(command) {
	return execSync(command, { cwd: ROOT, encoding: "utf8" });
}

function detectAi(message, files) {
	const msg = String(message || "").toLowerCase();
	const normalizedFiles = (files || []).map((f) => f.toLowerCase());

	if (msg.includes("codex") || normalizedFiles.some((f) => f.includes("codex"))) return "codex";
	if (msg.includes("claude") || normalizedFiles.some((f) => f.startsWith("claude/"))) return "claude";
	if (msg.includes("chatgpt") || msg.includes("gpt")) return "gpt";
	return "gpt";
}

function toDisplayMessage(message) {
	const trimmed = String(message || "").trim();
	if (!trimmed) return "(no message)";
	return trimmed.replace(/^merge\s.+$/i, "Merge updates");
}

function buildEntries() {
	const log = run("git log --date=short --pretty=format:%H%x09%ad%x09%s --name-only --max-count=60");
	const lines = log.split(/\r?\n/);
	const entries = [];
	let current = null;

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line) continue;

		if (line.includes("\t")) {
			if (current) entries.push(current);
			const [hash, date, subject] = line.split("\t");
			current = { hash, date, subject, files: [] };
			continue;
		}

		if (current) current.files.push(line);
	}
	if (current) entries.push(current);

	const result = [];
	for (const item of entries) {
		if (result.length >= MAX_ENTRIES) break;
		result.push({
			date: item.date,
			ai: detectAi(item.subject, item.files),
			text: toDisplayMessage(item.subject),
			commit: item.hash.slice(0, 7),
		});
	}
	return result;
}

function main() {
	const entries = buildEntries();
	fs.writeFileSync(OUTPUT, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
	process.stdout.write(`updated ${path.basename(OUTPUT)} (${entries.length} entries)\n`);
}

main();
