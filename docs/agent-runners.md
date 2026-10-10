# 交给 Agent：选电脑或云端

按「交给 Agent」时，用户选由谁来抓：

| 选项 | 灯 | 什么时候抓 |
|---|---|---|
| 电脑 | 青色 = 电脑上的 Agent 在线；灰色 = 离线（不能选） | 电脑上的 Claude Code 收到后马上抓 |
| 云端 | 一直青色 | 按下后启动一个云端 session 去抓（约几分钟） |

只有按下的那一刻才会抓，没有定时任务在后台跑。

## 数据

`inbox/{id}` 多一个字段 `runner: "computer" | "cloud"`。没有这个字段的旧条目当作 `cloud`。
两边只处理自己的条目，互不抢。

## 云端（已建好）

- Routine「旅用 云端抓取」，id `trig_01PpM4ge5GSGxXa44vFzUvAS`，没有排程，只在被触发时运行，每次开一个新 session。
- 它处理 `status == "pending"` 且 `runner` 为 `cloud` 或缺省的条目，写好地点或攻略后关闭条目。
- app 触发方式：声明 `mcp` capability，连接器 `Claude Code Remote`，工具 `fire_trigger`：

  ```js
  capabilities: {db:{}, user:{scopes:["profile"]}, sample:{}, assets:{}, downloads:true,
    mcp:{servers:[{server:"Claude Code Remote", tools:["fire_trigger"]}]}}
  ```

  写入 inbox 条目（`runner:"cloud"`）之后调用
  `callTool("Claude Code Remote", "fire_trigger", {trigger_id: "trig_01PpM4ge5GSGxXa44vFzUvAS"})`。
  第一次会弹出授权。`use("mcp")` 返回 `null` 或调用被拒时：条目照样存着，显示「已存进待办，下次打开云端或电脑时处理」。
- 只有 Routine 的主人（MS）能触发它。同行的人按「云端」时调用会失败，按上面的降级处理。
- trigger id 写进 `meta/app.cloudTriggerId`，不要硬编码在 HTML 里。

## 电脑

电脑上开一个专门的 Claude Code session（建议标题「旅用 电脑 Agent」）并打开 Remote Control。

在线判断，二选一，先试第一种：

1. **Remote Control 状态**：app 用同一个连接器的 `list_sessions` 找标题为「旅用 电脑 Agent」的 session，
   看它是否连着（先实际调用一次确认返回里有没有在线状态，没有就用第二种）。按「电脑」时用 `send_message`
   给它发「处理 inbox 里 runner == computer 的条目」。
2. **心跳**：电脑上的 session 用 `/loop` 每 2 分钟写一次 `meta/agent`：
   `{"id":"agent","computerSeenAt": <ms>}`，顺便处理 `runner == "computer"` 的待办。
   app 里 `now - computerSeenAt < 5 分钟` 就是青色。每次心跳都会用一点额度。

电脑离线时「电脑」按钮是灰的，不能选；已经选了电脑但还没处理的条目，可以在待办里改成云端（改 `runner` 再触发）。

## UI

- 「交给 Agent」弹层里两个选项卡片：💻 电脑 / ☁️ 云端，各带一个小圆灯（青色 `--sky` 系，灰色 `--line`）。
- 灯旁一行小字：电脑「在线」/「离线」，云端「随时可用」。
- 待办列表每条显示由谁处理和状态（排队中 / 处理中 / 完成 / 失败）。
