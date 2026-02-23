"use client";

import { categorizeColumn } from "@/lib/join-detector";

interface DataPreviewProps {
  fileName: string;
  columns: string[];
  columnTypes: Record<string, string>;
  rowCount: number;
  rows: Record<string, unknown>[];
  onClose: () => void;
}

const typeColors: Record<string, string> = {
  number: "bg-blue-500/20 text-blue-300",
  text: "bg-slate-500/20 text-slate-300",
  date: "bg-purple-500/20 text-purple-300",
};

const categoryHeaderColors: Record<string, string> = {
  id: "text-green-400",
  metric: "text-cyan-400",
  dimension: "text-blue-200",
  date: "text-purple-400",
  identifier: "text-blue-200/60",
  other: "text-blue-200/60",
};

export default function DataPreview({
  fileName,
  columns,
  columnTypes,
  rowCount,
  rows,
  onClose,
}: DataPreviewProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-2 md:p-4">
      <div className="bg-[#0c1929] border border-[#1e3a5f] rounded-xl md:rounded-2xl w-full max-w-5xl max-h-[90vh] md:max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3 md:px-6 md:py-4 border-b border-[#1e3a5f]/50">
          <div className="min-w-0 flex-1 mr-3">
            <h2 className="text-sm md:text-lg font-bold text-blue-300 flex items-center gap-2 truncate">
              <span className="text-base md:text-xl shrink-0">📊</span>
              <span className="truncate">{fileName}</span>
            </h2>
            <p className="text-[10px] md:text-xs text-blue-200/40 mt-0.5">
              {rows.length} of {rowCount.toLocaleString()} rows &middot; {columns.length} columns
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#1e3a5f]/30 hover:bg-red-500/30 text-blue-200/60 hover:text-red-400 transition text-lg shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Table container — scrollable both ways */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#111d33]">
                <th className="px-3 py-2.5 text-left text-[10px] text-blue-200/30 font-normal border-b border-[#1e3a5f]/30 sticky left-0 bg-[#111d33] z-20">
                  #
                </th>
                {columns.map((col) => {
                  const cat = categorizeColumn(col);
                  const colType = columnTypes[col] || "text";
                  return (
                    <th
                      key={col}
                      className={`px-3 py-2.5 text-left font-semibold text-xs border-b border-[#1e3a5f]/30 whitespace-nowrap ${categoryHeaderColors[cat]}`}
                    >
                      <div className="flex items-center gap-1.5">
                        {col}
                        <span className={`text-[9px] font-normal px-1.5 py-0.5 rounded-full ${typeColors[colType] || typeColors.text}`}>
                          {colType}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-[#1e3a5f]/10 hover:bg-[#111d33]/50 transition"
                >
                  <td className="px-3 py-2 text-[10px] text-blue-200/20 sticky left-0 bg-[#0c1929]">
                    {i + 1}
                  </td>
                  {columns.map((col) => {
                    const val = row[col];
                    const display =
                      val === null || val === undefined
                        ? ""
                        : String(val);
                    return (
                      <td
                        key={col}
                        className="px-3 py-2 text-xs text-blue-100/80 whitespace-nowrap max-w-[200px] truncate"
                        title={display}
                      >
                        {display || <span className="text-blue-200/20 italic">null</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer — type legend */}
        <div className="px-3 py-2 md:px-6 md:py-3 border-t border-[#1e3a5f]/30 flex items-center gap-3 md:gap-4 text-[10px] md:text-[11px]">
          <span className="text-blue-300">● Numbers</span>
          <span className="text-purple-400">● Dates</span>
          <span className="text-slate-400">● Text</span>
          <span className="ml-auto text-blue-200/30">
            {rows.length} of {rowCount.toLocaleString()} rows
          </span>
        </div>
      </div>
    </div>
  );
}
