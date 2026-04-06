#!/usr/bin/env node
/**
 * TaskPlex Pre-Commit Hook (PreToolUse: Bash)
 *
 * Fires on bash tool use. Blocks git commits if:
 * 1. validation-gate.json not passed (existing check)
 * 2. Required review artifacts missing for the quality profile (new — artifact-based)
 */

import { pathToFileURL, fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const {
  parseStdin, normalizeCwd, findSessionTask,
  isValidationPassed, allowTool, denyTool
} = await import(pathToFileURL(join(__dirname, 'hook-utils.mjs')).href);

import fs from 'fs';
import path from 'path';

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

    // Allow commits that only touch task artifacts (.claude-task/, product/, progress files)
    // These are state-saving commits, not source code commits
    const isStateOnly = /git\s+add\s+\.claude-task|git\s+add\s+product\/|git\s+commit.*chore.*[Tt]ask[Pp]lex\s*state|git\s+commit.*WIP.*state|git\s+stash/.test(command);
    if (isStateOnly) {
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
        `Run the validation pipeline to produce review artifacts.\n\n` +
        `To save task state without triggering this gate, commit only .claude-task/ files:\n` +
        `git add .claude-task/ && git commit -m "chore: TaskPlex state checkpoint"`
      );
      return;
    }

    // === Review artifact gate (ARTIFACT-BASED — do not trust manifest flags) ===
    // The agent can write validation-gate.json without actually spawning review agents.
    // This check verifies the ACTUAL review files exist — they can only be produced by
    // running the review agents, not by inline grep checks.
    const reviewsDir = path.join(taskPath, 'reviews');
    const hardeningDir = path.join(taskPath, 'hardening');

    const requiredByProfile = {
      lean: [],
      standard: [
        { file: 'security.md', dir: reviewsDir, label: 'security review' },
        { file: 'closure.md', dir: reviewsDir, label: 'closure verification' },
        { file: 'code-quality.md', dir: reviewsDir, label: 'code review' },
      ],
      enterprise: [
        { file: 'security.md', dir: reviewsDir, label: 'security review' },
        { file: 'closure.md', dir: reviewsDir, label: 'closure verification' },
        { file: 'code-quality.md', dir: reviewsDir, label: 'code review' },
        { file: 'report.md', dir: hardeningDir, label: 'hardening review' },
        { file: 'compliance.md', dir: reviewsDir, label: 'compliance audit' },
      ],
    };

    const required = requiredByProfile[profile] || requiredByProfile.standard;
    if (required.length > 0) {
      const missingArtifacts = required.filter(r => {
        const filePath = path.join(r.dir, r.file);
        return !fs.existsSync(filePath);
      });

      if (missingArtifacts.length > 0) {
        const missingList = missingArtifacts.map(r => `${r.label} (${r.file})`).join(', ');
        denyTool(
          `TaskPlex pre-commit: Commit blocked — review artifacts missing.\n` +
          `Profile: ${profile}. Missing: ${missingList}.\n\n` +
          `These files are produced by spawning the actual review agents.\n` +
          `Inline grep checks do NOT produce these artifacts.\n` +
          `Run the full validation pipeline with agent spawns.\n\n` +
          `To save task state without triggering this gate, commit only .claude-task/ files:\n` +
          `git add .claude-task/ && git commit -m "chore: TaskPlex state checkpoint"`
        );
        return;
      }
    }

    // === Conditional reviewer artifact gate (file-pattern-triggered) ===
    // If certain file types were modified, the corresponding reviewer MUST have run.
    // Same principle: the orchestrator can't be trusted to spawn conditional reviewers.
    // The hook checks modified files and requires the matching review artifact.
    if (profile !== 'lean') {
      const modifiedFiles = (manifest.modifiedFiles || []).map(f => f.replace(/\\/g, '/'));
      const conditionalMissing = [];

      // Database reviewer — required when SQL/migration/schema files modified
      const hasDBFiles = modifiedFiles.some(f =>
        /\.sql$/i.test(f) || /migrations?\//i.test(f) || /schema\//i.test(f)
      );
      if (hasDBFiles && !fs.existsSync(path.join(reviewsDir, 'database.md'))) {
        conditionalMissing.push('database review (reviews/database.md) — SQL/migration files modified');
      }

      // E2E reviewer — required when UI component/page files modified
      const hasUIFiles = modifiedFiles.some(f =>
        /\.(tsx|jsx|vue|svelte)$/i.test(f) ||
        /\/(pages|components|app|views|screens)\//i.test(f)
      );
      if (hasUIFiles && !fs.existsSync(path.join(reviewsDir, 'e2e.md'))) {
        conditionalMissing.push('e2e review (reviews/e2e.md) — UI files modified');
      }

      // User workflow reviewer — required when routing/navigation files modified
      const hasRoutingFiles = modifiedFiles.some(f =>
        /\/(routes|router|navigation)\//i.test(f) || /router\.(ts|js|tsx|jsx)$/i.test(f)
      );
      if (hasRoutingFiles && !fs.existsSync(path.join(reviewsDir, 'user-workflow.md'))) {
        conditionalMissing.push('user workflow review (reviews/user-workflow.md) — routing files modified');
      }

      if (conditionalMissing.length > 0) {
        denyTool(
          `TaskPlex pre-commit: Commit blocked — conditional review artifacts missing.\n` +
          `Modified files triggered these reviewers but their artifacts are missing:\n` +
          `- ${conditionalMissing.join('\n- ')}\n\n` +
          `Spawn the corresponding review agents in the validation pipeline.\n\n` +
          `To save task state without triggering this gate, commit only .claude-task/ files:\n` +
          `git add .claude-task/ && git commit -m "chore: TaskPlex state checkpoint"`
        );
        return;
      }
    }

    allowTool();
  } catch (error) {
    if (process.env.TF_DEBUG) console.error(`[tp-pre-commit] ${error.message}`);
    allowTool();
  }
}

main();
