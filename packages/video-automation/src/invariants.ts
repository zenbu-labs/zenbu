/**
 * Runtime invariant system for the judgment engine.
 * These track every state transition and validate correctness at each step.
 * Violations are collected (not thrown) so the system continues running
 * while still recording what went wrong.
 */

export interface InvariantViolation {
  timestamp: string;
  sessionId: string;
  phase: string;
  invariant: string;
  expected: string;
  actual: string;
}

export interface InvariantLog {
  timestamp: string;
  sessionId: string;
  phase: string;
  message: string;
}

// Per-session tracking
const violations = new Map<string, InvariantViolation[]>();
const logs = new Map<string, InvariantLog[]>();

function now() {
  return new Date().toISOString();
}

export function logInvariant(sessionId: string, phase: string, message: string) {
  if (!logs.has(sessionId)) logs.set(sessionId, []);
  logs.get(sessionId)!.push({ timestamp: now(), sessionId, phase, message });
}

export function violateInvariant(
  sessionId: string,
  phase: string,
  invariant: string,
  expected: string,
  actual: string,
) {
  if (!violations.has(sessionId)) violations.set(sessionId, []);
  violations.get(sessionId)!.push({
    timestamp: now(),
    sessionId,
    phase,
    invariant,
    expected,
    actual,
  });
  logInvariant(sessionId, phase, `VIOLATION: ${invariant} — expected: ${expected}, actual: ${actual}`);
}

export function assertInvariant(
  sessionId: string,
  phase: string,
  invariant: string,
  condition: boolean,
  expected: string,
  actual: string,
) {
  if (!condition) {
    violateInvariant(sessionId, phase, invariant, expected, actual);
  } else {
    logInvariant(sessionId, phase, `OK: ${invariant}`);
  }
  return condition;
}

export function getViolations(sessionId: string): InvariantViolation[] {
  return violations.get(sessionId) || [];
}

export function getLogs(sessionId: string): InvariantLog[] {
  return logs.get(sessionId) || [];
}

export function clearSession(sessionId: string) {
  violations.delete(sessionId);
  logs.delete(sessionId);
}

export function getAllViolations(): Map<string, InvariantViolation[]> {
  return violations;
}
