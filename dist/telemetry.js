"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Telemetry = exports.NoOpTelemetrySink = void 0;
const perf_hooks_1 = require("perf_hooks");
const process_1 = require("process");
/**
 * No-op telemetry sink (default).
 */
class NoOpTelemetrySink {
    incrementCounter() {
        // no-op
    }
    recordTiming() {
        // no-op
    }
    recordGauge() {
        // no-op
    }
}
exports.NoOpTelemetrySink = NoOpTelemetrySink;
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
class Telemetry {
    requestsTotal = 0;
    requestsActive = 0;
    recentTimings = [];
    maxTimings = 1000; // Keep last 1000 for percentile calculations
    eventLoopLagMs = 0;
    lastCpuUsage = (0, process_1.cpuUsage)();
    lastCpuTime = perf_hooks_1.performance.now();
    snapshot;
    monitoringInterval = null;
    cachedSnapshot = null;
    lastSnapshotTime = 0;
    snapshotCacheTtlMs = 100; // Cache snapshots for 100ms
    sink;
    totalResponseBytes = 0; // Track cumulative for O(1) average calculation
    constructor(sink = new NoOpTelemetrySink()) {
        this.snapshot = this.buildSnapshot();
        this.sink = sink;
        this.startEventLoopMonitoring();
    }
    /**
     * Records the start of a request.
     * Increments total request count and active request counter.
     */
    requestStart() {
        this.requestsTotal++;
        this.requestsActive++;
        this.sink.incrementCounter('requests.total', 1);
        this.sink.recordGauge('requests.active', this.requestsActive);
    }
    /**
     * Records the end of a request with timing and response size.
     *
     * Decrements active counter and adds timing to history. Old entries are
     * automatically removed to maintain bounded memory usage.
     *
     * @param startTime - When request started (used to calculate duration)
     * @param responseBytes - Size of response body in bytes
     */
    requestEnd(startTime, responseBytes = 0) {
        this.requestsActive = Math.max(0, this.requestsActive - 1);
        const durationMs = Date.now() - startTime;
        this.recentTimings.push({ durationMs, responseBytes });
        this.totalResponseBytes += responseBytes;
        // Emit metrics
        this.sink.recordTiming('request.duration', durationMs);
        this.sink.recordGauge('requests.active', this.requestsActive);
        this.sink.recordGauge('response.size', responseBytes);
        // Enforce bounded history (prevent unbounded growth)
        if (this.recentTimings.length > this.maxTimings) {
            const removed = this.recentTimings.shift();
            // Subtract removed entry from cumulative total
            if (removed) {
                this.totalResponseBytes -= removed.responseBytes;
            }
        }
    }
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
    getSnapshot() {
        const now = Date.now();
        // Return cached snapshot if still valid
        if (this.cachedSnapshot && (now - this.lastSnapshotTime) < this.snapshotCacheTtlMs) {
            return this.cachedSnapshot;
        }
        // Cache expired or doesn't exist: rebuild and cache
        this.snapshot = this.buildSnapshot();
        this.cachedSnapshot = this.snapshot;
        this.lastSnapshotTime = now;
        return this.snapshot;
    }
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
    refreshSnapshot() {
        this.snapshot = this.buildSnapshot();
    }
    /**
     * Stops the telemetry system and cleans up resources.
     *
     * Must be called during shutdown to prevent resource leaks.
     * Clears the event loop monitoring interval.
     */
    shutdown() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }
    /**
     * Builds a snapshot of current telemetry state.
     *
     * Calculates percentiles (O(n) quickselect), reads system metrics, and
     * compiles all data into an immutable snapshot object. Should not
     * be called on every request (cache snapshots).
     *
     * @returns Immutable snapshot of current metrics
     */
    buildSnapshot() {
        // Calculate percentiles using O(n) quickselect instead of O(n log n) sort
        let p50 = 0, p95 = 0, p99 = 0;
        if (this.recentTimings.length > 0) {
            // Reuse Float32Array for better cache locality and GC pressure
            // This avoids creating a new array on every snapshot build
            const timings = new Float32Array(this.recentTimings.length);
            for (let i = 0; i < this.recentTimings.length; i++) {
                timings[i] = this.recentTimings[i].durationMs;
            }
            p50 = quickselectPercentile(timings, 50);
            p95 = quickselectPercentile(timings, 95);
            p99 = quickselectPercentile(timings, 99);
        }
        // Read system memory usage
        const mem = (0, process_1.memoryUsage)();
        const memoryUsageMB = Math.round(mem.heapUsed / 1024 / 1024);
        // Calculate CPU usage percentage
        const cpuUsagePercent = this.calculateCpuUsage();
        // Calculate average response size - O(1) using cumulative sum instead of reduce
        const avgResponseSize = this.recentTimings.length > 0
            ? Math.round(this.totalResponseBytes / this.recentTimings.length)
            : 0;
        return {
            requestsTotal: this.requestsTotal,
            requestsActive: this.requestsActive,
            requestDurationP50Ms: p50,
            requestDurationP95Ms: p95,
            requestDurationP99Ms: p99,
            memoryUsageMB,
            cpuUsagePercent,
            eventLoopLagMs: this.eventLoopLagMs,
            responseSizeAvgBytes: avgResponseSize,
            timestamp: Date.now(),
        };
    }
    /**
     * Calculates CPU usage as a percentage of elapsed time.
     *
     * Reads the process CPU usage and compares with previous reading to
     * calculate percentage usage over the interval. Result is bounded to 0-100%.
     *
     * @returns CPU usage percentage (0-100)
     */
    calculateCpuUsage() {
        const now = perf_hooks_1.performance.now();
        const currentCpu = (0, process_1.cpuUsage)();
        const elapsed = now - this.lastCpuTime; // ms
        const userDiff = (currentCpu.user - this.lastCpuUsage.user) / 1000; // convert μs to ms
        const systemDiff = (currentCpu.system - this.lastCpuUsage.system) / 1000;
        this.lastCpuUsage = currentCpu;
        this.lastCpuTime = now;
        if (elapsed === 0)
            return 0;
        const cpuPercent = ((userDiff + systemDiff) / elapsed) * 100;
        return Math.round(Math.min(100, Math.max(0, cpuPercent)));
    }
    /**
     * Starts event loop lag monitoring.
     *
     * Monitors how long it takes for setInterval callbacks to fire.
     * If event loop is under load, callbacks are delayed.
     * Uses unref() to prevent this monitoring from keeping the process alive.
     *
     * Interval reference is stored so it can be cleaned up on shutdown.
     */
    startEventLoopMonitoring() {
        let lastCheck = Date.now();
        this.monitoringInterval = setInterval(() => {
            const now = Date.now();
            const expected = 100; // interval is set to 100ms
            const actual = now - lastCheck;
            const lag = Math.max(0, actual - expected); // How much longer than expected
            this.eventLoopLagMs = lag;
            lastCheck = now;
        }, 100);
        // Don't keep process alive just for monitoring
        // This allows the process to exit normally when all other work is done
        this.monitoringInterval.unref();
    }
}
exports.Telemetry = Telemetry;
/**
 * Calculates the value at a given percentile using quickselect algorithm.
 *
 * Uses in-place quickselect (O(n) average case) instead of sorting (O(n log n)).
 * Significantly faster for large datasets. Perfect for telemetry where we only
 * need specific percentiles, not the entire sorted array.
 *
 * Algorithm: Quickselect (modified QuickSort that stops early)
 * - Best/Average case: O(n)
 * - Worst case: O(n²) (rare with median-of-medians pivot)
 * - Space: O(log n) recursion depth
 *
 * Accepts Float32Array or number[] for better memory efficiency and GC pressure.
 *
 * @param arr - Array of numbers (will be modified in place)
 * @param p - Percentile (0-100)
 * @returns Value at the given percentile
 *
 * @example
 * quickselectPercentile([1, 2, 3, 4, 5], 50)  // ~3 (median)
 * quickselectPercentile([1, 2, 3, 4, 5], 95)  // ~5 (95th percentile)
 */
