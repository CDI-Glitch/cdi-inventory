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
| `src/lib/permissions.ts` | 权限判断集中点（含 `canAccessMobileView`） |
| `src/app/(mobile)/layout.tsx` | `/m/*` 登录守卫；只读 chrome，不复用桌面 Sidebar |

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
| `salesmanager.bne@cdi.com.au` | sales | 销售（BNE） |
| `cyrus@cdi.com.au` | sales | 销售（Sydney） |

若发现 `admin@cdi.com.au` 又被提升为 admin，按 §6 降回 editor。

### 5.1 初始密码存档（运营账号）

> 仅记录**创建时的初始密码**，供运维找回参考。员工自行改密后以数据库 `passwordHash` 为准，本表不再强制同步。  
> 创建脚本：仓管见 `prisma/seed.ts`；BNE 销售见 `scripts/create-bne-manager.cjs`；Sydney 销售见 `scripts/create-cyrus-sales.cjs`。

| 账号 | 初始密码 | 创建日期 | 备注 |
|---|---|---|---|
| `brisbane@cdi.com` | `Cdi@Bne2026$` | seed | 仓管 |
| `sydney@cdi.com` | `Cdi@Syd2026$` | seed | 仓管 |
| `salesmanager.bne@cdi.com.au` | `cdi2026manager!` | 见 create 脚本 | BNE 销售 |
| `cyrus@cdi.com.au` | `Cyrus$yd#Inv2026` | 2026-08-10 | Sydney 销售；显示名 Cyrus；role=`sales` |

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

## 10. 故障案例：`?error=MissingCSRF` 登出死循环（2026-07-30）

**现象：** 老板账号（`admin@cdi.com.au`）在其电脑上无法登录，反复输入正确密码仍显示 "Invalid email or password"，地址栏为 `.../login?error=MissingCSRF`。其他设备（用户本人手机/电脑、平板）不受影响。最终由老板手动删除 URL 里的 `?error=MissingCSRF` 后缀并重新访问干净的 `/login`，问题立即消失。

**根因链路（已在代码层面确认）：**

1. 当时正在对 §6/§8 的 admin 降级/升级机制做验证测试，老板的账号恰好在线（开着 portal 内部页面标签页未关），测试过程中被 `jwt()` 回调（`src/lib/auth.ts`）判定为 `active=false` 或 role 已变，token 被清空。
2. `session-watcher.tsx` 的 `RoleWatcher` 检测到 `status` 从已登录瞬间变为 `unauthenticated`，按设计自动调用了 `signOut({ callbackUrl: "/login" })`。
3. 这次自动登出发生在 token 刚被判定失效的异常时刻，登出请求本身的 CSRF 校验未通过 → NextAuth 在跳转时自动把 `?error=MissingCSRF` 拼在了回跳地址后面。**这个后缀不是老板手动产生的，是自动登出流程自己带出来的。**
4. 老板停留在这个已经"状态卡死"的页面反复重试登录，每次都复用同一批已失效/不匹配的 CSRF 状态，因此无论密码是否正确都必然失败（`src/app/login/page.tsx` 的 `signIn(..., { redirect:false })` 对任何 `result.error` 统一显示 "Invalid email or password"，看不出真实原因）。
5. 手动删除 URL 后缀并重新访问，强制浏览器发起一次全新请求，重新拿到一套匹配的登录令牌，问题消失。第 5 步"为什么单纯刷新无效、必须改动地址栏"未能在代码层完全证实，最可能是浏览器缓存/bfcache 命中了旧状态，但这属于浏览器黑盒行为。

**结论与后续处理（2026-07-30 首次评估）：**

- 当时判断为一次性的**测试副作用**，不是持续性的生产 bug；正常运营中没人会频繁手动切换 admin 权限，基本不会复现。
- **评估后决定不做代码修复**，仅记录在此供未来排查参考。
- 排除的错误假设：曾怀疑是 `AUTH_SECRET`/`NEXTAUTH_SECRET` 命名不一致（v4→v5 迁移遗留）导致全局 CSRF 失效，但该假设被推翻——若是全局配置问题，删除后缀重新访问同一台服务器应该复现同样的错误，而实际观察是重新访问后立即成功，说明问题是这一次的会话/令牌状态卡死，而非服务器配置缺失。

**2026-09-01 更新——复现频率升高，已修复：**

上面 2026-07-30 的评估把这归为"admin 降级测试期间的极小概率边界情况"，但后续反馈是**用户一切换网络（WiFi ↔ 流量，或短暂断网）就会触发同一条链路**，说明真正的触发条件远比"账号被停用"宽得多——`session-watcher.tsx` 的 `RoleWatcher` 只要看到 `useSession()` 的 `status` 变成 `"unauthenticated"` 就无条件自动登出，而这个 `status` 本身并不可靠：

