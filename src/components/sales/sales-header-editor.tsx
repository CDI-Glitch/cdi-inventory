"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CustomSelect } from "@/components/ui/custom-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Pencil } from "lucide-react";

interface Props {
  id: string;
  customer: string;
  date: string; // ISO date string yyyy-MM-dd
  locationId: string;
  locations: { id: string; name: string }[];
  quoteNo: string | null;
  invoiceNo: string | null;
  staffNotes: string | null;
  isQuote: boolean; // only show edit button when true
}

export function SalesHeaderEditor({
  id,
  customer: initialCustomer,
  date: initialDate,
  locationId: initialLocationId,
  locations,
  quoteNo: initialQuoteNo,
  invoiceNo: initialInvoiceNo,
  staffNotes: initialStaffNotes,
  isQuote,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [customer, setCustomer] = useState(initialCustomer);
  const [date, setDate] = useState(initialDate);
  const [locationId, setLocationId] = useState(initialLocationId);
  const [quoteNo, setQuoteNo] = useState(initialQuoteNo ?? "");
  const [invoiceNo, setInvoiceNo] = useState(initialInvoiceNo ?? "");
  const [staffNotes, setStaffNotes] = useState(initialStaffNotes ?? "");

  const locationOptions = locations.map((l) => ({ value: l.id, label: l.name }));
  const locationName = locations.find((l) => l.id === locationId)?.name ?? locationId;

  function cancel() {
    setCustomer(initialCustomer);
    setDate(initialDate);
    setLocationId(initialLocationId);
    setQuoteNo(initialQuoteNo ?? "");
    setInvoiceNo(initialInvoiceNo ?? "");
    setStaffNotes(initialStaffNotes ?? "");
    setError("");
    setEditing(false);
  }

  async function save() {
    if (!customer.trim()) return;
    setLoading(true);
    setError("");
    const res = await fetch(`/api/sales/${id}/header`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: customer.trim(),
        date,
        locationId,
        quoteNo: quoteNo.trim() || undefined,
        invoiceNo: invoiceNo.trim() || undefined,
        staffNotes: staffNotes.trim() || undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save");
      setLoading(false);
      return;
    }
    setEditing(false);
    setLoading(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-600 mt-1">{customer}</p>
          {(quoteNo || invoiceNo) && (
            <div className="mt-2 flex gap-4 text-sm">
              {quoteNo && (
                <span className="text-gray-500">Quote <span className="font-medium text-gray-800">{quoteNo}</span></span>
              )}
              {invoiceNo && (
                <span className="text-gray-500">Invoice <span className="font-medium text-gray-800">{invoiceNo}</span></span>
              )}
            </div>
          )}
          {staffNotes && (
            <div className="mt-2 rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2 text-sm text-yellow-800">
              {staffNotes}
            </div>
          )}
        </div>
        <div className="flex items-start gap-4 text-sm text-gray-500 text-right">
          <div>
            <p>{new Date(date).toLocaleDateString("en-AU")}</p>
            <p>{locationName}</p>
          </div>
          {isQuote && (
            <button
              onClick={() => setEditing(true)}
              className="mt-0.5 text-gray-400 hover:text-blue-600 transition-colors"
              title="Edit details"
            >
              <Pencil size={15} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Edit mode
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Customer *</label>
        <input
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
          <DatePicker name="date" value={date} onChange={setDate} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
          <CustomSelect
            name="locationId"
            value={locationId}
            options={locationOptions}
            onChange={setLocationId}
            fullWidth
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Quote no.</label>
          <input
            value={quoteNo}
            onChange={(e) => setQuoteNo(e.target.value)}
            placeholder="Q-001"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Invoice no.</label>
          <input
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            placeholder="INV-001"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Staff notes</label>
        <textarea
          value={staffNotes}
          onChange={(e) => setStaffNotes(e.target.value)}
          rows={2}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button
          onClick={save}
          disabled={loading || !customer.trim()}
          className="rounded bg-[#2563EB] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save"}
        </button>
        <button
          onClick={cancel}
          className="rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
