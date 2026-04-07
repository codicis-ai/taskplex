#!/usr/bin/env node
/**
 * Shared utilities for TaskPlex hooks (Claude Code).
 */

import fs from 'fs';
import path from 'path';

// ── Constants ──────────────────────────────────────────────────────────

export const STALENESS_THRESHOLD = 4 * 60 * 60 * 1000; // 4h
export const STALENESS_THRESHOLD_AUTONOMOUS = 24 * 60 * 60 * 1000; // 24h

// ── Path Utilities ─────────────────────────────────────────────────────

export function toWindowsPath(p) {
  if (!p) return p;
  const posixMatch = p.match(/^\/([a-zA-Z])(\/.*)?$/);
  if (posixMatch) {
    const drive = posixMatch[1].toUpperCase();
    const rest = posixMatch[2] || '';
    return `${drive}:${rest.replace(/\//g, '\\')}`;
  }
  return p;
}

export function normalizeCwd(hookInput) {
  let cwd = hookInput.cwd || process.cwd();
  return toWindowsPath(cwd) || process.cwd();
}

export function findProjectRoot(startDir) {
  let dir = path.resolve(startDir);
  while (dir) {
    if (fs.existsSync(path.join(dir, '.claude-task'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// ── Stdin ──────────────────────────────────────────────────────────────

export function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(data), 2000);
  });
}

export async function parseStdin() {
  const input = await readStdin();
  try {
    if (input.trim()) return JSON.parse(input);
  } catch { /* ignore */ }
  return {};
}

// ── Phase Numbering ────────────────────────────────────────────────────

const PHASE_MAP = {
  'init': 0, 'brief': 0.5, 'analysis': 1, 'planning': 2,
  'execution': 3, 'validation': 4, 'completion': 5, 'completed': 5
};

export function getPhaseNumber(phase) {
  return PHASE_MAP[phase] ?? parseFloat(phase) ?? 0;
}

// ── Task Discovery ─────────────────────────────────────────────────────

export function findActiveTasks(cwd) {
  const projectRoot = findProjectRoot(cwd);
  const taskDir = projectRoot
    ? path.join(projectRoot, '.claude-task')
    : path.join(cwd, '.claude-task');
  if (!fs.existsSync(taskDir)) return [];

  const activeTasks = [];
  try {
    const folders = fs.readdirSync(taskDir).filter(f => {
      const folderPath = path.join(taskDir, f);
      try {
        return fs.statSync(folderPath).isDirectory() &&
               fs.existsSync(path.join(folderPath, 'manifest.json'));
      } catch { return false; }
    });

    for (const folder of folders) {
      try {
        const manifestPath = path.join(taskDir, folder, 'manifest.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (['completed', 'cancelled'].includes(manifest.status)) continue;

        const lastUpdated = new Date(manifest.lastUpdated || manifest.createdAt || 0);
        const age = Date.now() - lastUpdated.getTime();
        const threshold = (manifest.executionMode === 'autonomous' || manifest.route === 'prd')
          ? STALENESS_THRESHOLD_AUTONOMOUS : STALENESS_THRESHOLD;
        if (age > threshold) continue;

        activeTasks.push({ folder, manifest, lastUpdated });
      } catch { continue; }
    }
  } catch { return []; }

  activeTasks.sort((a, b) => b.lastUpdated - a.lastUpdated);
  return activeTasks;
}

export function findSessionTask(cwd) {
  const projectRoot = findProjectRoot(cwd) || cwd;
  const activeTasks = findActiveTasks(cwd);
  if (activeTasks.length === 0) return null;

  const latest = activeTasks[0];
  const taskPath = path.join(projectRoot, '.claude-task', latest.folder);
  return { folder: latest.folder, manifest: latest.manifest, taskPath };
}

/** Compatibility shim for start-task-sentinel (originally used session files) */
export function findCurrentSession(cwd) {
  const task = findSessionTask(cwd);
  if (!task) return null;
  return { session: { taskId: task.folder } };
}

// ── Runtime API (stubs — no runtime in Claude Code standalone) ────────

export function isRuntimeAvailable() {
  return false;
}

export async function callRuntime(_method, _params) {
  return { ok: false, error: 'runtime not available' };
}

// ── Validation Checking ────────────────────────────────────────────────

export function isValidationPassed(taskPath) {
  const gatePath = path.join(taskPath, 'validation-gate.json');
  if (fs.existsSync(gatePath)) {
    try {
      const gate = JSON.parse(fs.readFileSync(gatePath, 'utf8'));
      if (gate.allPassed === true) {
        return { passed: true, source: 'validation-gate', details: gate };
      }
      return { passed: false, source: 'validation-gate', details: gate, missing: getMissingGateChecks(gate) };
    } catch { /* fall through */ }
  }

  const manifestPath = path.join(taskPath, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const v = manifest.validation || {};
      const isPassing = (verdict) => verdict === 'PASS' || verdict === 'WARN';
      if (isPassing(v.qa) && isPassing(v.security) && isPassing(v.requirements)) {
        return { passed: true, source: 'manifest-legacy', details: v };
      }
    } catch { /* fall through */ }
  }

  const reviewsDir = path.join(taskPath, 'reviews');
  const reviewFiles = { 'security.md': 'security', 'closure.md': 'closure', 'compliance.md': 'compliance' };
  const missing = [];
  const failed = [];

  for (const [file, label] of Object.entries(reviewFiles)) {
    const filePath = path.join(reviewsDir, file);
    if (!fs.existsSync(filePath)) { missing.push(label); }
    else {
      const verdict = parseVerdict(filePath);
      if (verdict === 'FAIL') failed.push(label);
    }
  }

  if (missing.length === 0 && failed.length === 0) {
    return { passed: true, source: 'review-files', details: reviewFiles };
  }
  return { passed: false, source: 'review-files', missing, failed };
}

function getMissingGateChecks(gate) {
  const missing = [];
  if (gate.required) {
    for (const [name, check] of Object.entries(gate.required)) {
      if (check.status !== 'passed') missing.push(name);
    }
  }
  if (gate.conditional) {
    for (const [name, check] of Object.entries(gate.conditional)) {
      if (check.triggered && check.status !== 'passed') missing.push(name);
    }
  }
  return missing;
}

export function parseVerdict(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.match(/\*\*FAIL\*\*/i)) return 'FAIL';
    if (content.match(/\*\*WARN\*\*/i)) return 'WARN';
    if (content.match(/\*\*PASS\*\*/i)) return 'PASS';
    if (content.match(/verdict[:\s]*fail/i)) return 'FAIL';
    if (content.match(/verdict[:\s]*warn/i)) return 'WARN';
    if (content.match(/verdict[:\s]*pass/i)) return 'PASS';
    return 'UNKNOWN';
  } catch { return 'MISSING'; }
}

