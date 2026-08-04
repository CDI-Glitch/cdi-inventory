# CDI 库存系统 — 开发 SOP & 回归测试清单

> 配套文件：`inventory-constitution.md`（设计宪法）
> 用途：每天开发完成后逐项检查，确保没有引入回归 Bug

---

## 开发顺序

| 天 | 重点 | 交付物 |
|---|---|---|
| 1 | 项目搭建 + Schema + 登录 | 项目能跑、数据库迁移完成、登录可用 |
| 2 | 库存列表 + 手动调整 | SKU 列表显示 On Hand/Reserved/Available、调整表单 |
| 3 | 销售记录 + 状态机 | CRUD + 状态推进 + 自动 GeneratedMovement |
| 4 | Bundle 管理 + 展开 | Admin 管理 Bundle、销售记录自动展开组件 |
| 5 | Shopify 集成 | Webhook 接收 + 同步推送 + 重试 |
| 6 | 到货 + 调货 | 主从表发货单、5 状态流、调货 |
| 7 | 仪表板 + 全量回归 | 仪表板统计、全测试通过 |

---

## 回归测试清单

### 1. 登录与权限

- [ ] 正确密码登录 → 进入仪表板
- [ ] 错误密码 → 显示错误信息
- [ ] Viewer 访问 /inventory/adjust → 403
- [ ] Editor 访问 /settings → 403
- [ ] Session 过期 → 重定向到登录页
- [ ] 权限/会话热更新相关改动 → 另跑 [`auth-permissions-runbook.md`](./auth-permissions-runbook.md) §8 全清单

### 2. 库存计算

- [ ] 新产品 + opening_stock 日志 → On Hand 正确
- [ ] 多条日志累加正确（正+负混合）
- [ ] Reserved 只计算 reservedQty > 0 的 GeneratedMovement
- [ ] Available = On Hand - Reserved（永远正确）
- [ ] REORDER / OUT_OF_STOCK 状态判断正确
- [ ] 两个仓库的库存互相独立

### 3. 手动调整

- [ ] 每种 type 生成正确的 InventoryLog
- [ ] delta = 0 被拒绝
- [ ] enteredBy 自动填入当前用户 ID
- [ ] 调整后触发 Shopify 同步（如果 SKU 有 shopifyInventoryItemId）
- [ ] 无 shopifyInventoryItemId 的 SKU → 不触发同步

### 4. 销售记录状态机

- [ ] 创建默认 `quote` → 无库存影响
- [ ] `quote → deposit_paid` → GeneratedMovement 创建，Reserved 增加；**每组件一条** `reservation_adjustment`（delta=0）出现在 Audit Log
- [ ] `deposit_paid → fully_paid` → 无库存变化
- [ ] `fully_paid → completed` → InventoryLog 写入，On Hand 减少，Reserved 释放
- [ ] `任何状态 → cancelled` → Reserved 释放；**每组件一条** `reservation_adjustment`（released on cancel）
- [ ] 非法转换拒绝（`quote → completed` 等）
- [ ] 终态无法再转换
- [ ] 并发编辑 → 409 冲突（第二个保存失败并提示）
- [ ] SKU 类型的销售记录：直接对 Product 预留
- [ ] Bundle 类型的销售记录：展开所有组件，对每个组件预留
- [ ] 同一 SKU 既出现在独立行又出现在 Bundle 组件 → Fulfillment 对比 **合并计数**，不误报 mismatch

### 5. Bundle 展开

- [ ] N 组件 Bundle → 生成 N 条 GeneratedMovement
- [ ] 数量正确：SalesLine.qty × 组件 qty（来自 `snapshotItems` 或 BundleItem）
- [ ] 保存 bundle 行时写入 `snapshotItems`（创建销售 / 编辑 quote 行均写）
- [ ] 组件 SKU 未激活（active=false）→ 转换被拒绝
- [ ] Bundle 代码不存在 → 转换被拒绝
- [ ] 修改 Bundle 定义 → **不影响**已有 `snapshotItems` 的 quote/订单在 deposit 时的展开
- [ ] 无快照的旧行 → 回退 live `BundleDefinition`（兼容路径）
- [ ] Sales detail：bundle 行可折叠查看组件；Order lines vs Fulfillment 合并后无假阳性 mismatch
- [ ] CMS 硬件包：`BDL-CMS-HW-DUALCAB`（FK×3）/ `BDL-CMS-HW-SINGLECAB`（FK×4）可加入销售行

