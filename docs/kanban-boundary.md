# Portal vs 车间看板 — 职责边界

> Portal 是库存与履约的 system of record。车间协作、进度、沟通属于 system of engagement，应落在独立看板软件，不并入 Portal。
> 先例：销售单 packlist 打印页上的临时备注（仅本次打开、不入库）。

## 判断标准

新需求命中下表任一条，就该等看板，不要做进 Portal。

| 命中的信号 | 说明 | 该归谁 |
|---|---|---|
| 需要别人不打印也能看到这句话 | 变成协作 / 通知 | 看板 |
| 需要查到「上次写了什么」 | 变成历史记录，牵出撤回 / 审计 | 看板 |
| 需要触发别的动作 | 提醒谁、生成任务、改变状态 | 看板（工作流） |
| 需要按 SKU / 工序追踪进度 | 这就是看板本体 | 看板 |

允许做进 Portal 的车间相关能力：

- 把履约真相打印出来（packlist 来自 `GeneratedMovement` / 完成扣减）
- 打印前用输入框代替笔，在**这一张纸**上写字；刷新或离开即丢，不写数据库

## 两个系统怎么对接（设想，未实施）

看板若要读「这单还差什么没预留 / 拣什么」，走 Portal 的只读 API（可复用 `buildFulfillmentView` 的形状），**不直接连 Portal 数据库**。

Portal 不感知看板内部状态。不要把看板专属状态混进 `SalesRecord.status`（quote / deposit_paid / fully_paid / completed / cancelled 只描述库存与收款合同，不描述车间工序）。

安装排期已明确不做（constitution 决策 8，用 Monday.com）。车间看板是同一类「不是 Portal 该做的事」。
