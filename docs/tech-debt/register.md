# 技术债 / 架构风险登记表

> 用途：记录"已知但暂不修复"或"已修复"的架构风险，按分类拆到子文件，供定期检查。
> 不是回归测试清单（那个在 `dev-sop.md`），不是设计决策记录（那个在 `constitution.md`）。
> 参考 `cdi-docs/dev/contract-deviations.md` 的登记思路，这里是 inventory 后端架构的对应版本。

## 使用方法

1. 定期检查（建议每次开放新权限 / 新功能上线前）时，先看这张表，状态是"排期中"或"待观察"的条目优先处理。
2. 每条只在这里放**一行摘要**，详情去对应分类文件查。
3. 状态变化（新增 / 修复 / 触发条件出现）时更新本表 + 对应分类文件。
4. 新增条目时分类文件选择：权限 → `permissions.md`；库存计算 → `inventory-calc.md`；并发/事务 → `concurrency.md`。分类文件超过约 10 条时再考虑拆子文件。

## 索引表

| ID | 分类 | 一句话风险 | 状态 | 登记日期 | 详情 |
|---|---|---|---|---|---|
| TD-01 | 权限 | Incoming 的 GET 接口没检查角色，sales/viewer 绕过网页可直接调 API 看到供应商/成本数据 | 已修复 | 2026-08-17 | [permissions.md#td-01](permissions.md#td-01) |
| TD-02 | 权限 | Transfers 的 GET 接口同样没检查角色 | 已修复 | 2026-08-17 | [permissions.md#td-02](permissions.md#td-02) |
| TD-03 | 权限 | 角色判断散落在 sidebar / ~15 个页面 / ~20 个 API route，无共享函数，新增角色容易漏改 | 已修复 | 2026-08-17 | [permissions.md#td-03](permissions.md#td-03) |
| TD-04 | 权限 | `constitution.md` 权限矩阵缺 `sales` 列，和代码不同步 | 已修复 | 2026-08-17 | [permissions.md#td-04](permissions.md#td-04) |
| TD-05 | 库存计算 | Forecast / Aging / Factory CSV 三处各自重写库存公式，未调用共享的 `getStock()` | 已修复 | 2026-08-17 | [inventory-calc.md#td-05](inventory-calc.md#td-05) |
| TD-06 | 库存计算 | Dashboard 低库存卡片没按仓库分组，多仓场景下数字错误 | 已修复 | 2026-08-17 | [inventory-calc.md#td-06](inventory-calc.md#td-06) |
| TD-07 | 并发/事务 | 库存写操作（预留、调货、到货确认）没有包在 `$transaction` 里 | 待观察 | 2026-08-17 | [concurrency.md#td-07](concurrency.md#td-07) |
| TD-08 | 并发/事务 | 库存行没有行级锁/乐观锁，并发预留同一 SKU 可能都成功 | 待观察 | 2026-08-17 | [concurrency.md#td-08](concurrency.md#td-08) |

## 状态说明

| 状态 | 含义 |
|---|---|
| 已登记 | 已确认存在，尚未排期 |
| 排期中 | 已确定要修，等待实施 |
| 待观察 | 现有设计（如允许负库存）已吸收大部分风险，暂不修，等触发条件出现再处理 |
| 已修复 | 完成修复，保留记录供追溯 |

## 明确不登记的项（已评估，判定为当前规模不需要）

- 引入 Redis / 消息队列：当前写入量和团队规模不需要，PostgreSQL 已有的 `BundleLocationStock` 缓存 + HTTP cache 足够
- 拆微服务 / 换后端框架：单体在当前规模是合理选择，换栈成本远高于收益