### 6. Shopify Webhook

- [ ] 合法 HMAC → 200 + 处理
- [ ] 非法 HMAC → 401
- [ ] 重复 shopifyOrderId → 200（幂等，不创建重复记录）
- [ ] `orders/paid` → 创建 SalesRecord (`fully_paid`)
- [ ] `orders/cancelled` → 转换已有记录为 `cancelled`
- [ ] Webhook 中的 SKU 在 Portal 不存在 → 创建为 `quote` + 告警

### 7. Shopify 同步推送

- [ ] 库存变动后自动推送 Available
- [ ] 成功 → SyncLog status=success
- [ ] API 错误 → SyncLog status=failed + error 字段
- [ ] 失败记录被重试（最多 3 次）
- [ ] 无 shopifyInventoryItemId → 跳过
- [ ] 推送的 Available 值 = On Hand - Reserved（实时计算）

### 8. 到货发货单

- [ ] 创建主表 + 多行明细
- [ ] 状态推进顺序正确：pending → shipped → in_transit → arrived → confirmed
- [ ] arrived 前可编辑明细行
- [ ] arrived 后只能填 actualQty
- [ ] confirmed 后完全不可编辑
- [ ] 确认 → 每行 actualQty > 0 生成 InventoryLog (receive_stock)
- [ ] 不能重复确认（确认后按钮消失）
- [ ] actualQty 和 expectedQty 不一致时正常处理（以 actualQty 为准）

### 9. 调货

- [ ] 创建：无库存变化
- [ ] `pending → in_transit`：源仓 On Hand 减少
- [ ] `in_transit → completed`：目标仓 On Hand 增加
- [ ] `in_transit → cancelled`：源仓 On Hand 恢复
- [ ] `pending → cancelled`：无库存变化
- [ ] 每个库存变动步骤触发 Shopify 同步（两个仓库都推）
- [ ] 不能调超过源仓 On Hand 的数量（创建时校验）

### 10. 仪表板

- [ ] SKU 总数准确
- [ ] 需补货数量准确（Available <= ReorderPoint 且 > 0）
- [ ] 缺货数量准确（Available <= 0）
- [ ] 同步状态徽章正确（全绿/有失败=红）
- [ ] 补货告警可点击跳转

### 11. 审计日志

- [ ] 显示所有 InventoryLog 条目
- [ ] 可按 SKU 筛选
- [ ] 可按类型筛选（含 **Reservation Adjusted**）
- [ ] 可按操作人筛选
- [ ] 可按日期范围筛选
- [ ] 每条记录的 reference 可点击跳转到来源
- [ ] `deposit_paid` 后：纯 SKU 行与 Bundle 组件都能在 Log 中看到 `reservation_adjustment`
- [ ] `cancelled` 释放后：对应 `reservation_adjustment` notes 含 released on cancel
- [ ] `reservation_adjustment` 的 delta 恒为 0（不影响 On Hand 合计）

### 12. SKU 导入规范

> 批量导入使用 `scripts/import-*.ts` 脚本，通过 Railway Console 执行。

**每次新增品类导入流程：**
1. 读取 Excel 文件，确认 headers 和数据行起始行（通常第 4 行是 headers，第 5 行起是数据）
2. 确认 category（必须与 `src/lib/constants.ts` 中的值完全一致，全大写）
3. 确认 unit（`Each` / `Pair` / `Set`），向用户确认不确定的
4. 确认 opening stock 放哪个仓库（Brisbane / Sydney）
5. 创建 `scripts/import-xxx.ts`，执行后检查 Created / Skipped 数量
6. 若有 SKU 命名错误需修正：先删除旧记录（含 InventoryLog），再重新创建

**category 值完整列表（`src/lib/constants.ts`）：**
`CANOPY` | `TRAY_DECK` | `HEADBOARD` | `DROP_SIDES` | `REAR_RACK` | `CHASSIS_PANEL` | `CHASSIS_DRAWER` | `MUDGUARD` | `UNDERBODY_TOOLBOX` | `ROOF_RACK` | `CANOPY_ACCESSORY` | `SERVICE_BODY` | `FITTING_KIT` | `UNISTRUT` | `12V`

