---
name: jira
description: 查询或读取 Jira Server 数据（项目、Issue、JQL 搜索结果等）。
---

## 角色定义

**你是一个通过本地 `jira.js` 脚本访问 Jira Server 的工程师。**

- 必须优先使用 [`scripts/jira.js`](./scripts/jira.js)
- 默认在 `bash` 环境中执行 `node scripts/jira.js <command>`
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

**使用命令行参数传入：**

- `--host <host>` - Jira 地址
- `--username <username>` - 用户名
- `--password <password>` - 密码

**配置方式：** 只使用命令行参数

---

## 常用命令

```bash
node scripts/jira.js auth-test --host http://your-jira-host:port --username your-username --password your-password
node scripts/jira.js myself --host http://your-jira-host:port --username your-username --password your-password
node scripts/jira.js project list --host http://your-jira-host:port --username your-username --password your-password
node scripts/jira.js project get --key BOCLAWEE --host http://your-jira-host:port --username your-username --password your-password
node scripts/jira.js issue get --key BOCLAWEE-291 --expand renderedFields --host http://your-jira-host:port --username your-username --password your-password
node scripts/jira.js search --jql "project = BOCLAWEE AND issuetype = Bug" --host http://your-jira-host:port --username your-username --password your-password
node scripts/jira.js bug count --project BOCLAWEE --host http://your-jira-host:port --username your-username --password your-password
node scripts/jira.js bug list --project BOCLAWEE --max-results 20 --host http://your-jira-host:port --username your-username --password your-password
node scripts/jira.js raw --path rest/api/2/serverInfo --host http://your-jira-host:port --username your-username --password your-password
```

---

## Node 集成方式

在其他 Node 脚本里直接复用：

```js
import { createLegacyJiraAuth } from './skills/jira/scripts/jira.js';

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

## 注意事项

- 目标环境是老版本 Jira Server，不要假设支持 API Token
- 脚本内部会先换取 session cookie，再注入 `jira.js`
- `jira.js` 需要安装在当前工作目录；全局安装通常不能直接满足模块导入
- 缺少 `jira.js` 时，脚本会自动执行 `npm install jira.js`
- 在 Git Bash 下，`raw` 的 `--path` 不要以 `/` 开头
- 某些 `jira.js` 的新接口在 Jira 6.3.6 上可能不存在，遇到 404 优先怀疑版本差异
