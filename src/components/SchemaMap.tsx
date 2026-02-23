"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import {
  ReactFlow,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  applyNodeChanges,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { DetectedJoin } from "@/lib/join-detector";
import {
  categorizeColumns,
  sortColumnsByRelevance,
  type CategorizedColumn,
} from "@/lib/join-detector";

/* ── Types ──────────────────────────────────────────── */

interface FileInput {
  id: string;
  fileName: string;
  columns: string[];
  rowCount: number;
}

interface SchemaMapProps {
  files: FileInput[];
  joins: DetectedJoin[];
  onRemoveFile: (fileId: string) => void;
}

interface FileNodeData {
  label: string;
  categorizedColumns: CategorizedColumn[];
  totalColumns: number;
  rowCount: number;
  joinColumns: string[];
  fileId: string;
  onRemove: (fileId: string) => void;
  [key: string]: unknown;
}

/* ── Category Colors ────────────────────────────────── */

const categoryStyle: Record<string, { color: string; icon: string }> = {
  id:         { color: "text-green-400",    icon: "🔑" },
  metric:     { color: "text-cyan-400",     icon: "#"  },
  dimension:  { color: "text-blue-200/70",  icon: "◆"  },
  date:       { color: "text-purple-400",   icon: "◷"  },
  other:      { color: "text-blue-200/40",  icon: "•"  },
  identifier: { color: "text-blue-200/30",  icon: "•"  },
};

/* ── Custom File Node ─────────────────────────────────── */

function FileNode({ data }: NodeProps<Node<FileNodeData>>) {
  const MAX_COLS = 10;

  // Filter out identifier columns (name, email, phone — noise)
  const relevantCols = data.categorizedColumns.filter(
    (c) => c.category !== "identifier"
  );
  const visibleCols = relevantCols.slice(0, MAX_COLS);
  const hiddenCount = data.totalColumns - visibleCols.length;

  return (
    <div className="bg-[#111d33] border-2 border-[#1e3a5f] rounded-lg px-3 py-2 min-w-[180px] max-w-[220px] shadow-lg relative group">
      <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-2.5 !h-2.5" />
      <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-2.5 !h-2.5" />

      {/* Remove button */}
      <button
        onClick={() => data.onRemove(data.fileId)}
        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500/80 hover:bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        x
      </button>

      <div className="text-xs font-bold text-blue-300 mb-1 truncate">{data.label}</div>
      <div className="text-[9px] text-blue-200/40 mb-1.5">
        {data.totalColumns} cols &middot; {data.rowCount.toLocaleString()} rows
      </div>

      <div className="space-y-0.5">
        {visibleCols.map((col) => {
          const isJoinCol = data.joinColumns.includes(col.name);
          const style = isJoinCol
            ? { color: "text-green-400 font-semibold", icon: "🔗" }
            : categoryStyle[col.category] || categoryStyle.other;

          return (
            <div
              key={col.name}
              className={`text-[10px] truncate ${style.color}`}
            >
              {style.icon} {col.name}
            </div>
          );
        })}
        {hiddenCount > 0 && (
          <div className="text-[9px] text-blue-200/30">
            ... +{hiddenCount} more
          </div>
        )}
      </div>
    </div>
  );
}

// Defined OUTSIDE component to prevent re-renders (React Flow docs)
const nodeTypes = { fileNode: FileNode };

/* ── Position helpers ─────────────────────────────────── */

function getNodePositions(count: number): { x: number; y: number }[] {
  switch (count) {
    case 1:
      return [{ x: 0, y: 50 }];
    case 2:
      return [{ x: 50, y: 50 }, { x: 500, y: 50 }];
    case 3:
      return [{ x: 0, y: 0 }, { x: 350, y: 0 }, { x: 175, y: 200 }];
    case 4:
      return [{ x: 0, y: 0 }, { x: 350, y: 0 }, { x: 0, y: 200 }, { x: 350, y: 200 }];
    default:
      return Array.from({ length: count }, (_, i) => ({ x: i * 300, y: 0 }));
  }
}

