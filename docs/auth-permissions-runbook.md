# CDI Inventory — 权限与会话热更新 Runbook

> 配套文件：`constitution.md`（权限矩阵权威源）、`dev-sop.md`（日常回归清单）
> 确立日期：2026-07-30
> 用途：维护账号权限、Admin 保护规则、会话热更新行为时的唯一操作手册

---

## 1. 设计原则（先读这段）

权限系统分 **两层**，不要混为一谈：

| 层 | 职责 | 是否允许短暂滞后 | 权威文件 |
|---|---|---|---|
| **安全层** | 每次请求重新查库校验 `role` / `active`；API 返回 403 | **不允许**——必须即时生效 | `src/lib/auth.ts`、各 API route |
| **UX 新鲜度层** | 已打开的标签页自动感知角色变化，刷新 Sidebar / 页面守卫 | 允许最多约 60 秒，或切回标签页时立即刷新 | `src/components/session-watcher.tsx` |

**安全层永远优先。** UX 层只是让用户不用手动 F5；即使 UX 层挂了，后端仍然会拒绝越权操作。

---

## 2. 架构图

```
┌─ Browser tab (already open) ─────────────────────────────────┐
│  SessionProvider                                             │
│    refetchOnWindowFocus ──┐                                  │
│    refetchInterval=60s ───┼──► GET /api/auth/session         │
│                           │         │                        │
│  RoleWatcher              │         ▼                        │
│    role changed? ─────────┘   jwt() callback                 │
│       │                       (re-query User.role/active)    │
│       ▼                                                      │
│  router.refresh() ──► re-run (portal)/layout + page guards   │
│  (or signOut if deactivated)                                 │
└──────────────────────────────────────────────────────────────┘

┌─ Any API / page request ─────────────────────────────────────┐
│  auth() / jwt() ──► DB role/active ──► allow or 403/redirect │
│  (independent of SessionWatcher; always authoritative)       │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. 关键文件索引

| 文件 | 作用 |
|---|---|
| `src/lib/auth.ts` | JWT 回调：每次 session 拉取都重查 `role` / `active`；停用则清空 token |
| `src/lib/auth.config.ts` | Edge 兼容配置（登录页、authorized 中间件） |
| `src/app/(portal)/layout.tsx` | 挂载 `<SessionWatcher>`；未登录 → `/login` |
| `src/components/session-watcher.tsx` | UX 热更新：角色变 → `router.refresh()`；停用 → `signOut()` |
| `src/components/sidebar.tsx` | 按 `role` 过滤导航项（含 Settings 仅 admin） |
| `src/app/api/users/[id]/route.ts` | Admin 三保护规则（自我 / 同级 / 保底） |
| `src/app/api/sync/route.ts` | Shopify Sync：admin-only，403 Forbidden |
| `src/components/settings/sync-panel.tsx` | 客户端必须检查 `res.ok`，禁止把 403 显示成绿色成功 |
| `src/app/(portal)/settings/page.tsx` | 整页 admin-only；非 admin → redirect `/dashboard` |

权限矩阵（谁能干什么）以 `docs/constitution.md` §G 为准，本 runbook 不重复抄写。

---

## 4. Admin 三保护规则

实现位置：`src/app/api/users/[id]/route.ts`

| 规则 | 行为 | UI 是否可做 |
|---|---|---|
| **自我保护** | admin 不能改自己的 role，也不能停用自己 | 否 → 400 |
| **同级保护** | admin 不能降级 / 停用另一个 admin | 否 → 400 |
| **保底保护** | 操作会导致 active admin 数量归零 → 拒绝 | 否 → 400 |

**可以在 UI 做的：** 把非 admin 提升为 admin。

**必须用数据库脚本做的：** 降级或停用一个已存在的 admin（有意设计——剥夺权限收紧到能操作 DB 的开发者）。

行业惯例不是「系统只能有一个 admin」，而是「至少保留一个 active admin」。单一 admin 是单点故障。

---

## 5. 账号隔离约定（2026-07-30）

| 账号 | 预期 role | 用途 |
|---|---|---|
| `dev@cdi.com.au` | **admin** | 开发者专用；改权限、Shopify Sync、绑定 Inventory Item ID |
| `admin@cdi.com.au` | **editor** | 老板日常业务登录（禁止共用 admin，否则 Audit Log 分不清操作人） |
| `brisbane@cdi.com` / `sydney@cdi.com` | editor | 仓管 |
| `salesmanager.bne@cdi.com.au` | sales | 销售 |

若发现 `admin@cdi.com.au` 又被提升为 admin，按 §6 降回 editor。

---

## 6. 运维操作：用脚本改 admin 角色

UI 无法降级 admin。标准做法（与 import 脚本相同：`pg.Pool` + `.env` 的 `DATABASE_URL`）：

```javascript
// 一次性脚本模板 — 用完即删，不要提交仓库
const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE "User" SET role = $1 WHERE email = $2 RETURNING email, role, active`,
      ['editor', 'admin@cdi.com.au']  // 或 'admin' 做提升
    );
    console.log(res.rows);
  } finally {
    client.release();
  }
}
main().catch(console.error).finally(() => pool.end());
```

