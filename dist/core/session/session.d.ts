/**
 * Session Management Module
 *
 * This module provides session management functionality for the OpenShell CLI tool.
 */
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
export declare class SessionStore {
    private sessionsDir;
    private activeSessionFile;
    private sessions;
    private activeSessionId;
    constructor(baseDir?: string);
    /**
     * Ensure the sessions directory exists
     */
    private ensureDirectoryExists;
    /**
     * Load sessions from disk
     */
    private loadSessions;
    /**
     * Load active session from disk
     */
    private loadActiveSession;
    /**
     * Save active session to disk
     */
    private saveActiveSession;
    /**
     * Save a session to disk
     */
    private saveSession;
    /**
     * Create a new session
     */
    createSession(title?: string): Session;
    /**
     * Get all sessions
     */
    getAllSessions(): Session[];
    /**
     * Get a session by ID
     */
    getSession(id: string): Session | undefined;
    /**
     * Get the active session
     */
    getActiveSession(): Session | null;
    /**
     * Set the active session
     */
    setActiveSession(id: string): boolean;
    /**
     * Delete a session
     */
    deleteSession(id: string): boolean;
    /**
     * Add a message to a session
     */
    addMessage(sessionId: string, role: 'user' | 'assistant' | 'tool', content: string): boolean;
    /**
     * Update a session's title
     */
    updateSessionTitle(id: string, title: string): boolean;
}
/**
 * Get the global session store instance
 */
export declare function getSessionStore(baseDir?: string): SessionStore;
