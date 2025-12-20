/**
 * telemetry.ts
 * Lightweight metrics: request counters, timers, memory/CPU snapshots, event-loop lag.
 * Single-writer/atomic snapshot for safe concurrent reads.
 */
export interface TelemetrySnapshot {
    readonly requestsTotal: number;
    readonly requestsActive: number;
    readonly requestDurationP50Ms: number;
    readonly requestDurationP95Ms: number;
    readonly requestDurationP99Ms: number;
    readonly memoryUsageMB: number;
    readonly cpuUsagePercent: number;
    readonly eventLoopLagMs: number;
    readonly responseSizeAvgBytes: number;
    readonly timestamp: number;
}
/**
 * Telemetry collector with atomic snapshot replacement.
 */
export declare class Telemetry {
    private requestsTotal;
    private requestsActive;
    private recentTimings;
    private readonly maxTimings;
    private eventLoopLagMs;
    private lastCpuUsage;
    private lastCpuTime;
    private snapshot;
    constructor();
    /**
     * Record request start.
     */
    requestStart(): void;
    /**
     * Record request end with timing and response size.
     */
    requestEnd(startTime: number, responseBytes?: number): void;
    /**
     * Get current telemetry snapshot (safe for concurrent reads).
     */
    getSnapshot(): TelemetrySnapshot;
    /**
     * Refresh snapshot (call periodically or on-demand).
     */
    refreshSnapshot(): void;
    /**
     * Build telemetry snapshot from current state.
     */
    private buildSnapshot;
    /**
     * Calculate CPU usage percentage (simple heuristic).
     */
    private calculateCpuUsage;
    /**
     * Start event-loop lag monitoring using setInterval.
     * Uses unref() to prevent keeping process alive.
     */
    private startEventLoopMonitoring;
}
//# sourceMappingURL=telemetry.d.ts.map