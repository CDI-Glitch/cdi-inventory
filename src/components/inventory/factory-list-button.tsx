import { Download } from "lucide-react";

interface Props {
  loc: string;
}

export function FactoryListButton({ loc }: Props) {
  return (
    <a
      href={`/api/inventory/shortage-export?loc=${encodeURIComponent(loc)}`}
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      <Download size={15} strokeWidth={2.25} aria-hidden="true" />
      Factory list
    </a>
  );
}
