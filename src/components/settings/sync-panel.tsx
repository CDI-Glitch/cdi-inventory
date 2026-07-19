"use client";

import { useState } from "react";

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

const STATUS_STYLES: Record<string, string> = {
  success: "bg-green-50 text-green-700",
  error: "bg-red-50 text-red-600",
  skipped: "bg-gray-100 text-gray-500",
};

export function SyncPanel({ syncLogs }: { syncLogs: SyncLog[] }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ synced?: number; errors?: number; message?: string } | null>(null);
  const [logs, setLogs] = useState(syncLogs);

  async function triggerSync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      setResult(data);
      // Refresh logs
      const logsRes = await fetch("/api/sync");
      if (logsRes.ok) {
        const fresh = await logsRes.json();
        setLogs(fresh.logs ?? []);
      }
    } catch {
      setResult({ message: "Network error — sync failed" });
    } finally {
      setSyncing(false);
    }
  }

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
            {result.message ?? `Synced ${result.synced} SKU(s)${result.errors ? `, ${result.errors} error(s)` : " — all good"}`}
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
          Required environment variables: <code className="text-xs bg-amber-100 px-1 rounded">SHOPIFY_SHOP_DOMAIN</code>,{" "}
          <code className="text-xs bg-amber-100 px-1 rounded">SHOPIFY_ADMIN_API_TOKEN</code>
        </p>
      </div>

      {/* Recent sync log */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent sync log (last 20)</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No sync history yet</p>
        ) : (
          <div className="rounded-xl border border-gray-200 overflow-hidden">
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
        )}
      </div>
    </div>
  );
}
