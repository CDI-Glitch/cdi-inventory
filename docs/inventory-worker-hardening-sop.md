# CDI Inventory — Public API Worker 加固 SOP & 回归测试清单

> 配套文件：`dev-sop.md`（Portal 主 SOP）、`constitution.md`（设计宪法）
> 配套计划：`cdi-inventory_worker_proxy_hardening_0127cae8.plan.md`
> 用途：实施「Worker 反代 + 限流 + CORS 收窄 + 状态值响应」改动时，逐项回归检查，确保不破坏现有 PDP 库存展示功能

---

## 改动摘要

| 层 | 改动前 | 改动后 |
|---|---|---|
| 浏览器请求目标 | 直连 Railway Portal (`cdi-inventory-production.up.railway.app`) | 打新建的 `cdi-inventory-worker`（Cloudflare Workers） |
| Portal 响应内容 | 精确件数 `{ "brisbane": 5, "sydney": 0 }` | 状态字符串 `{ "brisbane": "in_stock", "sydney": "out" }` |
| Portal 直连保护 | 无认证，任何人可直接 curl | 需 `x-internal-key` header，缺失/错误返回 403 |
| CORS | `Access-Control-Allow-Origin: *` | Worker 层收窄到 `https://coredrivenindustries.com.au`；Portal 层不再需要通配 CORS |
| 限流 | 无 | Worker 层按 IP 滑动窗口，30 req/min，超出 429 |

涉及三个仓库：
- `cdi-worker`（新增 `inventory-worker/`）
- `cdi-inventory`（`src/app/api/public/inventory/route.ts`）
- `cdi-theme`（`config/settings_data.json`、`config/settings_schema.json`、`assets/cdi-fulfillment.js`）

---

## 回归测试清单

### 1. Worker 层（`cdi-inventory-worker`）

- [ ] `curl https://cdi-inventory-worker.coredrivenindustries.workers.dev/api/public/inventory?sku=<已绑定SKU>` 返回 200 + `{brisbane: "in_stock"|"out", sydney: "in_stock"|"out"}`
- [ ] 同一 SKU 请求 `sku` 参数缺失 → 400（透传 Portal 的 400）
- [ ] 未绑定 SKU → 404（透传 Portal 的 404）
- [ ] 从浏览器 devtools 用非白名单 Origin（如 `https://example.com`）发起跨域请求 → 被 CORS 拦截，Network 面板无 `Access-Control-Allow-Origin` 或值不匹配
- [ ] 从 `https://coredrivenindustries.com.au` 页面发起请求 → 正常返回，响应头含匹配的 `Access-Control-Allow-Origin`
- [ ] 60 秒内对同一 IP 连续发起 35+ 次请求 → 第 31 次起返回 429，响应头含 `Retry-After`
- [ ] 等待限流窗口过期后 → 恢复 200
- [ ] Worker 请求 Portal 时是否正确附带 `x-internal-key`（可在 Portal 端日志或临时打印确认，测完删除临时日志）

### 2. Portal 层（`route.ts`）

- [ ] 直接 `curl https://cdi-inventory-production.up.railway.app/api/public/inventory?sku=<SKU>`（不带 `x-internal-key`）→ 403
- [ ] 带错误的 `x-internal-key` → 403
- [ ] 带正确的 `x-internal-key`（与 Railway 环境变量一致）→ 200，返回状态字符串（不是数字）
- [ ] `available > 0` 的仓库 → 返回 `"in_stock"`
- [ ] `available == 0` 的仓库 → 返回 `"out"`
- [ ] 响应中确认没有任何数字字段泄露精确件数
- [ ] Portal 原有内部功能不受影响：库存调整、销售记录、Shopify 同步等页面正常（这些走的是鉴权后的 `/api/inventory` 等路由，非 `/api/public/inventory`，理论上不受影响，但仍需过一遍避免误改了共享代码）

### 3. 主题层（`cdi-theme`）

