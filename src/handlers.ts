/**
 * handlers.ts
 *
 * Request handlers for demo endpoints: home page, health API, and badge generation.
 * Demonstrates response builders, context usage, and security best practices.
 *
 * @module handlers
 */

import type { RequestContext } from './context.js';
import type { RuntimeResponse } from './envelope.js';
import { htmlResponse, svgResponse } from './response.js';
import { escapeHtml } from './utils.js';

/**
 * Handle GET / - Home page with request info.
 */
export function handleHome(ctx: RequestContext, runtimeState: string): RuntimeResponse {
  const requestId = ctx.id;
  const elapsed = Date.now() - ctx.startTime;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nessen Runtime</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; }
    h1 { color: #2563eb; }
    .info { background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0; }
    .label { font-weight: 600; color: #374151; }
    code { background: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>🚀 Nessen Runtime</h1>
  <p>Production-grade minimal Node.js HTTP runtime</p>
  
  <div class="info">
    <div><span class="label">Request ID:</span> <code>${escapeHtml(ctx.id)}</code></div>
    <div><span class="label">Method:</span> <code>${escapeHtml(ctx.method)}</code></div>
    <div><span class="label">Path Info:</span> <code>${escapeHtml(ctx.pathInfo)}</code></div>
    <div><span class="label">Base Path:</span> <code>${escapeHtml(ctx.basePath)}</code></div>
    <div><span class="label">Intent:</span> <code>${escapeHtml(ctx.intent)}</code></div>
    <div><span class="label">Expects:</span> <code>${escapeHtml(ctx.expects)}</code></div>
    <div><span class="label">Is AJAX:</span> <code>${ctx.isAjax}</code></div>
    <div><span class="label">Runtime State:</span> <code>${escapeHtml(runtimeState)}</code></div>
    <div><span class="label">Response Time:</span> <code>${elapsed}ms</code></div>
  </div>

  <h2>Available Routes</h2>
  <ul>
    <li><code>GET /</code> - This page</li>
    <li><code>GET /health</code> - Liveness check</li>
    <li><code>GET /ready</code> - Readiness check</li>
    <li><code>GET /api/health</code> - Detailed health metrics (JSON)</li>
    <li><code>GET /badge/:label/:value.svg</code> - SVG badge generator</li>
  </ul>

  <h2>Examples</h2>
  <p>Try these:</p>
  <ul>
    <li><a href="${ctx.basePath}/api/health">${ctx.basePath}/api/health</a></li>
    <li><a href="${ctx.basePath}/badge/status/operational.svg">${ctx.basePath}/badge/status/operational.svg</a></li>
    <li><a href="${ctx.basePath}/badge/node/v20.svg">${ctx.basePath}/badge/node/v20.svg</a></li>
  </ul>
</body>
</html>`;

  return htmlResponse(html, 200, {}, requestId);
}

/**
 * Handle GET /badge/:label/:value.svg - Generate SVG badge.
 */
export function handleBadge(ctx: RequestContext): RuntimeResponse {
  const { label, value } = ctx.params;

  if (!label || !value) {
    const svg = generateErrorBadge('Invalid params');
    return svgResponse(svg, {}, ctx.id);
  }

  // Security: limit parameter lengths to prevent DoS
  if (label.length > 50 || value.length > 50) {
    const svg = generateErrorBadge('Parameter too long');
    return svgResponse(svg, {}, ctx.id);
  }

  // Remove .svg extension from value if present
  const cleanValue = value.endsWith('.svg') ? value.slice(0, -4) : value;

  const svg = generateBadge(label, cleanValue);
  return svgResponse(svg, {}, ctx.id);
}

/**
 * Generate SVG badge (simple implementation).
 */
function generateBadge(label: string, value: string): string {
  const labelWidth = Math.max(60, label.length * 7);
  const valueWidth = Math.max(60, value.length * 7);
  const totalWidth = labelWidth + valueWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${escapeHtml(label)}: ${escapeHtml(value)}">
  <title>${escapeHtml(label)}: ${escapeHtml(value)}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="#2563eb"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${escapeHtml(label)}</text>
    <text x="${labelWidth / 2}" y="14">${escapeHtml(label)}</text>
    <text x="${labelWidth + valueWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${escapeHtml(value)}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${escapeHtml(value)}</text>
  </g>
</svg>`;
}

/**
 * Generate error badge with error message.
 */
function generateErrorBadge(message: string): string {
  return generateBadge('error', message);
}
