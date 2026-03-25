#!/usr/bin/env node
/**
 * TaskPlex Pre-Commit Hook (PreToolUse: Bash)
 *
 * Fires on bash tool use. Blocks git commits if validation has not passed.
 */

import { pathToFileURL, fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const {
  parseStdin, normalizeCwd, findSessionTask,
  isValidationPassed, allowTool, denyTool
} = await import(pathToFileURL(join(__dirname, 'hook-utils.mjs')).href);

async function main() {
  try {
    const hookInput = await parseStdin();
    const command = hookInput.tool_input?.command || '';

    // Only intercept git commit commands
    if (!/git\s+commit/.test(command)) {
      allowTool();
      return;
    }

    const cwd = normalizeCwd(hookInput);
    const task = findSessionTask(cwd);
    if (!task) {
      allowTool();
      return;
    }

    const { manifest, taskPath } = task;
    const profile = manifest.qualityProfile || 'standard';

    if (profile === 'lean') {
      allowTool();
      return;
    }

    const validation = isValidationPassed(taskPath);
    if (!validation.passed) {
      const missing = validation.missing?.length
        ? `Missing: ${validation.missing.join(', ')}.`
        : 'validation-gate.json not found or not passed.';
      denyTool(
        `TaskPlex pre-commit: Commit blocked — validation has not passed.\n` +
        `${missing}\n` +
        `Complete the validation phase before committing.\n` +
        `Phase file: ~/.claude/taskplex/phases/validation.md`
      );
      return;
    }

    allowTool();
  } catch (error) {
    if (process.env.TF_DEBUG) console.error(`[tp-pre-commit] ${error.message}`);
    allowTool();
  }
}

main();
