# CDI Inventory — 逾期预留 / 缺货预警 Runbook

> 配套文件：`constitution.md`（决策 #16 / §D4 权威规格）、`dev-sop.md`（日常回归清单 §15）
> 确立日期：2026-08-11（commit `ef3d561`）
> 用途：维护、排查 Dashboard「At-risk reservations」、Inventory「Backorder alerts」，以及工厂缺货 CSV（§4.3）时的操作手册

---

## 1. 设计原则（先读这段）

本功能是**只读投影**，不写任何新业务表、不新增字段：

| 原则 | 含义 |
|---|---|
| **纯派生** | 每次页面加载从 `GeneratedMovement` + `InventoryLog` + `IncomingShipment` 实时算；完成/取消/补货后自动从清单消失 |
| **两个信号分开** | 「逾期」找客户，「缺货」找供应链；UI 永远不要合并成一个笼统的红色等级 |
| **与 Forecast 平行、互斥** | Inventory 上 `forecast=1` 与 `backorder=1` 不能同时渲染（避免表格列爆炸） |
| **落地宪法 H#3** | 「On Hand < Reserved → 仪表板 WARNING」此前只写在 constitution，本功能才真正实现 |

权威规格以 `docs/constitution.md` 决策 #16 与 §D4 为准；本 runbook 不重复抄写长文，只保留排障所需的可操作细节。

---

## 2. 核心公式

```
适用行：GeneratedMovement.reservedQty > 0
        AND SalesRecord.status ∈ {deposit_paid, fully_paid}

ageDays     = floor((now − GeneratedMovement.createdAt) / 1 day)
              ↑ createdAt 在 quote→deposit_paid 的 reserveStock() 时写入，
                之后 qty 更新不会刷新它，因此是可靠的「付押金日」代理

ageSignal   = ageDays ≥ 21 → STALE
              ageDays ≥ 14 → AGING
              否则         → null

Available   = On Hand − Reserved   （该 productId + locationId）
stockSignal = Available < 0 → BACKORDERED
              否则          → null

入清单条件  = ageSignal ≠ null  OR  stockSignal ≠ null
              （新鲜但已透支的预留也会进清单，不会因「不够老」被丢掉）

rank（仅排序/高亮，不单独渲染）
            = 2 若 BACKORDERED 或 STALE
              1 若 AGING
              0 否则

nearestIncoming（仅 BACKORDERED 行查询）
            = 该仓 status ∈ {shipped, in_transit, arrived}
              AND eta IS NOT NULL
              AND 含该 productId 的行
              按 eta ASC 取最近 1 个；没有则 UI 显示「None incoming」
```

阈值常量（目前写死，不做 Settings）：

| 常量 | 值 | 文件 |
|---|---|---|
| `RESERVATION_AGING_WARNING_DAYS` | 14 | `src/lib/constants.ts` |
| `RESERVATION_AGING_CRITICAL_DAYS` | 21 | `src/lib/constants.ts` |

---

## 3. 关键文件索引

| 文件 | 作用 |
|---|---|
| `src/lib/reservation-aging.ts` | **唯一计算入口** `getAgingReservations({ locationId? })`；Dashboard 与 Inventory 共用，改阈值/公式只改这里 |
| `src/lib/constants.ts` | 14 / 21 天阈值 |
| `src/lib/state-machine.ts` → `reserveStock` | `GeneratedMovement.createdAt` 的写入点（付押金时） |
| `src/app/(portal)/dashboard/page.tsx` | 「At-risk reservations」面板 + 第 5 张统计卡；`?loc=` 筛选 |
| `src/app/(portal)/inventory/page.tsx` | `backorder=1` 模式：过滤行、与 Forecast 互斥、组装 `agingByProductId` |
| `src/components/inventory/backorder-toggle.tsx` | 红色「Backorder alerts / Exit alerts」按钮 |
| `src/components/inventory/inventory-table.tsx` | Backorder 模式下的「Aged」「Next supply」列 |
| `src/components/inventory/inventory-filters.tsx` | hidden `backorder` 参数透传，避免筛选时丢模式 |
| `src/components/inventory/forecast-toggle.tsx` | 对照件：Forecast 有免责弹窗；Backorder **无**弹窗（实时数据） |
| `src/lib/shortage-report.ts` | 工厂 CSV：`getShortageRows`，只出 Available < 0 |
| `src/app/api/inventory/shortage-export/route.ts` | CSV 下载；任意已登录角色 |
| `src/components/inventory/factory-list-button.tsx` | Backorder 模式下的 Factory list 按钮 |

---

## 4. UI 表面

### 4.1 Dashboard

