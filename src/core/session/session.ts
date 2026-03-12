/**
 * Session Management Module
 *
 * This module provides session management functionality for the OpenShell CLI tool.
 */

import fs from 'fs';
import path from 'path';

/**
 * Session data structure
 */
export interface Session {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Array<{
    role: 'user' | 'assistant' | 'tool';
    content: string;
    timestamp: Date;
  }>;
}

/**
 * Session storage service
 */
export class SessionStore {
  private sessionsDir: string;
  private activeSessionFile: string;
  private sessions: Map<string, Session> = new Map();
  private activeSessionId: string | null = null;

  constructor(baseDir?: string) {
    // Use default directory if none provided
    const defaultDir = path.join(
      process.env['HOME'] || '',
      '.openshell',
      'sessions',
    );
    this.sessionsDir = baseDir || defaultDir;
    this.activeSessionFile = path.join(this.sessionsDir, 'active_session');

    // Ensure sessions directory exists
    this.ensureDirectoryExists();

    // Load sessions from disk
    this.loadSessions();

    // Load active session
    this.loadActiveSession();
  }

  /**
   * Ensure the sessions directory exists
   */
  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  /**
   * Load sessions from disk
   */
  private loadSessions(): void {
    const files = fs.readdirSync(this.sessionsDir);

    for (const file of files) {
      if (file.endsWith('.json') && file !== 'active_session.json') {
        const filePath = path.join(this.sessionsDir, file);
        try {
          const sessionData = fs.readFileSync(filePath, 'utf8');
          const session = JSON.parse(sessionData, (key, value) => {
            if (key.includes('At') && typeof value === 'string') {
              return new Date(value);
            }
            return value;
          }) as Session;
          this.sessions.set(session.id, session);
        } catch (error) {
          console.error(
            `Failed to load session ${file}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
  }

  /**
   * Load active session from disk
   */
  private loadActiveSession(): void {
    if (fs.existsSync(this.activeSessionFile)) {
      try {
        const activeSessionId = fs
          .readFileSync(this.activeSessionFile, 'utf8')
          .trim();
        if (activeSessionId && this.sessions.has(activeSessionId)) {
          this.activeSessionId = activeSessionId;
        }
      } catch (error) {
        console.error(
          `Failed to load active session: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Save active session to disk
   */
  private saveActiveSession(): void {
    if (this.activeSessionId) {
      fs.writeFileSync(this.activeSessionFile, this.activeSessionId, 'utf8');
    }
  }

  /**
   * Save a session to disk
   */
  private saveSession(session: Session): void {
    const filePath = path.join(this.sessionsDir, `${session.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf8');
  }

  /**
   * Create a new session
   */
  createSession(title: string = 'New Session'): Session {
    const session: Session = {
      id: Date.now().toString(),
      title,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    };

    this.sessions.set(session.id, session);
    this.saveSession(session);

    // Set as active session
    this.activeSessionId = session.id;
    this.saveActiveSession();

    return session;
  }

  /**
   * Get all sessions
   */
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );
  }

  /**
   * Get a session by ID
   */
  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  /**
   * Get the active session
   */
  getActiveSession(): Session | null {
    if (!this.activeSessionId) {
      return null;
    }
    return this.getSession(this.activeSessionId) || null;
  }

  /**
   * Set the active session
   */
  setActiveSession(id: string): boolean {
    if (this.sessions.has(id)) {
      this.activeSessionId = id;
      this.saveActiveSession();
      return true;
    }
    return false;
  }

  /**
   * Delete a session
   */
  deleteSession(id: string): boolean {
    if (this.sessions.delete(id)) {
      const filePath = path.join(this.sessionsDir, `${id}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // If deleted session was active, set active to null
      if (this.activeSessionId === id) {
        this.activeSessionId = null;
        if (fs.existsSync(this.activeSessionFile)) {
          fs.unlinkSync(this.activeSessionFile);
        }
      }

      return true;
    }
    return false;
  }

  /**
   * Add a message to a session
   */
  addMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'tool',
    content: string,
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messages.push({
        role,
        content,
        timestamp: new Date(),
      });
      session.updatedAt = new Date();
      this.saveSession(session);
      return true;
    }
    return false;
  }

  /**
   * Update a session's title
   */
  updateSessionTitle(id: string, title: string): boolean {
    const session = this.sessions.get(id);
    if (session) {
      session.title = title;
      session.updatedAt = new Date();
      this.saveSession(session);
      return true;
    }
    return false;
  }
}

/**
 * Global session store instance
 */
let sessionStoreInstance: SessionStore | null = null;

/**
 * Get the global session store instance
 */
export function getSessionStore(baseDir?: string): SessionStore {
  if (!sessionStoreInstance) {
    sessionStoreInstance = new SessionStore(baseDir);
  }
  return sessionStoreInstance;
}
