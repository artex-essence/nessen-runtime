"use strict";
/**
 * state.ts
 *
 * Runtime state machine implementing deterministic transitions.
 * States: STARTING → READY → DEGRADED/DRAINING → STOPPING
 *
 * This module manages the runtime lifecycle state with bounded history tracking
 * to prevent unbounded memory growth. Thread-safe via single-writer pattern.
 *
 * @module state
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateManager = void 0;
// Maximum state transitions to keep in history before truncating
const MAX_HISTORY_SIZE = 100;
/**
 * Manages runtime state machine with bounded history tracking.
 *
 * Implements a deterministic state machine with valid transition rules and
 * tracks recent transitions for debugging. History is bounded to prevent
 * unbounded memory growth in long-running processes.
 *
 * Thread-safe via single-writer pattern (external coordination required
 * if used in multi-threaded contexts).
 */
class StateManager {
    _current = 'STARTING';
    _history = [];
    _startTime = Date.now();
    get current() {
        return this._current;
    }
    get startTime() {
        return this._startTime;
    }
    /**
     * Get runtime uptime in milliseconds since creation.
     */
    get uptimeMs() {
        return Date.now() - this._startTime;
    }
    /**
     * Transition to a new state if valid.
     *
     * Validates that the transition is allowed per state machine rules,
     * updates the current state, and records the transition in bounded history.
     *
     * @param to - Target state to transition to
     * @returns true if transition was allowed, false if invalid
     */
    transition(to) {
        const from = this._current;
        if (!this.isValidTransition(from, to)) {
            return false;
        }
        this._current = to;
        // Add to history
        this._history.push({ from, to, timestamp: Date.now() });
        // Enforce bounded history size (prevent unbounded growth)
        if (this._history.length > MAX_HISTORY_SIZE) {
            this._history = this._history.slice(-MAX_HISTORY_SIZE);
        }
        return true;
    }
    /**
     * Validates whether a state transition is permitted.
     *
     * Defines the state machine rules. Not all transitions are valid;
     * for example, you cannot go directly from DRAINING to READY.
     *
     * @param from - Current state
     * @param to - Desired target state
     * @returns true if transition is allowed
     */
    isValidTransition(from, to) {
        // Prevent identity transitions (no-op)
        if (from === to)
            return false;
        // Define valid transitions per state
        const allowed = {
            STARTING: ['READY', 'STOPPING'],
            READY: ['DEGRADED', 'DRAINING', 'STOPPING'],
            DEGRADED: ['READY', 'DRAINING', 'STOPPING'],
            DRAINING: ['STOPPING'],
            STOPPING: [], // No transitions out of STOPPING
        };
        return allowed[from]?.includes(to) ?? false;
    }
    /**
     * Checks if the runtime should accept new requests.
     *
     * Returns true if the runtime is in READY or DEGRADED states.
     * DEGRADED state allows requests to continue while degraded functionality
     * can be announced via the health endpoint.
     *
     * @returns true if new requests should be accepted
     */
    canAcceptRequests() {
        return this._current === 'READY' || this._current === 'DEGRADED';
    }
    /**
     * Checks if the runtime is fully ready.
     *
     * Used by /ready endpoint for orchestration readiness probes.
     * Returns true only in READY state.
     *
     * @returns true if runtime is fully ready
     */
    isReady() {
        return this._current === 'READY';
    }
    /**
     * Checks if the runtime is alive.
     *
     * Used by /health endpoint for liveness probes.
     * Returns false only when in STOPPING state.
     *
     * @returns true if runtime is alive
     */
    isAlive() {
        return this._current !== 'STOPPING';
    }
    /**
     * Gets recent state transition history (most recent first).
     *
     * Returns the most recent transitions, useful for debugging and audit logs.
     * Limited to the most recent 10 transitions to keep output reasonable.
     *
     * @returns Array of recent state transitions (up to 10 most recent)
     */
    getHistory() {
        return this._history.slice(-10);
    }
}
exports.StateManager = StateManager;
//# sourceMappingURL=state.js.map