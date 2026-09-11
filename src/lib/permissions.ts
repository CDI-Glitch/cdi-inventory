import { ROLES, type Role } from "./constants";

export function asRole(value: unknown): Role {
  if (typeof value === "string" && (ROLES as readonly string[]).includes(value)) {
    return value as Role;
  }
  return "viewer";
}

export function roleFromSession(session: { user?: unknown } | null | undefined): Role {
  return asRole((session?.user as { role?: unknown } | undefined)?.role);
}

export function canAccessIncoming(role: Role): boolean {
  return role === "editor" || role === "admin";
}

export function canWriteIncoming(role: Role): boolean {
  return canAccessIncoming(role);
}

export function canCorrectShippedAt(role: Role): boolean {
  return role === "admin";
}

export function canAccessTransfers(role: Role): boolean {
  return role === "editor" || role === "admin";
}

export function canWriteTransfers(role: Role): boolean {
  return canAccessTransfers(role);
}

/** List + detail (learn BOM). UI opens in Step 3. */
export function canAccessBundles(role: Role): boolean {
  return role === "sales" || role === "editor" || role === "admin";
}

export function canWriteBundles(role: Role): boolean {
  return role === "admin";
}

export function canAccessAuditLog(role: Role): boolean {
  return role === "sales" || role === "editor" || role === "admin";
}

export function canAccessSettings(role: Role): boolean {
  return role === "admin";
}

export function canAdjustStock(role: Role): boolean {
  return role === "editor" || role === "admin";
}

export function canCreateProduct(role: Role): boolean {
  return role === "admin";
}

export function canEditProduct(role: Role): boolean {
  return role === "editor" || role === "admin";
}

export function canBindShopify(role: Role): boolean {
  return role === "admin";
}

export function canCreateSalesRecord(role: Role): boolean {
  // Explicit whitelist: any future role added to ROLES defaults to no
  // access unless listed here, instead of silently inheriting permission
  // via a `!== "viewer"` blacklist.
  return role === "sales" || role === "editor" || role === "admin";
}

export function canEditSalesRecord(role: Role): boolean {
  return role === "sales" || role === "editor" || role === "admin";
}

export function canEditFulfillment(role: Role, status: string): boolean {
  if (status === "deposit_paid") {
    return role === "admin" || role === "editor" || role === "sales";
  }
  if (status === "fully_paid") {
    return role === "admin" || role === "editor";
  }
  return false;
}

export function canManageLocations(role: Role): boolean {
  return role === "admin";
}

export function canManageUsers(role: Role): boolean {
  return role === "admin";
}

export function canRunSync(role: Role): boolean {
  return role === "admin";
}

export function canSeeDashboardActions(role: Role): boolean {
  return role === "sales" || role === "editor" || role === "admin";
}

/** Any signed-in role. Mobile chrome is structurally read-only regardless of role. */
export function canAccessMobileView(role: Role): boolean {
  return (
    role === "viewer" ||
    role === "sales" ||
    role === "editor" ||
    role === "admin"
  );
}

export function prefersOwnWarehouseTab(role: Role): boolean {
  return role === "editor" || role === "sales";
}