- [ ] `settings_data.json` 的 `cdi_portal_url` 已改为 Worker 域名（不是 Railway 域名）
- [ ] Theme Editor → Theme settings → CDI Integration → Portal URL 字段显示的值与 Worker 域名一致
- [ ] PDP 页面（已绑定 SKU 产品）：Brisbane / Sydney 两个 Tab 正确显示 `In stock` / `Back-order` / `Out of stock`
- [ ] PDP 页面（未绑定 SKU 产品）：Tab switcher 隐藏（`visibility: hidden`），显示单行聚合状态，无布局跳动（CLS）
- [ ] 切换变体（swatch）→ 重新请求 Worker，状态正确刷新
- [ ] 断网或 Worker 不可用 → 圆点保持灰色、状态文字为空（不报错、不崩溃，现有静默 catch 逻辑不变）
- [ ] DevTools Network 面板确认请求目标是 Worker 域名，不再直接出现 Railway 域名

### 4. 端到端安全验证

- [ ] 用不同浏览器 / 无痕模式模拟"竞品视角"：打开 PDP，Network 面板看到的请求 URL 只有 Worker 域名，看不到 Railway 域名
- [ ] 尝试用看到的 Worker URL 直接批量换 SKU 循环请求 → 触发限流（第 31 次起 429）
- [ ] 响应体确认只有状态字符串，无法反推精确库存数字

### 5. 部署顺序回归（对照计划文档的 Deploy order）

- [ ] Step 1：Worker 部署后，主题仍指向旧 Railway URL 且 Portal 未加 key 校验 → 现有功能不受影响（验证 Worker 上线本身不引入回归）
- [ ] Step 2 + 3：Portal 加 key 校验 + 主题切换到 Worker URL 尽量同时上线；上线后立即跑一遍第 1-4 节
- [ ] 若中间出现短暂状态显示异常（灰色圆点），确认几分钟后恢复正常，且没有报错弹窗或页面崩溃

---

## 回滚方案

若上线后发现问题，按以下顺序回滚（不需要一次性全部回滚，视问题范围而定）：

1. **主题**：`settings_data.json` 的 `cdi_portal_url` 改回 Railway 域名（Theme Editor 可直接改，无需重新部署代码）
2. **Portal**：临时放宽 `x-internal-key` 校验（允许缺失 header 时也放行），保留状态字符串响应格式
3. **Worker**：若 Worker 本身故障，直接跳过（回滚步骤 1 后主题不再依赖 Worker）

## 环境变量检查清单（上线前确认已设置）

| 位置 | 变量 | 值来源 |
|---|---|---|
| Railway (`cdi-inventory`) | `PORTAL_INTERNAL_KEY` | 随机生成的密钥字符串 |
| Cloudflare (`cdi-inventory-worker`) | `PORTAL_URL` | `https://cdi-inventory-production.up.railway.app` |
| Cloudflare (`cdi-inventory-worker`) | `PORTAL_INTERNAL_KEY` | 与 Railway 侧完全一致 |
| Cloudflare (`cdi-inventory-worker`) `wrangler.toml` | `ALLOWED_ORIGIN` | `https://coredrivenindustries.com.au` |
| Cloudflare (`cdi-inventory-worker`) | KV namespace binding | `INVENTORY_RATE_LIMIT` |

---

## 开发日志

> 实施过程中发现的边界场景、临时决策记录在这里（格式对齐 `dev-sop.md`）。

| 日期 | 发现 | 处理 |
|---|---|---|
| | | |

---

## 后续变更（本 SOP 完成后）

| 日期 | 变更 | 说明 |
|---|---|---|
| 2026-07-29 | 端点改名：`/api/public/inventory` → `/api/internal/inventory` | 纯语义修正，安全边界和行为不变——本 SOP 加固完成后该端点就已只接受带 `x-internal-key` 的请求，"public" 命名与实际情况不符，遂改名。三个仓库（`cdi-worker`、`cdi-inventory`、`cdi-theme`）同步改动，git 识别为 rename。完整记录见 `cdi-docs/dev/inventory-worker-runbook.md` v1.1。 |
| 2026-07-29 | PDP 加载骨架 | Worker 反代引入的额外网络延迟（Railway 冷启动可达数百毫秒）在客户端表现为空白等待，`cdi-theme/snippets/cdi-fulfillment-info.liquid` 新增纯 CSS shimmer 骨架动画覆盖此期间。架构记录见 `cdi-docs/dev/pdp-architecture.md` §8.7。 |

本 SOP 的回归测试清单中涉及的 `/api/public/inventory` 路径引用均已过期，实际路径以上表改名后的 `/api/internal/inventory` 为准；不追溯修改本文档正文以保留历史准确性。