---

### 13. 位置 Tab 筛选（Inventory & Sales）

**库存页：**
- [ ] Admin 登录 → 默认显示 All locations（Brisbane + Sydney 双列展示）
- [ ] 点击 `Brisbane` Tab → URL 含 `?loc=Brisbane`，只显示 Brisbane 单仓列（On Hand / Reserved / Available，无 Total 列）
- [ ] 点击 `Sydney` Tab → URL 含 `?loc=Sydney`，只显示 Sydney 单仓列
- [ ] 点击 `All locations` Tab → URL 去除 `loc` 参数，恢复双列展示
- [ ] 在 Brisbane Tab 下进行关键词搜索 → `loc=Brisbane` 保留在 URL 中
- [ ] 在 Brisbane Tab 下切换 Category/Status 下拉 → `loc=Brisbane` 保留

**销售页：**
- [ ] Admin 登录 → 默认显示 All locations
- [ ] 点击 `Brisbane` Tab → 只显示 Brisbane 的销售记录
- [ ] 点击 `Sydney` Tab → 只显示 Sydney 的销售记录
- [ ] 在 Brisbane Tab 下进行搜索/状态筛选 → `loc=Brisbane` 保留

**Editor 角色：**
- [ ] Brisbane Editor 登录 → 库存页默认显示 Brisbane Tab（不带 `loc` 参数时）
- [ ] Brisbane Editor 仍可手动点击 Sydney 或 All 查看
- [ ] Sydney Editor 登录 → 默认显示 Sydney Tab

### 14. Forecast Mode（未来库存预测，2026-08-04 新增）

**到货发货单 — ETA / shippedAt：**
- [ ] 新建到货单：ETA 为必填项，不填不能提交（前端 + API 双重校验）
- [ ] 老记录（无 ETA）不受影响，不强制补录
- [ ] 首次 `pending → shipped`：必须先选择"发货日期"才能提交，否则 400
- [ ] 已有 `shippedAt` 后再次调用状态转换接口传 `shippedAt` → 被静默忽略，值不变
- [ ] Editor/Admin 可在发货单详情页随时修改 ETA（`confirmed`/`cancelled` 状态下按钮不出现，接口也拒绝）
- [ ] 普通 Editor 在详情页看不到 `shippedAt` 的编辑图标（只读展示）
- [ ] Admin 在详情页能看到 `shippedAt` 编辑图标，修改后 `/audit-log` 出现一条 `shipped_at_correction`（delta=0），可按该发货单任一 SKU 或按类型筛选到

**库存页 — Forecast 开关：**
- [ ] 点击"Forecast"按钮 → 每次都弹出免责弹窗（"仅为估算，非锁定预留"），点击确认才跳转
- [ ] 已处于 Forecast 模式时点击"Exit forecast" → 直接退出，不弹窗
- [ ] Forecast 模式下 Name 列消失，SKU 与 Category 之间/之后插入货柜列
- [ ] 货柜列数 = 该仓库 `status IN (shipped,in_transit,arrived) AND eta 不为空` 的记录数，上限 5
- [ ] 货柜列按 ETA 取最近 5 个后反转显示（最近到港在右、紧贴 On Hand；最远在左），新建的货柜按 ETA 插入正确位置，不按创建时间排
- [ ] 某 SKU 在某货柜没有对应行 → 该列显示 "—" / qty 0，不报错
- [ ] 同一货柡同一 SKU 多行 → 该列 qty 为多行 `qtyOrdered` 之和
- [ ] 每列 Future Available = 上一列 Future Available + 本列 qty（第一列基准为当前 Available）
- [ ] 该仓库没有符合条件的货柜 → 显示"无在途货柜"提示，不渲染任何货柜列
- [ ] 切换 Category/Status/搜索筛选、翻页时，`forecast=1` 保留在 URL 中
- [ ] 切换仓库 Tab 时，`forecast=1` 保留，货柜列按新仓库重新计算
- [ ] Sales/Viewer 角色能看到 Forecast 列（只读），但看不到货柜列头的 PO 链接（纯文字）
- [ ] Editor/Admin 能点击货柜列头的 PO 号跳转到对应到货发货单详情页
- [ ] Forecast 模式**不**在数据库产生任何写入（除 ETA/shippedAt 本身的编辑操作）——刷新页面后数字应随 ETA/预留/取消的最新状态自动变化

