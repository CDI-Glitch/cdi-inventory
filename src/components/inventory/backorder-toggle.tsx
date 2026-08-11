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
      className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
    >
      {active ? (
        <>
          <X size={15} strokeWidth={2.25} aria-hidden="true" />
          Exit alerts
        </>
      ) : (
        <>
          <AlertTriangle size={15} strokeWidth={2.25} aria-hidden="true" />
          Backorder alerts
        </>
      )}
    </Link>
  );
}
