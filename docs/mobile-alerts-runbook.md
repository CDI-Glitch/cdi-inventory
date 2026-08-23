# CDI Inventory — 移动端只读库存查询

> 配套：`constitution.md` §E / §G；权限函数 `canAccessMobileView`（`src/lib/permissions.ts`）
> 确立日期：2026-08-23
> URL：`/m`（首页）、`/m/inventory`（列表 / Forecast / Short）

---

## 1. 为什么独立路由而不是给桌面页加断点

桌面 Inventory 是宽 CSS grid，Forecast 还会按货柜加列，375px 下无法可靠重排。

更关键：**权限边界不能靠 `md:hidden` 藏按钮。** 把窗口拉窄不等于进入只读模式。`/m/*` 在结构上不 import 任何表单、不渲染任何写路由链接。访问者桌面角色是 admin 也一样。

---

## 2. 范围内 / 外

| 有 | 没有 |
|---|---|
| 普通库存卡片（On Hand / Reserved / Available / Status） | Adjust Stock、Add SKU |
| Forecast（只读投影 + Incoming only） | 销售单详情、Aged / AGING / STALE |
| Short：仅 `Available < 0` | Incoming / Transfers / Bundles / Settings |
| 仓库 Tab + 搜索 + 分类 | SKU 详情页（含绑定/调整） |
| | Factory list CSV |

逾期预留（Aged）留在桌面 `?backorder=1`。它要链到 `/sales/[id]` 才有意义，而该页会按角色露出编辑控件，会越过「移动端永远只读」。

---

## 3. 安全边界

| 层 | 行为 |
|---|---|
| 登录 | 与桌面同一 NextAuth session；未登录 → `/login?callbackUrl=/m` |
| 访问 | `canAccessMobileView`：viewer / sales / editor / admin 均可 |
| 只读 | `/m` 页面不 import 写组件；SKU 是纯文字，不链 `/inventory/[sku]`、`/sales/[id]`、`/incoming/[id]` |
| 数据 | Short 模式 `includeAging: false`，不调用 `getAgingReservations()` |
| 桌面 | `/inventory/adjust` 等既有 403 / redirect **不改** |

硬打开桌面 URL（例如 `/sales/xyz`）仍走桌面权限：viewer 看到只读详情，sales/editor/admin 仍可能看到编辑按钮。这是桌面行为，不是 `/m` 的漏洞。`/m` 的承诺是 **不提供通往这些页的入口**。

---

## 4. 数据复用

- `src/lib/inventory-view.ts` → `buildInventoryView`（桌面 Inventory 与 `/m/inventory` 共用）
- `src/lib/dashboard-stats.ts` → `getLowStockRows` / `countShortSkus`
- 改公式只改这些 helper，禁止在 `/m` 页面复制一套 ATP

---

## 5. 回归

- [ ] 四种角色都能打开 `/m` 和 `/m/inventory`
- [ ] `/m` 源码与渲染 HTML 中无 `/inventory/adjust`、`/inventory/new`、`/sales/`、`/incoming/`
- [ ] Short 列表无 Aged 徽标、无销售单号链接
- [ ] Forecast 货柜号不可点进 Incoming
- [ ] 未登录访问 `/m` → 登录后回到 `/m`
- [ ] 桌面 Inventory Backorder 仍有 Aged / Aging only / 销售单链接
- [ ] 375px 视口无横向溢出
