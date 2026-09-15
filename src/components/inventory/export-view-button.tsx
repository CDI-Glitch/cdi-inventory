import { Download } from "lucide-react";

interface Props {
  href: string;
}

export function ExportViewButton({ href }: Props) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      <Download size={15} strokeWidth={2.25} aria-hidden="true" />
      Export SKUs
    </a>
  );
}
