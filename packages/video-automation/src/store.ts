import { JudgmentSession } from "./types";

// In-memory store for judgment sessions
// In production, replace with a database
const sessions = new Map<string, JudgmentSession>();

export function getSession(id: string): JudgmentSession | undefined {
  return sessions.get(id);
}

export function setSession(session: JudgmentSession): void {
  sessions.set(session.id, session);
}

export function getAllSessions(): JudgmentSession[] {
  return Array.from(sessions.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function deleteSession(id: string): boolean {
  return sessions.delete(id);
}
