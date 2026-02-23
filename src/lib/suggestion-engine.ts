/**
 * Smart query suggestion engine.
 *
 * Analyzes selected files' columns and detected joins to generate
 * 3-5 valuable, clickable query suggestions. Cross-file suggestions
 * first (the "MERGE in MergeAI"), then single-file.
 *
 * All client-side — instant, no API call.
 */

import {
  categorizeColumn,
  type DetectedJoin,
  type ColumnCategory,
} from "./join-detector";

/* ── Types ──────────────────────────────────────────── */

export interface SuggestedQuery {
  text: string;
  type: "single" | "cross";
}

interface FileInput {
  id: string;
  fileName: string;
  columns: string[];
  columnTypes?: Record<string, string>;
}

interface FileAnalysis {
  id: string;
  fileName: string;
  shortName: string;
  metrics: string[];
  dimensions: string[];
  dates: string[];
  ids: string[];
}

/* ── Helpers ─────────────────────────────────────────── */

/** Shorten file name: "training_and_development_data.csv" → "training" */
function shortName(fileName: string): string {
  return fileName
    .replace(/\.csv$/i, "")
    .split(/[_\-\s]/)[0]
    .toLowerCase();
}

/** Analyze a file's columns by category.
 *  Source of truth: columnTypes from actual data (detected during upload).
 *  Name-based categorization is secondary — a column named "Score"
 *  is only a metric if the real data is numeric.
 */
function analyzeFile(file: FileInput): FileAnalysis {
  const types = file.columnTypes || {};
  const byCategory: Record<ColumnCategory, string[]> = {
    id: [],
    metric: [],
    dimension: [],
    date: [],
    identifier: [],
    other: [],
  };

  for (const col of file.columns) {
    const nameCat = categorizeColumn(col);
    const realType = types[col]; // "number" | "text" | undefined

    // Universal rule: metric ONLY if actual data is numeric
    if (nameCat === "metric") {
      if (realType === "number") {
        byCategory.metric.push(col);
      } else {
        // Name says metric but data is text — demote to dimension
        byCategory.dimension.push(col);
      }
    } else {
      byCategory[nameCat].push(col);
    }
  }

  return {
    id: file.id,
    fileName: file.fileName,
    shortName: shortName(file.fileName),
    metrics: byCategory.metric,
    dimensions: byCategory.dimension,
    dates: byCategory.date,
    ids: byCategory.id,
  };
}

/* ── Suggestion Generator ────────────────────────────── */

/**
 * Generate 3-5 smart query suggestions based on selected files
 * and their detected joins.
 */
export function generateSuggestions(
  files: FileInput[],
  joins: DetectedJoin[]
): SuggestedQuery[] {
  if (files.length === 0) return [];

  const suggestions: SuggestedQuery[] = [];
  const used = new Set<string>(); // track used column names to avoid repetition
  const analyses = files.map(analyzeFile);

  // ── Cross-file suggestions (when 2+ files connected) ──

  if (joins.length > 0 && analyses.length >= 2) {
    for (const join of joins) {
      if (suggestions.length >= 3) break;

      const aFile = analyses.find((a) => a.id === join.fileA.id);
      const bFile = analyses.find((a) => a.id === join.fileB.id);
      if (!aFile || !bFile) continue;

      // Template 1: metric from A + dimension from B
      if (aFile.metrics.length > 0 && bFile.dimensions.length > 0) {
        const metric = pickUnused(aFile.metrics, used);
        const dim = pickUnused(bFile.dimensions, used);
        if (metric && dim) {
          suggestions.push({
            text: `Compare average ${metric} by ${dim}`,
            type: "cross",
          });
          used.add(metric);
          used.add(dim);
        }
      }

      // Template 2: metric from B + dimension from A
      if (bFile.metrics.length > 0 && aFile.dimensions.length > 0) {
        const metric = pickUnused(bFile.metrics, used);
        const dim = pickUnused(aFile.dimensions, used);
        if (metric && dim) {
          suggestions.push({
            text: `Show average ${metric} by ${dim}`,
            type: "cross",
          });
          used.add(metric);
          used.add(dim);
        }
      }

      // Template 3: metric + date from different files
      if (aFile.metrics.length > 0 && bFile.dates.length > 0) {
        const metric = pickUnused(aFile.metrics, used);
        if (metric) {
          const dim = pickUnused(bFile.dimensions, used) ||
            pickUnused(aFile.dimensions, used);
          if (dim) {
            suggestions.push({
              text: `Show ${metric} trend over time by ${dim}`,
              type: "cross",
            });
            used.add(metric);
            used.add(dim);
          }
        }
      }
    }
  }

  // ── Single-file suggestions (fill remaining slots) ──

  for (const analysis of analyses) {
    if (suggestions.length >= 5) break;

    // metric + dimension → bar chart
    if (analysis.metrics.length > 0 && analysis.dimensions.length > 0) {
      const metric = pickUnused(analysis.metrics, used);
      const dim = pickUnused(analysis.dimensions, used);
      if (metric && dim) {
        suggestions.push({
          text: `What is the average ${metric} by ${dim}?`,
          type: "single",
        });
        used.add(metric);
        used.add(dim);
      }
    }

    // metric + date → line chart
    if (analysis.metrics.length > 0 && analysis.dates.length > 0) {
      const metric = pickUnused(analysis.metrics, used);
      if (metric) {
        suggestions.push({
          text: `Show ${metric} trend over time`,
          type: "single",
        });
        used.add(metric);
      }
    }

    // dimension → pie chart
    if (analysis.dimensions.length > 0 && suggestions.length < 5) {
      const dim = pickUnused(analysis.dimensions, used);
      if (dim) {
        suggestions.push({
          text: `What is the ${dim} distribution?`,
          type: "single",
        });
        used.add(dim);
      }
    }

    // two metrics → scatter
    if (analysis.metrics.length >= 2 && suggestions.length < 5) {
      const m1 = pickUnused(analysis.metrics, used);
      const m2 = pickUnused(analysis.metrics, new Set([...(m1 ? [m1] : []), ...used]));
      if (m1 && m2) {
        suggestions.push({
          text: `Show ${m1} vs ${m2}`,
          type: "single",
        });
        used.add(m1);
        used.add(m2);
      }
    }
  }

  // Deduplicate by text
  const seen = new Set<string>();
  return suggestions.filter((s) => {
    const key = s.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}

/** Pick the first column from candidates that hasn't been used yet. */
function pickUnused(candidates: string[], used: Set<string>): string | null {
  return candidates.find((c) => !used.has(c)) ?? null;
}