- **真正的根因（已对照 NextAuth v5 源码 `packages/next-auth/src/lib/client.ts` 的 `fetchData()` 确认）：** 该函数无论是"请求真的发出去了，服务器确认没有会话"，还是"请求本身网络失败/超时/离线"，两种情况都统一 `catch` 后返回同一个 `null`，`useSession()` 完全区分不出来。网络切换的瞬间发生的请求失败，会被误判为"真的被登出了"。
- 这与另一个主流 Auth 库 `better-auth` 修过的 issue 是同一类 bug：[Session is set to null on network reconnect (mobile)](https://github.com/better-auth/better-auth/issues/8420)，官方修复（[PR #8437](https://github.com/better-auth/better-auth/pull/8437)）采用的做法是 stale-while-revalidate：只有服务器明确确认"没有会话"才清空登录态，网络层错误则保留原状态、等下一轮重试。

**修复方式（`src/components/session-watcher.tsx`）：** `RoleWatcher` 看到 `status === "unauthenticated"` 后不再直接调用 `signOut()`，而是先用自己的 `fetch("/api/auth/session", { cache: "no-store" })` 独立复核一次——fetch 本身抛错（网络问题）就当作"还不确定"，维持现状等下一轮轮询；只有 fetch 正常完成且确认没有 `user` 才认定是真的登出。真正登出时也改用 `signOut({ redirect: false })` + 手动 `router.replace("/login")`，不再让 NextAuth 自己的重定向路径有机会拼出 `?error=MissingCSRF`。`src/app/login/page.tsx` 同时加了兜底：一进页面就清掉 URL 里残留的 `?error=...`，且把 `MissingCSRF` 和"密码错误"分开显示，不再一律显示"Invalid email or password"。

- 这个修改**不影响权限即时生效**：真正的强制点在 `src/lib/auth.ts` 的 `jwt()` 回调，每次服务器端调用 `auth()`（任何页面加载、任何 API 请求）都会重新查一次数据库的 `active`/`role`，与 `session-watcher.tsx` 这层纯 UX 便利逻辑无关。改动只影响"停留在原地什么都不做的那个浏览器 Tab，多久会自己弹回登录页"，不影响"这个人下一次做任何实质操作时是否会被服务器拦截"。

---

## 11. 故障案例：sales 角色可绕过页面级权限直接访问 Incoming/Transfers（2026-08-11）

**现象：** sales 角色用户直接在地址栏输入 `/incoming`、`/transfers` 等 URL 可以正常打开页面并看到供应商名称、PO 号、ETA、单件成本 (`unitCost`)、调货明细，以及编辑表单和状态操作按钮——尽管 Sidebar 导航里根本看不到这两个入口的链接。

**根因：** 权限判断分散在三层，新增 `sales` 角色时只更新了其中两层：

| 层 | 文件 | 是否正确排除 sales |
|---|---|---|
| Sidebar 导航过滤 | `src/components/sidebar.tsx` | 是（`roles: ["editor", "admin"]`） |
| 写入 API | `src/app/api/incoming/*`、`src/app/api/transfers/*` | 是（`role === "viewer" \|\| role === "sales"` → 403） |
| **页面级 `redirect` 守卫** | `incoming/page.tsx`、`incoming/[id]/page.tsx`、`incoming/new/page.tsx`、`transfers/page.tsx`、`transfers/[id]/page.tsx`、`transfers/new/page.tsx` | **否**——6 个文件全部只写了 `if (role === "viewer") redirect("/dashboard")`，遗漏了 sales |

页面层的检查很可能是在系统还只有 viewer/editor/admin 三级角色时写的，后续加入 `sales` 角色并收紧到"到货/调货 sales 不能"（`docs/constitution.md` §G）时，API 层和 Sidebar 都同步更新了，唯独这 6 处页面守卫被漏改——典型的"权限判断点分散、新增角色未逐一核对"问题。

**修复：** 6 个文件统一改为 `if (role === "viewer" || role === "sales") redirect("/dashboard")`，与 API 层写法完全一致。不影响 editor/admin 的正常访问，也不需要改 Sidebar 或写入 API（它们本来就是对的）。

**后续（2026-08-17 已实施）：** 权限判断已收敛到 `src/lib/permissions.ts`（`canAccessIncoming` / `canWriteIncoming` / `canAccessTransfers` 等）。Sidebar、页面 redirect、API（含 Incoming/Transfers **GET**）一律调用该文件。GET `/api/incoming*`、`GET /api/transfers*` 原先只查登录、不查角色的漏洞一并堵住。

---

## 12. 变更纪律

改以下任一文件前，必须读完本 runbook §1–§3，并跑完 §8 清单：

- `src/lib/auth.ts` / `auth.config.ts`
- `src/components/session-watcher.tsx`
- `src/app/api/users/[id]/route.ts`
- `src/app/(portal)/layout.tsx` / `settings/page.tsx`
- `src/components/settings/sync-panel.tsx`
- `src/components/sidebar.tsx` 的 `canShow` 函数
- `src/app/(portal)/incoming/**/page.tsx`、`src/app/(portal)/transfers/**/page.tsx` 的角色 `redirect` 守卫（必须与 `src/lib/permissions.ts` 一致）
- `src/lib/permissions.ts`（新增角色或改范围时只改这里；`/m` 只读边界见 [`mobile-alerts-runbook.md`](./mobile-alerts-runbook.md)）

**禁止：**

- 为了「方便测试」在生产关掉 `jwt()` 里的 DB 重查
- 删掉 sync-panel 的 `res.ok` 检查
- 用 UI 互相降级 admin 作为常规运维手段
- 让老板日常账号长期保持 admin（破坏 Audit Log 归因）
