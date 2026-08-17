export type SnapshotItem = {
  productId: string;
  sku: string;
  name: string;
  qty: number;
  altGroupKey?: string | null;
};

export type MovementLike = {
  productId: string;
  reservedQty: number;
};

export type LineLike = {
  id: string;
  lineType: string;
  itemCode: string;
  qty: number;
  snapshotItems: unknown;
};

export type AltGroupCandidate = {
  productId: string;
  sku: string;
  name: string;
};

export type AltGroupPick = AltGroupCandidate & { qty: number };

export type AltGroupTask = {
  lineId: string;
  lineNo: number;
  itemCode: string;
  altGroupKey: string;
  requiredQty: number;
  reservedQty: number;
  resolved: boolean;
  candidates: AltGroupCandidate[];
  picked: AltGroupPick[];
};

export class AltGroupUnresolvedError extends Error {
  constructor(summary: string) {
    super(`Cannot complete: pick remaining alt groups first (${summary}).`);
    this.name = "AltGroupUnresolvedError";
  }
}

export function parseSnapshotItems(raw: unknown): SnapshotItem[] {
  if (!Array.isArray(raw)) return [];
  const out: SnapshotItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    if (typeof item.productId !== "string" || typeof item.sku !== "string") continue;
    out.push({
      productId: item.productId,
      sku: item.sku,
      name: typeof item.name === "string" ? item.name : item.sku,
      qty: typeof item.qty === "number" && item.qty > 0 ? item.qty : 1,
      altGroupKey: typeof item.altGroupKey === "string" ? item.altGroupKey : null,
    });
  }
  return out;
}

export function formatAltGroupLabel(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return "Alt group";
  return trimmed
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function reservedByProduct(movements: MovementLike[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const mov of movements) {
    if (mov.reservedQty <= 0) continue;
    map.set(mov.productId, (map.get(mov.productId) ?? 0) + mov.reservedQty);
  }
  return map;
}

export function listAltGroupTasks(lines: LineLike[], movements: MovementLike[]): AltGroupTask[] {
  const remaining = reservedByProduct(movements);
  const tasks: AltGroupTask[] = [];

  lines.forEach((line, index) => {
    if (line.lineType !== "bundle") return;
    const groups = new Map<string, SnapshotItem[]>();
    for (const item of parseSnapshotItems(line.snapshotItems)) {
      const key = item.altGroupKey?.trim();
      if (!key) continue;
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }

    for (const [altGroupKey, items] of groups) {
      const qtyPerKit = items[0]?.qty ?? 1;
      const requiredQty = qtyPerKit * line.qty;
      const seen = new Set<string>();
      const candidates: AltGroupCandidate[] = [];
      for (const item of items) {
        if (seen.has(item.productId)) continue;
        seen.add(item.productId);
        candidates.push({ productId: item.productId, sku: item.sku, name: item.name });
      }

      const picked: AltGroupPick[] = [];
      let allocated = 0;
      for (const candidate of candidates) {
        if (allocated >= requiredQty) break;
        const have = remaining.get(candidate.productId) ?? 0;
        const take = Math.min(have, requiredQty - allocated);
        if (take <= 0) continue;
        remaining.set(candidate.productId, have - take);
        allocated += take;
        picked.push({ ...candidate, qty: take });
      }

      tasks.push({
        lineId: line.id,
        lineNo: index + 1,
        itemCode: line.itemCode,
        altGroupKey,
        requiredQty,
        reservedQty: allocated,
        resolved: allocated >= requiredQty,
        candidates,
        picked,
      });
    }
  });

  return tasks;
}

export function unresolvedAltGroupSummary(tasks: AltGroupTask[]): string | null {
  const open = tasks.filter((t) => !t.resolved);
  if (open.length === 0) return null;
  return open
    .map((t) => `Line ${t.lineNo} · ${formatAltGroupLabel(t.altGroupKey)}`)
    .join("; ");
}

export function applyAltGroupPick(
  lines: LineLike[],
  movements: MovementLike[],
  lineId: string,
  altGroupKey: string,
  productId: string
): { ok: true; nextReserved: Map<string, number> } | { ok: false; error: string } {
  const tasks = listAltGroupTasks(lines, movements);
  const task = tasks.find((t) => t.lineId === lineId && t.altGroupKey === altGroupKey);
  if (!task) {
    return { ok: false, error: "Alt group not found on this sales line." };
  }
  if (!task.candidates.some((c) => c.productId === productId)) {
    return { ok: false, error: "Selected SKU is not a candidate for this alt group." };
  }

  const nextReserved = reservedByProduct(movements);
  for (const pick of task.picked) {
    nextReserved.set(pick.productId, (nextReserved.get(pick.productId) ?? 0) - pick.qty);
  }
  nextReserved.set(productId, (nextReserved.get(productId) ?? 0) + task.requiredQty);
  return { ok: true, nextReserved };
}
