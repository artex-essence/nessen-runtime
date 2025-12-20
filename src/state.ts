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
export class StateManager {
  private _current: RuntimeState = 'STARTING';
  private _history: StateTransition[] = [];
  private readonly _startTime: number = Date.now();

  get current(): RuntimeState {
    return this._current;
  }

  get startTime(): number {
    return this._startTime;
  }

  get uptimeMs(): number {
    return Date.now() - this._startTime;
  }

  /**
   * Transition to new state. Returns true if allowed, false otherwise.
   */
  transition(to: RuntimeState): boolean {
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
  private isValidTransition(from: RuntimeState, to: RuntimeState): boolean {
    // Prevent no-op
    if (from === to) return false;

    // Valid transitions
    const allowed: Record<RuntimeState, RuntimeState[]> = {
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
  canAcceptRequests(): boolean {
    return this._current === 'READY' || this._current === 'DEGRADED';
  }

  /**
   * Check if runtime is ready (for /ready endpoint).
   */
  isReady(): boolean {
    return this._current === 'READY';
  }

  /**
   * Check if runtime is alive (for /health liveness).
   */
  isAlive(): boolean {
    return this._current !== 'STOPPING';
  }

  /**
   * Get recent state history (last 10 transitions).
   */
  getHistory(): StateTransition[] {
    return this._history.slice(-10);
  }
}
