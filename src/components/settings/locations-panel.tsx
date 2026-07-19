"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Location {
  id: string;
  name: string;
  shopifyLocationId: string | null;
  active: boolean;
}

export function LocationsPanel({ locations: initial }: { locations: Location[] }) {
  const router = useRouter();
  const [locations, setLocations] = useState(initial);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [newLoc, setNewLoc] = useState({ name: "", shopifyLocationId: "" });
  const [error, setError] = useState("");

  async function createLocation(e: React.FormEvent) {
    e.preventDefault();
    setSaving("new");
    setError("");
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newLoc.name,
          shopifyLocationId: newLoc.shopifyLocationId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create location");
      } else {
        setLocations([...locations, data]);
        setNewLoc({ name: "", shopifyLocationId: "" });
        setShowNew(false);
        router.refresh();
      }
    } finally {
      setSaving(null);
    }
  }

  async function updateShopifyId(loc: Location, shopifyLocationId: string) {
    setSaving(loc.id);
    const res = await fetch(`/api/locations/${loc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopifyLocationId: shopifyLocationId || null }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLocations(locations.map((l) => (l.id === loc.id ? updated : l)));
    }
    setSaving(null);
  }

  async function toggleActive(loc: Location) {
    setSaving(loc.id + "-active");
    const res = await fetch(`/api/locations/${loc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !loc.active }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLocations(locations.map((l) => (l.id === loc.id ? updated : l)));
    }
    setSaving(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{locations.length} location{locations.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setShowNew(!showNew)}
          className="rounded-lg bg-[#2563EB] text-white px-4 py-2 text-sm font-medium hover:bg-[#1D4ED8] transition-colors"
        >
          + Add location
        </button>
      </div>

      {showNew && (
        <form onSubmit={createLocation} className="rounded-xl border border-[#2563EB]/20 bg-blue-50/30 p-4 mb-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">New location</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Location name</label>
              <input
                required
                value={newLoc.name}
                onChange={(e) => setNewLoc({ ...newLoc, name: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                placeholder="e.g. Brisbane Warehouse"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Shopify Location ID <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                value={newLoc.shopifyLocationId}
                onChange={(e) => setNewLoc({ ...newLoc, shopifyLocationId: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                placeholder="gid://shopify/Location/..."
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving === "new"}
              className="rounded-lg bg-[#2563EB] text-white px-4 py-2 text-sm font-medium hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors"
            >
              {saving === "new" ? "Creating…" : "Create location"}
            </button>
            <button
              type="button"
              onClick={() => { setShowNew(false); setError(""); }}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Shopify Location ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {locations.map((loc) => (
              <tr key={loc.id} className={`hover:bg-gray-50/50 ${!loc.active ? "opacity-50" : ""}`}>
                <td className="px-4 py-3 font-medium text-gray-900">{loc.name}</td>
                <td className="px-4 py-3">
                  <ShopifyIdEditor
                    loc={loc}
                    saving={saving === loc.id}
                    onSave={(id) => updateShopifyId(loc, id)}
                  />
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${loc.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {loc.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleActive(loc)}
                    disabled={saving === loc.id + "-active"}
                    className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-50"
                  >
                    {saving === loc.id + "-active" ? "…" : loc.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ShopifyIdEditor({
  loc,
  saving,
  onSave,
}: {
  loc: Location;
  saving: boolean;
  onSave: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(loc.shopifyLocationId ?? "");

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 font-mono">
          {loc.shopifyLocationId ?? <span className="text-gray-300">— not set —</span>}
        </span>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-[#2563EB] hover:underline"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded border border-gray-200 px-2 py-1 text-xs font-mono w-64 focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
        placeholder="gid://shopify/Location/..."
      />
      <button
        disabled={saving}
        onClick={() => { onSave(value); setEditing(false); }}
        className="text-xs text-[#2563EB] hover:underline disabled:opacity-50"
      >
        {saving ? "…" : "Save"}
      </button>
      <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:underline">
        Cancel
      </button>
    </div>
  );
}
