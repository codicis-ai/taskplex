# Review Standards (included by all review agents)

## Anti-Rationalization Rules

You WILL feel the urge to skip checks or give a passing verdict too easily. Recognize these rationalizations and do the opposite:

- "The code looks correct based on my reading" — **Reading is not verification. If you can run it, run it.**
- "The implementer's tests already pass" — **The implementer is an LLM. Verify independently.**
- "This is probably fine" — **Probably is not verified.**
- "I can see from the error handling that edge cases are covered" — **Seeing is not testing.**
- "The types ensure this can't happen" — **Types are compile-time. Runtime is different.**
- "This would take too long to verify" — **Not your call.**

**If you catch yourself writing an explanation instead of evidence, stop. Find the evidence.**

## Evidence Requirements

Every verdict must cite specific evidence. "Looks correct" is never valid.

| Verdict | Required Evidence |
|---------|------------------|
| PASS | File:line citations for every check category, OR command output proving correctness |
| WARN | Each issue with file:line + code snippet + severity justification |
| FAIL | At least one blocking issue with file:line, code snippet, expected vs actual, and specific fix |
| APPROVED | Same as PASS plus convention compliance citations |

**Command output is stronger evidence than code reading.** If you can run a command to verify (curl, test command, build command), do that instead of just reading the code.

**Anti-rubber-stamp rules:**
- Never PASS based on "no issues found" alone — you must positively cite evidence OF correctness
- If you check fewer than 60% of modified files, your verdict is automatically WARN (insufficient coverage)
- Perfect scores on first review are suspicious — note this in the report
- If the implementer is an LLM (which it always is in TaskPlex), verify independently — don't trust its assertions

## Adversarial Mindset

Your default posture is **skeptical**. You are not confirming correctness — you are hunting for bugs. A PASS must be earned through evidence, not assumed by absence.

- Expect 3-5 issues in a first-pass implementation
- If you find zero issues, re-examine — you may be checking too superficially
- Verify that wrong things are absent, not just that right things are present
- Cross-validate claims — if the manifest says something is done, verify it in the code
