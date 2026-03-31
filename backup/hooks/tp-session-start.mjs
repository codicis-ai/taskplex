#!/usr/bin/env node
/**
 * TaskPlex Session Start Hook (SessionStart)
 *
 * Fires on session start/resume/compact recovery. Responsibilities:
 *   - Detect active tasks in working directory
 *   - Read latest checkpoint if recovering from compaction
 *   - Inject recovery context so Claude can resume the task
 *   - Instruct LLM to recreate task list from phaseChecklist
 */

import { pathToFileURL, fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const {
  parseStdin, normalizeCwd, findSessionTask, readLatestCheckpoint,
  callRuntime, isRuntimeAvailable,
  continueWithContext, continueQuietly
} = await import(pathToFileURL(join(__dirname, 'hook-utils.mjs')).href);

import fs from 'fs';
import path from 'path';

async function main() {
  try {
    const hookInput = await parseStdin();
    const cwd = normalizeCwd(hookInput);

    // Find active task
    const task = findSessionTask(cwd);
    if (!task) {
      continueQuietly();
      return;
    }

    const { manifest, taskPath, folder } = task;

    if (manifest.status === 'completed' || manifest.status === 'cancelled') {
      continueQuietly();
      return;
    }

    // ── Runtime integration: register session + attach task ──
    let runtimeSession = null;
    let runtimeTaskInfo = null;
    const runtimeUp = isRuntimeAvailable();

    if (runtimeUp) {
      const regResult = await callRuntime('session.register', {
        client_type: 'claude-code',
        pid: process.ppid || null,
        capabilities: ['hooks', 'mcp', 'agents']
      });

      if (regResult.ok) {
        runtimeSession = regResult.result;
        manifest.runtimeSessionId = runtimeSession.session_id;

        const attachResult = await callRuntime('task.attach', {
          task_dir: taskPath.replace(/\\/g, '/'),
          session_id: runtimeSession.session_id
        });

        if (attachResult.ok) {
          runtimeTaskInfo = attachResult.result;
        }
      }

      const manifestPath = path.join(taskPath, 'manifest.json');
      try {
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      } catch { /* non-fatal */ }
    }

    // ── Runtime resume context ──
    let resumeCtx = null;
    if (runtimeSession && manifest.taskId) {
      const resumeResult = await callRuntime('task.resume_context', {
        task_id: manifest.taskId,
        after_compaction: false
      });
      if (resumeResult.ok) {
        resumeCtx = resumeResult.result;
      }
    }

    // Build context message
    const lines = [
      `[TaskPlex] Active task detected: ${manifest.taskId}`,
      `Phase: ${resumeCtx?.phase || manifest.phase} | Status: ${resumeCtx?.status || manifest.status}`,
      `Profile: ${manifest.qualityProfile || 'standard'} | Route: ${manifest.executionMode || 'standard'}`,
    ];

    if (runtimeSession) {
      lines.push(`Runtime: connected (session ${runtimeSession.session_id.slice(0, 8)}..., v${runtimeSession.runtime_version})`);
    } else {
      lines.push('Runtime: offline — using local mode');
    }

    if (manifest.description) {
      lines.push(`Description: ${manifest.description}`);
    }

    // Check for recent checkpoint
    const checkpoint = readLatestCheckpoint(taskPath);
    if (checkpoint) {
      const checkpointAge = Date.now() - new Date(checkpoint.timestamp).getTime();
      if (checkpointAge < 5 * 60 * 1000) {
        lines.push('');
        lines.push('Recovering from context compaction.');
        if (runtimeSession && manifest.taskId) {
          const compactResume = await callRuntime('task.resume_context', {
            task_id: manifest.taskId,
            after_compaction: true
          });
          if (compactResume.ok) resumeCtx = compactResume.result;
        }
      }
    }

    const progressNotes = resumeCtx?.progress_notes || manifest.progressNotes || [];

    // === Phase Checklist ===
    const checklist = manifest.phaseChecklist;
    if (checklist && typeof checklist === 'object') {
      lines.push('');
      lines.push('═══ TASKPLEX PROGRESS (from manifest) ═══');
      const phaseOrder = [
        { key: 'initialization', label: 'PHASE 1: INITIALIZATION' },
        { key: 'conventionCheck', label: 'PHASE 2: DESIGN — Convention Check' },
        { key: 'intentExploration', label: 'PHASE 3: DESIGN — Intent Exploration' },
        { key: 'planning', label: 'PHASE 4: PLANNING' },
        { key: 'implementation', label: 'PHASE 5: IMPLEMENTATION' },
        { key: 'qa', label: 'PHASE 5.5: QA' },
        { key: 'validation', label: 'PHASE 6: VALIDATION' },
        { key: 'completion', label: 'PHASE 7: COMPLETION' },
      ];

      // Collect pending/active steps for task recreation
      const tasksToRecreate = [];

      for (const phase of phaseOrder) {
        const steps = checklist[phase.key];
        if (!steps || typeof steps !== 'object') continue;
        const stepEntries = Object.entries(steps);
        const allDone = stepEntries.every(([, v]) => v === 'done' || v === 'skipped');
        const hasActive = stepEntries.some(([, v]) => v === 'active');
        const marker = hasActive ? '📍' : (allDone ? '✅' : '⬜');
        lines.push(`${marker} ${phase.label}`);
        for (const [stepId, status] of stepEntries) {
          const icon = status === 'done' ? '✅' : status === 'active' ? '➡️' : status === 'skipped' ? '⏭️' : '⬜';
          lines.push(`  ${icon} ${stepId}`);

          // Track steps that need task recreation
          if (status === 'active') {
            tasksToRecreate.push({ step: stepId, phase: phase.label, status: 'in_progress' });
          } else if (status === 'pending') {
            tasksToRecreate.push({ step: stepId, phase: phase.label, status: 'pending' });
          }
        }
      }
      lines.push('═══════════════════════════════════════');
      lines.push('');
      lines.push('MANDATORY: Output this checklist at the top of your next response.');
      lines.push('Resume from the step marked ➡️. Do NOT restart completed steps.');

      // Task list recreation instruction — MUST be prominent
      if (tasksToRecreate.length > 0) {
        lines.push('');
        lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        lines.push('⚠️  YOUR FIRST ACTION: Recreate the task list');
        lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        lines.push('');
        lines.push('Call TaskCreate for EACH of these steps BEFORE doing anything else:');
        for (const t of tasksToRecreate) {
          const statusNote = t.status === 'in_progress' ? '→ then call TaskUpdate to set in_progress' : '';
          lines.push(`  TaskCreate: "${t.step}" ${statusNote}`);
        }
        lines.push('');
        lines.push('Do this NOW. The task list must be visible in the conversation before you resume work.');
        lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }
    }

    // Active progress notes
    const activeNotes = progressNotes
      .filter(n => n.status === 'active')
      .map(n => `  - ${n.text}`);
    if (activeNotes.length > 0) {
      lines.push('');
      lines.push('In progress:');
      lines.push(...activeNotes);
    }

    // Pending progress notes
    const pendingNotes = progressNotes
      .filter(n => n.status === 'pending')
      .map(n => `  - ${n.text}`);
    if (pendingNotes.length > 0) {
      lines.push('');
      lines.push('Pending:');
      lines.push(...pendingNotes);
    }

    // Issues
    const issues = progressNotes
      .filter(n => n.status === 'issue')
      .map(n => `  - ${n.text}`);
    if (issues.length > 0) {
      lines.push('');
      lines.push('Issues:');
      lines.push(...issues);
    }

    // File stats
    const fileCount = (manifest.modifiedFiles || []).length;
    if (fileCount > 0) {
      lines.push('');
      lines.push(`Files modified: ${fileCount}`);
    }

    const relManifest = path.relative(cwd, path.join(taskPath, 'manifest.json')).replace(/\\/g, '/');
    lines.push('');
    lines.push(`To resume: Read ${relManifest} for full task state.`);

    const artifacts = [];
    if (fs.existsSync(path.join(taskPath, 'brief.md'))) artifacts.push('brief.md');
    if (fs.existsSync(path.join(taskPath, 'spec.md'))) artifacts.push('spec.md');
    if (fs.existsSync(path.join(taskPath, 'architecture.md'))) artifacts.push('architecture.md');
    if (fs.existsSync(path.join(taskPath, 'progress.md'))) artifacts.push('progress.md');

    if (artifacts.length > 0) {
      const taskDir = path.relative(cwd, taskPath).replace(/\\/g, '/');
      lines.push(`Key artifacts: ${artifacts.map(a => `${taskDir}/${a}`).join(', ')}`);
    }

    continueWithContext(lines.join('\n'));
  } catch (error) {
    if (process.env.TF_DEBUG) console.error(`[tf-session-start] ${error.message}`);
    continueQuietly();
  }
}

main();
