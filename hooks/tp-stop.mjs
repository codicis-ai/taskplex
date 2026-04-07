#!/usr/bin/env node
/**
 * TaskPlex Stop Hook (Stop)
 *
 * Fires when the user tries to stop/exit the session. Responsibilities:
 *   - Check if active task has incomplete validation
 *   - Warn (but don't block) if task is mid-phase
 *   - Update manifest with session end timestamp
 */

import { pathToFileURL, fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const {
  parseStdin, normalizeCwd, findSessionTask,
  isValidationPassed, allowStop, blockStop,
  callRuntime, isRuntimeAvailable
} = await import(pathToFileURL(join(__dirname, 'hook-utils.mjs')).href);

import fs from 'fs';
import path from 'path';

async function main() {
  try {
    const hookInput = await parseStdin();
    const cwd = normalizeCwd(hookInput);

    const task = findSessionTask(cwd);
    if (!task) {
      allowStop();
      return;
    }

    const { manifest, taskPath } = task;

    if (manifest.status === 'completed' || manifest.status === 'cancelled') {
      await detachFromRuntime(manifest, 'task-complete');
      allowStop();
      return;
    }

    manifest.lastUpdated = new Date().toISOString();
    const manifestPath = path.join(taskPath, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const profile = manifest.qualityProfile || 'standard';
    if (profile === 'lean') {
      await detachFromRuntime(manifest, 'user-stop-lean');
      allowStop();
      return;
    }

    const phase = manifest.phase || 'init';

    if (phase === 'validation') {
      const validation = isValidationPassed(taskPath);
      if (!validation.passed) {
        let reason = `TaskPlex: Task "${manifest.taskId}" is in validation phase but validation has not passed.`;
        if (validation.missing && validation.missing.length > 0) {
          reason += ` Missing: ${validation.missing.join(', ')}.`;
        }
        reason += ' The task will be resumable on next session start.';
        blockStop(reason);
        return;
      }
    }

    if (phase === 'implementation') {
      const fileCount = (manifest.modifiedFiles || []).length;
      const activeNotes = (manifest.progressNotes || [])
        .filter(n => n.status === 'active')
        .map(n => n.text);

      if (activeNotes.length > 0) {
        console.error(`[taskplex] Task "${manifest.taskId}" has active work (${fileCount} files modified). Active: ${activeNotes.join('; ')}. Resumable with /resume.`);
      }

      await detachFromRuntime(manifest, 'user-stop-implementation');
      allowStop();
      return;
    }

    await detachFromRuntime(manifest, 'user-stop');
    allowStop();
  } catch (error) {
    if (process.env.TF_DEBUG) console.error(`[tf-stop] ${error.message}`);
    allowStop();
  }
}

async function detachFromRuntime(manifest, reason) {
  if (!manifest.runtimeSessionId || !isRuntimeAvailable()) return;
  try {
    await callRuntime('session.detach', {
      session_id: manifest.runtimeSessionId,
      reason
    });
  } catch {
    // Non-fatal
  }
}

main();
