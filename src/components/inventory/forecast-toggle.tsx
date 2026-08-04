"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  active: boolean;
  href: string;
}

/**
 * Read-only mode toggle — every time it's clicked ON, shows a dismissible disclaimer
 * ("estimate only, not a guaranteed reservation") before navigating. Clicking it OFF
 * navigates straight back to the normal view.
 */
export function ForecastToggle({ active, href }: Props) {
  const router = useRouter();
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  function handleClick() {
    if (active) {
      router.push(href);
      return;
    }
    setShowDisclaimer(true);
  }

  function confirm() {
    setShowDisclaimer(false);
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
          active
            ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE]"
            : "border-gray-300 text-gray-700 hover:bg-gray-50"
        }`}
      >
        {active ? "Exit forecast" : "Forecast"}
      </button>

      {showDisclaimer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-900">Forecast Mode is an estimate</h3>
            <p className="mt-2 text-sm text-gray-600">
              Future Available projects current stock forward using the ETA of upcoming
              containers. It is <span className="font-medium">not</span> a locked reservation
              against any specific shipment — ETAs, quantities, and existing reservations can all
              change before a container actually arrives.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDisclaimer(false)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                className="rounded-md bg-[#2563EB] px-3 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8]"
              >
                Got it, show forecast
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
