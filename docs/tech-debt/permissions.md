# 技术债详情 — 权限

> 索引见 `register.md`。本文件只放权限相关条目。

---

### TD-01：Incoming 的读取接口没检查角色 {#td-01}

**人话解释：**
网页上 sales / viewer 账号点不到"到货"这个页面（页面本身有跳转判断），但如果知道网址规律，直接在浏览器地址栏或用 curl 敲 API 网址（不用点按钮进入页面），系统不会拦截，会把供应商名字、PO 号、进货成本这些数字原样返回。

**涉及文件：**
- `src/app/api/incoming/route.ts`（GET 列表接口，第 30-55 行区域，只检查登录状态，没检查角色）
- `src/app/api/incoming/[id]/route.ts`（GET 详情接口，第 13-30 行区域，同样问题）

**为什么会这样：**
之前给 Incoming 加 sales 角色限制时，把网页跳转判断（`page.tsx` 里的 redirect）和写操作的 API（POST/PATCH）都改了，但列表/详情这两个**读**接口当时没同步加检查——两处各写一份判断，漏了其中一个分支。这个历史修复记录在 `docs/auth-permissions-runbook.md`。

**触发条件：** 有人（内部人员或知道 API 路径的人）主动用浏览器 devtools 或工具直接调用 API，不是自动发生，需要主动绕过网页。

**影响范围：** 供应商名称、PO 号、单位成本——这些是采购敏感信息，sales/viewer 本不该看到。

**修复方案：** 给这两个接口补上和网页一致的角色检查（`role !== "viewer" && role !== "sales"` 或改用共享函数，见 TD-03）。

**状态：** 已修复（2026-08-17）— GET 调用 `canAccessIncoming`。
**登记日期：** 2026-08-17

---

### TD-02：Transfers 的读取接口同样没检查角色 {#td-02}

**人话解释：** 和 TD-01 完全一样的问题，换成"调货"功能。sales/viewer 直接调 API 能看到调货单详情。

**涉及文件：**
- `src/app/api/transfers/route.ts`（GET 列表）
- `src/app/api/transfers/[id]/route.ts`（GET 详情）

**触发条件：** 同 TD-01。

**修复方案：** 同 TD-01，补角色检查。

**状态：** 已修复（2026-08-17）— GET 调用 `canAccessTransfers`。
**登记日期：** 2026-08-17

---

### TD-03：角色判断散落，无共享函数 {#td-03}

**人话解释：**
"谁能看到什么、谁能点什么按钮"这个判断，现在是在很多个文件里各写一份，不是写在一个地方大家都来引用。就像同一条规定抄了几十份纸条贴在不同地方，改规定的时候必须找到每一张纸条改掉，漏改一张就出现 TD-01/TD-02 这种漏洞。

**具体分布（约 40 个文件里有权限相关判断）：**
- `src/components/sidebar.tsx` — 导航栏该显示哪些菜单
- 约 15 个页面文件（`incoming/*`、`transfers/*`、`bundles/*`、`settings/page.tsx`、`audit-log/page.tsx`、`inventory/adjust/page.tsx` 等）— 页面级跳转判断
- 约 20 个 API route 文件 — 接口级 403 判断

**已存在但没被用的东西：**
`src/lib/constants.ts` 里定义了 `ROLES` 常量和 `Role` 类型，但没有任何权限判断真正引用它，等于定义了却没用上。

**为什么重要（尤其是现在）：**
你打算开放 Bundle 的部分权限，这是新增一个权限维度。如果先加角色再收敛，新加的判断会散落成"第 21 份纸条"；如果先收敛成共享函数再加角色，只需要改一个文件。

**触发条件：** 每次新增角色、调整某功能权限范围时，都有漏改风险；不是"会不会发生"，是"下次改权限时有多大概率漏一个地方"。

**修复方案：** 新建 `src/lib/permissions.ts`，定义 `canAccessIncoming(role)`、`canAccessTransfers(role)`、`canAccessBundles(role)` 等函数，逐步替换 sidebar / 页面 / API 里的内联判断。这个建议本身在 `docs/auth-permissions-runbook.md:231` 已经写过，当时评估"未采纳，仅记录"。

**状态：** 已修复（2026-08-17）— 判断集中在 `src/lib/permissions.ts`。Bundle 菜单仍用 `canWriteBundles`（admin），Step 3 再改为 `canAccessBundles`。
**登记日期：** 2026-08-17

---

### TD-04：权限矩阵文档缺 sales 列 {#td-04}

**人话解释：**
`docs/constitution.md` 里那张"谁能做什么"的表格，只列了 Viewer / Editor / Admin 三种角色，但代码里其实有 4 种角色（多了 `sales`）。文档和代码不一致，看文档的人会误判 sales 能不能做某件事。

**涉及文件：**
- `docs/constitution.md`（权限矩阵章节，约第 460-473 行）

**触发条件：** 无自动触发，是文档滞后于代码的问题，靠人工发现。

**修复方案：** 补上 `sales` 列，同时核对审计日志（Audit Log）权限——代码里 sales 和 editor 都能看，但文档写的是仅 admin，两边需要对齐。

**状态：** 已修复（2026-08-17）— constitution §G 已含 sales 列，Audit Log 以代码为准。
**登记日期：** 2026-08-17
