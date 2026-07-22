# CDI 库存系统 — 设计宪法 v2.0

> 所有架构决策已确认。本文档为最终规格说明。
> 状态：已审计通过 — 2026-07-19
> 最后更新：2026-07-21（SKU 导入阶段完成，权限矩阵精化，reorderPoint inline 编辑，新增 SKU 分类）

---

## 已确认决策

| # | 决策 | 选择 | 原因 |
|---|---|---|---|
| 1 | 初始库存 | 纯日志模式 — 第一条 InventoryLog 就是初始库存 | 计算公式永远只有一个：`SUM(所有日志)` |
| 2 | 销售记录状态 | 单一 `status` 字段 + 状态机控制 | 不可能出现三个字段不一致的情况 |
| 3 | Bundle 组件展开 | 内部表；在订单详情 + SKU 详情 + Admin 审计页展示 | Staff 界面简洁，Admin 可全局审计 |
| 4 | 到货结构 | 主从表（IncomingShipment + IncomingLine） | 一次发货 = 一条主记录 + 多行明细，不重复填写 |
| 5 | 在途追踪 | 5 状态：pending → shipped → in_transit → arrived → confirmed | 完整供应链可视化 |
| 6 | 确认后修改 | SalesLine（客户订单层）确认后不允许撤回；GeneratedMovement（履约层）Admin 可在 deposit_paid/fully_paid 阶段调整，每次写 `reservation_adjustment` 审计日志 | 两层分离：客户合同不可改，实际发货可换料 |
| 7 | Excel 导入 | Phase 2 | 先手动验证流程正确性 |
| 8 | 安装排期 | 不做（用 Monday.com） | 不是 Portal 该做的事 |
| 9 | 收款记录 | 不做（用 Zoho Invoice） | 不是 Portal 该做的事 |
| 10 | 库存/销售默认视图 | 按仓库 Tab 分开展示；editor 默认自己仓库，admin/viewer 默认 All | 避免 Brisbane 和 Sydney 数据混在一起难以阅读 |

---

## A. 设计哲学

### A1. 核心公理（不可违反）

| # | 公理 |
|---|---|
| 1 | **唯一数据源** — Portal 拥有所有库存数字。Shopify 只展示 Portal 告诉它的数字。 |
| 2 | **每次变动必有原因** — 库存数字不会无缘无故改变。每一笔 +/- 都关联到一条日志。 |
| 3 | **不可能的状态无法表示** — 类型系统+验证层阻止非法操作。 |
| 4 | **大声失败，不静默失败** — 同步失败：记录错误 + 仪表板红灯 + 自动重试。 |
| 5 | **离线安全** — Portal 宕机时，Shopify 用上次同步的库存继续卖。恢复后补处理。 |
| 6 | **渐进复杂度** — 上线第一天的 UX 比 Sheet 简单。高级功能藏在 Admin 或 Phase 2。 |

### A2. 对比 Excel 的 5 个结构性缺陷

| # | Excel 问题 | Portal 解法 |
|---|---|---|
| 1 | 无并发编辑保护 | 乐观锁机制 |
| 2 | 无状态机约束 | 后端强制验证所有状态转换 |
| 3 | 无 Shopify 同步 | 变动自动触发同步 |
| 4 | 公式脆弱 | 代码级计算函数 |
| 5 | 无审计追踪 | 每次变动全量记录 |

---

## B. 数据库 Schema（14 个模型）

### User（用户）
```
id, email, passwordHash, name, role(viewer|editor|admin), active, createdAt
```

### Location（仓库位置）
```
id, name("Brisbane"|"Sydney"), shopifyLocationId, active
```

### Product（产品/SKU）
```
id, sku(唯一), name, category, unit, reorderPoint, active,
adminNotes, shopifyInventoryItemId, shopifyVariantId, createdAt, updatedAt
```
- 无 openingStock 字段 — 初始库存通过第一条 InventoryLog 记录
- SKU 格式：`^[A-Z0-9\-]+$`
- category（当前已启用，含义如下）：