---

## 每日收工检查

1. `git status` — 无遗漏文件
2. 本地 `npm run build` — 无编译错误
3. 跑一遍当天实现的对应测试清单章节
4. 更新此文件的 checkbox（标记已通过项）
5. 如有边界场景发现，记录到下方"开发日志"区

---

## 开发日志

> 遇到的 Bug、边界场景、临时决策记录在这里。

| 日期 | 发现 | 处理 |
|---|---|---|
| 2026-07-19 | `migrate dev` 在非交互环境失败 | 手动创建 SQL migration + `prisma db execute` + `migrate resolve` |
| 2026-07-19 | Incoming 页面 runtime 错误（旧列名缓存） | `prisma generate` + 重启 dev server |
| 2026-07-19 | Railway 部署 `UntrustedHost` 错误 | `trustHost: true` 加入 `auth.config.ts` |
| 2026-07-20 | category 大小写不一致（DB uppercase vs constants lowercase） | `fix-category-case.ts` 脚本修正，`constants.ts` 统一大写 |
| 2026-07-20 | Category 筛选 reset 问题 | `CustomSelect` 同步写 hidden input 值 + `setTimeout` 延迟 submit |
| 2026-07-20 | 灯板 SKU 命名错误 | `fix-tail-light-skus.ts` 删旧建新 |
| 2026-07-21 | `session.user?.role` TS 类型错误 | 改为 `(session?.user as any)?.role` |
| 2026-07-21 | `CustomSelect` 在 form 内过窄 | 新增 `fullWidth` prop，所有 form 内 CustomSelect 更新 |
| 2026-07-22 | `PrismaPg` v7.8 + Railway Public URL 带 `?connect_timeout` 参数导致 `ECONNREFUSED` | 见下方「Import 脚本连接规范」|
| 2026-07-27 | Shopify `inventorySetQuantities` 变量验证报错（三轮调试） | 详见下方「Shopify API Breaking Changes 记录」 |
| 2026-07-27 | `SHOPIFY_ADMIN_API_TOKEN` 废弃，改 client credentials grant | `shopify-sync.ts` 重构 `getToken()`，Railway 变量改为 `SHOPIFY_CLIENT_ID`/`SHOPIFY_CLIENT_SECRET` |
| 2026-07-27 | SyncLog 需分页 + 清理功能 | GET /api/sync 加 `page` 参数，新增 DELETE 接口，Settings UI 加分页与清理按钮 |
| 2026-07-30 | Admin 之间无保护，可互相降级/停用甚至降到零 admin | 见 [`auth-permissions-runbook.md`](./auth-permissions-runbook.md) |
| 2026-07-30 | `deposit_paid` 有 GeneratedMovement 但 Audit Log 无预留痕迹 | `reserveStock` / `releaseReservations` 补写 `reservation_adjustment` |
| 2026-07-30 | 改 Bundle 定义会静默影响仍处 `quote` 的订单展开 | SalesLine 增加 `snapshotItems`；保存时快照 BOM |
| 2026-07-30 | Bundle 组件与独立 SKU 同码时 Fulfillment 误报 mismatch | Sales detail 合并计数 + 折叠展示组件 |
| 2026-07-30 | Prisma `migrate dev` 报 drift 并诱导 `reset` | 生产库历来用 `db push`、无 `_prisma_migrations`；已 baseline，见下方「Prisma Migration Baseline」|

---

## Admin 权限保护设计（2026-07-30 确立）

> **完整手册：** [`docs/auth-permissions-runbook.md`](./auth-permissions-runbook.md)
> 含：安全层 vs UX 层、Admin 三保护、账号隔离、脚本降级/提升、Session 热更新、回归清单、故障排查。

