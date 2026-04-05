#!/usr/bin/env node
/**
 * TaskPlex Heartbeat Hook (PostToolUse: Edit|Write)
 *
 * Fires on every file edit/write. Responsibilities:
 *   - Track modified files in manifest.modifiedFiles[]
 *   - Increment toolCallCount + track by type
 *   - Auto-promote phase based on artifact detection
 *   - Update lastUpdated timestamp
 *   - Render progress.md from manifest.progressNotes[]
 *   - Compaction guard (token estimation warning)
 */

import { pathToFileURL, fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const {
  parseStdin, normalizeCwd, findSessionTask, findProjectRoot,
  getPhaseNumber, isSourceFile, detectFileState,
  callRuntime, isRuntimeAvailable,
  readPlannedFiles, inferFileOwner, isSharedFile, isPlannedFile
} = await import(pathToFileURL(join(__dirname, 'hook-utils.mjs')).href);

import fs from 'fs';
import path from 'path';

const HEARTBEAT_INTERVAL = 5;

async function main() {
  try {
    const hookInput = await parseStdin();
    const cwd = normalizeCwd(hookInput);
    const toolName = hookInput.tool_name || 'unknown';

    const task = findSessionTask(cwd);
    if (!task) { process.exit(0); }

    const { taskPath, manifest } = task;
    const manifestPath = path.join(taskPath, 'manifest.json');

    if (manifest.status === 'completed' || manifest.status === 'cancelled') {
      process.exit(0);
    }

    // === Track modified file ===
    const editedFile = hookInput.tool_input?.file_path || hookInput.tool_input?.path || null;
    if (editedFile) {
      if (!manifest.modifiedFiles) manifest.modifiedFiles = [];
      const normalized = editedFile.replace(/\\/g, '/');
      if (!manifest.modifiedFiles.includes(normalized)) {
        manifest.modifiedFiles.push(normalized);
      }
    }

    // === Increment tool call counter ===
    if (typeof manifest.toolCallCount !== 'number') manifest.toolCallCount = 0;
    manifest.toolCallCount++;
    if (!manifest.toolCallsByType) manifest.toolCallsByType = {};
    manifest.toolCallsByType[toolName] = (manifest.toolCallsByType[toolName] || 0) + 1;

    // === Auto-promote phase ===
    const { derivedPhase } = detectFileState(taskPath);
    if (derivedPhase) {
      const currentPhaseNum = getPhaseNumber(manifest.phase);
      const derivedPhaseNum = getPhaseNumber(derivedPhase);

      if (derivedPhaseNum > currentPhaseNum) {
        const runtimeUp = isRuntimeAvailable();
        let transitionAllowed = true;

        if (runtimeUp && manifest.runtimeSessionId) {
          const transResult = await callRuntime('phase.request_transition', {
            task_id: manifest.taskId,
            from_phase: manifest.phase,
            to_phase: derivedPhase,
            evidence: null
          });

          if (transResult.ok) {
            transitionAllowed = transResult.result.allowed;
          }
        }

        if (transitionAllowed) {
          // Log phase transition with narrative
          if (!manifest._phaseTransitions) manifest._phaseTransitions = [];
          const fileCount = (manifest.modifiedFiles || []).length;
          const summary = `${fileCount} files modified. Moving to ${derivedPhase}.`;
          manifest._phaseTransitions.push({
            from: manifest.phase,
            to: derivedPhase,
            at: new Date().toISOString(),
            toolCall: manifest.toolCallCount,
            summary
          });
          manifest.phase = derivedPhase;
        }
      }
    }

    // === Runtime heartbeat ===
    if (manifest.runtimeSessionId && manifest.toolCallCount % HEARTBEAT_INTERVAL === 0) {
      callRuntime('session.heartbeat', {
        session_id: manifest.runtimeSessionId
      }).catch(() => {});
    }

    // === Progress note staleness check ===
    if (typeof manifest.lastProgressNoteToolCall !== 'number') {
      manifest.lastProgressNoteToolCall = 0;
    }
    // Detect if a new progress note was appended (compare array length)
    const noteCount = (manifest.progressNotes || []).length;
    if (!manifest._lastKnownNoteCount) manifest._lastKnownNoteCount = 0;
    if (noteCount > manifest._lastKnownNoteCount) {
      // A new progress note was added since last heartbeat
      manifest.lastProgressNoteToolCall = manifest.toolCallCount;
      manifest._lastKnownNoteCount = noteCount;
    } else if (manifest.toolCallCount - manifest.lastProgressNoteToolCall > 15) {
      // Stale — inject reminder via progress.md warning
      manifest._progressNoteStale = true;
    } else {
      manifest._progressNoteStale = false;
    }

    // === Phase checklist auto-update ===
    if (editedFile) {
      const normalizedForCheck = editedFile.replace(/\\/g, '/');
      const basename = path.basename(normalizedForCheck);
      if (!manifest.phaseChecklist) manifest.phaseChecklist = {};

      if (basename === 'brief.md') {
        manifest.phaseChecklist.briefWriting = 'completed';
      }
      if (basename === 'spec.md') {
        manifest.phaseChecklist.planning = 'completed';
        if (!manifest.phaseChecklist.implementation || manifest.phaseChecklist.implementation === 'pending') {
          manifest.phaseChecklist.implementation = 'in-progress';
        }
      }
      if (basename === 'qa-report.md') {
        manifest.phaseChecklist.qa = 'completed';
        if (!manifest.phaseChecklist.validation || manifest.phaseChecklist.validation === 'pending') {
          manifest.phaseChecklist.validation = 'in-progress';
        }
      }
    }

    // === Wave progress tracking ===
    if (editedFile && manifest.waveProgress) {
      const normalizedWaveFile = editedFile.replace(/\\/g, '/');
      for (const waveId of Object.keys(manifest.waveProgress)) {
        const wave = manifest.waveProgress[waveId];
        if (wave && wave.status === 'in-progress') {
          if (!wave.filesModified) wave.filesModified = [];
          if (!wave.filesModified.includes(normalizedWaveFile)) {
            wave.filesModified.push(normalizedWaveFile);
          }
          break; // Only track against the current in-progress wave
        }
      }
    }

    // === Session Guardian: Scope & Ownership Checks (Phase 1) ===
    const guardianPhases = new Set(['implementation', 'qa']);
    if (editedFile && guardianPhases.has(manifest.phase)) {
      const plannedFiles = readPlannedFiles(taskPath);
      const normalizedEdit = editedFile.replace(/\\/g, '/');
      const guardianWarnings = [];

      // Scope check
      if (plannedFiles && !isPlannedFile(plannedFiles, normalizedEdit)) {
        // Only warn for source-ish files, not random config
        if (isSourceFile(editedFile)) {
          if (!manifest._guardianScopeWarned) manifest._guardianScopeWarned = [];
          if (!manifest._guardianScopeWarned.includes(normalizedEdit)) {
            manifest._guardianScopeWarned.push(normalizedEdit);
            guardianWarnings.push(`SCOPE WARNING: ${normalizedEdit} not in planned file set. Possible scope creep.`);
          }
        }
      }

      // Ownership check (only for multi-agent routes with file-ownership.json)
      if (plannedFiles && plannedFiles.ownership.size > 0 && !isSharedFile(plannedFiles, normalizedEdit)) {
        const owner = inferFileOwner(plannedFiles, normalizedEdit);
        // We can't reliably determine the current agent from hook context,
        // but we can detect if the file is being modified and it's owned by a specific worker.
        // Log ownership info in observations for cross-reference.
        if (owner) {
          // Track ownership edits for Phase 2 trigger detection
          if (!manifest._guardianOwnershipEdits) manifest._guardianOwnershipEdits = {};
          if (!manifest._guardianOwnershipEdits[normalizedEdit]) {
            manifest._guardianOwnershipEdits[normalizedEdit] = [];
          }
          const editEntry = { timestamp: new Date().toISOString(), owner };
          manifest._guardianOwnershipEdits[normalizedEdit].push(editEntry);

          // If the same file has been edited with different inferred owners, that's a conflict
          const owners = new Set(manifest._guardianOwnershipEdits[normalizedEdit].map(e => e.owner));
          if (owners.size > 1) {
            const ownerList = [...owners].join(', ');
            if (!manifest._guardianOwnershipWarned) manifest._guardianOwnershipWarned = [];
            if (!manifest._guardianOwnershipWarned.includes(normalizedEdit)) {
              manifest._guardianOwnershipWarned.push(normalizedEdit);
              guardianWarnings.push(`OWNERSHIP WARNING: ${normalizedEdit} edited by multiple owners (${ownerList}). Potential conflict.`);
            }
          }
        }
      }

      // File count check
      if (plannedFiles) {
        const modifiedCount = (manifest.modifiedFiles || []).length;
        const plannedCount = plannedFiles.files.size;
        if (plannedCount > 0 && modifiedCount > plannedCount * 1.5) {
          if (!manifest._guardianFileCountWarned) {
            manifest._guardianFileCountWarned = true;
            const pct = Math.round(((modifiedCount - plannedCount) / plannedCount) * 100);
            guardianWarnings.push(`FILE COUNT WARNING: ${modifiedCount} files modified, plan specified ${plannedCount}. Exceeding scope by ${pct}%.`);
          }
        }
      }

      // Observation log (append-only)
      try {
        const obsPath = path.join(taskPath, 'observations.md');
        const owner = plannedFiles ? inferFileOwner(plannedFiles, normalizedEdit) : null;
        const inScope = plannedFiles ? isPlannedFile(plannedFiles, normalizedEdit) : null;
        const shared = plannedFiles ? isSharedFile(plannedFiles, normalizedEdit) : false;
        const ownerStr = owner || 'unknown';
        let statusStr = inScope === null ? 'no-plan' : inScope ? 'in-scope' : 'OUT-OF-SCOPE';
        if (shared) statusStr = 'shared';

        const logLine = `[${new Date().toISOString()}] EDIT ${normalizedEdit} owner:${ownerStr} status:${statusStr}\n`;
        fs.appendFileSync(obsPath, logLine);
      } catch { /* non-fatal */ }

      // Phase 2 trigger detection: write trigger file if thresholds crossed
      const scopeWarnings = (manifest._guardianScopeWarned || []).length;
      const ownershipWarnings = (manifest._guardianOwnershipWarned || []).length;
      const buildFixRounds = manifest.iterationCounts?.buildFixRounds || 0;
      const triggerPath = path.join(taskPath, 'guardian-trigger.json');

      if (!fs.existsSync(triggerPath)) {
        let trigger = null;
        if (scopeWarnings >= 3) {
          trigger = { trigger: 'scope-alarm', reason: `${scopeWarnings} files outside planned scope`, timestamp: new Date().toISOString() };
        } else if (ownershipWarnings >= 1 && (manifest.executionMode === 'standard' || manifest.executionMode === 'team' || manifest.executionMode === 'blueprint')) {
          trigger = { trigger: 'ownership-conflict', reason: `${ownershipWarnings} file(s) edited by multiple owners`, timestamp: new Date().toISOString() };
        } else if (buildFixRounds >= 3) {
          trigger = { trigger: 'build-loop', reason: `${buildFixRounds} build-fix rounds used (approaching limit)`, timestamp: new Date().toISOString() };
        }

        if (trigger) {
          try { fs.writeFileSync(triggerPath, JSON.stringify(trigger, null, 2)); } catch { /* non-fatal */ }
          guardianWarnings.push(`GUARDIAN TRIGGER: ${trigger.trigger} — ${trigger.reason}. Check guardian-alerts.md after next agent returns.`);
        }
      }

      // Emit warnings via progress.md (will be picked up by renderProgress)
      if (guardianWarnings.length > 0) {
        manifest._guardianWarnings = guardianWarnings;
      }
    }

    // === Update timestamp ===
    manifest.lastUpdated = new Date().toISOString();

    // === Write manifest ===
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    // === Render progress.md ===
    renderProgress(taskPath, manifest);

    // === Compaction guard ===
    const estimatedTokens = weightedTokenEstimate(manifest);
    if (estimatedTokens > 130000) {
      writeCompactionWarning(taskPath, manifest, estimatedTokens);
    }
  } catch (error) {
    if (process.env.TF_DEBUG) console.error(`[tf-heartbeat] ${error.message}`);
  }

  process.exit(0);
}

function renderProgress(taskPath, manifest) {
  try {
    const notes = manifest.progressNotes || [];

    const lines = [
      `# Progress: ${manifest.description || manifest.taskId}`,
      `**Phase:** ${manifest.phase} | **Status:** ${manifest.status}`,
      `**Profile:** ${manifest.qualityProfile || 'standard'} | **Route:** ${manifest.executionMode || 'standard'}`,
      '',
    ];

    // === Narrative Summary (for cold starts / session resume) ===
    lines.push('## Task Narrative');
    lines.push('');
    lines.push(`**Task**: ${manifest.description || manifest.taskId}`);

    // Approach — from brief.md if it exists
    const briefPath = path.join(taskPath, 'brief.md');
    if (fs.existsSync(briefPath)) {
      try {
        const brief = fs.readFileSync(briefPath, 'utf8');
        const approachMatch = brief.match(/##\s*(?:Chosen\s+)?Approach[^\n]*\n([\s\S]*?)(?=\n## |\n---|\n$)/i);
        if (approachMatch) {
          const approachLine = approachMatch[1].trim().split('\n')[0];
          if (approachLine.length > 0 && approachLine.length < 200) {
            lines.push(`**Approach**: ${approachLine}`);
          }
        }
      } catch { /* non-fatal */ }
    }

    // Current focus — from active progress notes
    const active = notes.filter(n => n.status === 'active');
    if (active.length > 0) {
      lines.push(`**Current focus**: ${active.map(n => n.text).join('; ')}`);
    }

    // Key decisions — from confirmed conventions + overrides
    const decisions = [];
    if (manifest.conventionContext?.confirmed?.length > 0) {
      decisions.push(...manifest.conventionContext.confirmed.slice(0, 3));
    }
    if (manifest.overrides?.length > 0) {
      decisions.push(...manifest.overrides.map(o => `Override: ${o.reason}`).slice(0, 2));
    }
    if (decisions.length > 0) {
      lines.push(`**Key decisions**: ${decisions.join('; ')}`);
    }

    // Blockers — from issues + escalations
    const issues = notes.filter(n => n.status === 'issue');
    const escalations = manifest.escalations || [];
    const blockers = [
      ...issues.map(n => n.text),
      ...escalations.map(e => `${e.type}: ${e.source}`),
    ];
    if (blockers.length > 0) {
      lines.push(`**Blockers**: ${blockers.join('; ')}`);
    }

    // Next — from pending progress notes
    const pending = notes.filter(n => n.status === 'pending');
    if (pending.length > 0) {
      lines.push(`**Next**: ${pending.slice(0, 3).map(n => n.text).join('; ')}`);
    }

    // Files summary
    const fileCount = (manifest.modifiedFiles || []).length;
    if (fileCount > 0) {
      lines.push(`**Files modified**: ${fileCount}`);
    }

    lines.push('');

    // === Phase transition log ===
    if (manifest._phaseTransitions?.length > 0) {
      lines.push('## Phase Transitions');
      for (const t of manifest._phaseTransitions.slice(-5)) {
        lines.push(`- **${t.from} → ${t.to}**: ${t.summary}`);
      }
      lines.push('');
    }

    // === Detailed Progress ===
    const done = notes.filter(n => n.status === 'done');

    if (done.length > 0) {
      lines.push('## Completed');
      for (const n of done) lines.push(`- [x] ${n.text}`);
      lines.push('');
    }

    if (active.length > 0) {
      lines.push('## In Progress');
      for (const n of active) lines.push(`- [ ] **${n.text}**`);
      lines.push('');
    }

    if (pending.length > 0) {
      lines.push('## Pending');
      for (const n of pending) lines.push(`- [ ] ${n.text}`);
      lines.push('');
    }

    // Wave progress summary
    if (manifest.waveProgress) {
      lines.push('');
      lines.push('## Wave Progress');
      for (const [waveId, wave] of Object.entries(manifest.waveProgress)) {
        const fileCount = (wave.filesModified || []).length;
        const validationStr = wave.validation ? ` | Validation: ${JSON.stringify(wave.validation)}` : '';
        lines.push(`- **${waveId}** (${wave.name || waveId}): ${wave.status || 'pending'} — ${fileCount} files${validationStr}`);
      }
    }

    // Progress note staleness warning
    if (manifest._progressNoteStale) {
      lines.push('');
      lines.push('### Progress Note Reminder');
      lines.push('No progress note in 15+ tool calls. Update manifest.progressNotes with current status.');
    }

    // Execution continuity reminder (PRD: Workflow Enforcement)
    if (manifest.phase === 'implementation' || manifest.phase === 'qa') {
      lines.push('');
      lines.push('### Execution Continuity');
      lines.push('EXECUTION CONTINUITY: After user approves plan, run to completion. Do not stop to ask "should I continue?"');
    }

    // Session Guardian warnings (PRD: Session Guardian Phase 1)
    if (manifest._guardianWarnings && manifest._guardianWarnings.length > 0) {
      lines.push('');
      lines.push('### Session Guardian');
      for (const w of manifest._guardianWarnings) {
        lines.push(`- ${w}`);
      }
      // Clear after rendering — they'll re-appear if the condition persists
      delete manifest._guardianWarnings;
    }

    fs.writeFileSync(path.join(taskPath, 'progress.md'), lines.join('\n'));
  } catch {
    // Non-fatal
  }
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
      'Context approaching compaction threshold. Ensure manifest.json is current.',
    ].join('\n');

    content = content.replace(/\n### Compaction Guard\n[\s\S]*?(?=\n### |\n## |$)/, '');
    content = content.trimEnd() + '\n' + warning + '\n';
    fs.writeFileSync(progressPath, content);
  } catch { /* Non-fatal */ }
}

main();
