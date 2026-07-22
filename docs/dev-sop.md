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
- [ ] `quote → deposit_paid` → GeneratedMovement 创建，Reserved 增加
- [ ] `deposit_paid → fully_paid` → 无库存变化
- [ ] `fully_paid → completed` → InventoryLog 写入，On Hand 减少，Reserved 释放
- [ ] `任何状态 → cancelled` → Reserved 释放
- [ ] 非法转换拒绝（`quote → completed` 等）
- [ ] 终态无法再转换
- [ ] 并发编辑 → 409 冲突（第二个保存失败并提示）
- [ ] SKU 类型的销售记录：直接对 Product 预留
- [ ] Bundle 类型的销售记录：展开所有组件，对每个组件预留

### 5. Bundle 展开

- [ ] N 组件 Bundle → 生成 N 条 GeneratedMovement
- [ ] 数量正确：SalesRecord.qty × BundleItem.qty
- [ ] 组件 SKU 未激活（active=false）→ 转换被拒绝
- [ ] Bundle 代码不存在 → 转换被拒绝
- [ ] 修改 Bundle 定义 → 不影响已有订单的 GeneratedMovement

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
- [ ] 可按类型筛选
- [ ] 可按操作人筛选
- [ ] 可按日期范围筛选
- [ ] 每条记录的 reference 可点击跳转到来源

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
`CANOPY` | `TRAY_DECK` | `SERVICE_BODY` | `UNDERBODY_TOOLBOX` | `CHASSIS_PANEL` | `CHASSIS_DRAWER` | `HEADBOARD` | `MUDGUARD` | `ROOF_RACK` | `REAR_RACK` | `CANOPY_ACCESSORY` | `FITTING_KIT` | `UNISTRUT`

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
SHOPIFY_STORE_DOMAIN=coredrivenindustries.myshopify.com
SHOPIFY_ADMIN_API_TOKEN=shpat_xxxxx
SHOPIFY_WEBHOOK_SECRET=whsec_xxxxx
ADMIN_EMAIL=admin@cdi.com.au
ADMIN_PASSWORD=changeme
```