/* ── Schema Map Component ─────────────────────────────── */

export default function SchemaMap({ files, joins, onRemoveFile }: SchemaMapProps) {
  // Build join column lookup: fileId → Set of join column names
  const joinColumnsByFile = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const j of joins) {
      if (!map.has(j.fileA.id)) map.set(j.fileA.id, new Set());
      if (!map.has(j.fileB.id)) map.set(j.fileB.id, new Set());
      map.get(j.fileA.id)!.add(j.fileA.column);
      map.get(j.fileB.id)!.add(j.fileB.column);
    }
    return map;
  }, [joins]);

  // Build React Flow nodes with categorized, sorted columns
  const positions = getNodePositions(files.length);
  const initialNodes: Node<FileNodeData>[] = useMemo(() => {
    return files.map((f, i) => {
      const categorized = sortColumnsByRelevance(categorizeColumns(f.columns));
      return {
        id: f.id,
        type: "fileNode",
        position: positions[i] || { x: i * 300, y: 0 },
        data: {
          label: f.fileName,
          categorizedColumns: categorized,
          totalColumns: f.columns.length,
          rowCount: f.rowCount,
          joinColumns: Array.from(joinColumnsByFile.get(f.id) || []),
          fileId: f.id,
          onRemove: onRemoveFile,
        },
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, joinColumnsByFile, onRemoveFile]);

  // Build React Flow edges from detected joins — clean labels, no percentages
  const edges: Edge[] = useMemo(() => {
    return joins.map((j, i) => {
      const isPossible = j.joinType === "possible_id";
      return {
        id: `join-${i}`,
        source: j.fileA.id,
        target: j.fileB.id,
        label: j.label,
        animated: !isPossible,
        style: {
          stroke: isPossible ? "#64748b" : "#22c55e",
          strokeWidth: isPossible ? 1.5 : 2,
          strokeDasharray: isPossible ? "6 3" : undefined,
        },
        labelStyle: {
          fill: isPossible ? "#94a3b8" : "#22c55e",
          fontSize: 11,
          fontWeight: 600,
        },
        labelBgStyle: {
          fill: "#0c1929",
          fillOpacity: 0.9,
        },
      };
    });
  }, [joins]);

  // Draggable nodes state
  const [nodes, setNodes] = useState(initialNodes);
  const onNodesChange = useCallback(
    (changes: NodeChange<Node<FileNodeData>>[]) =>
      setNodes((ns) => applyNodeChanges(changes, ns)),
    []
  );

  // Sync nodes when files/joins change
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes]);

  if (files.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-sm text-blue-200/30">Select files from the sidebar to visualize joins</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        key={files.map((f) => f.id).join(",")}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.5, includeHiddenNodes: true }}
        proOptions={{ hideAttribution: true }}
        panOnDrag
        zoomOnScroll
        minZoom={0.3}
        maxZoom={2}
      />
      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-[#0c1929]/90 border border-[#1e3a5f]/40 rounded-lg px-3 py-2.5 text-[11px] space-y-1 pointer-events-none">
        <div className="text-blue-200/50 font-semibold mb-1">Legend</div>
        <div className="text-green-400">🔗 Join Key</div>
        <div className="text-cyan-400"># Metric</div>
        <div className="text-blue-200/70">◆ Dimension</div>
        <div className="text-purple-400">◷ Date</div>
        <div className="flex items-center gap-1.5 mt-1.5 pt-1 border-t border-[#1e3a5f]/30">
          <span className="w-6 h-0 border-t-2 border-green-500 inline-block" />
          <span className="text-green-400">Confirmed join</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-0 border-t-[1.5px] border-dashed border-slate-500 inline-block" />
          <span className="text-slate-400">Possible join</span>
        </div>
      </div>
    </div>
  );
}
