# CDI 双仓库部署 — 交接文件

**日期**：2026-07-23  
**状态**：Phase 1 完成，Phase 2（分仓库存透明化 UI）待执行  
**执行人**：Cursor Agent (Sonnet 4.6)  
**关联文档**：
- `cdi-docs/dev/rates-worker-runbook.md` — rate worker 运维手册（已更新 §7）
- `cdi-docs/dev/metafield-spec.md` — Metafield 规范（已更新 preorder/backorder 补注）
- `cdi-docs/dev/inventory-constitution.md` — 库存系统宪法

---

## 背景

悉尼店铺开业，需要在 Shopify 添加第二个仓库 Location，同时确保：
1. rate worker（运费计价）按就近原则从正确仓库报价
2. PDP 库存状态/ATC 按钮逻辑不受影响
3. Inventory Portal 双仓架构就绪（Sydney 库存后续录入）

---

## Phase 1 — 已完成（2026-07-23）

### P1-A：Shopify Location 搭建

**操作人**：用户在 Shopify Admin 手动完成

| Location | 名称 | 地址 | 状态 |
|---|---|---|---|
| Brisbane | Core Driven Industries Brisbane | 22 Counihan Road, Seventeen Mile Rocks QLD 4073 | Active，Default |
| Sydney | Core Driven Industries Sydney | 25 Tarlington Place, Smithfield NSW 2164 | Active |

**关键确认**：
- Brisbane 为 Default location（Shopify 默认 fulfillment 优先）
- Sydney 所有 SKU 库存初始为 0（Portal sync 未做，暂缓）
- 两个 Location 均未开启 "In-store pickup"（pickup availability 组件不会渲染）

---

### P1-B：rate worker 双仓就近改造

**改动文件**：
- `cdi-worker/rates-worker/wrangler.toml`
- `cdi-worker/rates-worker/index.js`

**核心变化**：

原来：单一 `PICKUP_*` 变量，硬编码 Brisbane 地址。

现在：`WAREHOUSE_ROUTES` 数组 + `pickWarehouse(province, env)` 函数，按客户目的地州自动选仓：

| 目的地州 | 发货仓 |
|---|---|
| NSW, VIC, SA, TAS, WA, ACT | Sydney（Smithfield NSW 2164） |
| QLD, NT 及其他 | Brisbane（Seventeen Mile Rocks QLD 4073） |

**设计原则**：
- 每次 checkout 仍只调用 BigPost 1 次（不乘以仓库数），不影响 2,000 次/天限制
- 就近逻辑集中在 worker 代码，与 Shopify Location 配置完全解耦
- 新增第三仓只需在 `WAREHOUSE_ROUTES` 加一条 + `wrangler.toml` 加一组 `PICKUP_XXX_*` 变量

**已 deploy**：Version ID `3aad14f2-efc7-45f0-99f3-de250c2584ce`，2026-07-23

**过渡期注意**：Sydney 库存全 0 期间，VIC/SA/WA/TAS 客户看到的是 Sydney 报价（偏低），但实际从 Brisbane 发货，运费差价由内部消化。等 Sydney 有库存后自动消失。这是已知且接受的过渡行为。

---

### P1-C：metafield-spec.md 补注

**改动文件**：`cdi-docs/dev/metafield-spec.md`

在 `cdi_display.preorder_mode` 和 `cdi_display.backorder_mode` 两行用途说明末尾补注：

> 库存判断基于全店所有 Location 合计（`variant.inventory_quantity`），与 Location 数量无关。新增 Sydney Location 后，只要任一仓有货合计 > 0，此字段不触发。

---

### P1-D：主题双仓兼容性核查

**结论：主题代码零改动，双仓完全兼容。**

| 组件 | 双仓影响 | 结论 |
|---|---|---|
| `snippets/cdi-pdp-inventory.liquid` | `variant.inventory_quantity` 为全店合计，Sydney 0 + Brisbane N = N，状态不变 | 安全 ✓ |
| `snippets/buy-buttons.liquid` | ATC 按钮逻辑同上，合计有货则正常 Add to cart | 安全 ✓ |
| `sections/cdi-sticky-atc.liquid` | 同上 | 安全 ✓ |
| Dawn pickup availability 组件 | `\| where: 'pick_up_enabled', true` 过滤，两仓均未开启 pickup，组件不渲染 | 安全 ✓，不要开启 Location 的 in-store pickup |

