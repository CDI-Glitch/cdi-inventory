"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
}

const ROLE_STYLES: Record<string, string> = {
  admin: "bg-purple-50 text-purple-700",
  editor: "bg-blue-50 text-[#1D4ED8]",
  viewer: "bg-gray-100 text-gray-600",
};

export function UsersPanel({ users: initial }: { users: User[] }) {
  const router = useRouter();
  const [users, setUsers] = useState(initial);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  // New user form state
  const [newUser, setNewUser] = useState({ email: "", name: "", password: "", role: "viewer" });

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving("new");
    setError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.formErrors?.[0] ?? data.error ?? "Failed to create user");
      } else {
        setUsers([...users, data]);
        setNewUser({ email: "", name: "", password: "", role: "viewer" });
        setShowNew(false);
        router.refresh();
      }
    } finally {
      setSaving(null);
    }
  }

  async function toggleActive(user: User) {
    setSaving(user.id);
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers(users.map((u) => (u.id === user.id ? updated : u)));
    }
    setSaving(null);
  }

  async function changeRole(user: User, role: string) {
    setSaving(user.id + "-role");
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers(users.map((u) => (u.id === user.id ? updated : u)));
    }
    setSaving(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{users.length} user{users.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setShowNew(!showNew)}
          className="rounded-lg bg-[#2563EB] text-white px-4 py-2 text-sm font-medium hover:bg-[#1D4ED8] transition-colors"
        >
          + Add user
        </button>
      </div>

      {/* New user form */}
      {showNew && (
        <form onSubmit={createUser} className="rounded-xl border border-[#2563EB]/20 bg-blue-50/30 p-4 mb-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700 mb-1">New user</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full name</label>
              <input
                required
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                required
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                placeholder="jane@cdi.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password (min 8 chars)</label>
              <input
                required
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving === "new"}
              className="rounded-lg bg-[#2563EB] text-white px-4 py-2 text-sm font-medium hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors"
            >
              {saving === "new" ? "Creating…" : "Create user"}
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

      {/* Users table */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Role</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.id} className={`hover:bg-gray-50/50 transition-colors ${!user.active ? "opacity-50" : ""}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-[#2563EB]/10 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-[#2563EB]">
                        {user.name[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="font-medium text-gray-900">{user.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{user.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={user.role}
                    onChange={(e) => changeRole(user, e.target.value)}
                    disabled={saving === user.id + "-role"}
                    className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium bg-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${user.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {user.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {new Date(user.createdAt).toLocaleDateString("en-AU")}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleActive(user)}
                    disabled={saving === user.id}
                    className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-50 transition-colors"
                  >
                    {saving === user.id ? "…" : user.active ? "Deactivate" : "Activate"}
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
