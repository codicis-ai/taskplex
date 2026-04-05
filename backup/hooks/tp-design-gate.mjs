#!/usr/bin/env node
/**
 * TaskPlex Design & Implementation Gate Hook (PreToolUse: Edit|Write)
 *
 * Two enforcement roles:
 * 1. Design gate: Blocks artifact writes until the correct designPhase sub-phase is reached.
 * 2. Implementation gate: Blocks orchestrator source edits in team/blueprint mode
 *    (orchestrator must delegate to agents, not implement directly).
 */

import { pathToFileURL, fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const {
  parseStdin, normalizeCwd, findSessionTask,
  allowTool, denyTool, isSourceFile
} = await import(pathToFileURL(join(__dirname, 'hook-utils.mjs')).href);

import fs from 'fs';
import path from 'path';

// Sub-phase ordering (higher number = later in flow)
const SUB_PHASE_ORDER = {
  'convention-scan':     0,
  'convention-check':    1,
  'intent-exploration':  2,
  'approach-review':     3,
  'design-approval':     4,
  'brief-writing':       5,
  'prd-bootstrap':       6,
  'prd-critic':          7,
  'prd-approval':        8,
  'planning-active':     9,
};

// Artifact → minimum sub-phase required to write it
const ARTIFACT_GATES = {
  'conventions.md':         'convention-check',
  'intent-and-journeys.md': 'intent-exploration',
  'research.md':            'intent-exploration',
  'brief.md':               'brief-writing',
  'spec.md':                'brief-writing',
  'plan.md':                'brief-writing',
  'architecture.md':        'brief-writing',
  'strategic-review.md':    'prd-critic',
  'tactical-review.md':     'prd-critic',
  'prd.md':                 'prd-bootstrap',
  'prd-state.json':         'prd-bootstrap',
};

const ALWAYS_ALLOWED = new Set([
  'manifest.json',
  'progress.md',
  'session.json',
]);

async function main() {
  try {
    const hookInput = await parseStdin();
    const cwd = normalizeCwd(hookInput);

    const task = findSessionTask(cwd);
    if (!task) {
      allowTool();
      return;
    }

    const { manifest, taskPath } = task;

    const phase = manifest.phase || 'init';

    // === Implementation + QA gates (ARTIFACT-BASED — do not trust manifest flags) ===
    // Gate ordering: Spec exists → Critic artifacts exist → Implementation delegated → Wave
    // Design principle: check what FILES exist on disk, not what the manifest CLAIMS happened.
    // The agent can set any flag — it cannot fake file existence without producing content.
    if (phase === 'implementation' || phase === 'qa') {
      const execMode = manifest.executionMode || 'standard';
      const toolInput = hookInput.tool_input || {};
      const filePath = toolInput.file_path || toolInput.path || '';
      const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();

      // Allow writes to task artifacts (.claude-task/) — only block source code edits
      if (filePath && !normalizedPath.includes('.claude-task/') && isSourceFile(filePath)) {

        // --- Spec gate (all routes): spec.md must exist before implementation ---
        // A PRD is input, not a spec. The planning phase must produce spec.md.
        // Light route: brief.md is sufficient (no spec required).
        if (execMode !== 'light') {
          const specPath = path.join(taskPath, 'spec.md');
          const hasSpec = fs.existsSync(specPath);
          if (!hasSpec) {
            denyTool(
              `TaskPlex spec gate: No spec.md found in .claude-task/{taskId}/.\n` +
              `The planning phase must produce a spec before implementation can begin.\n` +
              `A PRD or plan file is requirements INPUT — it is not a spec.\n` +
              `Run the planning agent to write spec.md from your brief.\n` +
              `See planning.md Phase A (Standard) or Phase B (Blueprint).\n\n` +
              `Escape: create a minimal spec.md in the task directory.`
            );
            return;
          }
        } else {
          // Light route: at minimum brief.md must exist
          const briefPath = path.join(taskPath, 'brief.md');
          if (!fs.existsSync(briefPath)) {
            denyTool(
              `TaskPlex brief gate: No brief.md found in .claude-task/{taskId}/.\n` +
              `Even Light route requires a brief before implementation.\n` +
              `Run the design phase to produce brief.md.\n\n` +
              `Escape: create a minimal brief.md in the task directory.`
            );
            return;
          }
        }

        // --- Critic gate (ARTIFACT-BASED — ignore manifest.criticCompleted flag) ---
        // Standard/team/blueprint: review artifacts must exist in reviews/ directory.
        // Light route: exempt (no critic step).
        if (execMode === 'standard' || execMode === 'team' || execMode === 'blueprint') {
          let hasCriticReview = false;
          try {
            const reviewsDir = path.join(taskPath, 'reviews');
            if (fs.existsSync(reviewsDir)) {
              const reviewFiles = fs.readdirSync(reviewsDir);
              if (execMode === 'blueprint') {
                // Blueprint requires strategic or tactical review
                hasCriticReview = reviewFiles.some(f =>
                  f.startsWith('strategic-review') || f.startsWith('tactical-review'));
              } else {
                // Standard/team requires spec critic review
                hasCriticReview = reviewFiles.some(f =>
                  f.startsWith('spec-review') || f.startsWith('spec-critic') || f.startsWith('closure'));
              }
            }
          } catch { /* treat as not done */ }

          if (!hasCriticReview) {
            const criticMsg = execMode === 'blueprint'
              ? `TaskPlex critic gate: No critic review artifacts found in reviews/.\n` +
                `Blueprint route requires strategic-critic and/or tactical-critic reviews.\n` +
                `Spawn critics and ensure they write to .claude-task/{taskId}/reviews/.\n` +
                `See planning.md Blueprint Phase A.2.`
              : `TaskPlex critic gate: No critic review artifacts found in reviews/.\n` +
                `Standard route requires spec critic review.\n` +
                `Spawn closure-agent for spec review — it must write to .claude-task/{taskId}/reviews/.\n` +
                `See planning.md Standard Phase A.2.`;
            denyTool(
              criticMsg + `\n\nThe gate checks for ACTUAL review files, not manifest flags.\n` +
              `Escape: create a review file in .claude-task/{taskId}/reviews/.`
            );
            return;
          }
        }

        // --- Blueprint artifact gate: architecture.md + file-ownership.json ---
        if (execMode === 'blueprint') {
          const missing = [];
          if (!fs.existsSync(path.join(taskPath, 'architecture.md'))) missing.push('architecture.md');
          if (!fs.existsSync(path.join(taskPath, 'file-ownership.json'))) missing.push('file-ownership.json');
          if (missing.length > 0) {
            denyTool(
              `TaskPlex blueprint artifact gate: Missing required artifacts: ${missing.join(', ')}.\n` +
              `Blueprint route requires architecture.md (from architect agent) and\n` +
              `file-ownership.json (from planning agent) before implementation.\n\n` +
              `Escape: create the missing files in .claude-task/{taskId}/.`
            );
            return;
          }
        }

        // --- Implementation delegated gate (standard/team/blueprint) ---
        if (execMode === 'standard' || execMode === 'team' || execMode === 'blueprint') {
          if (!manifest.implementationDelegated) {
            denyTool(
              `TaskPlex implementation gate: Source file edits blocked.\n` +
              `Execution mode: ${execMode} — the orchestrator must delegate to agents, not implement directly.\n` +
              `Spawn implementation agents per ~/.claude/taskplex/phases/planning.md.\n` +
              `Create TaskPlex-managed worktrees (git worktree add) for Blueprint agents.\n` +
              `After spawning, set manifest.implementationDelegated = true to unlock orchestrator edits.\n\n` +
              `If this is a post-agent fix (build-fixer, review fix), set manifest.implementationDelegated = true first.`
            );
            return;
          }
        }

        // === Wave gate (blueprint only): block next wave until current wave validated ===
        if (execMode === 'blueprint' && manifest.waveProgress) {
          const waves = manifest.waveProgress;
          const waveIds = Object.keys(waves).sort();

          for (let i = 1; i < waveIds.length; i++) {
            const prevWave = waves[waveIds[i - 1]];
            const currWave = waves[waveIds[i]];

            // If current wave is in-progress but previous wave isn't validated
            if (currWave && currWave.status === 'in-progress') {
              if (prevWave && prevWave.status !== 'completed') {
                denyTool(
                  `TaskPlex wave gate: Cannot proceed with ${waveIds[i]} (${currWave.name || ''}).\n` +
                  `Previous wave ${waveIds[i - 1]} (${prevWave.name || ''}) status: ${prevWave.status}.\n` +
                  `Previous wave must have status "completed" with validation passed before next wave starts.\n\n` +
                  `Update manifest.waveProgress.${waveIds[i - 1]}.status = "completed" and\n` +
                  `manifest.waveProgress.${waveIds[i - 1]}.validation = { "passed": true, ... } first.`
                );
                return;
              }
              if (prevWave && prevWave.validation && prevWave.validation.passed === false) {
                denyTool(
                  `TaskPlex wave gate: Cannot proceed with ${waveIds[i]}.\n` +
                  `Previous wave ${waveIds[i - 1]} validation FAILED.\n` +
                  `Fix validation issues in ${waveIds[i - 1]} before starting ${waveIds[i]}.\n\n` +
                  `Validation details: ${JSON.stringify(prevWave.validation)}`
                );
                return;
              }
            }
          }
        }
      }
      // Past the implementation + wave gate checks — allow
      allowTool();
      return;
    }

    // Only enforce design gate during init and brief phases
    if (phase !== 'init' && phase !== 'brief' && phase !== 'bootstrap') {
      allowTool();
      return;
    }

    const designDepth = manifest.designDepth || 'full';

    const toolInput = hookInput.tool_input || {};
    const filePath = toolInput.file_path || toolInput.path || '';
    if (!filePath) {
      allowTool();
      return;
    }

    const fileName = path.basename(filePath).toLowerCase();
    const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();

    if (ALWAYS_ALLOWED.has(fileName)) {
      allowTool();
      return;
    }

    if (!normalizedPath.includes('.claude-task/') && !normalizedPath.includes('.taskplex/')) {
      allowTool();
      return;
    }

    // Mid-flow escape
    const interaction = manifest.designInteraction || {};
    if (interaction.userEscaped) {
      allowTool();
      return;
    }

    const currentSubPhase = manifest.designPhase || 'convention-scan';
    const currentOrder = SUB_PHASE_ORDER[currentSubPhase] ?? 0;

    if (normalizedPath.includes('/reviews/')) {
      const reviewGateOrder = SUB_PHASE_ORDER['prd-critic'] ?? 7;
      if (currentOrder < reviewGateOrder && phase === 'init') {
        denyTool(
          `TaskPlex design gate: Review files are not allowed during ${currentSubPhase}. ` +
          `Reviews happen after brief approval. Current sub-phase: ${currentSubPhase}.`
        );
        return;
      }
      allowTool();
      return;
    }

    const requiredSubPhase = ARTIFACT_GATES[fileName];
    if (!requiredSubPhase) {
      allowTool();
      return;
    }

    const requiredOrder = SUB_PHASE_ORDER[requiredSubPhase] ?? 0;

    // Light mode relaxation
    if (designDepth === 'light') {
      if (fileName === 'conventions.md' && currentOrder >= SUB_PHASE_ORDER['convention-scan']) {
        allowTool();
        return;
      }
      if ((fileName === 'brief.md' || fileName === 'spec.md') && currentOrder >= SUB_PHASE_ORDER['intent-exploration']) {
        allowTool();
        return;
      }
    }

    // === Interaction evidence check (adaptive model) ===
    // Gate criteria use flags (contextConfirmed, ambiguitiesResolved), not question counters.
    // Counters (intentQuestionsAsked, etc.) are kept for observability but are NOT gate criteria.
    if (designDepth === 'full') {
      if (fileName === 'brief.md') {
        const missing = [];
        if (!interaction.contextConfirmed) {
          missing.push('confirm understanding with user (set manifest.designInteraction.contextConfirmed = true after user confirms/corrects your synthesis)');
        }
        if (!interaction.ambiguitiesResolved) {
          missing.push('resolve remaining ambiguities (set manifest.designInteraction.ambiguitiesResolved = true when sufficiency check passes — no open questions remain)');
        }
        if (!interaction.approachSelected) {
          missing.push('get user selection on approach (propose 2-3 options, set approachSelected = true after user chooses)');
        }
        if ((interaction.sectionsApproved || 0) < 1) {
          missing.push(`get at least 1 design section approved (approved: ${interaction.sectionsApproved || 0})`);
        }
        if (missing.length > 0) {
          denyTool(
            `TaskPlex design gate: Cannot write brief.md — interaction evidence missing.\n` +
            `Design depth: full. Required steps not yet completed:\n` +
            missing.map(m => `  - ${m}`).join('\n') + '\n\n' +
            `The gate uses adaptive interaction — question count is driven by context density, not hard minimums.\n` +
            `If the user says "just do it", set manifest.designInteraction.userEscaped = true.`
          );
          return;
        }
      }

      if (fileName === 'conventions.md' && currentSubPhase === 'convention-check') {
        if (!interaction.contextConfirmed) {
          denyTool(
            `TaskPlex design gate: Cannot update CONVENTIONS.md from convention-check until ` +
            `context has been confirmed with user. ` +
            `Set manifest.designInteraction.contextConfirmed = true after user confirms conventions.`
          );
          return;
        }
      }
    }

    if (designDepth === 'light') {
      if (fileName === 'brief.md') {
        if (!interaction.contextConfirmed) {
          denyTool(
            `TaskPlex design gate: Cannot write brief.md — even in light mode, ` +
            `context must be confirmed with the user. ` +
            `Set manifest.designInteraction.contextConfirmed = true after user confirms your synthesis.`
          );
          return;
        }
      }
    }

    if (currentOrder < requiredOrder) {
      const friendlyPhases = {
        'convention-scan':    'auto-scanning conventions',
        'convention-check':   'asking convention questions (user must answer)',
        'intent-exploration': 'exploring intent with user (clarifying questions)',
        'approach-review':    'reviewing approaches with user (2-3 options)',
        'design-approval':    'getting section-by-section design approval',
        'brief-writing':      'writing brief from approved design',
        'prd-bootstrap':      'bootstrapping PRD features',
        'prd-critic':         'running critic review on PRD',
        'prd-approval':       'getting user approval on PRD',
      };

      const currentDesc = friendlyPhases[currentSubPhase] || currentSubPhase;
      const requiredDesc = friendlyPhases[requiredSubPhase] || requiredSubPhase;

      denyTool(
        `TaskPlex design gate: Cannot write ${fileName} yet.\n` +
        `Current sub-phase: ${currentSubPhase} (${currentDesc}).\n` +
        `Required sub-phase: ${requiredSubPhase} (${requiredDesc}).\n\n` +
        `Complete the earlier interaction steps first and update manifest.designPhase.`
      );
      return;
    }

    allowTool();
  } catch (error) {
    if (process.env.TF_DEBUG) console.error(`[tf-design-gate] ${error.message}`);
    allowTool();
  }
}

main();
