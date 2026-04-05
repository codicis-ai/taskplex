#!/usr/bin/env node
/**
 * Sentinel Hook (PostToolUse: Read|Bash|Grep|Glob|Agent|WebFetch|WebSearch)
 *
 * Ultra-lightweight companion to heartbeat. Fires on non-Edit/Write tools.
 * Only does:
 *   - F6: Increment toolCallCount + track by tool type in toolCallsByType
 *   - F6: Threshold check → write warning to progress.md
 *
 * Does NOT: track files, promote phases, update session files, emit traces.
 * Async: runs in background, never blocks tool execution.
 */

import { pathToFileURL, fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const { parseStdin, normalizeCwd, findCurrentSession, findProjectRoot } =
  await import(pathToFileURL(join(__dirname, 'hook-utils.mjs')).href);

import fs from 'fs';
import path from 'path';

async function main() {
  try {
    const hookInput = await parseStdin();
    const cwd = normalizeCwd(hookInput);

    const sessionResult = findCurrentSession(cwd);
    if (!sessionResult) process.exit(0);

    const { session } = sessionResult;

    const projectRoot = findProjectRoot(cwd) || cwd;
    const taskDir = path.join(projectRoot, '.claude-task');
    if (!fs.existsSync(taskDir)) process.exit(0);

    const taskPath = path.join(taskDir, session.taskId);
    const manifestPath = path.join(taskPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) process.exit(0);

    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch { process.exit(0); }

    if (manifest.status === 'completed' || manifest.status === 'cancelled') {
      process.exit(0);
    }

    // === F6: Increment tool call counter ===
    if (typeof manifest.toolCallCount !== 'number') manifest.toolCallCount = 0;
    manifest.toolCallCount++;

    const toolName = hookInput.tool_name || 'unknown';
    if (!manifest.toolCallsByType) manifest.toolCallsByType = {};
    manifest.toolCallsByType[toolName] = (manifest.toolCallsByType[toolName] || 0) + 1;

    manifest.lastUpdated = new Date().toISOString();

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    // === F6: Threshold check ===
    const estimatedTokens = weightedTokenEstimate(manifest);
    if (estimatedTokens > 130000) {
      writeCompactionWarning(taskPath, manifest, estimatedTokens);
    }
  } catch (error) {
    if (process.env.TF_DEBUG) console.error(`[start-task-sentinel] ${error.message}`);
  }

  process.exit(0);
}

function weightedTokenEstimate(manifest) {
  const t = manifest.toolCallsByType || {};
  return 30000
    + ((t['Edit'] || 0) + (t['Write'] || 0)) * 4000
    + (t['Read'] || 0) * 3500
    + (t['Bash'] || 0) * 2500
    + ((t['Grep'] || 0) + (t['Glob'] || 0)) * 1500
    + (t['Agent'] || 0) * 5000
    + ((t['WebFetch'] || 0) + (t['WebSearch'] || 0)) * 2000;
}

function writeCompactionWarning(taskPath, manifest, estimatedTokens) {
  try {
    const progressPath = path.join(taskPath, 'progress.md');
    if (!fs.existsSync(progressPath)) return;

    let content = fs.readFileSync(progressPath, 'utf8');
    const estimatedK = Math.round(estimatedTokens / 1000);
    const warning = [
      '',
      '### Compaction Guard',
      `Warning: Estimated context ~${estimatedK}k tokens (${manifest.toolCallCount} tool calls).`,
      'Context approaching compaction threshold (130k/200k).',
      'Ensure progress.md and manifest.json are current before compaction fires.',
    ].join('\n');

    content = content.replace(/\n### Compaction Guard\n[\s\S]*?(?=\n### |\n## |$)/, '');
    content = content.trimEnd() + '\n' + warning + '\n';
    fs.writeFileSync(progressPath, content);
  } catch {
    // Non-fatal
  }
}

main();
