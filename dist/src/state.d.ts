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
export type RuntimeState = 'STARTING' | 'READY' | 'DEGRADED' | 'DRAINING' | 'STOPPING';
export interface StateTransition {
    readonly from: RuntimeState;
    readonly to: RuntimeState;
    readonly timestamp: number;
}
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
export declare class StateManager {
    private _current;
    private _history;
    private readonly _startTime;
    get current(): RuntimeState;
    get startTime(): number;
    /**
     * Get runtime uptime in milliseconds since creation.
     */
    get uptimeMs(): number;
    /**
     * Transition to a new state if valid.
     *
     * Validates that the transition is allowed per state machine rules,
     * updates the current state, and records the transition in bounded history.
     *
     * @param to - Target state to transition to
     * @returns true if transition was allowed, false if invalid
     */
    transition(to: RuntimeState): boolean;
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
    private isValidTransition;
    /**
     * Checks if the runtime should accept new requests.
     *
     * Returns true if the runtime is in READY or DEGRADED states.
     * DEGRADED state allows requests to continue while degraded functionality
     * can be announced via the health endpoint.
     *
     * @returns true if new requests should be accepted
     */
    canAcceptRequests(): boolean;
    /**
     * Checks if the runtime is fully ready.
     *
     * Used by /ready endpoint for orchestration readiness probes.
     * Returns true only in READY state.
     *
     * @returns true if runtime is fully ready
     */
    isReady(): boolean;
    /**
     * Checks if the runtime is alive.
     *
     * Used by /health endpoint for liveness probes.
     * Returns false only when in STOPPING state.
     *
     * @returns true if runtime is alive
     */
    isAlive(): boolean;
    /**
     * Gets recent state transition history (most recent first).
     *
     * Returns the most recent transitions, useful for debugging and audit logs.
     * Limited to the most recent 10 transitions to keep output reasonable.
     *
     * @returns Array of recent state transitions (up to 10 most recent)
     */
    getHistory(): StateTransition[];
}
//# sourceMappingURL=state.d.ts.map