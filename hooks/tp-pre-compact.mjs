#!/usr/bin/env node
/**
 * TaskPlex Pre-Compact Hook (PreCompact)
 *
 * Fires before context compaction. Responsibilities:
 *   - Snapshot manifest + progress to checkpoints/compact-{timestamp}.json
 *   - Include current phase, status, modified files, progress notes
 *   - Emit system message with recovery instructions
 */

import { pathToFileURL, fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const {
  parseStdin, normalizeCwd, findSessionTask,
  callRuntime, isRuntimeAvailable,
  continueWithSystemMessage, continueQuietly
} = await import(pathToFileURL(join(__dirname, 'hook-utils.mjs')).href);

import fs from 'fs';
import path from 'path';

async function main() {
  try {
    const hookInput = await parseStdin();
    const cwd = normalizeCwd(hookInput);

    const task = findSessionTask(cwd);
    if (!task) {
      continueQuietly();
      return;
    }

    const { manifest, taskPath } = task;

    if (manifest.status === 'completed' || manifest.status === 'cancelled') {
      continueQuietly();
      return;
    }

    // === Create local checkpoint ===
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const checkpointsDir = path.join(taskPath, 'checkpoints');
    fs.mkdirSync(checkpointsDir, { recursive: true });

    const checkpoint = {
      checkpointType: 'pre-compact',
      timestamp: new Date().toISOString(),
      taskId: manifest.taskId,
      phase: manifest.phase,
      status: manifest.status,
      designDepth: manifest.designDepth || null,
      executionMode: manifest.executionMode || 'standard',
      qualityProfile: manifest.qualityProfile || 'standard',
      toolCallCount: manifest.toolCallCount || 0,
      modifiedFiles: manifest.modifiedFiles || [],
      progressNotes: manifest.progressNotes || [],
      phaseChecklist: manifest.phaseChecklist || null,
      validation: manifest.validation || {},
      iterationCounts: manifest.iterationCounts || {},
      degradations: manifest.degradations || [],
      phaseTransitions: manifest._phaseTransitions || [],
    };

    // Include narrative summary from progress.md
    const progressPath = path.join(taskPath, 'progress.md');
    if (fs.existsSync(progressPath)) {
      try {
        const progressContent = fs.readFileSync(progressPath, 'utf8');
        const narrativeMatch = progressContent.match(/## Task Narrative\n([\s\S]*?)(?=\n## (?!Task Narrative)|\n---|\n$)/);
        if (narrativeMatch) {
          checkpoint.narrativeSummary = narrativeMatch[1].trim();
        }
      } catch { /* non-fatal */ }
    }

    // Include active workers if any
    const workersDir = path.join(taskPath, 'workers');
    if (fs.existsSync(workersDir)) {
      try {
        const workerFiles = fs.readdirSync(workersDir).filter(f => f.endsWith('.json'));
        checkpoint.workers = workerFiles.map(f => {
          try {
            return JSON.parse(fs.readFileSync(path.join(workersDir, f), 'utf8'));
          } catch { return { file: f, error: 'unreadable' }; }
        });
      } catch { /* skip */ }
    }

    // ── Runtime: call task.handoff for richer checkpoint data ──
    let handoffData = null;
    const runtimeUp = isRuntimeAvailable();
    if (runtimeUp && manifest.runtimeSessionId) {
      const handoffResult = await callRuntime('task.handoff', {
        task_id: manifest.taskId
      });

      if (handoffResult.ok) {
        handoffData = handoffResult.result;
        checkpoint.runtimeHandoff = {
          decisionsSummary: handoffData.decisions_summary,
          pendingGates: handoffData.pending_gates,
          activeWorkers: handoffData.active_workers,
          progressNotes: handoffData.progress_notes,
          nextAction: handoffData.next_action,
          checkpointPath: handoffData.checkpoint_path,
        };
      }
    }

    const checkpointPath = path.join(checkpointsDir, `compact-${timestamp}.json`);
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));

    // === Build recovery message ===
    const lines = [
      `[TaskPlex] Context compaction checkpoint saved.`,
      `Task: ${manifest.taskId} | Phase: ${manifest.phase} | Status: ${manifest.status}`,
      `Profile: ${manifest.qualityProfile || 'standard'} | Mode: ${manifest.executionMode || 'standard'}`,
    ];

    if (handoffData) {
      lines.push(`Runtime: connected — handoff captured`);
      if (handoffData.active_workers?.length > 0) {
        lines.push(`Active workers: ${handoffData.active_workers.join(', ')}`);
      }
      if (handoffData.pending_gates?.length > 0) {
        lines.push(`Pending gates: ${handoffData.pending_gates.join(', ')}`);
      }
      if (handoffData.next_action) {
        lines.push(`Next action: ${handoffData.next_action}`);
      }
    } else {
      const activeNotes = (manifest.progressNotes || [])
        .filter(n => n.status === 'active')
        .map(n => n.text);
      const pendingNotes = (manifest.progressNotes || [])
        .filter(n => n.status === 'pending')
        .map(n => n.text);

      if (activeNotes.length > 0) lines.push(`In progress: ${activeNotes.join('; ')}`);
      if (pendingNotes.length > 0) lines.push(`Pending: ${pendingNotes.join('; ')}`);
    }

    lines.push(`Modified files: ${(manifest.modifiedFiles || []).length}`);
    lines.push(`Recovery: Read ${path.relative(cwd, path.join(taskPath, 'manifest.json')).replace(/\\/g, '/')}`);

    continueWithSystemMessage(lines.join('\n'));
  } catch (error) {
    if (process.env.TF_DEBUG) console.error(`[tf-pre-compact] ${error.message}`);
    continueQuietly();
  }
}

main();
