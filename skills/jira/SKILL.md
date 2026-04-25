---
name: jira
description: 查询或读取 Jira Server 数据（项目、Issue、JQL 搜索结果等）。
---

## 角色定义

**你是一个通过本地 `jira.js` 脚本访问 Jira Server 的工程师。**

- 必须优先使用 [`scripts/jira.js`](./scripts/jira.js)
- 默认在 `bash` 环境中执行 `node scripts/jira.js <command>`
- **执行前必须先 `cd` 到 skill 目录**（即 SKILL.md 所在目录），确保 `scripts/jira.js` 路径正确
- 如果当前环境没有 `jira.js` 依赖，脚本会提示并自动在当前工作目录安装；不要假设全局安装可直接被模块导入

---

## 核心规则（必须遵守）

### 规则 0：先看脚本帮助

**执行不熟悉的命令前，先运行：**

```bash
node scripts/jira.js --help
```

原因：

- 脚本参数才是当前版本的准确信息
- Skill 负责指导流程，不替代脚本本身

### 规则 1：统一走 `jira.js` 脚本

- ✅ 允许：在 Node 脚本里 `import { createLegacyJiraAuth } from './skills/jira/scripts/jira.js'`
- ❌ 不要再单独维护另一份认证层脚本
- ❌ 不要优先用 `curl` 直接访问 Jira REST API

### 规则 2：认证方式

**默认从 `.env` 文件读取**（首次使用需要先执行 `auth-test` 生成）：

- `JIRA_HOST` - Jira 地址
- `JIRA_USERNAME` - 用户名
- `JIRA_PASSWORD` - 密码

**首次配置：**

```bash
node scripts/jira.js auth-test --host http://your-jira-host:port --username your-username --password your-password
```

认证成功后会自动将凭据写入 `.env`，后续命令无需再传认证参数。

**命令行参数覆盖**：如果通过 `--host`/`--username`/`--password` 传参，会覆盖 `.env` 中的值，成功后自动更新 `.env`。

---

## 常用命令

首次配置（自动生成 `.env`）：

```bash
node scripts/jira.js auth-test --host http://your-jira-host:port --username your-username --password your-password
```

后续使用（自动从 `.env` 读取，无需重复传入认证参数）：

```bash
node scripts/jira.js myself
node scripts/jira.js project list
node scripts/jira.js project get --key BOCLAWEE
node scripts/jira.js issue get --key BOCLAWEE-291 --expand renderedFields
node scripts/jira.js search --jql "project = BOCLAWEE AND issuetype = Bug"
node scripts/jira.js bug count --project BOCLAWEE
node scripts/jira.js bug list --project BOCLAWEE --max-results 20
node scripts/jira.js raw --path rest/api/2/serverInfo
```

如需切换 Jira 实例，重新执行 `auth-test` 即可：

```bash
node scripts/jira.js auth-test --host http://another-jira-host:port --username user --password pass
```

---

## Node 集成方式

在其他 Node 脚本里直接复用：

```js
import { createLegacyJiraAuth } from './skills/jira/scripts/jira.js';

// 方式 1：直接调用，会自动从 .env 读取
const auth = await createLegacyJiraAuth();

// 方式 2：显式传参，覆盖 .env
const auth = await createLegacyJiraAuth({
  host: 'http://your-jira-host:port',
  username: 'your-username',
  password: 'your-password',
});

const me = await auth.v2.myself.getCurrentUser();
```

返回对象包含：

- `session`
- `raw`
- `v2`
- `v3`
- `agile`
- `serviceDesk`

---

## `.env` 说明

- `.env` 存储在 **skill 目录**下（即 SKILL.md 同级目录），与脚本一起
- 安全读写：只操作 `JIRA_*` 开头的 key，不破坏其他 skill 写入的配置
- 命令行参数优先：`--host`/`--username`/`--password` 会覆盖 `.env` 中的值，成功后自动同步
- 无论从哪里执行 `node scripts/jira.js`，.env 始终能找到（基于脚本自身路径定位）
- `.env` 已在仓库 `.gitignore` 中，凭据不会误提交

---

## 注意事项

- 目标环境是老版本 Jira Server，不要假设支持 API Token
- 脚本内部会先换取 session cookie，再注入 `jira.js`
- `jira.js` 需要安装在当前工作目录；全局安装通常不能直接满足模块导入
- 缺少 `jira.js` 时，脚本会自动执行 `npm install jira.js`
- 在 Git Bash 下，`raw` 的 `--path` 不要以 `/` 开头
- 某些 `jira.js` 的新接口在 Jira 6.3.6 上可能不存在，遇到 404 优先怀疑版本差异