// ── File State Detection ───────────────────────────────────────────────

export function detectFileState(taskPath) {
  const artifacts = [];
  let derivedPhase = null;

  const checks = [
    { file: 'brief.md', label: 'brief', phase: 'brief' },
    { file: 'intent.md', label: 'intent', phase: 'brief' },
    { file: 'spec.md', label: 'spec', phase: 'planning' },
    { file: 'architecture.md', label: 'architecture', phase: 'planning' },
    { file: 'reviews/code-review.md', label: 'code-review', phase: 'validation' },
    { file: 'reviews/security.md', label: 'security-review', phase: 'validation' },
    { file: 'reviews/closure.md', label: 'closure', phase: 'validation' },
    { file: 'reviews/compliance.md', label: 'compliance', phase: 'completion' },
  ];

  for (const check of checks) {
    if (fs.existsSync(path.join(taskPath, check.file))) {
      artifacts.push(check.label);
      derivedPhase = check.phase;
    }
  }

  const gatePath = path.join(taskPath, 'validation-gate.json');
  if (fs.existsSync(gatePath)) {
    try {
      const gate = JSON.parse(fs.readFileSync(gatePath, 'utf8'));
      artifacts.push('validation-gate');
      if (gate.allPassed === true) { derivedPhase = 'completion'; artifacts.push('validation-passed'); }
    } catch { /* skip */ }
  }

  return { artifacts, derivedPhase };
}

// ── Checkpoint Management ──────────────────────────────────────────────

export function readLatestCheckpoint(taskPath) {
  const checkpointsDir = path.join(taskPath, 'checkpoints');
  if (!fs.existsSync(checkpointsDir)) return null;
  try {
    const files = fs.readdirSync(checkpointsDir)
      .filter(f => f.startsWith('compact-') && f.endsWith('.json'))
      .sort().reverse();
    if (files.length === 0) return null;
    return JSON.parse(fs.readFileSync(path.join(checkpointsDir, files[0]), 'utf8'));
  } catch { return null; }
}

// ── Planned Files (Session Guardian) ──────────────────────────────

let _plannedFilesCache = null;
let _plannedFilesCacheSize = -1;
let _plannedFilesTaskPath = null;

/**
 * Read the set of planned files for scope checking.
 * Primary: file-ownership.json (structured, written by planning agent)
 * Fallback: regex extraction from spec.md File Map table
 * Returns: { files: Set<string>, ownership: Map<string, string>, sharedFiles: Set<string> } | null
 */
