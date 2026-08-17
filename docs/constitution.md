# CDI 库存系统 — 设计宪法 v2.2

> 所有架构决策已确认。本文档为最终规格说明。
> 状态：已审计通过 — 2026-07-19
> 最后更新：2026-08-16（决策 17 Sellable Bundle / Shopify 派生 kits；Webhook 行为对齐现网）

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
| 11 | Bundle 策略 | Soft BOM + 行级 `snapshotItems`；硬件快捷包与可售 Tray BOM 并存。改 Bundle 定义不得回溯改 quote 期已保存的行 | 车型/颜色/尺寸组合不可穷举；可售 Tray 是另一类 Bundle（决策 17），不破坏快照原则 |
| 12 | 自动预留审计 | `reserveStock` / `releaseReservations` 每条组件写 `reservation_adjustment`（delta=0） | Audit Log 与手动换料路径一致，避免「有预留但无 Log」误解 |
| 13 | Admin 账号隔离 | `dev@` = admin；`admin@cdi.com.au` = editor（老板日常） | Audit Log 操作人可分清；详见 `auth-permissions-runbook.md` |
| 14 | 未来库存预测（Forecast Mode） | 只读投影，不写入任何数据、不创建预留/pegging 概念；共享货柜列模型（同仓所有 SKU 看到相同的最多 5 个货柜列）；显示顺序为最远 ETA 在左、最近 ETA 在右（紧贴 On Hand）；`Future Available[ETA] = On Hand − Reserved + Σ qtyOrdered(ETA ≤ 该列)`；ETA 新建必填（不回溯旧记录）；`shippedAt`（实际发货日）首次在 pending→shipped 时必填，之后普通 editor 锁定，仅 admin 可通过独立纠正接口修改并写 `shipped_at_correction` 审计日志 | 对齐 ERP 行业惯例（Time-Phased ATP）；最近到港贴在当前库存旁更直觉；因为不落库、不建立预留，天生不存在"释放"边界问题；ETA(计划) vs shippedAt(实际) 是 SAP/NetSuite 通用的 Planned/Actual 日期模式 |
| 15 | 外购辅材（CONSUMABLE） | 复用现有 Product/InventoryLog/IncomingShipment 表，新增 `category = "CONSUMABLE"`；不做独立表 | 辅材仍需走 Incoming 发货单+Forecast，独立表会被迫复制整套 Incoming/Forecast 逻辑；用 Category 硬性排除 Bundle 与 Sales 已足够隔离 |
| 16 | 逾期预留 / 缺货预警（Aging Reservations & Backorder Alerts） | 不新增字段，纯派生计算：以 `GeneratedMovement.createdAt`（`deposit_paid` 时创建）算预留年龄；年龄信号（AGING ≥14 天 / STALE ≥21 天）与库存信号（BACKORDERED：Available<0）各自独立展示为两个徽标，不合并成单一"严重等级"；仪表板按仓库筛选（All/Brisbane/Sydney），Inventory 页新增与 Forecast Mode 平行的 `backorder=1` 独立模式（二者互斥，不叠加显示）；缺货行额外查询最近一个在途货柜（复用 Forecast Mode 的合格条件）作为"预计何时补上"提示 | 对齐 ERP 行业惯例的账龄分析（Aging Analysis）+ ATP 例外管理；两个信号分开显示避免"该催客户"和"该催供应链"混淆；数据随订单完成/取消/补货自动从清单消失，不需要人工标记已处理；阈值先写死常量，内部小系统暂不做 Settings 可调项（渐进复杂度原则） |
| 17 | Sellable Bundle（Tray kits → Shopify） | 不建壳 Product。`BundleDefinition` 持有 `sellableSku` + Shopify ID；kits = MIN(约束组)；替代组求和；`nonConstraining` 不卡 ATP；kits 按仓缓存；PDP 读缓存。共用件窗口接受 + 仪表板预警 | 网站 Tray 是组合件；Portal 零件账不能复制一份假库存。详见 `docs/bundle-shopify-sync.md` |

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

## B. 数据库 Schema（15 个模型）