- URL：`/dashboard` 或 `/dashboard?loc=Brisbane` / `Sydney` / `all`（默认 `all`）
- 统计卡「At-risk reservations」：数量 > 0 时红字 + 红边，点「View all」进 Inventory Backorder 模式
- 面板：最多展示 10 行；每行两个独立徽标（`Aged Nd` 黄/红、`Short N` 红）；BACKORDERED 行下方显示最近货柜或「No incoming stock」
- 空状态文案：`No aging or backordered reservations`

### 4.2 Inventory Backorder alerts 模式

- URL：`/inventory?loc=<仓库名>&backorder=1`
- 与 Forecast 互斥：点 Forecast 会清掉 `backorder`；点 Backorder 会清掉 `forecast` / `incomingOnly`；若两参数同时存在，**Forecast 优先渲染**
- 表格只保留：`Available < 0` **或** 有逾期预留的 SKU
- 同一 SKU 多条逾期预留时：保留 **rank 最高**、同 rank 则 **ageDays 最大** 的那条做「Aged」列展示
- 「Aged」列可点进对应 `/sales/[id]`；无年龄信号时显示 `—`（行仅因 Available<0 进入）
- 「Next supply」列只对 `Available < 0` 有意义；非缺货行显示 `—`

### 4.3 工厂缺货 CSV（试用，2026-08-13）

内部 Backorder 屏给仓管/销售催客户；工厂要的是按 SKU 汇总的下料清单，不带客户名和销售单。

- 入口：Backorder 模式下的 **Factory list** 按钮 → `GET /api/inventory/shortage-export?loc=<仓库名>`
- 计算：`src/lib/shortage-report.ts` 的 `getShortageRows(locationId)`。只出 **active** 且该仓 `Available < 0` 的 SKU；`Short qty = max(0, Reserved − On Hand)`
- 在途资格与 Forecast / Aging 相同：`shipped` / `in_transit` / `arrived` 且 ETA 已知；每 SKU 只带**最近一柜**
- 不含客户、销售单、Aged 天数。含 CONSUMABLE（未特判）
- 权限：任意已登录角色（与 Inventory 页一致）。文件带 UTF-8 BOM，Excel 可直接打开中文表头
- 打印页 / PDF 本轮不做

QA：导出行数应等于该仓 `Available < 0` 的 active SKU 数（可与 Backorder 表交叉核对，但 Backorder 还会多出「仅逾期、有货」的行，那些不应出现在 CSV）

---

## 5. 故障排查（按症状）

### 5.1 Dashboard / Inventory 完全没有告警，但你确认有老预留

按顺序查：

1. **父单 status** 必须是 `deposit_paid` 或 `fully_paid`。`quote` 没有 GeneratedMovement；`completed` / `cancelled` 会把 `reservedQty` 归零 → 正确行为是**不出清单**。
2. **`reservedQty > 0`**。打开销售单 Fulfillment 层确认；若 Admin 手动把履约数量改到 0，行会消失。
3. **年龄不够且 Available ≥ 0**。`ageDays < 14` 且库存未透支 → 故意不进清单。QA 可直连 DB 把该行 `GeneratedMovement.createdAt` 改早（见 §6）。
4. **仓库筛错了**。Dashboard `?loc=` 或 Inventory 顶部 Tab 是否对准了你以为的那仓。
5. **代码是否仍调用共享 helper**。Dashboard 与 Inventory 都必须走 `getAgingReservations`；若有人在页面里复制了一份公式，阈值会漂移——改回共用 helper。

### 5.2 有「Short」缺货徽标，但没有「Aged」

正常。`stockSignal` 与 `ageSignal` 独立：刚付押金就透支的单子会只有 Short；够 14 天才会出 Aged。

### 5.3 有「Aged」但 Available 明明已经是负数，却显示「None incoming」

`nearestIncoming` 只认与 Forecast Mode **相同** 的货柜资格：

- `IncomingShipment.status ∈ {shipped, in_transit, arrived}`
- `eta IS NOT NULL`
- 该仓 + 该 SKU 有 `IncomingLine`

`pending`（还在供应商侧、未发货）**不算**在途；没有 ETA 的老单也不算。这是故意的——「还没发」不等于「快补上」。

### 5.4 Inventory Backorder 模式空表 / 行数不对

1. 确认 URL 有 `backorder=1` 且**没有**被 Forecast 抢占（`forecast=1` 存在时 Backorder 渲染关闭）。
2. **Status=Reorder 会藏掉真正缺货的行**（2026-08-13 已修）。`Available < 0` 的 Status 永远是 `OUT_OF_STOCK`，不是 Reorder。进入 Backorder 会丢掉 `status`，模式内不再套用 Status 下拉。若仍觉得列表偏短，先看表上方 `N alerts · X short`，再对 Factory list CSV。
3. Category / Search 仍会收窄。筛选表单提交后模式丢了 → 检查 `inventory-filters.tsx` 是否还有 hidden `name="backorder"`。