**测试主题 = 在线主题同步清单**（双仓上线前验证）：
- [ ] 随机打开一个有 Brisbane 库存的产品 PDP，确认显示 "In stock"（合计 > 0）
- [ ] 确认 ATC 按钮显示 "Add to cart"（非 backorder/preorder）
- [ ] 在 checkout 填墨尔本地址，确认运费正常显示（BigPost Sydney 报价）
- [ ] 在 checkout 填布里斯班地址，确认运费正常显示（BigPost Brisbane 报价）
- [ ] PDP 上没有多余的 pickup availability 文案出现

---

## Phase 2 — 待执行（分仓库存透明化 UI）

**触发条件**：你提供同行案例截图后设计

**目标**：在 PDP 展示分档状态（如 `Brisbane: In stock · Sydney: On backorder`）

**技术路径**：
- Liquid 拿不到分仓数据（`variant.inventory_quantity` 永远是合计）
- 需要 JS 调 Shopify Storefront API 或自研 Portal endpoint 拿分仓数字
- 展示精细度：分档状态（不显示精确数字），已确认

**前置依赖**（Phase 3 Portal 工作）：
- Portal 完成 `shopifyInventoryItemId` 绑定（见 `inventory-handoff-2026-07-22.md` 优先级 3）
- Portal 完成分仓 sync 推送 Shopify

---

## Phase 3 — 待执行（Portal 分仓 sync）

属 Portal 侧工作，见 `inventory-handoff-2026-07-22.md` 优先级 3、4：

1. 在 Portal Settings → Warehouses 填入两个 Shopify Location ID
   - Location ID 从 Shopify Admin URL 获取：`Settings → Locations → 点击对应仓库 → URL 末尾数字`
2. 绑定 SKU 的 `shopifyInventoryItemId`（Shopify 产品 CSV 导出可批量获取）
3. 触发全量同步验证
4. 开店后通过 Portal Adjust Stock → `opening_stock` 录入 Sydney 初始库存

---

## 关键决策记录

| 决策 | 选择 | 理由 |
|---|---|---|
| PDP 库存判断模型 | 全店合计库存（不按仓库） | Liquid 不暴露分仓库存；合计有货即可购买，就近发货交给 rate worker |
| ATC 按钮触发条件 | 合计 = 0 且 policy=continue 才显示 backorder/preorder | 与合计模型一致，Sydney 有货可抵消 Brisbane 无货 |
| rate worker 就近逻辑 | 按州硬分界（客户目的地州） | 省 BigPost 调用次数；未来 N 仓只扩展数组，不改核心逻辑 |
| NSW 分配 | 走 Sydney | 同州就近，逻辑最自然 |
| 过渡期运费误差 | 接受 | Sydney 初期无货，VIC 等客户用 Sydney 地址报价偏低，内部消化 |
| pickup availability | 不改，默认不渲染 | 两仓均为发货仓非门店，不开 in-store pickup |

---

## 已修改文件清单

| 文件 | 类型 | 变更摘要 |
|---|---|---|
| `cdi-worker/rates-worker/wrangler.toml` | 配置 | 单组 PICKUP_* → 双组 PICKUP_BNE_* + PICKUP_SYD_* |
| `cdi-worker/rates-worker/index.js` | 代码 | 新增 WAREHOUSE_ROUTES + pickWarehouse()；替换硬编码 pickupLocation |
| `cdi-docs/dev/rates-worker-runbook.md` | 文档 | §7 从预留方案改为已实施，含第三仓扩展指引 |
| `cdi-docs/dev/metafield-spec.md` | 文档 | preorder_mode/backorder_mode 补注双仓语义说明 |
| `cdi-inventory/handoff/dual-warehouse-2026-07-23.md` | 文档 | 本文件（新建） |
