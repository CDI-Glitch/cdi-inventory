<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# CDI Inventory Portal — Key Documents

| Document | Path | Notes |
|---|---|---|
| **System Design Constitution** | `docs/constitution.md` | Single source of truth for architecture, data model, permission matrix, ops SOP |
| **Dev SOP / Runbook** | `docs/dev-sop.md` | Regression checklist, DB connection troubleshooting, import script guide |
| **Auth & Permissions Runbook** | `docs/auth-permissions-runbook.md` | Admin protection rules, session hot-refresh, account isolation, demote/promote ops |
| **Aging / Backorder Alerts Runbook** | `docs/aging-reservations-runbook.md` | Dashboard + Inventory backorder mode: formulas, dual signals, troubleshooting |
| **Sellable Bundle / Shopify kits** | `docs/bundle-shopify-sync.md` | Tray BOM ATP, alt groups, kits cache, Worker lookup |
| **SKU Master List** | `docs/sku-master-list.md` | All current SKUs with categories and opening stock |
| **Tech Debt / Architecture Risk Register** | `docs/tech-debt/register.md` | Known architecture risks (permissions, inventory calc duplication, concurrency), status, and review triggers. Check before opening new permission scopes or major features. |
| **Portal vs workshop Kanban** | `docs/kanban-boundary.md` | What belongs in Portal vs a future shop-floor board. Use before adding workshop notes, tasks, or statuses. |

> ⚠️ The constitution is the authoritative document for this project. Read it before making any structural changes to the database schema, state machine, or permission model.
