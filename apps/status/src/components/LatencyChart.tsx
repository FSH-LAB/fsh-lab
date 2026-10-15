"use client";

import { useState } from "react";
import type { ServiceMetricPoint } from "@/lib/types";

interface LatencyChartProps {
  points: ServiceMetricPoint[];
  avgLatencyMs: number;
  p95LatencyMs: number;
}

export function LatencyChart({
  points,
  avgLatencyMs,
  p95LatencyMs,
}: LatencyChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<ServiceMetricPoint | null>(
    null,
  );

  if (!points || points.length === 0) {
    return (
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 text-center text-xs text-slate-400">
        Live telemetry accumulating. Awaiting health probe measurements...
      </div>
    );
  }

  const maxLatency = Math.max(...points.map((p) => p.latencyMs), 60);
  const minLatency = Math.min(...points.map((p) => p.latencyMs), 5);
  const range = maxLatency - minLatency || 1;

  const width = 600;
  const height = 120;
  const paddingX = 15;
  const paddingY = 15;

  const svgPoints = points.map((p, idx) => {
    const x =
      points.length === 1
        ? width / 2
        : paddingX + (idx / (points.length - 1)) * (width - paddingX * 2);
    const y =
      height -
      paddingY -
      ((p.latencyMs - minLatency) / range) * (height - paddingY * 2);
    return { x, y, point: p };
  });

  const pathD =
    points.length === 1
      ? `M ${paddingX},${svgPoints[0]?.y.toFixed(1)} L ${width - paddingX},${svgPoints[0]?.y.toFixed(1)}`
      : svgPoints.reduce((acc, curr, idx) => {
          return `${acc} ${idx === 0 ? "M" : "L"} ${curr.x.toFixed(1)},${curr.y.toFixed(1)}`;
        }, "");

  const areaD =
    points.length === 1
      ? `M ${paddingX},${svgPoints[0]?.y.toFixed(1)} L ${width - paddingX},${svgPoints[0]?.y.toFixed(1)} L ${width - paddingX},${height - paddingY} L ${paddingX},${height - paddingY} Z`
      : `${pathD} L ${svgPoints[svgPoints.length - 1]?.x.toFixed(1)},${height - paddingY} L ${svgPoints[0]?.x.toFixed(1)},${height - paddingY} Z`;

  const firstTimestamp = points[0]?.timestamp ?? "";
  const lastTimestamp = points[points.length - 1]?.timestamp ?? "";

  return (
    <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between text-xs gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-300">
            Response Latency Telemetry
          </span>
          {hoveredPoint ? (
            <span className="text-emerald-400 font-mono">
              {hoveredPoint.timestamp} UTC: {hoveredPoint.latencyMs}ms
            </span>
          ) : (
            <span className="text-slate-500">
              {points.length === 1
                ? "Live observation"
                : `${points.length} observed samples`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="text-slate-400">
            Avg: <strong className="text-slate-200">{avgLatencyMs}ms</strong>
          </span>
          <span className="text-slate-400">
            P95: <strong className="text-slate-200">{p95LatencyMs}ms</strong>
          </span>
        </div>
      </div>

      <div className="relative w-full aspect-[600/120]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
        >
          <defs>
            <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1={paddingX}
            y1={paddingY}
            x2={width - paddingX}
            y2={paddingY}
            stroke="#334155"
            strokeDasharray="3 3"
            strokeWidth="0.5"
          />
          <line
            x1={paddingX}
            y1={height - paddingY}
            x2={width - paddingX}
            y2={height - paddingY}
            stroke="#334155"
            strokeDasharray="3 3"
            strokeWidth="0.5"
          />

          {/* Area under curve */}
          <path d={areaD} fill="url(#latencyGradient)" />

          {/* Line curve */}
          <path
            d={pathD}
            fill="none"
            stroke="#10b981"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Hoverable and focusable sample points */}
          {svgPoints.map(({ x, y, point }, i) => (
            <g
              key={i}
              tabIndex={0}
              role="button"
              aria-label={`Sample ${i + 1} of ${svgPoints.length}: ${point.timestamp} UTC, ${point.latencyMs}ms`}
              className="cursor-pointer group outline-none focus:outline-none"
              onMouseEnter={() => setHoveredPoint(point)}
              onMouseLeave={() => setHoveredPoint(null)}
              onFocus={() => setHoveredPoint(point)}
              onBlur={() => setHoveredPoint(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setHoveredPoint(point);
                }
              }}
            >
              <circle
                cx={x}
                cy={y}
                r="3"
                className="fill-emerald-400 opacity-60 group-hover:opacity-100 group-focus:opacity-100 group-hover:r-4 group-focus:r-4 transition-all"
              />
              <circle cx={x} cy={y} r="10" className="fill-transparent" />
            </g>
          ))}
        </svg>
      </div>

      {/* Accessible data table for screen readers */}
      <table className="sr-only">
        <caption>Response Latency Telemetry Samples</caption>
        <thead>
          <tr>
            <th scope="col">Sample</th>
            <th scope="col">Timestamp (UTC)</th>
            <th scope="col">Latency (ms)</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, idx) => (
            <tr key={idx}>
              <td>{idx + 1}</td>
              <td>{p.timestamp}</td>
              <td>{p.latencyMs}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-between text-[11px] text-slate-500 font-mono">
        <span>{firstTimestamp ? `${firstTimestamp} (Start)` : ""}</span>
        <span>
          {points.length > 1
            ? `Telemetry window (${points.length} samples)`
            : "Live ping sample"}
        </span>
        <span>{lastTimestamp ? `${lastTimestamp} (Latest)` : "Just now"}</span>
      </div>
    </div>
  );
}
