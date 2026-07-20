import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
}

function buildUrl(page: number, searchParams: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (v && k !== "page") params.set(k, v);
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `?${qs}` : "?";
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}

export function Pagination({ currentPage, totalPages, searchParams }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      {/* Prev */}
      {hasPrev ? (
        <Link
          href={buildUrl(currentPage - 1, searchParams)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm text-gray-600 border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft size={14} />
          Prev
        </Link>
      ) : (
        <span className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm text-gray-300 border border-gray-200 bg-white cursor-not-allowed">
          <ChevronLeft size={14} />
          Prev
        </span>
      )}

      {/* Page numbers */}
      <div className="flex items-center gap-1 mx-1">
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-sm text-gray-400">
              …
            </span>
          ) : (
            <Link
              key={p}
              href={buildUrl(p as number, searchParams)}
              className={[
                "min-w-[32px] text-center px-2 py-1.5 rounded-md text-sm transition-colors",
                p === currentPage
                  ? "bg-[#2563EB] text-white font-medium"
                  : "text-gray-600 border border-gray-300 bg-white hover:bg-gray-50",
              ].join(" ")}
            >
              {p}
            </Link>
          )
        )}
      </div>

      {/* Next */}
      {hasNext ? (
        <Link
          href={buildUrl(currentPage + 1, searchParams)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm text-gray-600 border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
        >
          Next
          <ChevronRight size={14} />
        </Link>
      ) : (
        <span className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm text-gray-300 border border-gray-200 bg-white cursor-not-allowed">
          Next
          <ChevronRight size={14} />
        </span>
      )}
    </div>
  );
}