| 值 | 含义 |
|---|---|
| `CANOPY` | 车顶篷主体 |
| `TRAY_DECK` | 货架底板 |
| `SERVICE_BODY` | 服务车厢（CMS Lite 系列） |
| `UNDERBODY_TOOLBOX` | 底部边箱（C型/T型/Tie-Down Bar） |
| `CHASSIS_PANEL` | 底盘面板（灯板/中间面板） |
| `CHASSIS_DRAWER` | 底盘抽屉（VTD Trundle Drawer） |
| `HEADBOARD` | 头板 |
| `MUDGUARD` | 挡泥板 |
| `ROOF_RACK` | 车顶架 |
| `REAR_RACK` | 后架 |
| `CANOPY_ACCESSORY` | Canopy 配件（Jerry Can / Spare Wheel 等） |
| `FITTING_KIT` | 安装套件（Bolt & Nut Kit / FK） |
| `UNISTRUT` | C Channel 导轨（Canopy Top C Channel） |

### InventoryLog（库存变动日志）— 核心表
```
id, productId, locationId, type, delta(+/-), reference, enteredBy, notes, createdAt
```
type 枚举：`opening_stock | receive_stock | sales_deduction | adjustment_in | adjustment_out | write_off | stocktake_correction | transfer_out | transfer_in`

### SalesRecord（销售记录）
```
id, recordId(SR-0001), date, quoteNo, invoiceNo, customer,
status, staffNotes, locationId, shopifyOrderId(唯一), version, createdAt, updatedAt
```
status：`quote | deposit_paid | fully_paid | completed | cancelled`

**字段语义：**
- `quoteNo`：Quote/Draft 阶段的 Zoho Quote 号（可选，`quote` 状态可编辑，之后只读）
- `invoiceNo`：`quote → deposit_paid` 转换时一次性填入（可选），之后**永久只读，不得修改**
  - 理由：Invoice 号是审计锚点，可能已发给客户或在 Zoho/MYOB 有对应记录，改了会导致对账混乱
  - 填错了唯一出路：cancel 此记录，重新开单
- `quote` 状态 = Draft，无库存副作用，所有字段（头部 + 行）均可通过 Portal 编辑
- `deposit_paid` 及之后所有字段均锁定，仅 `invoiceNo` 可在转换动作本身时填入

### SalesLine（销售行）
```
id, salesRecordId, lineType("sku"|"bundle"), itemCode, qty, notes, sortOrder, createdAt
```
- 一张 SalesRecord 对应多条 SalesLine（最少 1 条）
- **语义：客户订的 / Invoice 依据** — `quote` 状态下可编辑，`deposit_paid` 后永久锁定
- `lineType = "bundle"` 时，`reserveStock()` 自动按 BOM 展开预留所有组件

### GeneratedMovement（履约预留 / 实际发货层）
```
id, salesRecordId, productId, locationId, reservedQty, createdAt
```
- **语义：实际要从仓库拿的货** — 与 SalesLine 分开，允许分叉（换料场景）
- `quote → deposit_paid` 时首次生成（按 SalesLine 展开）
- `deposit_paid` / `fully_paid` 阶段：**Admin 可调整**（换料/增减），每次写 `reservation_adjustment` 日志（delta=0，不影响 On Hand）
- `fully_paid → completed` 时：按此层扣减 On Hand（`sales_deduction` 写入 InventoryLog）
- `→ cancelled`：`reservedQty` 归零（释放）
- 两层分叉时，Sales detail 页面显示 ⚠ 标记，所有 Staff 可见

### BundleDefinition（Bundle 定义）
```
id, code(唯一), name, productFamily, active, createdAt
```

### BundleItem（Bundle 组件）
```
id, bundleId, productId, qty, componentRole, required, sortOrder, notes
```
componentRole：`main_body | body_attachment | tray_mount | hardware_bracket`

### IncomingShipment（到货发货单 — 主表）
```
id, reference, supplier, trackingNo, eta, status, locationId, notes, createdBy, createdAt, updatedAt
```
status：`pending | shipped | in_transit | arrived | confirmed`