export function readPlannedFiles(taskPath) {
  // Try file-ownership.json first
  const ownershipPath = path.join(taskPath, 'file-ownership.json');
  if (fs.existsSync(ownershipPath)) {
    try {
      const stat = fs.statSync(ownershipPath);
      if (_plannedFilesCache && _plannedFilesTaskPath === taskPath && _plannedFilesCacheSize === stat.size) {
        return _plannedFilesCache;
      }

      const data = JSON.parse(fs.readFileSync(ownershipPath, 'utf8'));
      const files = new Set();
      const ownership = new Map();
      const sharedFiles = new Set();

      // Workers section
      if (data.workers) {
        for (const [workerId, worker] of Object.entries(data.workers)) {
          const owned = worker.ownedFiles || worker.files || [];
          const created = worker.creates || [];
          for (const f of [...owned, ...created]) {
            const norm = f.replace(/\\/g, '/');
            files.add(norm);
            ownership.set(norm, workerId);
          }
        }
      }

      // Shared files
      if (data.sharedFiles) {
        for (const f of data.sharedFiles) {
          const norm = f.replace(/\\/g, '/');
          files.add(norm);
          sharedFiles.add(norm);
        }
      }

      _plannedFilesCache = { files, ownership, sharedFiles };
      _plannedFilesCacheSize = stat.size;
      _plannedFilesTaskPath = taskPath;
      return _plannedFilesCache;
    } catch { /* fall through to spec */ }
  }

  // Fallback: parse spec.md for File Map table
  const specPath = path.join(taskPath, 'spec.md');
  if (fs.existsSync(specPath)) {
    try {
      const stat = fs.statSync(specPath);
      if (_plannedFilesCache && _plannedFilesTaskPath === taskPath && _plannedFilesCacheSize === stat.size) {
        return _plannedFilesCache;
      }

      const content = fs.readFileSync(specPath, 'utf8');
      const files = new Set();
      // Match table rows with file paths: | path/to/file.ext | action | desc |
      const fileMapRegex = /\|\s*`?([a-zA-Z0-9_\-/.]+\.[a-zA-Z0-9]+)`?\s*\|/g;
      let match;
      while ((match = fileMapRegex.exec(content)) !== null) {
        const norm = match[1].replace(/\\/g, '/');
        if (norm.includes('/') || norm.includes('.')) {
          files.add(norm);
        }
      }

      if (files.size === 0) return null;

      _plannedFilesCache = { files, ownership: new Map(), sharedFiles: new Set() };
      _plannedFilesCacheSize = stat.size;
      _plannedFilesTaskPath = taskPath;
      return _plannedFilesCache;
    } catch { /* fall through */ }
  }

  return null;
}

/**
 * Infer which worker owns a file by reverse-lookup in file-ownership.json.
 * Returns worker ID string or null if ambiguous/unknown.
 */
export function inferFileOwner(plannedFiles, normalizedPath) {
  if (!plannedFiles || !plannedFiles.ownership) return null;
  // Check if file path ends with any owned path (relative matching)
  for (const [ownedPath, workerId] of plannedFiles.ownership) {
    if (normalizedPath.endsWith(ownedPath) || normalizedPath.includes(ownedPath)) {
      return workerId;
    }
  }
  return null;
}

/**
 * Check if a file is in the shared files set.
 */
export function isSharedFile(plannedFiles, normalizedPath) {
  if (!plannedFiles || !plannedFiles.sharedFiles) return false;
  for (const shared of plannedFiles.sharedFiles) {
    if (normalizedPath.endsWith(shared) || normalizedPath.includes(shared)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a file is in the planned file set.
 */
export function isPlannedFile(plannedFiles, normalizedPath) {
  if (!plannedFiles || !plannedFiles.files) return false;
  for (const planned of plannedFiles.files) {
    if (normalizedPath.endsWith(planned) || normalizedPath.includes(planned)) {
      return true;
    }
  }
  return false;
}

// ── Source File Detection ──────────────────────────────────────────────

const SOURCE_PATTERNS = [
  /\.(tsx?|jsx?|py|rs|go|java|rb|vue|svelte)$/,
  /\.(css|scss|less)$/,
  /\.(sql)$/,
];

export function isSourceFile(filePath) {
  return SOURCE_PATTERNS.some(pattern => pattern.test(filePath));
}

// ── Hook Output Helpers ────────────────────────────────────────────────

export function allowStop() {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

export function blockStop(reason) {
  console.log(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}

export function allowTool() {
  console.log(JSON.stringify({}));
  process.exit(0);
}

export function denyTool(reason) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason
    }
  }));
  process.exit(0);
}

export function continueWithContext(stateMessage) {
  console.log(JSON.stringify({
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: stateMessage
    }
  }));
  process.exit(0);
}

export function continueWithSystemMessage(message) {
  console.log(JSON.stringify({ continue: true, systemMessage: message }));
  process.exit(0);
}

export function continueQuietly() {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}
