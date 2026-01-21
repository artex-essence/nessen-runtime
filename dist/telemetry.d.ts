/**
 * telemetry.ts
 *
 * Lightweight metrics collection system tracking request throughput, timing percentiles,
 * system resource usage, and event loop health. Uses atomic snapshot pattern to enable
 * lock-free concurrent reads from health endpoints while maintaining accurate metrics.
 *
 * Prevents memory leaks through:
 * - Bounded request timing history (1000 recent requests)
 * - Proper interval cleanup with unref() for non-blocking monitoring
 * - Automatic old entry removal
 *
 * @module telemetry
 */
/**
 * Telemetry sink for exporting metrics to external systems.
 */
export interface TelemetrySink {
    /**
     * Record a counter increment.
     */
    incrementCounter(name: string, value: number, tags?: Record<string, string>): void;
    /**
     * Record a timing measurement.
     */
    recordTiming(name: string, durationMs: number, tags?: Record<string, string>): void;
    /**
     * Record a gauge value.
     */
    recordGauge(name: string, value: number, tags?: Record<string, string>): void;
}
/**
 * No-op telemetry sink (default).
 */
export declare class NoOpTelemetrySink implements TelemetrySink {
    incrementCounter(): void;
    recordTiming(): void;
    recordGauge(): void;
}
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
 * Telemetry collector providing metrics snapshots for monitoring.
 *
 * Tracks request metrics and system health using bounded data structures
 * to prevent memory growth in long-running processes. Uses atomic snapshot
 * pattern: a single snapshot is atomically replaced, allowing concurrent
 * reads without locks.
 *
 * Implements snapshot caching (100ms TTL) to avoid expensive percentile
 * calculations on every health check.
 *
 * Key features:
 * - Bounded history: keeps only last 1000 requests for percentile calculation
 * - Lock-free snapshots: uses atomic replacement pattern for safe reads
 * - Snapshot caching: 100ms TTL prevents expensive recalculation on health checks
 * - Event loop monitoring: detects when event loop is delayed
 * - CPU/Memory tracking: system resource usage over time
 * - Proper cleanup: interval uses unref() and is stored for cleanup
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
    private monitoringInterval;
    private cachedSnapshot;
    private lastSnapshotTime;
    private readonly snapshotCacheTtlMs;
    private readonly sink;
    private totalResponseBytes;
    constructor(sink?: TelemetrySink);
    /**
     * Records the start of a request.
     * Increments total request count and active request counter.
     */
    requestStart(): void;
    /**
     * Records the end of a request with timing and response size.
     *
     * Decrements active counter and adds timing to history. Old entries are
     * automatically removed to maintain bounded memory usage.
     *
     * @param startTime - When request started (used to calculate duration)
     * @param responseBytes - Size of response body in bytes
     */
    requestEnd(startTime: number, responseBytes?: number): void;
    /**
     * Gets the current telemetry snapshot (safe for concurrent reads).
     *
     * Returns the most recent snapshot. Safe to call from multiple threads
     * without locks due to atomic reference replacement pattern.
     *
     * Uses caching (100ms TTL) to avoid expensive percentile calculation
     * on every health check. Frequently called endpoints benefit from this caching.
     *
     * @returns Current telemetry snapshot (may be cached)
     */
    getSnapshot(): TelemetrySnapshot;
    /**
     * Refreshes the telemetry snapshot.
     *
     * Should be called periodically (or on-demand when snapshot freshness matters).
     * Recalculates percentiles, system metrics, and rebuilds the snapshot.
     * This is relatively expensive (O(n log n) percentile calculation).
     *
     * Note: health endpoints should cache this periodically rather than
     * calling on every request.
     */
    refreshSnapshot(): void;
    /**
     * Stops the telemetry system and cleans up resources.
     *
     * Must be called during shutdown to prevent resource leaks.
     * Clears the event loop monitoring interval.
     */
    shutdown(): void;
    /**
     * Builds a snapshot of current telemetry state.
     *
     * Calculates percentiles (O(n) quickselect), reads system metrics, and
     * compiles all data into an immutable snapshot object. Should not
     * be called on every request (cache snapshots).
     *
     * @returns Immutable snapshot of current metrics
     */
    private buildSnapshot;
    /**
     * Calculates CPU usage as a percentage of elapsed time.
     *
     * Reads the process CPU usage and compares with previous reading to
     * calculate percentage usage over the interval. Result is bounded to 0-100%.
     *
     * @returns CPU usage percentage (0-100)
     */
    private calculateCpuUsage;
    /**
     * Starts event loop lag monitoring.
     *
     * Monitors how long it takes for setInterval callbacks to fire.
     * If event loop is under load, callbacks are delayed.
     * Uses unref() to prevent this monitoring from keeping the process alive.
     *
     * Interval reference is stored so it can be cleaned up on shutdown.
     */
    private startEventLoopMonitoring;
}
/**
 * Calculate percentile from sorted array (old implementation, kept for reference).
 *
 * @deprecated Use quickselectPercentile for better performance
 * Kept for reference: this was O(n log n) due to sorting.
 * Quickselect achieves O(n) by avoiding full sort.
 */
//# sourceMappingURL=telemetry.d.ts.map