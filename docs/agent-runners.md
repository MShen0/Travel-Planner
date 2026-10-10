# 交给 Agent：选电脑或云端

按「交给 Agent」时，底部出现两个选项，各带一盏灯：

| 选项 | 灯 | 按下后 |
|---|---|---|
| 💻 电脑 | 青色 = 电脑上的 Agent 在线；灰色 = 离线（不能选） | app 给电脑上的会话发消息，它马上抓 |
| ☁️ 云端 | 一直青色 | app 启动云端 Routine，开一个新的云端会话去抓 |

只有按下的那一刻才会抓，后台没有定时任务。已上线：artifact Version 20。

## 怎么做到的

app 声明了 `mcp` capability，通过看的人自己的 **Claude Code Remote** 连接器调用三个工具：

- `list_sessions`：找标题包含 `meta/app.computerSessionName`（默认「旅用 电脑」，忽略空格）的会话，
  `connection_status == "connected"` 就亮青色灯。打开选项或待办页时查一次，之后每分钟查一次。
- `send_message`：选电脑时叫醒那个会话，消息里带条目 id。
- `fire_trigger`：选云端时启动 `meta/app.cloudTriggerId`（Routine「旅用 云端抓取」，没有排程）。

第一次按时 claude.ai 会问是否允许这个页面用 Claude Code Remote。

## 朋友按的时候

Routine 和电脑会话属于主人的账号，朋友的账号启动不了。所以：

- 朋友选云端：链接照样存进待办（`runner: "cloud"`），提示「旅用的主人下次打开 app 时，云端会自动处理」。
  主人的 app 一打开，看到没启动过的云端条目（没有 `firedAt`）就自动启动一次。
- 朋友那边的电脑灯是灰的（看不到主人的会话）。
- 待办页每条都有「交给电脑 / 交给云端（再叫一次云端）」，失败的可以重试。

## 电脑这边要做的

1. 在电脑上开一个 Claude Code 会话，进入仓库目录，打开 Remote Control（`/remote-control`），
   把会话改名为包含「旅用 电脑」的名字（`/rename 旅用 电脑 Agent`）。
2. 跟它说一次：「收到旅用 app 的消息时，按 CLAUDE.md 和 /collect、/guide 处理 inbox 里 runner == computer 的待办。」
3. 会话连着的时候，app 里的电脑灯就是青色。

## 代码

live artifact 是多文件版本（不在 GitHub 上）。这次改动的文件：

- 新增 `js/lib/agents.js`（纯函数：解析会话列表、找电脑会话、待启动的云端条目）和 `js/ui/agents.js`
  （`useAgentHub`、`AgentPicker`、`AgentLamps`）。
- `index.html` 加载这两个文件；`js/ui/platform.js` 的 runtime 多了 `mcp`；`js/app.js` 把 `agents` 放进 `ctx`。
- `js/ui/collect.js`、`js/ui/guides.js`：「交给 Agent」先显示选项；待办页显示由谁处理、排队中 / 处理中，并能改交或重试。
- `js/ui/home.js` 提示文字；`js/ui/kit.js` 新图标 `laptop`、`cloud`；`css/tokens.css` 的 `--lamp-on`（青）/`--lamp-off`（灰）；
  `css/screens.css` 末尾的 `.agent-pick`、`.agent-opt`、`.lamp`、`.agent-lamps`、`.inbox-actions`。

电脑上继续改 app 之前，先用 Artifact 工具 `read`（`paths` 全部文件）拉回 Version 20，不然会把这次的改动覆盖掉。
