"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp } from "lucide-react";

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
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-white transition-colors ${
          active ? "bg-[#0D9488] hover:bg-[#0F766E]" : "bg-[#14B8A6] hover:bg-[#0D9488]"
        }`}
      >
        <TrendingUp size={15} strokeWidth={2.25} aria-hidden="true" />
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
                className="inline-flex items-center gap-1.5 rounded-md bg-[#14B8A6] px-3 py-2 text-sm font-medium text-white hover:bg-[#0D9488]"
              >
                <TrendingUp size={15} strokeWidth={2.25} aria-hidden="true" />
                Got it, show forecast
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