**检查当前所有账号：**

```sql
SELECT email, role, active FROM "User" ORDER BY email;
```

**降级后预期：** 对方已打开的标签页切回焦点时应瞬切（Sidebar / Settings 消失或跳转 Dashboard）；最长不超过约 60 秒（`refetchInterval`）。

---

## 7. Session 热更新行为说明

| 触发 | 时机 | 结果 |
|---|---|---|
| `refetchOnWindowFocus` | 用户切回该浏览器标签页 | 几乎立即拉 session → 角色变则 `router.refresh()` |
| `refetchInterval={60}` | 标签页一直保持前台 | 最多约 60 秒内自动刷新 |
| 账号 `active=false` | 下次 session 拉取 | `jwt()` 清空 token → watcher 调 `signOut()` → `/login` |

**为什么不选 WebSocket / SSE：** 内部小团队系统，不需要毫秒级推送；next-auth 官方 `SessionProvider` 已覆盖「别人改了我的权限」这一场景，过度基建不划算。

**为什么不能删掉 sync-panel 的 `res.ok` 检查：** 那是客户端防御性 bug 修复，与 session 是否及时刷新无关。即使 UI 100% 实时，网络竞态 / 多标签页仍可能打到 403；必须正确显示红色错误，不能再出现 `Synced undefined SKU(s) — all good`。

---

## 8. 回归测试清单（改权限相关代码后必跑）

### 安全层

- [ ] Editor 调 `POST /api/sync` → 403，UI 显示红色 **Forbidden**（不是绿色成功）
- [ ] Editor 硬刷新 `/settings` → 被 redirect 到 `/dashboard`
- [ ] Admin 调 `POST /api/sync` → 200，正常同步
- [ ] Admin 在 UI 尝试改自己的 role → 400
- [ ] Admin A 在 UI 尝试降级 Admin B → 400
- [ ] 停用账号后，该用户下一次请求 / 焦点刷新 → 被登出到 `/login`

### UX 热更新层

- [ ] 用户以 admin 打开 Settings → Shopify Sync（**不要刷新这个标签页**）
- [ ] 用脚本把该用户降为 editor
- [ ] 切回该标签页（或等 ≤60s）→ Sidebar 角色变为 editor，Settings 不可用 / 跳转 Dashboard
- [ ] 不刷新页面时点 Sync now（若仍停在 Sync 页）→ 红色 Forbidden（证明安全层独立于 UX 层）

### 账号隔离

- [ ] `SELECT email, role FROM "User"` → `dev@cdi.com.au` = admin，`admin@cdi.com.au` = editor

---

## 9. 故障排查

| 现象 | 可能原因 | 处理 |
|---|---|---|
| 降级后 UI 一直显示 Admin，但 Sync 已 403 | 正常：安全层已生效，UX 层未刷新 | 切回标签页触发 focus refetch；或等 60s；或硬刷新 |
| 切回标签页也不更新 | Railway 未部署含 `session-watcher` 的版本；或浏览器仍跑旧 JS | 确认 Deployments 最新 commit；硬刷新一次 |
| Sync 显示 `Synced undefined SKU(s) — all good` | 旧版 `sync-panel` 未检查 `res.ok` | 确认 `sync-panel.tsx` 含 `if (!res.ok)`；Redeploy |
| UI 无法把某人从 admin 降下来 | 同级保护，预期行为 | 用 §6 脚本操作 DB |
| 系统里没有 active admin 了 | 违规直接改库绕过保底保护 | 立刻用脚本把 `dev@cdi.com.au`（或可信账号）设回 `role='admin'` |

---

## 10. 变更纪律

改以下任一文件前，必须读完本 runbook §1–§3，并跑完 §8 清单：

- `src/lib/auth.ts` / `auth.config.ts`
- `src/components/session-watcher.tsx`
- `src/app/api/users/[id]/route.ts`
- `src/app/(portal)/layout.tsx` / `settings/page.tsx`
- `src/components/settings/sync-panel.tsx`
- `src/components/sidebar.tsx` 的 `roles` 白名单

**禁止：**

- 为了「方便测试」在生产关掉 `jwt()` 里的 DB 重查
- 删掉 sync-panel 的 `res.ok` 检查
- 用 UI 互相降级 admin 作为常规运维手段
- 让老板日常账号长期保持 admin（破坏 Audit Log 归因）
