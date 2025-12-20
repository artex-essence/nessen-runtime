/**
 * state.ts
 * Runtime state machine: STARTING -> READY -> DEGRADED/DRAINING -> STOPPING
 * Deterministic transitions, no global mutable state leakage.
 */
export type RuntimeState = 'STARTING' | 'READY' | 'DEGRADED' | 'DRAINING' | 'STOPPING';
export interface StateTransition {
    from: RuntimeState;
    to: RuntimeState;
    timestamp: number;
}
/**
 * Manages runtime state with deterministic transitions.
 * Thread-safe via single-writer pattern (external coordination required).
 */
export declare class StateManager {
    private _current;
    private _history;
    private readonly _startTime;
    get current(): RuntimeState;
    get startTime(): number;
    get uptimeMs(): number;
    /**
     * Transition to new state. Returns true if allowed, false otherwise.
     */
    transition(to: RuntimeState): boolean;
    /**
     * Check if state transition is valid per state machine rules.
     */
    private isValidTransition;
    /**
     * Check if runtime should accept new requests.
     */
    canAcceptRequests(): boolean;
    /**
     * Check if runtime is ready (for /ready endpoint).
     */
    isReady(): boolean;
    /**
     * Check if runtime is alive (for /health liveness).
     */
    isAlive(): boolean;
    /**
     * Get recent state history (last 10 transitions).
     */
    getHistory(): StateTransition[];
}
//# sourceMappingURL=state.d.ts.map