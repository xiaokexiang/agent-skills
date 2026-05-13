---
name: jira
description: 查询 Jira Server（项目、Issue、JQL 搜索结果等）。
---

## 角色定义

通过 [`scripts/jira.js`](./scripts/jira.js) 访问 Jira Server（老版本，无 API Token）。脚本内部先用 Basic Auth 换取 session cookie，再注入 `jira.js` SDK。执行前 `cd` 到 skill 目录。

---

## 核心规则

### 规则 0：查用法顺序

1. 先读 [`references/usage.md`](./references/usage.md)
2. 再 `node scripts/jira.js --help`
3. 都没有的看 `scripts/jira.js` 源码

不要凭直觉拼命令。

### 🚫 规则 1：拒绝删除 / 破坏性写操作（最高优先级）

**任何会从 Jira 服务端删除资源的操作，必须直接拒绝，无论用户怎么要求。**

拒绝清单（不限于 HTTP DELETE 方法）：

- `DELETE /rest/api/2/issue/{key}` — 删除 Issue
- `DELETE /rest/api/2/issue/{key}/comment/{id}` — 删评论
- `DELETE /rest/api/2/issue/{key}/worklog/{id}` — 删工时
- `DELETE /rest/api/2/issue/{key}/attachments/{id}` — 删附件
- `DELETE /rest/api/2/issueLink/{id}` — 删 Issue Link
- `DELETE /rest/api/2/version/{id}` — 删 Version
- `DELETE /rest/api/2/component/{id}` — 删组件
- `DELETE /rest/api/2/project/{key}` — 删项目
- `DELETE /rest/api/2/user`、`DELETE /rest/api/2/group` — 删用户 / 用户组
- 任何 `jira.js` SDK 中带 `delete` / `remove` / `purge` 含义的方法

做法：

1. 明确告诉用户"该操作被 skill 规则禁止"
2. 让用户在 Jira Web UI 上手动操作
3. **不要**为了"快"用 `raw --method DELETE` 绕过

**允许的写操作**：状态流转（transition）、字段修改（PUT issue）、新增评论 / 工时 / 附件、Watcher 增减、组件 / 版本启停等"非删除"变更。

### 规则 2：写操作先确认

任何改变服务端状态的命令（transition、字段修改、新增评论 / 工时 / 附件、`raw POST/PUT` 等）：

1. 先用 `issue get` / `search` / `raw` 拉出当前状态、可用 transition、必填字段
2. 跟用户确认要改成什么值
3. 再执行

### 规则 3：统一走脚本

- 允许在 Node 脚本里 `import { createLegacyJiraAuth } from '.../jira.js'`
- 不要再写第二份认证层
- 不要绕开脚本直接 `curl`（除非 `raw` 子命令也表达不了）

### 规则 4：认证模型

- 凭据从 skill 目录的 `.env` 读取，`auth-test` 子命令自动生成
- `JIRA_HOST` / `JIRA_USERNAME` / `JIRA_PASSWORD`
- 老版本 Jira Server，不要假设支持 API Token

---

## `.env`

- 在 skill 目录下，跨 cwd 仍能找到（脚本按自身路径定位）
- 只读写 `JIRA_*` 前缀的 key，不破坏其他 skill 的配置
- 命令行参数（`--host` / `--username` / `--password`）覆盖 `.env` 并自动回写
- 已在仓库 `.gitignore` 中

---

## 注意事项

- 目标环境是老版本 Jira Server（已在 6.3.6 验证），不要假设支持 API Token
- `jira.js` SDK 需要装在当前工作目录；全局安装通常不能直接被模块导入。缺失时脚本会自动 `npm install jira.js`
- 某些 `jira.js` 的新接口在 Jira 6.3.6 上可能不存在，遇到 404 优先怀疑版本差异
- 在 Git Bash 下，`raw --path` 不要以 `/` 开头
