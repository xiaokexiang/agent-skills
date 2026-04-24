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

每次通过命令行传参数：

```bash
node scripts/jira.js auth-test --host http://your-jira-host:port --username your-username --password your-password
```

如果当前目录缺少 `jira.js`，脚本会提示并自动安装。

## 3. 常用命令

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
