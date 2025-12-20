"use strict";
/**
 * state.ts
 * Runtime state machine: STARTING -> READY -> DEGRADED/DRAINING -> STOPPING
 * Deterministic transitions, no global mutable state leakage.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateManager = void 0;
/**
 * Manages runtime state with deterministic transitions.
 * Thread-safe via single-writer pattern (external coordination required).
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
    get uptimeMs() {
        return Date.now() - this._startTime;
    }
    /**
     * Transition to new state. Returns true if allowed, false otherwise.
     */
    transition(to) {
        const from = this._current;
        if (!this.isValidTransition(from, to)) {
            return false;
        }
        this._current = to;
        this._history.push({ from, to, timestamp: Date.now() });
        return true;
    }
    /**
     * Check if state transition is valid per state machine rules.
     */
    isValidTransition(from, to) {
        // Prevent no-op
        if (from === to)
            return false;
        // Valid transitions
        const allowed = {
            STARTING: ['READY', 'STOPPING'],
            READY: ['DEGRADED', 'DRAINING', 'STOPPING'],
            DEGRADED: ['READY', 'DRAINING', 'STOPPING'],
            DRAINING: ['STOPPING'],
            STOPPING: [],
        };
        return allowed[from]?.includes(to) ?? false;
    }
    /**
     * Check if runtime should accept new requests.
     */
    canAcceptRequests() {
        return this._current === 'READY' || this._current === 'DEGRADED';
    }
    /**
     * Check if runtime is ready (for /ready endpoint).
     */
    isReady() {
        return this._current === 'READY';
    }
    /**
     * Check if runtime is alive (for /health liveness).
     */
    isAlive() {
        return this._current !== 'STOPPING';
    }
    /**
     * Get recent state history (last 10 transitions).
     */
    getHistory() {
        return this._history.slice(-10);
    }
}
exports.StateManager = StateManager;
//# sourceMappingURL=state.js.map