### User（用户）
```
id, email, passwordHash, name, role(viewer|sales|editor|admin), active, createdAt
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
| `DROP_SIDES` | 侧栏板 |
| `12V` | 12V 电气件（LED 灯带等） |
| `CONSUMABLE` | 外购辅材/耗材（螺栓、垫片等，手动扣减，见 §D3） |

### InventoryLog（库存变动日志）— 核心表
```
id, productId, locationId, type, delta(+/-), reference, enteredBy, notes, createdAt
```
type 枚举：`opening_stock | receive_stock | sales_deduction | adjustment_in | adjustment_out | write_off | stocktake_correction | transfer_out | transfer_in | reservation_adjustment`

**`reservation_adjustment`（delta 恒为 0）：**
- 不改变 On Hand；只记录 Reserved 语义变动，供 Audit Log 透明展示
- 写入路径（三处必须齐全）：
  1. `quote → deposit_paid` 自动预留（`reserveStock`）
  2. `→ cancelled` 自动释放（`releaseReservations`）
  3. Admin 在 deposit_paid / fully_paid 手动换料（`movements` API）

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
id, salesRecordId, lineType("sku"|"bundle"), itemCode, qty, notes, sortOrder,
snapshotItems(Json?), createdAt
```
- 一张 SalesRecord 对应多条 SalesLine（最少 1 条）
- **语义：客户订的 / Invoice 依据** — `quote` 状态下可编辑，`deposit_paid` 后永久锁定
- `lineType = "bundle"` 时：
  - 保存行时把当时的 BOM 写入 `snapshotItems`：`[{productId, sku, name, qty}, ...]`
  - `reserveStock()` **优先读 `snapshotItems`**；无快照的旧行才回退查 live `BundleDefinition`
  - 之后改 Bundle 定义 **不会**改变已保存行的展开结果
- Sales detail 的 Order lines 可折叠查看组件；Fulfillment 对比时须把 bundle 组件 qty 与独立 SKU 行 **合并计数**

### GeneratedMovement（履约预留 / 实际发货层）
```
id, salesRecordId, productId, locationId, reservedQty, createdAt
```
- **语义：实际要从仓库拿的货** — 与 SalesLine 分开，允许分叉（换料场景）
- `quote → deposit_paid` 时首次生成（按 SalesLine / snapshot 展开）并写 `reservation_adjustment` 审计
- `deposit_paid` / `fully_paid` 阶段：**Admin 可调整**（换料/增减），每次写 `reservation_adjustment` 日志（delta=0，不影响 On Hand）
- `fully_paid → completed` 时：按此层扣减 On Hand（`sales_deduction` 写入 InventoryLog）
- `→ cancelled`：`reservedQty` 归零（释放）并写 `reservation_adjustment` 审计
- 两层分叉时，Sales detail 页面显示 ⚠ 标记，所有 Staff 可见

### BundleDefinition（Bundle 定义）
```
id, code(唯一), name, productFamily, active,
sellableSku(唯一, 可空), shopifyInventoryItemId, shopifyVariantId, createdAt
```

**设计约定（Soft BOM / 快捷包 + 可售 Tray）：**
- 硬件快捷包：无 `sellableSku`，不推 Shopify（CMS Dual/Single cab 包照旧）
- 可售 Tray（决策 17）：有 `sellableSku`，kits 派生后缓存并推 Shopify。不建壳 Product
- 已上线硬件包：

| code | 用途 | 组件（每包 qty） |
|---|---|---|
| `BDL-CMS-HW-DUALCAB` | Dual / Extra Cab 硬件快捷包 | FK×3，TT-BN-BX/MG×1，TT-BN-DNP×1，TT-BN-FK×1，TT-BN-FKT×1，CXH×1 |
| `BDL-CMS-HW-SINGLECAB` | Single Cab 硬件快捷包 | FK×4，其余同上 |

- T-Tray 可售包见 `docs/bundle-shopify-sync.md`
- Phase 2：规则型 Configurator（选车型/配件 → 生成可编辑草案清单），仍应写 `snapshotItems`

### BundleItem（Bundle 组件）
```
id, bundleId, productId, qty, componentRole, required, sortOrder, notes,
nonConstraining, altGroupKey
```
componentRole：`main_body | body_attachment | tray_mount | hardware_bracket`
- `nonConstraining=true`：进预留/领料，不进 kits ATP
- `altGroupKey`：同 bundle 内同 key 互为替代，ATP 对组内 available 求和；预留不自动占这组。销售单按 `(lineId, altGroupKey)` 手选一个 SKU 后才写入预留；未凑够数量不能 Completed

