"use client";

import { useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

interface SyncLog {
  id: string;
  sentQty: number;
  status: string;
  error: string | null;
  attempts: number;
  createdAt: Date | string;
  product: { sku: string; name: string };
  location: { name: string };
}

interface Pagination {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const STATUS_STYLES: Record<string, string> = {
  success: "bg-green-50 text-green-700",
  error: "bg-red-50 text-red-600",
  skipped: "bg-gray-100 text-gray-500",
};

const PAGE_SIZE = 50;

export function SyncPanel({
  syncLogs: initialLogs,
  initialPagination,
}: {
  syncLogs: SyncLog[];
  initialPagination: Pagination;
}) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ synced?: number; errors?: number; message?: string } | null>(null);
  const [logs, setLogs] = useState(initialLogs);
  const [pagination, setPagination] = useState(initialPagination);
  const [loadingPage, setLoadingPage] = useState(false);

  // Dialog state for clear confirmation
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearMode, setClearMode] = useState<"days" | "count">("days");
  const [keepDays, setKeepDays] = useState(30);
  const [keepCount, setKeepCount] = useState(500);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<string | null>(null);

  const fetchLogs = useCallback(async (page: number) => {
    setLoadingPage(true);
    try {
      const res = await fetch(`/api/sync?page=${page}&pageSize=${PAGE_SIZE}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
        setPagination(data.pagination);
      }
    } finally {
      setLoadingPage(false);
    }
  }, []);

  async function triggerSync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResult({ message: data.error ?? `Sync failed (${res.status})`, errors: 1 });
      } else {
        setResult(data);
        await fetchLogs(1);
      }
    } catch {
      setResult({ message: "Network error — sync failed", errors: 1 });
    } finally {
      setSyncing(false);
    }
  }

  async function clearLogs() {
    setClearing(true);
    setClearResult(null);
    try {
      const params =
        clearMode === "days"
          ? `keepDays=${keepDays}`
          : `keepCount=${keepCount}`;
      const res = await fetch(`/api/sync?${params}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setClearResult(`Deleted ${data.deleted} record(s).`);
        await fetchLogs(1);
      } else {
        setClearResult(data.error ?? "Failed to clear logs.");
      }
    } catch {
      setClearResult("Network error.");
    } finally {
      setClearing(false);
    }
  }

  const canPrev = pagination.page > 1;
  const canNext = pagination.page < pagination.totalPages;

  return (
    <div>
      {/* Sync control */}
      <div className="rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Push to Shopify</h3>
            <p className="text-sm text-gray-500 mt-1">
              Syncs current <span className="font-medium">Available</span> quantities from this portal to Shopify inventory levels.
              Only SKUs with a Shopify Inventory Item ID configured will be updated.
            </p>
          </div>
          <button
            onClick={triggerSync}
            disabled={syncing}
            className="shrink-0 ml-4 rounded-lg bg-[#2563EB] text-white px-4 py-2 text-sm font-medium hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors"
          >
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>

        {result && (
          <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${result.errors ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
            {result.message ?? `Synced ${result.synced ?? 0} SKU(s)${result.errors ? `, ${result.errors} error(s)` : " — all good"}`}
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-6">
        <p className="text-sm font-semibold text-amber-800 mb-1">Setup required</p>
        <p className="text-sm text-amber-700">
          To enable Shopify sync, each product must have a <strong>Shopify Inventory Item ID</strong> and <strong>Variant ID</strong>.
          Set these on each product's detail page in Inventory. Also set the <strong>Shopify Location ID</strong> on each location in the Locations tab.
        </p>
        <p className="text-sm text-amber-700 mt-2">
          Required environment variables:{" "}
          <code className="text-xs bg-amber-100 px-1 rounded">SHOPIFY_STORE_DOMAIN</code>,{" "}
          <code className="text-xs bg-amber-100 px-1 rounded">SHOPIFY_CLIENT_ID</code>,{" "}
          <code className="text-xs bg-amber-100 px-1 rounded">SHOPIFY_CLIENT_SECRET</code>
        </p>
      </div>

      {/* Sync log header row */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">
          Sync log{" "}
          <span className="font-normal text-gray-400">
            ({pagination.total.toLocaleString()} total)
          </span>
        </h3>
        <button
          onClick={() => { setShowClearDialog(true); setClearResult(null); }}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear old logs
        </button>
      </div>

      {/* Clear dialog */}
      {showClearDialog && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-4">
          <p className="text-sm font-semibold text-red-800 mb-3">Clear sync logs</p>
          <div className="flex flex-wrap gap-4 mb-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="radio"
                name="clearMode"
                checked={clearMode === "days"}
                onChange={() => setClearMode("days")}
              />
              Keep last
              <input
                type="number"
                min={1}
                max={365}
                value={keepDays}
                onChange={(e) => setKeepDays(parseInt(e.target.value) || 30)}
                className="w-16 border border-gray-300 rounded-md px-2 py-1 text-sm"
                disabled={clearMode !== "days"}
              />
              days
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="radio"
                name="clearMode"
                checked={clearMode === "count"}
                onChange={() => setClearMode("count")}
              />
              Keep latest
              <input
                type="number"
                min={0}
                max={10000}
                value={keepCount}
                onChange={(e) => setKeepCount(parseInt(e.target.value) || 500)}
                className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm"
                disabled={clearMode !== "count"}
              />
              records
            </label>
          </div>
          {clearResult && (
            <p className="text-sm text-gray-700 mb-3">{clearResult}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={clearLogs}
              disabled={clearing}
              className="rounded-lg bg-red-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {clearing ? "Clearing…" : "Confirm delete"}
            </button>
            <button
              onClick={() => setShowClearDialog(false)}
              className="rounded-lg border border-gray-300 bg-white text-gray-700 px-4 py-1.5 text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Log table */}
      {logs.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">No sync history yet</p>
      ) : (
        <>
          <div className={`rounded-xl border border-gray-200 overflow-hidden ${loadingPage ? "opacity-60" : ""}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Time</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">SKU</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Location</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Qty Sent</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("en-AU", {
                        day: "2-digit", month: "short",
                        hour: "2-digit", minute: "2-digit", hour12: false,
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{log.product.sku}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{log.location.name}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-900">{log.sentQty}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[log.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-red-500 max-w-[200px] truncate">{log.error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-gray-400">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total.toLocaleString()} records
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => fetchLogs(pagination.page - 1)}
                  disabled={!canPrev || loadingPage}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => fetchLogs(pagination.page + 1)}
                  disabled={!canNext || loadingPage}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
