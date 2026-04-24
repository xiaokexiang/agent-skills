# Jira Usage

本文档说明 `scripts/jira.js` 的使用方式。

## 1. 运行入口

```bash
npm run jira -- <command> [options]
```

先看帮助：

```bash
npm run jira -- --help
```

## 2. 认证配置

每次通过命令行传参数：

```bash
npm run jira -- auth-test --host http://your-jira-host:port --username your-username --password your-password
```

如果当前目录缺少 `jira.js`，脚本会提示并自动安装。

## 3. 常用命令

### 验证认证

```bash
npm run jira -- auth-test --host http://your-jira-host:port --username your-username --password your-password
```

### 当前用户

```bash
npm run jira -- myself --host http://your-jira-host:port --username your-username --password your-password
npm run jira -- myself --expand groups --host http://your-jira-host:port --username your-username --password your-password
```

### Issue 详情

```bash
npm run jira -- issue get --key BOCLAWEE-291 --host http://your-jira-host:port --username your-username --password your-password
npm run jira -- issue get --key BOCLAWEE-291 --expand renderedFields --host http://your-jira-host:port --username your-username --password your-password
npm run jira -- issue get --key BOCLAWEE-291 --fields summary,status,assignee,attachment --host http://your-jira-host:port --username your-username --password your-password
```

### JQL 搜索

```bash
npm run jira -- search --jql "project = BOCLAWEE" --host http://your-jira-host:port --username your-username --password your-password
npm run jira -- search --jql "project = BOCLAWEE AND issuetype = Bug" --host http://your-jira-host:port --username your-username --password your-password
npm run jira -- search --jql "project = BOCLAWEE" --fields summary,status --max-results 20 --host http://your-jira-host:port --username your-username --password your-password
```

### 直接查 Bug

```bash
npm run jira -- bug count --project BOCLAWEE --host http://your-jira-host:port --username your-username --password your-password
npm run jira -- bug list --project BOCLAWEE --host http://your-jira-host:port --username your-username --password your-password
```

### 项目查询

```bash
npm run jira -- project list --host http://your-jira-host:port --username your-username --password your-password
npm run jira -- project get --key BOCLAWEE --host http://your-jira-host:port --username your-username --password your-password
```

### 原始 REST 调用

```bash
npm run jira -- raw --path /rest/api/2/serverInfo --host http://your-jira-host:port --username your-username --password your-password
npm run jira -- raw --method GET --path /rest/api/2/issue/BOCLAWEE-291 --host http://your-jira-host:port --username your-username --password your-password
npm run jira -- raw --method POST --path /rest/api/2/search --data '{"jql":"project = BOCLAWEE"}' --host http://your-jira-host:port --username your-username --password your-password
```

可选参数：

- `--query <json>`
- `--data <json>`
- `--headers <json>`

## 4. 在 Node 中复用认证层

`scripts/jira.js` 同时也是可导入模块。

```js
import { createLegacyJiraAuth } from './skills/jira/scripts/jira.js';

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

## 5. 适用场景

- 查询当前用户
- 获取项目列表和项目详情
- 获取 Issue 详情
- 执行 JQL 搜索
- 在其他 Node 脚本里复用老 Jira 的认证层