摘要：
- Admin 不能改自己 / 不能降级同级 admin / 系统至少保留 1 个 active admin
- 降级已存在的 admin → 只能走 DB 脚本（见 runbook §6）
- `dev@cdi.com.au` = admin；`admin@cdi.com.au` = editor（老板日常）
- 已打开标签页的角色热更新由 `session-watcher.tsx` 负责；安全边界始终在服务端即时生效
- **降级 / 热更新不会改密码，也不会永久锁登录**；`Invalid email or password` = 密码错或 `active=false`（与「是否已被踢下线」无关）

---

## Prisma Migration Baseline（2026-07-30 确立）

### 背景

生产 Railway DB 早期全程使用 `prisma db push`，从未写入 `_prisma_migrations`。本地曾有孤立的 `migrations/*.sql` 文件，与真实库无关。运行 `migrate dev` 会误报 drift 并提示危险的 `migrate reset`。

### 当前状态

| 项 | 状态 |
|---|---|
| 权威 migration | `prisma/migrations/20260730000000_baseline/`（完整当前 schema，含 `SalesLine.snapshotItems`） |
| DB 追踪表 | `_prisma_migrations` 已存在；baseline 已 `migrate resolve --applied` |
| `prisma migrate status` | 应显示 `Database schema is up to date!` |

### 以后改 schema 的正确姿势

```bash
# ✅ 本地开发：生成 migration 文件并应用到连接的 DB
npx prisma migrate dev --name short_description

# ❌ 不要再对有真实数据的生产库依赖 db push 作为唯一手段
# ❌ 永远不要对生产库跑 prisma migrate reset
```

Railway 部署若仍只跑 `db push`，短期可继续，但新变更应先有 migration 文件入库，避免再次漂移。

### 安全红线

- `migrate reset` = **清空全部数据**。任何提示 reset 的流程必须先停手并告知负责人。
- Baseline SQL 仅用于历史对齐；**禁止**对已有库手动执行 baseline 里的 `CREATE TABLE`。

---

## Import 脚本连接规范（必读，2026-07-22 确立）

### 症状

在 Cursor 本地运行 `npx tsx scripts/import-*.ts` 时出现：

```
PrismaClientKnownRequestError: code: 'ECONNREFUSED'
```

TCP 层面（`Test-NetConnection`）完全通，但 Prisma 拒绝连接。

### 根本原因

`PrismaPg` v7.8.0 驱动在解析带有 `?connect_timeout=30&sslmode=no-verify` 参数的连接字符串时存在 bug，会静默失败并尝试连接 `localhost`。与 Prisma 版本绑定，**不稳定，未来版本可能重现也可能修复**。

### 永久解法：所有 import 脚本必须用 `pg.Pool` 直连

**禁止在 import 脚本里使用 `PrismaClient` + `PrismaPg` 适配器。**

**标准模板（所有新 import 脚本必须使用此结构）：**

```typescript
import { Pool } from "pg";
import { randomBytes } from "crypto";

const pool = new Pool({
  host: "tokaido.proxy.rlwy.net",
  port: 43176,
  user: "postgres",
  password: process.env.DB_PASS || "SHufVETPyuJhEckjrUldCjPZPkxrkVvv",
  database: "railway",
  ssl: { rejectUnauthorized: false },
});

function cuid() {
  return "c" + randomBytes(11).toString("hex");
}

async function main() {
  // 查询示例
  const check = await pool.query('SELECT id FROM "Product" WHERE sku = $1', [sku]);

  // 插入示例
  const id = cuid();
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO "Product" (id, sku, name, category, unit, "reorderPoint", active, "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, sku, name, category, unit, reorderPoint, true, now, now]
  );
}

main().catch(console.error).finally(() => pool.end());
```

### `.env` 中的 DATABASE_URL

本地 `.env` 的 `DATABASE_URL` **不得包含** `?connect_timeout=...` 或 `sslmode=...` 参数，否则 `pg` 库也会解析失败：

```
# ✅ 正确
DATABASE_URL="postgresql://postgres:xxx@tokaido.proxy.rlwy.net:43176/railway"

# ❌ 错误 — pg 库无法解析这些参数
DATABASE_URL="postgresql://postgres:xxx@tokaido.proxy.rlwy.net:43176/railway?connect_timeout=30&sslmode=no-verify"
```

