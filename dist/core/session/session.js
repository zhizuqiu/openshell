/**
 * Session Management Module
 *
 * This module provides session management functionality for the OpenShell CLI tool.
 */
import fs from 'fs';
import path from 'path';
/**
 * Session storage service
 */
export class SessionStore {
    sessionsDir;
    activeSessionFile;
    sessions = new Map();
    activeSessionId = null;
    constructor(baseDir) {
        // Use default directory if none provided
        const defaultDir = path.join(process.env['HOME'] || '', '.openshell', 'sessions');
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
    ensureDirectoryExists() {
        if (!fs.existsSync(this.sessionsDir)) {
            fs.mkdirSync(this.sessionsDir, { recursive: true });
        }
    }
    /**
     * Load sessions from disk
     */
    loadSessions() {
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
                    });
                    this.sessions.set(session.id, session);
                }
                catch (error) {
                    console.error(`Failed to load session ${file}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }
    }
    /**
     * Load active session from disk
     */
    loadActiveSession() {
        if (fs.existsSync(this.activeSessionFile)) {
            try {
                const activeSessionId = fs
                    .readFileSync(this.activeSessionFile, 'utf8')
                    .trim();
                if (activeSessionId && this.sessions.has(activeSessionId)) {
                    this.activeSessionId = activeSessionId;
                }
            }
            catch (error) {
                console.error(`Failed to load active session: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    /**
     * Save active session to disk
     */
    saveActiveSession() {
        if (this.activeSessionId) {
            fs.writeFileSync(this.activeSessionFile, this.activeSessionId, 'utf8');
        }
    }
    /**
     * Save a session to disk
     */
    saveSession(session) {
        const filePath = path.join(this.sessionsDir, `${session.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf8');
    }
    /**
     * Create a new session
     */
    createSession(title = 'New Session') {
        const session = {
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
    getAllSessions() {
        return Array.from(this.sessions.values()).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }
    /**
     * Get a session by ID
     */
    getSession(id) {
        return this.sessions.get(id);
    }
    /**
     * Get the active session
     */
    getActiveSession() {
        if (!this.activeSessionId) {
            return null;
        }
        return this.getSession(this.activeSessionId) || null;
    }
    /**
     * Set the active session
     */
    setActiveSession(id) {
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
    deleteSession(id) {
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
    addMessage(sessionId, role, content) {
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
    updateSessionTitle(id, title) {
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
let sessionStoreInstance = null;
/**
 * Get the global session store instance
 */
export function getSessionStore(baseDir) {
    if (!sessionStoreInstance) {
        sessionStoreInstance = new SessionStore(baseDir);
    }
    return sessionStoreInstance;
}
//# sourceMappingURL=session.js.map