### 5.5 「Aged」天数突然变小 / 变成新日期

常见根因：Admin 在 Fulfillment 层**删掉旧 GeneratedMovement 再新建一行**（`movements` API 对不存在的 SKU 会 `create`，新行 `createdAt = now`）。qty-only 的 `update` **不会**刷新 `createdAt`。若年龄被意外重置，查该销售单履约编辑历史与 Audit Log 的 `reservation_adjustment`。

### 5.6 同一 SKU Dashboard 多行、Inventory 只一行

预期差异：

- Dashboard 按 **预留行**（每条 GeneratedMovement）列出，同一 SKU 可对应多张销售单。
- Inventory 按 **SKU** 聚合，只挂最差那条的 Aged / Next supply。

不要强行改成同一种粒度，除非产品明确要求。

### 5.7 改阈值不生效

只改 `src/lib/constants.ts` 两个常量即可；**不要**在 Dashboard / Inventory 页面再写死数字。改完需重新部署（Railway）。若将来要做成 Settings，先改 constitution 决策 #16 再动 schema。

---

## 6. QA 手法（制造可复现数据）

生产数据很少刚好卡在 14/21 天边界，本地/预发可用直连 DB（`pg` 脚本，见 `dev-sop.md`「Import 脚本连接规范」）：

```sql
-- 把某条活跃预留的 createdAt 拨到 N 天前（仅 QA）
UPDATE "GeneratedMovement"
SET "createdAt" = NOW() - INTERVAL '16 days'
WHERE id = '<movement_id>';
```

验证矩阵：

| 操作 | 期望 |
|---|---|
| `createdAt` → 16 天前，Available ≥ 0 | `Aged 16d`（AGING / 琥珀） |
| `createdAt` → 22 天前 | `Aged 22d`（STALE / 红） |
| Available < 0，任意年龄 | `Short N`；有合格在途柜则显示 Next supply，否则 None incoming |
| 订单 → `completed` 或 `cancelled` | 该行从 Dashboard / Backorder 模式消失 |
| 到货确认把 Available 拉回 ≥ 0，且年龄 < 14 | 行消失（若仍 ≥14 则只剩 Aged） |

**禁止**在生产库长期留下被拨乱的 `createdAt`；测完改回或走真实业务流程消化。

---

## 7. 回归清单（改此功能时必跑）

完整 checkbox 以 `docs/dev-sop.md` §15 为准。此处只列排障高频项：

- [ ] Dashboard 统计卡数量与面板列表一致（同 `loc` 筛选）
- [ ] All / Brisbane / Sydney 切换只影响本面板，不误伤 Open orders / Low stock 的全局聚合语义
- [ ] Inventory：`backorder=1` ↔ Forecast 互斥；筛选 / 翻页 / 换仓后 `backorder=1` 仍在 URL
- [ ] 双徽标独立：可出现「只有 Aged」「只有 Short」「两者都有」
- [ ] BACKORDERED + 有在途柜 → Next supply 有 `poRef`/ETA/qty；无柜 → 红色 None incoming
- [ ] `completed` / `cancelled` 后告警消失；不需要人工「标记已处理」
- [ ] Factory list CSV 行数 = 该仓 Available < 0 的 active SKU；不含仅逾期有货行

---

## 8. 开发日志（本功能相关 Bug）

> 后续若本功能出 Bug，记在这里；格式对齐 `dev-sop.md` 开发日志。

| 日期 | 发现 | 处理 |
|---|---|---|
| 2026-08-11 | 宪法 H#3 仪表板 WARNING 从未实现；预留逾期 / 缺货无可见提醒 | 初版落地（`ef3d561`）：共享 helper + Dashboard 面板 + Inventory Backorder 模式；双信号分开展示；缺货行带最近在途货柜提示 |

---

## 9. 已知局限 / 刻意不做

| 项 | 现状 | 原因 |
|---|---|---|
| 阈值可配置 UI | 无，常量写死 | 渐进复杂度；内部小系统暂不需要 |
| `depositPaidAt` 独立字段 | 无，用 `GeneratedMovement.createdAt` | 避免 schema 膨胀；已知履约「删建」会重置年龄（见 §5.5） |
| Forecast + Backorder 同屏 | 互斥 | 表格列过多；缺货行已内嵌最近一柜提示 |
| 告警「已处理」勾选 | 无 | 实时投影：问题解决后自动消失，避免僵尸勾选 |
| 邮件 / 推送通知 | 无 | 当前仅 Portal 内可见；需要时另开决策 |
| 工厂打印页 / PDF | 无，仅 CSV | 试用阶段先验证列与分组；打印页作 fast-follow |