### Railway 生产环境

Railway 上的 App 服务使用内网 URL（`${{Postgres.DATABASE_URL}}`），走 `.railway.internal`，不受此问题影响。只有**本地开发环境**需要注意。

### 快速诊断命令

怀疑连接有问题时，先运行以下命令验证 TCP 和 pg 层面是否正常：

```powershell
# 1. TCP 层测试（应显示 TcpTestSucceeded: True）
Test-NetConnection -ComputerName tokaido.proxy.rlwy.net -Port 43176

# 2. pg 层测试（应显示 OK: xxx products）
node -e "require('./scripts/_test-pg.cjs')"
```

如果 TCP 通但 pg 报 `ECONNREFUSED`，检查 `.env` 里的 URL 是否带有多余参数。

---

## 环境变量（.env.example）

```env
DATABASE_URL=postgresql://user:pass@host:5432/cdi_inventory
NEXTAUTH_SECRET=随机32位字符串
NEXTAUTH_URL=http://localhost:3000
SHOPIFY_STORE_DOMAIN=vdg1pn-e4.myshopify.com
SHOPIFY_CLIENT_ID=（Dev Dashboard → CDI Inventory Portal → Settings → Client ID）
SHOPIFY_CLIENT_SECRET=（Dev Dashboard → CDI Inventory Portal → Settings → Secret）
SHOPIFY_WEBHOOK_SECRET=（自定义随机字符串，注册 Webhook 时填同一个值）
ADMIN_EMAIL=admin@cdi.com.au
ADMIN_PASSWORD=changeme
```

> ⚠️ `SHOPIFY_ADMIN_API_TOKEN` 已废弃（Shopify 2026 年起不再支持 Admin Custom App 静态 token）。
> 现在使用 client credentials grant：`SHOPIFY_CLIENT_ID` + `SHOPIFY_CLIENT_SECRET` 动态换取临时 token（有效期 24h，自动续期）。

---

## Shopify 同步 Runbook

### A. 首次搭建（只需做一次）

**1. 创建 Dev Dashboard App**

