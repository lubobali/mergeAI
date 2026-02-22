export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0c1929] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-2">
          <span className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" />
          <span className="w-3 h-3 bg-blue-400 rounded-full animate-bounce [animation-delay:0.15s]" />
          <span className="w-3 h-3 bg-blue-400 rounded-full animate-bounce [animation-delay:0.3s]" />
        </div>
        <p className="text-blue-200/40 text-sm">Loading MergeAI...</p>
      </div>
    </div>
  );
}