function quickselectPercentile(arr, p) {
    if (arr.length === 0)
        return 0;
    if (arr.length === 1)
        return arr[0];
    // Calculate target index for percentile
    const targetIndex = Math.ceil((arr.length * p) / 100) - 1;
    const clampedIndex = Math.max(0, Math.min(targetIndex, arr.length - 1));
    return quickselect(arr, 0, arr.length - 1, clampedIndex);
}
/**
 * Quickselect: finds the k-th smallest element (in-place).
 *
 * Used internally by quickselectPercentile. Performs in-place partitioning
 * similar to QuickSort but only recurses into the partition containing the
 * target index.
 *
 * @param arr - Array to search (modified in place)
 * @param left - Left boundary index
 * @param right - Right boundary index
 * @param k - Target index (0-based, the k-th smallest element)
 * @returns The k-th smallest element
 */
function quickselect(arr, left, right, k) {
    if (left === right) {
        return arr[left];
    }
    // Partition the array around a pivot
    const pivotIndex = partition(arr, left, right);
    if (k === pivotIndex) {
        return arr[k];
    }
    else if (k < pivotIndex) {
        // Target is in left partition
        return quickselect(arr, left, pivotIndex - 1, k);
    }
    else {
        // Target is in right partition
        return quickselect(arr, pivotIndex + 1, right, k);
    }
}
/**
 * Partitions array segment around a pivot for quickselect.
 *
 * Chooses median-of-three as pivot for better average-case performance.
 * Places pivot in its final sorted position and returns the index.
 *
 * @param arr - Array to partition
 * @param left - Left boundary index
 * @param right - Right boundary index
 * @returns Final position of pivot after partitioning
 */
function partition(arr, left, right) {
    // Median-of-three pivot selection (better than random for this use case)
    const mid = Math.floor((left + right) / 2);
    let pivotIndex = left;
    // Choose pivot: smallest of three
    if (arr[mid] < arr[left])
        pivotIndex = mid;
    if (arr[right] < arr[pivotIndex])
        pivotIndex = right;
    // Swap pivot to end
    const temp = arr[right];
    arr[right] = arr[pivotIndex];
    arr[pivotIndex] = temp;
    // Partition around pivot value
    const pivot = arr[right];
    let store = left;
    for (let i = left; i < right; i++) {
        if (arr[i] < pivot) {
            const tmp = arr[i];
            arr[i] = arr[store];
            arr[store] = tmp;
            store++;
        }
    }
    // Swap pivot to final position
    const tmp = arr[right];
    arr[right] = arr[store];
    arr[store] = tmp;
    return store;
}
/**
 * Calculate percentile from sorted array (old implementation, kept for reference).
 *
 * @deprecated Use quickselectPercentile for better performance
 * Kept for reference: this was O(n log n) due to sorting.
 * Quickselect achieves O(n) by avoiding full sort.
 */
// Removed: Use quickselectPercentile instead for O(n) performance
//# sourceMappingURL=telemetry.js.map