### IncomingLine（到货明细行 — 从表）
```
id, shipmentId, productId, expectedQty, actualQty
```

### Transfer（调货）
```
id, fromLocationId, toLocationId, productId, qty, status, notes, createdBy, createdAt, completedAt
```
status：`pending | in_transit | completed | cancelled`

### SyncLog（Shopify 同步日志）
```
id, productId, locationId, sentQty, status(success|failed|pending), error, attempts, createdAt
```

### ProcessedWebhook（Webhook 去重）
```
id, shopifyOrderId(唯一), topic, processedAt
```

---

## C. 状态机

### C1. 销售记录

```
[创建] → quote → deposit_paid → fully_paid → completed (终态)
           │            │              │
           ▼            ▼              ▼
        cancelled    cancelled      cancelled (终态)
```

| 状态 | 含义 | 库存影响 |
|---|---|---|
| `quote` | 报价中 | 无 |
| `deposit_paid` | 已收订金 | Reserved +qty |
| `fully_paid` | 已付全款 | 仍预留（不变） |
| `completed` | 已完成 | On Hand -qty，Reserved -qty |
| `cancelled` | 已取消 | Reserved -qty（释放） |

合法转换：

| 当前状态 | 可转换到 |
|---|---|
| `quote` | `deposit_paid` / `cancelled` |
| `deposit_paid` | `fully_paid` / `cancelled` |
| `fully_paid` | `completed` / `cancelled` |
| `completed` | 无（终态） |
| `cancelled` | 无（终态） |

转换触发：

| 转换 | 自动执行 |
|---|---|
| `quote → deposit_paid` | 迭代所有 SalesLine → 展开组件 → 创建 GeneratedMovement |
| `deposit_paid` / `fully_paid` 期间 | Admin 可调整 GeneratedMovement（换料）→ 写 `reservation_adjustment` 日志 |
| `deposit_paid → fully_paid` | 无库存操作 |
| `fully_paid → completed` | reservedQty 归零 + InventoryLog(`sales_deduction`) |
| `→ cancelled` | reservedQty 归零（释放） |

### C2. 到货发货单

```
[创建] → pending → shipped → in_transit → arrived → confirmed (终态)
           │          │
           ▼          ▼
        cancelled  cancelled (终态)
```

确认时：每行 `actualQty > 0` → InventoryLog(`receive_stock`, delta = actualQty)

### C3. 调货

```
[创建] → pending → in_transit → completed (终态)
           │            │
           ▼            ▼
        cancelled    cancelled (终态)
```

| 转换 | 源仓库 | 目标仓库 |
|---|---|---|
| `pending → in_transit` | On Hand -= qty | 无变化 |
| `in_transit → completed` | 无变化 | On Hand += qty |
| `in_transit → cancelled` | On Hand += qty（恢复） | 无变化 |

---

## D. 库存计算（唯一公式）

```
On Hand  = SUM(InventoryLog.delta) WHERE productId AND locationId
Reserved = SUM(GeneratedMovement.reservedQty) WHERE productId AND locationId AND reservedQty > 0
Available = On Hand - Reserved

状态判断：
  Available <= 0           → OUT_OF_STOCK
  Available <= ReorderPoint → REORDER
  其他                      → OK
```

无快照表。无缓存值。永远从源头实时计算。

---

## E. 页面与导航

```
仪表板 (Dashboard)     ← 库存概览、警报、同步健康
库存 (Inventory)       ← SKU 库存列表（位置 Tab 筛选）
  └─ 调整 (Adjust)     ← 手动调整（仅 Admin）
销售 (Sales)           ← 销售记录（位置 Tab 筛选）
Bundle 管理            ← Bundle 定义（仅 Admin）
到货 (Incoming)        ← 工厂发货单
调货 (Transfers)       ← 仓库间调拨
审计日志 (Audit Log)   ← 全局变动时间线（仅 Admin）
设置 (Settings)        ← 用户/仓库/Shopify（仅 Admin）
```

---

## L. 位置 Tab 筛选 UI 约定

> 确认于 2026-07-20