### BundleLocationStock（kits 缓存）
```
id, bundleDefinitionId, locationId, cachedKits, updatedAt
```
- 每个可售 bundle × 仓库一行
- Worker `/api/internal/inventory` 对 `sellableSku` 只读此表，不现场算 BOM

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
| `quote → deposit_paid` | 迭代所有 SalesLine → 按 `snapshotItems`（或 live BOM）展开 → 创建 GeneratedMovement + 每组件 `reservation_adjustment` |
| `deposit_paid` / `fully_paid` 期间 | Admin 可调整 GeneratedMovement（换料）→ 写 `reservation_adjustment` 日志 |
| `deposit_paid → fully_paid` | 无库存操作 |
| `fully_paid → completed` | reservedQty 归零 + InventoryLog(`sales_deduction`) |
| `→ cancelled` | reservedQty 归零（释放）+ 每组件 `reservation_adjustment` |

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

## D2. Forecast Mode（未来库存预测 — 只读投影）

行业对照：MRP/ERP 系统的 Time-Phased Available-to-Promise（时间分段可用量），把未来供应事件（货柜到港）按时间顺序排列，滚动累计"截至该事件时的可用量"。

**核心原则：Forecast Mode 不产生任何数据库写入**（除了 ETA/shippedAt 本身的编辑，那属于 IncomingShipment 主数据维护，不是"预测"逻辑）。每次页面加载都从当前真实数据重新计算，因此 ETA 调整、货柜取消、短装、预留取消等都会在下次查看时自动反映——不存在"未来预留"需要释放的边界问题，因为从未创建过预留。

```
适用货柜：status IN (shipped, in_transit, arrived) AND eta IS NOT NULL
排序：eta ASC 取最近 5 个，显示时反转（最远在左、最近在右，紧贴 On Hand）
列数上限：5（累计 Future Available 同样封顶在第 5 列，不隐藏额外累加）

同一货柜同一 SKU 多行 → 先按 productId 汇总 qtyOrdered，再计算

Future Available[ETA] = On Hand − Reserved + Σ qtyOrdered(所有 ETA ≤ 该列 的货柜)
（显示上：越靠右 = 越近的时间；越靠左 = 更远的未来，累计供应更多）
```

- **列模型**：共享货柜列——同一仓库的所有 SKU 在 Forecast 视图里看到相同的最多 5 个时间列；某 SKU 在某货柜没有行，该列显示 0/空（不是"每个 SKU 独立的下一批到货"）。显示顺序：最远 ETA 在左、最近 ETA 在右（`Next 1` = 最近一柜，紧贴 On Hand）。
- **仓库范围**：Forecast Mode 仅在单一仓库视图下可用（当前 Inventory 页本身就是单仓库范围，没有"All locations"聚合模式，因此不存在需要额外禁用的跨仓聚合场景）。
- **可见性 vs 编辑权限**：所有角色（含 sales/viewer）都能查看 Forecast 列（只读展示）；只有 editor+ 能调整 ETA 或录入/纠正 shippedAt。
- **免责声明**：每次点击开启 Forecast Mode 都会弹出一次性可关闭的提示弹窗，说明数字仅为估算，不是对特定货柜的锁定预留。
- **`shippedAt`（实际发货日）**：在 `pending → shipped` 转换时首次必填录入；录入后对普通 editor 锁定（无法通过状态转换接口覆盖），仅 admin 能通过独立的 `/api/incoming/[id]/shipped-at` 纠正接口修改，且每次修改都会为该发货单涉及的每个不同 `productId` 写一条 `delta:0` 的 `InventoryLog`（`type: shipped_at_correction`），可在 `/audit-log` 按 SKU 或类型筛选查看。此字段纯记录用途，从不参与库存数学计算。这是 SAP/NetSuite 等系统里 Planned（ETA）vs Actual（shippedAt）日期模式的落地。

---

## D3. 外购辅材（CONSUMABLE）— 手动库存

**背景**：外六角螺栓、尼龙垫片等外购五金/耗材，采购数量大（如 M8*25 一次 1000 颗），实际消耗跟具体某台车/某个 Bundle 无固定对应关系，不适合走 Bundle 组件互斥/绑定规则或按销售单自动预留，而是靠仓库人员在生产消耗后手动在 Adjust Stock 页面扣减。

**设计：不建独立表，复用现有 Product/InventoryLog/IncomingShipment，新增 `category = "CONSUMABLE"`**：

