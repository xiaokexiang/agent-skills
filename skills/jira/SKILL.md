---
name: jira
description: 查询或读取 Jira Server 数据（项目、Issue、JQL 搜索结果等）。
---

## 角色定义

**你是一个通过本地 `jira.js` 脚本访问 Jira Server 的工程师。**

- 必须优先使用 [`scripts/jira.js`](./scripts/jira.js)
- 默认在 `bash` 环境中执行 `npm run jira -- <command>`
- 禁止为同一认证逻辑再写一套新的登录脚本
- 文档只给出常用模式，具体能力以脚本实际支持为准
- 如果当前环境没有 `jira.js` 依赖，脚本会提示并自动在当前工作目录安装；不要假设全局安装可直接被模块导入

---

## 核心规则（必须遵守）

### 规则 0：先看脚本帮助

**执行不熟悉的命令前，先运行：**

```bash
npm run jira -- --help
```

原因：

- 脚本参数才是当前版本的准确信息
- Skill 负责指导流程，不替代脚本本身

### 规则 1：统一走 `jira.js` 脚本

- ✅ 允许：`npm run jira -- project list`、`npm run jira -- issue get --key ABC-123`
- ✅ 允许：在 Node 脚本里 `import { createLegacyJiraAuth } from './skills/jira/scripts/jira.js'`
- ❌ 不要再单独维护另一份认证层脚本
- ❌ 不要优先用 `curl` 直接访问 Jira REST API

### 规则 2：认证方式

**使用命令行参数传入：**

- `--host <host>` - Jira 地址
- `--username <username>` - 用户名
- `--password <password>` - 密码

**配置方式：** 只使用命令行参数

### 规则 3：优先查询，谨慎写原始接口

优先使用现成命令：

- `auth-test`
- `myself`
- `issue get`
- `search`
- `project list`
- `project get`

只有现成命令不够时，才使用：

- `raw`

---

## 命令参考

### 认证与用户

| 操作 | 命令 |
|------|------|
| 验证认证 | `npm run jira -- auth-test` |
| 查看当前用户 | `npm run jira -- myself` |
| 查看当前用户并展开字段 | `npm run jira -- myself --expand groups` |

### Issue

| 操作 | 命令 |
|------|------|
| 获取 Issue 详情 | `npm run jira -- issue get --key <issueKey>` |
| 获取指定字段 | `npm run jira -- issue get --key <issueKey> --fields summary,status,assignee` |
| 展开附加字段 | `npm run jira -- issue get --key <issueKey> --expand renderedFields` |

### 搜索

| 操作 | 命令 |
|------|------|
| 执行 JQL 搜索 | `npm run jira -- search --jql "<jql>"` |
| 限制返回数量 | `npm run jira -- search --jql "<jql>" --max-results 20` |
| 只取指定字段 | `npm run jira -- search --jql "<jql>" --fields summary,status` |

### Bug

| 操作 | 命令 |
|------|------|
| 统计项目下 Bug 数量 | `npm run jira -- bug count --project <projectKey>` |
| 列出项目下 Bug | `npm run jira -- bug list --project <projectKey>` |

### 项目

| 操作 | 命令 |
|------|------|
| 列出项目 | `npm run jira -- project list` |
| 获取项目详情 | `npm run jira -- project get --key <projectKey>` |

### 原始接口

| 操作 | 命令 |
|------|------|
| GET 任意路径 | `npm run jira -- raw --path /rest/api/2/serverInfo` |
| 带方法调用 | `npm run jira -- raw --method POST --path /rest/api/2/search --data '{"jql":"project = ABC"}'` |

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

## 执行流程

```text
1. 接收用户需求
   -> 2. 确认是否已有 JIRA_HOST / JIRA_USERNAME / JIRA_PASSWORD
   -> 3. 如不熟悉命令，先看 npm run jira -- --help
   -> 4. 优先选现成命令：myself / issue get / search / project list / project get
   -> 5. 如现成命令不够，再使用 raw
   -> 6. 返回 JSON 结果或基于结果总结
```

---

## 注意事项

- 目标环境是老版本 Jira Server，不要假设支持 API Token
- 脚本内部会先换取 session cookie，再注入 `jira.js`
- `jira.js` 需要安装在当前工作目录；全局安装通常不能直接满足模块导入
- 缺少 `jira.js` 时，脚本会自动执行 `npm install jira.js`
- 某些 `jira.js` 的新接口在 Jira 6.3.6 上可能不存在，遇到 404 优先怀疑版本差异
