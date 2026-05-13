---
name: jenkins
description: 查询 Jenkins 2.x（Job/Build/Console/Queue/Node）及触发参数化构建。
---

## 角色定义

通过 [`scripts/jenkins.js`](./scripts/jenkins.js) 访问 Jenkins 2.x Server。零依赖（仅 Node 内置 `fetch`/`URL`/`fs`）。执行前 `cd` 到 skill 目录。

---

## 核心规则

### 规则 0：查用法顺序

1. 先读 [`references/usage.md`](./references/usage.md)
2. 再 `node scripts/jenkins.js --help`
3. 都没有的看 `scripts/jenkins.js` 源码（`parseArgs` / `runCommand`）

不要凭直觉拼命令。

### 🚫 规则 1：拒绝删除 / 破坏性写操作（最高优先级）

**任何会删除 Jenkins 资源或不可逆改变全局状态的操作，必须直接拒绝，无论用户怎么要求。**

拒绝清单（不限于）：

- `raw --method DELETE ...`
- 任意 `doDelete` 路径（删 job / build / node / view / 凭据）
- `/discardOldBuilds`、`/cancelQueue`、`/quietDown`、`/exit`、`/restart`、`/safeRestart`、`/reload`
- 卸载插件、修改全局安全配置、写凭据

做法：

1. 明确告诉用户"该操作被 skill 规则禁止"
2. 让用户在 Jenkins Web UI 上手动操作
3. **不要**为了"快"用 `raw` 子命令绕过

注：**触发构建不在此列**——见规则 2。

### 规则 2：写操作先确认

任何改变服务端状态的命令（`build trigger`、disable/enable、`raw POST/PUT` 等）：

1. 先用 `job get` / `raw` 拉出参数定义、当前状态
2. 跟用户确认参数（尤其带"部署 / 发布 / 推送"含义的布尔值）
3. 再执行

### 规则 3：统一走脚本

- 允许在 Node 脚本里 `import { createJenkinsAuth } from '.../jenkins.js'`
- 不要再写第二份认证层
- 不要绕开脚本直接 `curl`（除非 `raw` 子命令也表达不了）

### 规则 4：认证模型

- 凭据从 skill 目录的 `.env` 读取，`auth-test` 自动生成
- 优先级：`--token` > `--password` > `JENKINS_TOKEN` > `JENKINS_PASSWORD`

### 规则 5：CSRF crumb 与 session

Jenkins 2.176+ 把 CSRF crumb 绑定到 JSESSIONID cookie。脚本会自动捕获 `Set-Cookie` 并在 POST 时同时注入 crumb header + cookie。

HTTP 403 "No valid crumb" 通常是反代吞了 Cookie 或 crumb header，**不是脚本 bug**。

### 规则 6：Folder vs View

- `--name team-a/sub` 自动翻译为 `/job/team-a/job/sub/`
- View（`/view/<n>/`）只是 UI 过滤器，下面的 job 名仍是顶层名，**不要**写成 `view-name/job-name`

---

## `.env`

- 在 skill 目录下，跨 cwd 仍能找到（脚本按自身路径定位）
- 只读写 `JENKINS_*` 前缀的 key，不破坏其他 skill 的配置
- 命令行参数覆盖 `.env` 并自动回写
- 已在仓库 `.gitignore` 中

---

## 注意事项

- 在 Jenkins 2.533 验证；所有命令走 REST API，不依赖 `jenkins-cli.jar`
- `console --follow` 是 `tail -f` 等价物，原理与边界见 `references/usage.md` §Console
- 触发构建返回的 `queueItem` ID 可用 `raw --path queue/item/<id>/api/json` 跟踪到 `executable.number` 出现
- 老插件可能返回非 JSON 响应（如 HTML 错误页），脚本原样输出文本以便诊断