```
参与（无需改动，直接复用现有逻辑）：
  - Incoming 发货单 + Forecast Mode      → IncomingLine.productId 本来就是任意 Product 的 FK
  - Adjust Stock（手动增减）              → 日常消耗的正确入口
  - Dashboard 低库存预警 / Inventory REORDER 状态 → 正常参与，跟普通 SKU 一样提醒补货
  - Shopify 同步                          → 天然不同步，只要不绑定 shopifyInventoryItemId

硬性排除（代码层面 UI + API 双重校验）：
  - Bundle 组件选择器 + POST/PUT /api/bundles      → category === "CONSUMABLE" 时 400
  - 销售单 SKU 行选择器 + POST /api/sales, PUT /api/sales/[id]/lines → category === "CONSUMABLE" 时 400（"SKU not sellable"）
```

**SKU 命名约定**：`sku` 字段对辅材类只是一个无实际含义的递增代号（如 `CSM0001`、`CSM0002`），真实信息放在 `name` 字段的中文描述里（如"尼龙垫片M13*50*10"）。不引入额外的 schema 校验，纯数据录入约定。

**为什么不用独立表**：`IncomingLine.productId` 已经是无 Category 限制的通用 FK，Forecast Mode/ETA/shippedAt 全部挂在这条关系上；独立表意味着要么把整套 Incoming/Forecast 复制一份，要么让 `IncomingLine` 支持多态外键（Prisma 不直接支持，需手写兼容层）。一个 Category 字段 + 两处硬性排除，已经达到"不跟 Bundle 互斥/绑定规则挂钩、靠手动扣减"的全部诉求，且零额外维护成本。

---

## D4. 逾期预留 / 缺货预警（Aging Reservations & Backorder Alerts）

**背景**：客户付押金（`deposit_paid`）后，履约层会创建 `GeneratedMovement` 预留库存。如果这笔预留一直挂着没有转 `completed`，可能是「该催客户付尾款/确认要不要退款」（纯时间问题），也可能是「这个 SKU 已经透支，需要靠未来货柜补上」（供应链问题）。这两种情况过去都没有任何提醒，需要人工翻销售单才能发现。

**核心公式**（纯派生计算，`src/lib/reservation-aging.ts`，无新增字段）：

```
预留年龄 ageDays = now − GeneratedMovement.createdAt
  （只统计 reservedQty > 0 且父 SalesRecord.status ∈ {deposit_paid, fully_paid} 的行）

年龄信号 ageSignal：
  ageDays ≥ 21  → STALE（该催客户/该决定退款还是继续等）
  ageDays ≥ 14  → AGING
  否则          → 不标记

库存信号 stockSignal：
  Available(该 SKU + 该仓) < 0  → BACKORDERED（该催供应链/安排到货或调货）
  否则                          → 不标记

只要 ageSignal 或 stockSignal 任一非空 → 该行进入清单；两个信号各自独立展示为徽标，从不合并成一个"严重等级"颜色
```

- **两个信号分开展示，不合并**：合并成一个颜色会让人分不清到底该找谁处理——"逾期"该找客户，"缺货"该找供应链，两者可能同时发生也可能只发生一个。
- **缺货行自动带出"下一批货何时到"**：`stockSignal = BACKORDERED` 的行会额外查询该 SKU+该仓最近一个符合 Forecast Mode 资格的在途货柜（`status ∈ {shipped, in_transit, arrived} AND eta IS NOT NULL`，取 ETA 最近的一个），展示 `poRef` / ETA / 数量；如果查无结果，展示醒目的"无在途货柜"提示——不用切换到 Forecast Mode 就能判断是"等等就好"还是"真的没货在路上"。
- **数据自动过期，不需要人工标记已处理**：这不是一张存储的告警表，是每次页面加载都重新查询的实时投影——订单一旦 `completed`/`cancelled`（`GeneratedMovement` 被清空/status 离开 deposit_paid/fully_paid）或库存补足（Available 回正），下次查看时该行自动从清单消失，不存在"忘记关掉旧提醒"的问题。
- **展示位置**：
  - Dashboard 新增独立面板"At-risk reservations"，含 All/Brisbane/Sydney 筛选（`?loc=`），以及一张统计卡（有告警时变红）。
  - Inventory 页新增与 Forecast Mode 平行的独立模式（`?backorder=1`），只显示当前仓库里被标记的 SKU，多两列"Aged"/"Next supply"。两个模式互斥（不叠加显示），避免同一行同时塞入 Forecast 的多货柜列和 Aging 的年龄列导致过挤。
