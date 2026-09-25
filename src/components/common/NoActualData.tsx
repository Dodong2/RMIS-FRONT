export function NoActualData({ message = "No actual data", hint }: { message?: string; hint?: string }) {
  return (
    <div className="text-center py-16 rounded-2xl" style={{ background: "white", border: "1px solid #e2e8f0" }}>
      <p className="text-sm font-semibold" style={{ color: "#64748b" }}>{message}</p>
      {hint && <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>{hint}</p>}
    </div>
  );
}
