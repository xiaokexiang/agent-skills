# Jira Usage

本文档说明 `scripts/jira.js` 的使用方式。

## 1. 入口

```bash
node scripts/jira.js <command> [options]
```

先看帮助：

```bash
node scripts/jira.js --help
```

## 2. 认证

### 首次配置

首次使用时，通过命令行传入认证信息，成功后自动生成 `.env`：

```bash
node scripts/jira.js auth-test --host http://your-jira-host:port --username your-username --password your-password
```

认证成功后，会自动将凭据写入 **skill 目录**下的 `.env` 文件，包含：

```env
JIRA_HOST=http://your-jira-host:port
JIRA_USERNAME=your-username
JIRA_PASSWORD=your-password
```

### 日常使用

已有 `.env` 后，无需再传认证参数：

```bash
node scripts/jira.js project list
node scripts/jira.js issue get --key BOCLAWEE-291
```

### 切换实例

如需更换 Jira 实例，重新执行 `auth-test`：

```bash
node scripts/jira.js auth-test --host http://new-host:port --username new-user --password new-pass
```

`.env` 中的值会自动更新。

## 3. 常用命令

```bash
# 认证并保存凭据
node scripts/jira.js auth-test --host http://your-jira-host:port --username your-username --password your-password

# 查询用户信息
node scripts/jira.js myself

# 项目管理
node scripts/jira.js project list
node scripts/jira.js project get --key BOCLAWEE

# Issue 查询
node scripts/jira.js issue get --key BOCLAWEE-291 --expand renderedFields

# JQL 搜索
node scripts/jira.js search --jql "project = BOCLAWEE AND issuetype = Bug"

# Bug 统计
node scripts/jira.js bug count --project BOCLAWEE
node scripts/jira.js bug list --project BOCLAWEE --max-results 20

# 原始 REST 调用
node scripts/jira.js raw --path rest/api/2/serverInfo
```

常用可选参数：

- `--query <json>`
- `--data <json>`
- `--headers <json>`
- `--fields <csv>`
- `--expand <value>`
- `--max-results <n>`

说明：

- 在 Git Bash 下，`raw` 的 `--path` 建议写成 `rest/api/...`
- `--path` 可参考 Jira 6.3.6 REST 文档：`https://docs.atlassian.com/software/jira/docs/api/REST/6.3.6/`

## 4. 在 Node 中复用认证层

`scripts/jira.js` 同时也是可导入模块。

```js
import { createLegacyJiraAuth } from './skills/jira/scripts/jira.js';

// 自动从 .env 读取
const auth = await createLegacyJiraAuth();

// 或显式传参
const auth = await createLegacyJiraAuth({
  host: 'http://your-jira-host:port',
  username: 'your-username',
  password: 'your-password',
});

const me = await auth.v2.myself.getCurrentUser();
const projectList = await auth.raw.get('/rest/api/2/project');
```

返回对象：

- `session`
- `raw`
- `v2`
- `v3`
- `agile`
- `serviceDesk`