### L1. 适用页面

**库存 (Inventory)** 和 **销售 (Sales)** 页面顶部固定显示位置 Tab 切换条。其他页面（到货、调货）目前不需要。

### L2. Tab 布局规则

- Tab 顺序：`Brisbane` | `Sydney` | _(分隔)_ `All locations`
- `All locations` 放在最右，通过左侧 `ml-4` 视觉间距与单仓 Tab 区分
- 选中状态：蓝色下划线 `border-[#2563EB]` + 蓝色文字
- 未选中：灰色文字，hover 变深灰色 + 浅灰色下划线
- 仓库 Tab 顺序由数据库 `Location.name ASC` 决定（不硬编码）

### L3. 默认 Tab 规则（按角色）

| 角色 | 未带 `loc` 参数时默认显示 |
|---|---|
| `editor` | 用户名与某仓库名完全匹配（大小写不敏感）时，默认该仓；否则默认 All |
| `admin` | All locations |
| `viewer` | All locations |

> 用户名与仓库匹配逻辑依赖 `session.user.name` 与 `Location.name` 的 `toLowerCase()` 比对。

### L4. URL 参数约定

- 参数名：`loc`，值为仓库的 `Location.name`（如 `Brisbane`、`Sydney`）
- 空值或不带参数 = All locations
- 切换 Tab 时清除 `page` 分页参数，保留其他所有 `searchParams`
- Filter 表单提交时通过 `<input type="hidden" name="loc" value={currentLoc} />` 保持当前 Tab

### L5. 库存表列变化（单仓 vs 全部）

| 模式 | 列结构 |
|---|---|
| 单仓（`loc` 有值） | SKU / Name / Category / **On Hand / Reserved / Available** / Status |
| 全部（`loc` 空） | SKU / Name / Category / **[Brisbane] × 3列 / [Sydney] × 3列 / Total Available** / Status |

---

## F. Shopify 集成

```
Shopify 客户下单付款 → orders/paid Webhook → Portal 接收（HMAC 验证+去重）
→ 自动创建 SalesRecord (fully_paid) → 计算 Available → 推送到 Shopify
```

- Webhook 安全：HMAC-SHA256
- 幂等性：ProcessedWebhook 按 shopifyOrderId 去重
- 失败重试：SyncLog 记录，最多 3 次

---

## G. 权限矩阵

| 功能 | Viewer | Editor | Admin |
|---|---|---|---|
| 仪表板/库存列表/销售查看 | 能 | 能 | 能 |
| 销售创建/编辑 | 不能 | 能 | 能 |
| 到货/调货 | 不能 | 能 | 能 |
| 手动调整库存 (Adjust Stock) | 不能 | 能 | 能 |
| 编辑 Reorder Point | 不能 | 能 | 能 |
| **调整履约预留（换料，deposit_paid/fully_paid）** | **不能** | **不能** | **能** |
| 新建 SKU | 不能 | 不能 | 能 |
| Bundle 管理 | 不能 | 不能 | 能 |
| 审计日志查看 | 不能 | 不能 | 能 |
| 设置（用户/仓库/Shopify） | 不能 | 不能 | 能 |

---

## H. 边界场景

| # | 场景 | 处理 |
|---|---|---|
| 1 | 并发修改同一记录 | 乐观锁 → 409 冲突提示 |
| 2 | Webhook 到达时宕机 | Shopify 48h 重试 + 唯一约束防重复 |
| 3 | On Hand < Reserved | 允许；仪表板 WARNING；Shopify 显示缺货 |
| 4 | Bundle 修改后对旧订单 | SalesLine 是不可变客户订单快照；GeneratedMovement（履约层）Admin 可独立调整 |
| 5 | 标完成但未取走 | `stocktake_correction` 冲正 |
| 6 | Shopify 产品被删 | SyncLog 404 → 仪表板告警 |
| 7 | 调货途中丢失 | 取消调货 + `write_off` |
| 8 | 初始库存填错 | `stocktake_correction` |
| 9 | Webhook 含未知 SKU | 创建为 `quote` + 告警 |
| 10 | 到货确认后数量错 | 不撤回；`stocktake_correction` |

