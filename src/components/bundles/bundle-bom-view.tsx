const ROLE_LABELS: Record<string, string> = {
  main_body: "Main body",
  body_attachment: "Body attachment",
  tray_mount: "Tray mount",
  hardware_bracket: "Hardware bracket",
};

type BomItem = {
  id: string;
  qty: number;
  componentRole: string;
  nonConstraining: boolean;
  altGroupKey: string | null;
  product: { sku: string; name: string };
};

type Props = {
  bundle: {
    code: string;
    name: string;
    productFamily: string;
    active: boolean;
    sellableSku: string | null;
    items: BomItem[];
    locationStocks: { id: string; cachedKits: number; location: { name: string } }[];
  };
};

function formatGroupLabel(key: string) {
  return key
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function BundleBomView({ bundle }: Props) {
  const regular = bundle.items.filter((i) => !i.altGroupKey);
  const groups = new Map<string, BomItem[]>();
  for (const item of bundle.items) {
    const key = item.altGroupKey?.trim();
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-sm font-semibold text-gray-900">{bundle.code}</p>
            <h2 className="text-lg font-bold text-gray-900">{bundle.name}</h2>
            <p className="mt-1 text-sm text-gray-500">
              Family: {bundle.productFamily || "—"}
              {bundle.sellableSku ? ` · Website SKU ${bundle.sellableSku}` : " · Not sellable on website"}
              {bundle.active ? "" : " · Inactive"}
            </p>
          </div>
        </div>
        {bundle.sellableSku && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Cached kits</h3>
            {bundle.locationStocks.length === 0 ? (
              <p className="text-sm text-gray-400">No cache yet. An admin can save the bundle or run Shopify sync.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {bundle.locationStocks.map((row) => (
                  <li key={row.id} className="flex justify-between gap-4">
                    <span className="text-gray-600">{row.location.name}</span>
                    <span className="font-mono font-medium">{row.cachedKits}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 space-y-2">
        <p className="font-semibold text-gray-900">How to read this BOM</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <span className="font-medium">Normal lines</span> — website kits wait on these, and paying a deposit reserves them.
          </li>
          <li>
            <span className="font-medium">Pick-one groups</span> — stock of the options is added together for website kits. Deposit does not reserve one SKU; warehouse must pick one before the sales record can be completed.
          </li>
          <li>
            <span className="font-medium">Ignore for kits</span> — still reserved and picked (fasteners), but they do not reduce website kit count.
          </li>
        </ul>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Required components</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium text-gray-500">
              <th className="px-4 py-2">SKU</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2 text-center">Qty</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {regular.map((item) => (
              <tr key={item.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-2 font-mono text-xs">{item.product.sku}</td>
                <td className="px-4 py-2 text-gray-700">{item.product.name}</td>
                <td className="px-4 py-2 text-center tabular-nums">{item.qty}</td>
                <td className="px-4 py-2 text-gray-500">{ROLE_LABELS[item.componentRole] ?? item.componentRole}</td>
                <td className="px-4 py-2">
                  {item.nonConstraining ? (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Ignore for kits</span>
                  ) : (
                    <span className="text-xs text-gray-400">Constrains website kits</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {[...groups.entries()].map(([key, items]) => (
        <div key={key} className="rounded-xl border border-amber-200 bg-amber-50/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-100">
            <h3 className="text-sm font-semibold text-gray-900">
              {formatGroupLabel(key)} — pick one
            </h3>
            <p className="text-xs text-gray-600 mt-1">
              Qty {items[0]?.qty ?? 1} per kit. Website kits use the sum of available stock across these SKUs. Fulfillment must reserve exactly one of them.
            </p>
          </div>
          <table className="w-full text-sm bg-white">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium text-gray-500">
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Role</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">{item.product.sku}</td>
                  <td className="px-4 py-2 text-gray-700">{item.product.name}</td>
                  <td className="px-4 py-2 text-gray-500">{ROLE_LABELS[item.componentRole] ?? item.componentRole}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
