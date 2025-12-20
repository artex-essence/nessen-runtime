/**
 * telemetry.ts
 * Lightweight metrics: request counters, timers, memory/CPU snapshots, event-loop lag.
 * Single-writer/atomic snapshot for safe concurrent reads.
 */

import { performance } from 'perf_hooks';
import { cpuUsage, memoryUsage } from 'process';

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

interface RequestTiming {
  durationMs: number;
  responseBytes: number;
}

/**
 * Telemetry collector with atomic snapshot replacement.
 */
export class Telemetry {
  private requestsTotal = 0;
  private requestsActive = 0;
  private recentTimings: RequestTiming[] = [];
  private readonly maxTimings = 1000; // Keep last 1000 for percentiles
  private eventLoopLagMs = 0;
  private lastCpuUsage = cpuUsage();
  private lastCpuTime = performance.now();

  private snapshot: TelemetrySnapshot;

  constructor() {
    this.snapshot = this.buildSnapshot();
    this.startEventLoopMonitoring();
  }

  /**
   * Record request start.
   */
  requestStart(): void {
    this.requestsTotal++;
    this.requestsActive++;
  }

  /**
   * Record request end with timing and response size.
   */
  requestEnd(startTime: number, responseBytes: number = 0): void {
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
  getSnapshot(): TelemetrySnapshot {
    return this.snapshot;
  }

  /**
   * Refresh snapshot (call periodically or on-demand).
   */
  refreshSnapshot(): void {
    this.snapshot = this.buildSnapshot();
  }

  /**
   * Build telemetry snapshot from current state.
   */
  private buildSnapshot(): TelemetrySnapshot {
    // Optimize: only sort if we have timings
    let p50 = 0, p95 = 0, p99 = 0;
    if (this.recentTimings.length > 0) {
      const timings = this.recentTimings.map(t => t.durationMs).sort((a, b) => a - b);
      p50 = percentile(timings, 50);
      p95 = percentile(timings, 95);
      p99 = percentile(timings, 99);
    }

    const mem = memoryUsage();
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
  private calculateCpuUsage(): number {
    const now = performance.now();
    const currentCpu = cpuUsage();

    const elapsed = now - this.lastCpuTime; // ms
    const userDiff = (currentCpu.user - this.lastCpuUsage.user) / 1000; // convert μs to ms
    const systemDiff = (currentCpu.system - this.lastCpuUsage.system) / 1000;

    this.lastCpuUsage = currentCpu;
    this.lastCpuTime = now;

    if (elapsed === 0) return 0;

    const cpuPercent = ((userDiff + systemDiff) / elapsed) * 100;
    return Math.round(Math.min(100, Math.max(0, cpuPercent)));
  }

  /**
   * Start event-loop lag monitoring using setInterval.
   * Uses unref() to prevent keeping process alive.
   */
  private startEventLoopMonitoring(): void {
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

/**
 * Calculate percentile from sorted array.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;

  const index = Math.ceil((sorted.length * p) / 100) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))] ?? 0;
}
