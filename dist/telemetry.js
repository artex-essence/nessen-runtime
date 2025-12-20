"use strict";
/**
 * telemetry.ts
 * Lightweight metrics: request counters, timers, memory/CPU snapshots, event-loop lag.
 * Single-writer/atomic snapshot for safe concurrent reads.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Telemetry = void 0;
const perf_hooks_1 = require("perf_hooks");
const process_1 = require("process");
/**
 * Telemetry collector with atomic snapshot replacement.
 */
class Telemetry {
    requestsTotal = 0;
    requestsActive = 0;
    recentTimings = [];
    maxTimings = 1000; // Keep last 1000 for percentiles
    eventLoopLagMs = 0;
    lastCpuUsage = (0, process_1.cpuUsage)();
    lastCpuTime = perf_hooks_1.performance.now();
    snapshot;
    constructor() {
        this.snapshot = this.buildSnapshot();
        this.startEventLoopMonitoring();
    }
    /**
     * Record request start.
     */
    requestStart() {
        this.requestsTotal++;
        this.requestsActive++;
    }
    /**
     * Record request end with timing and response size.
     */
    requestEnd(startTime, responseBytes = 0) {
        this.requestsActive = Math.max(0, this.requestsActive - 1);
        const durationMs = Date.now() - startTime;
        this.recentTimings.push({ durationMs, responseBytes });
        if (this.recentTimings.length > this.maxTimings) {
            this.recentTimings.shift();
        }
    }
    /**
     * Get current telemetry snapshot (safe for concurrent reads).
     */
    getSnapshot() {
        return this.snapshot;
    }
    /**
     * Refresh snapshot (call periodically or on-demand).
     */
    refreshSnapshot() {
        this.snapshot = this.buildSnapshot();
    }
    /**
     * Build telemetry snapshot from current state.
     */
    buildSnapshot() {
        // Optimize: only sort if we have timings
        let p50 = 0, p95 = 0, p99 = 0;
        if (this.recentTimings.length > 0) {
            const timings = this.recentTimings.map(t => t.durationMs).sort((a, b) => a - b);
            p50 = percentile(timings, 50);
            p95 = percentile(timings, 95);
            p99 = percentile(timings, 99);
        }
        const mem = (0, process_1.memoryUsage)();
        const memoryUsageMB = Math.round(mem.heapUsed / 1024 / 1024);
        const cpuUsagePercent = this.calculateCpuUsage();
        // Calculate average response size
        const avgResponseSize = this.recentTimings.length > 0
            ? Math.round(this.recentTimings.reduce((sum, t) => sum + t.responseBytes, 0) / this.recentTimings.length)
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
     * Calculate CPU usage percentage (simple heuristic).
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
     * Start event-loop lag monitoring using setInterval.
     * Uses unref() to prevent keeping process alive.
     */
    startEventLoopMonitoring() {
        let lastCheck = Date.now();
        const interval = setInterval(() => {
            const now = Date.now();
            const expected = 100; // interval is 100ms
            const actual = now - lastCheck;
            const lag = Math.max(0, actual - expected);
            this.eventLoopLagMs = lag;
            lastCheck = now;
        }, 100);
        // Don't keep process alive just for monitoring
        interval.unref();
    }
}
exports.Telemetry = Telemetry;
/**
 * Calculate percentile from sorted array.
 */
function percentile(sorted, p) {
    if (sorted.length === 0)
        return 0;
    const index = Math.ceil((sorted.length * p) / 100) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))] ?? 0;
}
//# sourceMappingURL=telemetry.js.map