前往 [https://dev.shopify.com/dashboard/](https://dev.shopify.com/dashboard/)（不是 Partners Dashboard，也不是 Shopify Admin）。

> ⚠️ Shopify 已不再允许在 Shopify Admin 内创建 Custom App，必须通过 Dev Dashboard。

- 打开已有 App「CDI Inventory Portal」或点 **Create app**
- 进入 **Versions → Create version**
- **Scopes** 填写：`read_inventory,write_inventory,read_products,read_locations`
- **Webhooks API version** 选当前最新季度版（当前为 `2026-07`）
- 点 **Release**
- 进入 **Settings**，复制 **Client ID** 和 **Client secret**（Secret 只显示一次，立即复制）
- 在左侧找到 **Install** 或 **Test on store**，将 App 安装到 `vdg1pn-e4.myshopify.com`

**2. 写入 Railway 环境变量**

Railway → `cdi-inventory` 服务 → **Variables** → 添加：

| 变量名 | 值 |
|---|---|
| `SHOPIFY_STORE_DOMAIN` | `vdg1pn-e4.myshopify.com` |
| `SHOPIFY_CLIENT_ID` | 从 Dev Dashboard Settings 复制 |
| `SHOPIFY_CLIENT_SECRET` | 从 Dev Dashboard Settings 复制 |

**3. 填写 Shopify Location ID**

Shopify Admin → **Settings → Locations** → 点开每个仓库，URL 末尾数字即为 Location ID：
`/admin/settings/locations/112920068395` → ID 为 `112920068395`

运行脚本（ID 已在脚本内硬编码，Brisbane=112920068395，Sydney=115677495595）：

```powershell
cd C:\Users\CoreD\Desktop\shopify\cdi-inventory
node scripts/set-location-shopify-ids.cjs
```

---

### B. 绑定 SKU InventoryItem ID（新增 SKU 需同步时）

**步骤 1：拉取 Shopify 产品列表**

```powershell
$env:SHOPIFY_CLIENT_ID="8c3db662f811dbb18eba8d7de7d8ae8c"
$env:SHOPIFY_CLIENT_SECRET="你的secret"
node scripts/fetch-shopify-inventory-items.cjs
```

输出格式：

```
Product                SKU              VariantID        InventoryItemID
Base Canopy 1200mm     CD-2D-17128-SHB  53753696485675   55840277233963
...
```

**步骤 2：更新绑定脚本并执行**

打开 `scripts/bind-shopify-inventory-item-ids.cjs`，在 `BINDINGS` 对象里追加新条目：

```javascript
'NEW-SKU-CODE': { inventoryItemId: '55840277299499', variantId: '53753696551211' },
```

然后运行：

```powershell
node scripts/bind-shopify-inventory-item-ids.cjs
```

脚本会报告每条 OK 或 NOT FOUND（NOT FOUND 表示 Portal 里没有该 SKU，需先创建产品）。

**当前已绑定的 SKU 范围（2026-07-27）：**
- Base Canopy 1000–1800mm（CD-2D-171xx 系列，含 SHB/W/无后缀，33 个 SKU）
- Base Canopy 1800mm Full Access（CD-3D-17188 系列）
- LC79 Factory Tray Canopy 1200/1600/1800mm（LC-2D-181x10 系列）
- Lockable Jerry Can Holder（CD-JCA 系列）
- Spare Wheel Carrier（CD-SWH 系列）

**不同步的 SKU 范围：**
- Base Tray / PKG 套餐（Portal 无对应 SKU，Shopify 端手动管理）
- Trundle Drawer（T-ADDON-VTD-*，方案待定）
- Add-on 配件（CDI-ADDON-*，如 Sensor/Camera/BLIS/灯）

---

### C. 手动触发同步

Portal → **Settings → Shopify Sync → Sync now**

查看 Sync Log 确认全部 `success`。如有 `error`，查看完整错误原因：

```sql
-- 在 Railway → Postgres → Data 标签页执行
SELECT p.sku, l.name AS location, sl.status, sl.error, sl."createdAt"
FROM "SyncLog" sl
JOIN "Product" p ON p.id = sl."productId"
JOIN "Location" l ON l.id = sl."locationId"
WHERE sl.status = 'error'
ORDER BY sl."createdAt" DESC
LIMIT 20;
```

---

### D. API 版本升级（年度维护）

Shopify 每季度发布新 API 版本（01/04/07/10），每个版本支持约 12 个月。Shopify 会在到期前 3 个月发邮件提醒。

**升级时需检查的两个文件：**

| 文件 | 改动位置 |
|---|---|
| `src/lib/shopify-sync.ts` | 第 70 行附近的 `/admin/api/2026-07/graphql.json` 版本字符串 |
| Cloudflare Rate Worker | 环境变量 `SHOPIFY_API_VERSION` 直接改值，无需改代码 |

**升级前必查的 mutation：**
- `inventorySetQuantities`（Portal 同步核心）→ 检查 `InventorySetQuantitiesInput` 和 `InventoryQuantityInput` 的字段定义
- 文档地址：`https://shopify.dev/docs/api/admin-graphql/{版本}/input-objects/InventorySetQuantitiesInput`

---

### E. 已知 API Breaking Changes 记录（2026-07-27）

| API 版本 | Breaking Change | 影响 | 修复方案 |
|---|---|---|---|
| 2026-01+ | `inventorySetQuantities` 支持 `@idempotent` directive（可选） | 无，新增功能 | — |
| 2026-04+ | `@idempotent` directive **强制必填** | 不带 key 的调用返回变量验证错误 | 每次调用用 `randomUUID()` 生成 key 嵌入 query |
| 2026-07 | `InventorySetQuantitiesInput` 无 `ignoreCompareQuantity` 字段 | 传该字段导致 GraphQL 类型验证失败 | 移除该字段 |
| 2026-07 | `InventoryQuantityInput.changeFromQuantity` **强制必填**（传 `null` 跳过 CAS 校验） | 不传导致 mutation 报错 | 每个 quantity item 加 `changeFromQuantity: null` |
| N/A | Shopify Admin 不再支持创建 Custom App，改为 Dev Dashboard | 无法在 Store Admin 拿到静态 `shpat_` token | 改用 Dev Dashboard + client credentials grant |
