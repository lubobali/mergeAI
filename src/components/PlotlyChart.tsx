"use client";

import { useEffect, useRef } from "react";
import type { ChartConfig } from "@/lib/types";

// MergeAI theme colors
const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

interface PlotlyChartProps {
  config: ChartConfig;
}

export default function PlotlyChart({ config }: PlotlyChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;

    // Dynamic import of plotly.js-dist-min (client-side only, avoids SSR)
    import("plotly.js-dist-min").then((Plotly) => {
      if (!chartRef.current) return;

      const { data, layout } = buildPlotlyData(config);

      Plotly.newPlot(el, data, layout, {
        displayModeBar: true,
        responsive: true,
        displaylogo: false,
      });
    });

    return () => {
      import("plotly.js-dist-min").then((Plotly) => {
        Plotly.purge(el);
      });
    };
  }, [config]);

  return <div ref={chartRef} style={{ width: "100%", height: "400px" }} />;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPlotlyData(config: ChartConfig): { data: any[]; layout: Record<string, unknown> } {
  const darkLayout = {
    paper_bgcolor: "#111d33",
    plot_bgcolor: "#111d33",
    font: { color: "#94a3b8", family: "system-ui, sans-serif" },
    margin: { l: 60, r: 30, t: 50, b: 60 },
    height: 400,
    xaxis: { gridcolor: "rgba(30,58,95,0.25)", zerolinecolor: "#1e3a5f" },
    yaxis: { gridcolor: "rgba(30,58,95,0.25)", zerolinecolor: "#1e3a5f" },
    hoverlabel: { bgcolor: "#0c1929", bordercolor: "#2563eb", font: { color: "#e2e8f0" } },
    showlegend: false,
    title: { text: config.title, font: { size: 16, color: "#e2e8f0" } },
  };

  switch (config.type) {
    case "bar": {
      const data = config.series.map((s, i) => ({
        type: "bar",
        x: config.xValues,
        y: s.values,
        name: s.name,
        marker: { color: COLORS[i % COLORS.length] },
        hovertemplate: "<b>%{x}</b><br>%{y:,.2f}<extra></extra>",
      }));
      const layout = {
        ...darkLayout,
        showlegend: config.series.length > 1,
        xaxis: {
          ...darkLayout.xaxis,
          tickangle: config.xValues.length > 6 ? -45 : 0,
        },
      };
      return { data, layout };
    }

    case "line": {
      const data = config.series.map((s, i) => ({
        type: "scatter",
        mode: "lines+markers",
        x: config.xValues,
        y: s.values,
        name: s.name,
        line: { color: COLORS[i % COLORS.length], width: 2 },
        marker: { size: 6 },
        hovertemplate: "<b>%{x}</b><br>%{y:,.2f}<extra></extra>",
      }));
      const layout = {
        ...darkLayout,
        showlegend: config.series.length > 1,
      };
      return { data, layout };
    }

    case "pie": {
      const data = [
        {
          type: "pie",
          labels: config.xValues.map(String),
          values: config.series[0]?.values || [],
          hole: 0.35,
          marker: { colors: COLORS },
          textinfo: "label+percent",
          hovertemplate: "<b>%{label}</b><br>%{value:,.2f} (%{percent})<extra></extra>",
        },
      ];
      const layout = {
        ...darkLayout,
        showlegend: true,
        legend: { font: { color: "#94a3b8" } },
      };
      return { data, layout };
    }

    case "scatter": {
      const data = [
        {
          type: "scatter",
          mode: "markers",
          x: config.xValues.map(Number),
          y: config.series[0]?.values || [],
          marker: { color: COLORS[0], size: 8, opacity: 0.7 },
          hovertemplate: `<b>${config.xColumn}</b>: %{x:,.2f}<br><b>${config.yColumns[0]}</b>: %{y:,.2f}<extra></extra>`,
        },
      ];
      const layout = {
        ...darkLayout,
        xaxis: { ...darkLayout.xaxis, title: { text: config.xColumn, font: { color: "#94a3b8" } } },
        yaxis: { ...darkLayout.yaxis, title: { text: config.yColumns[0], font: { color: "#94a3b8" } } },
      };
      return { data, layout };
    }

    case "heatmap": {
      const data = [
        {
          type: "heatmap",
          x: config.xValues.map(String),
          y: config.series.map((s) => s.name),
          z: config.series.map((s) => s.values),
          colorscale: "RdYlGn",
          hovertemplate: "<b>%{x}</b> / <b>%{y}</b><br>%{z:,.2f}<extra></extra>",
        },
      ];
      return { data, layout: darkLayout };
    }

    default:
      return { data: [], layout: darkLayout };
  }
}
