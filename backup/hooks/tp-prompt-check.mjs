#!/usr/bin/env node
/**
 * TaskPlex Prompt Check (UserPromptSubmit)
 *
 * Fires on every user prompt. Responsibilities:
 *   - Detect /tp or /taskplex invocation
 *   - Inject a reminder to follow the phase dispatch protocol
 *   - Detect active taskplex tasks and remind about state
 */

import { pathToFileURL, fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const {
  parseStdin, normalizeCwd, findSessionTask
} = await import(pathToFileURL(join(__dirname, 'hook-utils.mjs')).href);

async function main() {
  try {
    const hookInput = await parseStdin();
    const userPrompt = hookInput.user_prompt || hookInput.prompt || '';
    const cwd = normalizeCwd(hookInput);

    const isTpInvocation = /^\s*\/t(p|askplex)\b/i.test(userPrompt);

    if (isTpInvocation) {
      const task = findSessionTask(cwd);

      if (task && task.manifest.status === 'in-progress') {
        const m = task.manifest;
        console.log(JSON.stringify({
          additionalContext: [
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            '⚠️  ACTIVE TASKPLEX TASK DETECTED',
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            '',
            `Task: ${m.description || m.taskId}`,
            `Phase: ${m.phase} | Design: ${m.designPhase || 'N/A'}`,
            `Status: ${m.status}`,
            `Path: .claude-task/${task.folder}/manifest.json`,
            '',
            'An active task exists. Options:',
            '1. Resume this task (read manifest and continue)',
            '2. Complete/cancel this task before starting a new one',
            '3. Start a new task anyway (the old one will be abandoned)',
            '',
            'Ask the user which they prefer.',
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          ].join('\n')
        }));
        return;
      }

      // No active task — inject the workflow reminder
      console.log(JSON.stringify({
        additionalContext: [
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '🔧 TASKPLEX WORKFLOW ACTIVATED',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '',
          'MANDATORY: Your FIRST action must be:',
          '',
          '  Read("~/.claude/taskplex/phases/init.md")',
          '',
          'Read it IN FULL, then follow Steps 0-5 in exact order.',
          '',
          'DO NOT:',
          '- Skip to coding (tp-design-gate hook WILL block your edits)',
          '- Batch all design questions into one message',
          '- Write brief.md before user interaction is complete',
          '- Guess what the workflow should be — READ THE FILE',
          '',
          'The hooks are globally active and enforcing:',
          '- tp-design-gate: blocks Edit/Write before design completion',
          '- tp-heartbeat: tracks files in manifest on every edit',
          '- tp-pre-commit: blocks commits without validation',
          '',
          'Phase files (read in sequence as you progress):',
          '1. ~/.claude/taskplex/phases/init.md (NOW)',
          '2. ~/.claude/taskplex/phases/planning.md (after init)',
          '3. ~/.claude/taskplex/phases/validation.md (after implementation)',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        ].join('\n')
      }));
      return;
    }

    // Not a /tp invocation — check active task in design phase
    const task = findSessionTask(cwd);
    if (task && task.manifest.status === 'in-progress') {
      const m = task.manifest;
      const phase = m.phase || 'init';

      if (phase === 'init' || phase === 'brief') {
        const looksLikeCodeRequest = /\b(fix|implement|add|create|build|write|code|edit|change|update|refactor)\b/i.test(userPrompt);
        if (looksLikeCodeRequest) {
          console.log(JSON.stringify({
            additionalContext: [
              `[tp] Active task "${m.description || m.taskId}" is in ${phase}/${m.designPhase || 'unknown'} phase.`,
              `Design interaction must complete before implementation.`,
              `Read .claude-task/${task.folder}/manifest.json for current state.`,
            ].join(' ')
          }));
          return;
        }
      }
    }

    console.log(JSON.stringify({}));
  } catch (error) {
    if (process.env.TF_DEBUG) console.error(`[tp-prompt-check] ${error.message}`);
    console.log(JSON.stringify({}));
  }
}

main();