- **阈值管理**：14 天 / 21 天目前是 `src/lib/constants.ts` 里的常量，不做 Settings 页面可调——内部小系统暂不需要（渐进复杂度原则），真有旺季/淡季调整需求再加。
- **操作 / 排障手册**：[`docs/aging-reservations-runbook.md`](./aging-reservations-runbook.md)

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

**SKU 产品（现网）：** Portal `Product.shopifyInventoryItemId` → `inventorySetQuantities`（Available = On Hand − Reserved）。

**可售 Bundle（决策 17）：** `BundleDefinition` 绑定 Shopify variant；推送值为派生 kits（缓存于 `BundleLocationStock`）。零件变动级联重算。PDP 经 Worker 查 `sellableSku` 时读缓存，不现场展开 BOM。

**Webhook（现网，不是自动建单）：**

```
Shopify orders/paid → HMAC + ProcessedWebhook 去重
→ 按 invoice/订单名匹配已有 SalesRecord，写入 shopifyOrderId
→ 不创建销售单、不预留、不改库存
```

- 结账听 Shopify 上次推送的数字
- 人工在 Portal 建单并 `deposit_paid` 预留后，kits 才会下降并回推
- 第二刀（付款即展开 Tray BOM 并预留）明确推迟
- Webhook 安全：HMAC-SHA256；幂等：ProcessedWebhook
- 推送失败：Product 路径写 SyncLog；Bundle 路径记服务端 error，不阻断库存写入

---

## G. 权限矩阵

| 功能 | Viewer | Sales | Editor | Admin |
|---|---|---|---|---|
| 仪表板/库存列表/销售查看 | 能 | 能 | 能 | 能 |
| 销售创建/编辑 | 不能 | 能 | 能 | 能 |
| 到货/调货 | 不能 | 不能 | 能 | 能 |
| 手动调整库存 (Adjust Stock) | 不能 | 不能 | 能 | 能 |
| 编辑 Reorder Point | 不能 | 不能 | 能 | 能 |
| **调整履约预留（deposit_paid）** | **不能** | **能** | **能** | **能** |
| **调整履约预留（fully_paid）** | **不能** | **不能** | **能** | **能** |
| 新建 SKU | 不能 | 不能 | 不能 | 能 |
| Bundle 查看（列表/BOM） | 不能 | 能（只读） | 能（只读） | 能 |
| Bundle 新建/改 BOM/Shopify 绑定 | 不能 | 不能 | 不能 | 能 |
| 审计日志查看 | 不能 | 能 | 能 | 能 |
| 设置（用户/仓库/Shopify） | 不能 | 不能 | 不能 | 能 |

判断函数集中在 `src/lib/permissions.ts`。Sidebar、页面 redirect、API 403 必须调用同一套函数，禁止再写内联 `role === ...`。

---

## H. 边界场景

| # | 场景 | 处理 |
|---|---|---|
| 1 | 并发修改同一记录 | 乐观锁 → 409 冲突提示 |
| 2 | Webhook 到达时宕机 | Shopify 48h 重试 + 唯一约束防重复 |
| 3 | On Hand < Reserved | 允许；仪表板 WARNING（`At-risk reservations` 面板，见 D4）；Shopify 显示缺货 |
| 4 | Bundle 修改后对旧订单 | 保存行时已写入 `snapshotItems`；`deposit_paid` 按快照展开，不读新 BOM。无快照的旧行才回退 live 定义。履约层仍可由 Admin 单独调整 |
| 5 | 标完成但未取走 | `stocktake_correction` 冲正 |
| 6 | Shopify 产品被删 | SyncLog 404 → 仪表板告警 |
| 7 | 调货途中丢失 | 取消调货 + `write_off` |
| 8 | 初始库存填错 | `stocktake_correction` |
| 9 | Webhook 含未知 SKU | 现网：只尝试匹配已有销售单；匹配不到则只记录 webhook，不建单 |
| 10 | 到货确认后数量错 | 不撤回；`stocktake_correction` |
| 11 | 共用件卡住多色 Tray | 仪表板 Shared kit bottleneck；人工尽快预留。不在 Shopify 侧做安全余量扣减 |

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
│   ├── lib/db.ts|inventory.ts|bundle-atp.ts|state-machine.ts|shopify-sync.ts|auth.ts|constants.ts
│   ├── components/
│   └── types/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```
