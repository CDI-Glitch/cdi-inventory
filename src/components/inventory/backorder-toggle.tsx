import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";

interface Props {
  active: boolean;
  href: string;
}

/**
 * Parallel to ForecastToggle, but for live current data (not a projection), so no
 * disclaimer step is needed — clicking navigates straight away.
 */
export function BackorderToggle({ active, href }: Props) {
  return (
    <Link
      href={href}
      className={
        active
          ? "inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
          : "inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
      }
    >
      {active ? (
        <>
          <X size={14} strokeWidth={2.25} aria-hidden="true" />
          Exit alerts
        </>
      ) : (
        <>
          <AlertTriangle size={14} strokeWidth={2.25} aria-hidden="true" />
          Alerts
        </>
      )}
    </Link>
  );
}