---

## H2. 操作规范（人工流程约定）

| # | 场景 | 正确做法 |
|---|---|---|
| 1 | 付押金后要给客户加一个新品 | 开**新的 SalesRecord**（`quote` 状态），不要在旧单的履约层追加 |
| 2 | 备货时发现需要换料 | 在原单 Fulfillment 层调整（Admin），换料写 `reservation_adjustment` 日志 |
| 3 | 客户付尾款前核对 | 打开 Sales detail，对比 Order lines（客户订的）和 Fulfillment（实际预留），确认无误后点 Mark completed |
| 4 | Available 显示负数 | 正常（Back Order 状态，宪法 H#3 允许）；安排补货/调货后负数会自动归正 |

---

## I. 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Next.js (App Router) — 最新稳定版 |
| ORM | Prisma |
| 数据库 | PostgreSQL (Railway) |
| 认证 | NextAuth.js v5 |
| UI | Tailwind CSS + Shadcn/ui |
| 验证 | Zod |
| 部署 | Railway Pro ($5/月) |
| 语言 | TypeScript (strict) |

---

## J. 不做的功能

| 功能 | 替代 |
|---|---|
| 安装排期 | Monday.com |
| 收款/开票 | Zoho Invoice |
| 完整 ERP | 未来评估 |
| 条码扫描 | Phase 2+ |
| 拣货单 | Phase 2 |
| Xero 集成 | 未来评估 |
| Excel 导入（批量） | ✅ 已实现：`scripts/import-*.ts` 脚本体系 |

---

## M. SKU 导入脚本体系（`scripts/`）

> 已完成 Phase 2 Excel 批量导入，通过 Railway Console 执行 `npx tsx scripts/import-*.ts`。

| 脚本 | 分类 | SKU 数 | 状态 |
|---|---|---|---|
| `import-skus.ts` | CANOPY | ~60 | ✅ |
| `import-lc79-trays.ts` | TRAY_DECK | 13 | ✅ |
| `import-canopy-cchannel.ts` | UNISTRUT | ~12 | ✅ |
| `import-fitting-kit.ts` | FITTING_KIT | 2 | ✅ |
| `import-underbody-toolbox.ts` | UNDERBODY_TOOLBOX | 24 | ✅ |
| `import-t-profile-toolbox.ts` | UNDERBODY_TOOLBOX | 18 | ✅ |
| `import-tie-down-bars.ts` | UNDERBODY_TOOLBOX | 12 | ✅ |
| `import-headboard.ts` | HEADBOARD | 3 | ✅ |
| `import-tail-light-panels.ts` + `fix-tail-light-skus.ts` | CHASSIS_PANEL | 5 | ✅ |
| `import-tray-panels.ts` | CHASSIS_PANEL | 11 | ✅ |
| `import-mudguards.ts` | MUDGUARD | 9 | ✅ |
| `import-vtd-drawers.ts` | CHASSIS_DRAWER | 3 | ✅ |
| `import-tray-decks.ts` | TRAY_DECK | 13 | ✅ |
| `import-service-bodies.ts` | SERVICE_BODY | 16 | ✅ |
| `import-bolt-nuts.ts` | FITTING_KIT | 7 | ✅ |
| `import-roof-racks.ts` | ROOF_RACK | 12 | ✅ |
| `import-rear-racks.ts` | REAR_RACK | 3 | ✅ |
| `import-jerry-spare.ts` | CANOPY_ACCESSORY | 6 | ✅ |

---

## K. 目录结构

```
c:\Users\CoreD\Desktop\shopify\cdi-inventory\
├── docs/dev-sop.md
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── (auth)/login/
│   │   ├── (portal)/dashboard|inventory|sales|bundles|incoming|transfers|audit-log|settings/
│   │   └── api/webhooks/shopify/ + api/sync/
│   ├── lib/db.ts|inventory.ts|state-machine.ts|shopify.ts|auth.ts|constants.ts
│   ├── components/
│   └── types/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```
