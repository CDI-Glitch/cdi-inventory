<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# CDI Inventory Portal — Key Documents

| Document | Path | Notes |
|---|---|---|
| **System Design Constitution** | `docs/constitution.md` | Single source of truth for architecture, data model, permission matrix, ops SOP |
| **Dev SOP / Runbook** | `docs/dev-sop.md` | Regression checklist, DB connection troubleshooting, import script guide |
| **SKU Master List** | `docs/sku-master-list.md` | All current SKUs with categories and opening stock |

> ⚠️ The constitution is the authoritative document for this project. Read it before making any structural changes to the database schema, state machine, or permission model.
