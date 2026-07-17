#!/usr/bin/env node

// Fetches the owner's taste context from the hosted Taste Engine and writes it
// as TASTE.md (or stdout), so any project worked on with Claude Code / Codex
// can reference the owner's accumulated taste and knowledge.
//
// Usage (from any project directory):
//   node /path/to/taste-engine/scripts/taste-context.mjs            # → ./TASTE.md
//   node /path/to/taste-engine/scripts/taste-context.mjs --stdout   # print instead
//   node /path/to/taste-engine/scripts/taste-context.mjs --out docs/TASTE.md
//
// Reads the same config file as the weekly runner:
//   ~/.config/taste-engine/weekly.json  → { "baseUrl": "...", "secret": "..." }
// (overridable with TASTE_ENGINE_WEEKLY_CONFIG)

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const configPath = process.env.TASTE_ENGINE_WEEKLY_CONFIG
  ?? join(process.env.HOME ?? process.cwd(), ".config", "taste-engine", "weekly.json");

function fail(message) {
  console.error(`taste-context: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { out: "TASTE.md", stdout: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--stdout") args.stdout = true;
    else if (argv[i] === "--out") args.out = argv[++i] ?? fail("--out にはパスが必要です。");
    else fail(`不明な引数です: ${argv[i]}`);
  }
  return args;
}

async function loadConfig() {
  let value;
  try {
    value = JSON.parse(await readFile(configPath, "utf8"));
  } catch {
    fail(`設定ファイルを読めません: ${configPath}(baseUrl と secret を含むJSONを置いてください)`);
  }
  if (typeof value?.baseUrl !== "string" || typeof value?.secret !== "string") {
    fail("設定ファイルには baseUrl と secret が必要です。");
  }
  return { baseUrl: value.baseUrl.replace(/\/$/, ""), secret: value.secret };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = await loadConfig();
  const response = await fetch(`${config.baseUrl}/api/agent/context`, {
    headers: { authorization: `Bearer ${config.secret}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    fail(`取得に失敗しました (${response.status}): ${body.slice(0, 300)}`);
  }
  const markdown = await response.text();

  if (args.stdout) {
    process.stdout.write(markdown);
    return;
  }
  const outPath = resolve(process.cwd(), args.out);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, markdown, "utf8");
  console.log(`taste-context: ${outPath} を更新しました。`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
