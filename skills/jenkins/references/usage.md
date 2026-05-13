# Jenkins Usage

本文档说明 `scripts/jenkins.js` 的详细用法，覆盖认证、Job 查询、构建触发、Console 跟踪、队列与节点查看，以及 Node 集成方式。

## 1. 入口

```bash
node scripts/jenkins.js <command> [subcommand] [options]
```

先看帮助：

```bash
node scripts/jenkins.js --help
```

## 2. 认证

### 推荐：API Token

Jenkins 个人页面 → Configure → API Token → Add new Token，生成后：

```bash
node scripts/jenkins.js auth-test \
  --host http://jenkins:8080 \
  --username your-user \
  --token 11abcdef0123456789...
```

### 回退：用户名 + 密码

```bash
node scripts/jenkins.js auth-test \
  --host http://jenkins:8080 \
  --username your-user \
  --password your-pass
```

### `.env` 优先级

```
命令行 --token  >  命令行 --password  >  JENKINS_TOKEN  >  JENKINS_PASSWORD
```

`.env` 同时存在 `JENKINS_TOKEN` 和 `JENKINS_PASSWORD` 时，Token 优先。要切换到密码模式，删掉 `.env` 里的 `JENKINS_TOKEN=` 那一行，或重新 `auth-test --password ...`。

### 切换实例

```bash
node scripts/jenkins.js auth-test --host http://other-jenkins:8080 --username u --token t
```

`.env` 自动更新。

## 3. Job 与 Build

### 列出所有 Job

```bash
node scripts/jenkins.js job list
```

默认 tree 表达式 `jobs[name,fullName,url,color,buildable]`。自定义：

```bash
node scripts/jenkins.js job list --tree "jobs[name,color,lastBuild[number,result]]"
```

### 获取 Job 详情

```bash
node scripts/jenkins.js job get --name my-job
node scripts/jenkins.js job get --name team-a/backend-deploy   # folder
node scripts/jenkins.js job get --name my-job --depth 1        # 包含 lastBuild 等子对象
```

Color → Status 映射（脚本已自动转换）：

| color | status |
|---|---|
| blue | SUCCESS |
| red | FAILURE |
| yellow | UNSTABLE |
| aborted | ABORTED |
| notbuilt | NOT_BUILT |
| disabled | DISABLED |
| `*_anime` | `<状态>/BUILDING` |

### 获取构建详情

```bash
node scripts/jenkins.js build last --name my-job
node scripts/jenkins.js build get  --name my-job --number 42
```

输出包含：`number / result / building / duration / timestamp / builtOn / cause / parameters / url`。

### 触发构建

无参数：

```bash
node scripts/jenkins.js build trigger --name my-job
```

参数化（JSON 字符串）：

```bash
node scripts/jenkins.js build trigger --name my-job --params '{"BRANCH":"main","RUN_TESTS":"true"}'
```

返回 `queueItem` ID，可继续查询：

```bash
node scripts/jenkins.js raw --path queue/item/<id>/api/json
```

## 4. Console 控制台输出

### 一次性拉取

```bash
node scripts/jenkins.js console --name my-job --number 42
node scripts/jenkins.js console --name my-job                # 默认 lastBuild
```

直接输出纯文本到 stdout，重定向到文件或 `grep` 都可以：

```bash
node scripts/jenkins.js console --name my-job --number 42 > build-42.log
node scripts/jenkins.js console --name my-job --number 42 | grep -i error
```

### `tail -f` 模式

```bash
node scripts/jenkins.js console --name my-job --follow              # tail lastBuild
node scripts/jenkins.js console --name my-job --number 42 --follow  # tail 指定构建
```

可选参数：

- `--interval <ms>` 轮询间隔（默认 1000，最小 100）
- `--start <bytes>` 起始偏移（断点续传）

实现细节：

- 端点 `GET /job/<name>/<n>/logText/progressiveText?start=<offset>`
- 响应头 `X-Text-Size` 推进偏移、`X-More-Data: true` 表示构建仍在进行
- 构建结束时一次性输出剩余日志后退出
- Ctrl+C 优雅退出

实战示例 — 触发构建后立刻跟踪日志：

```bash
node scripts/jenkins.js build trigger --name my-job --params '{"BRANCH":"main"}'
# 等几秒确保构建已从 queue 进入 building 状态
sleep 5
node scripts/jenkins.js console --name my-job --follow
```

## 5. 队列与节点

```bash
node scripts/jenkins.js queue list   # 当前构建队列（等待执行的项目）
node scripts/jenkins.js node list    # 所有 agent / 节点状态
```

## 6. 原始 REST 调用

任何 `scripts/jenkins.js` 还没封装的端点，都可通过 `raw` 调用：

```bash
# GET
node scripts/jenkins.js raw --path api/json
node scripts/jenkins.js raw --path computer/master/api/json
node scripts/jenkins.js raw --path queue/item/123/api/json

# 带 query
node scripts/jenkins.js raw --path api/json --query '{"tree":"jobs[name,color]"}'

# POST（自动注入 crumb）
node scripts/jenkins.js raw --path job/my-job/disable --method POST
node scripts/jenkins.js raw --path job/my-job/enable  --method POST

# 自定义 headers / body
node scripts/jenkins.js raw \
  --path createItem \
  --method POST \
  --query '{"name":"new-job"}' \
  --data '{"some":"config-json"}' \
  --headers '{"Content-Type":"application/xml"}'
```

说明：

- `--path` 不需要以 `/` 开头，脚本会补
- `--query` 是 query string 的 JSON，会编码进 URL
- `--data` 是请求 body 的 JSON，会序列化
- 想发送 form-urlencoded，用 `--data` 传字符串前需额外加 `--headers '{"Content-Type":"application/x-www-form-urlencoded"}'`，或考虑直接走 `build trigger`

## 7. 在 Node 中复用

```js
import {
  createJenkinsAuth,
  jobPath,
  printTable,
} from './skills/jenkins/scripts/jenkins.js';

// 自动从 .env 读取
const { client, credentials } = await createJenkinsAuth();

// 显式覆盖
const explicit = await createJenkinsAuth({
  host: 'http://jenkins:8080',
  username: 'u',
  token: 't',
});

const me = await client.get('/whoAmI/api/json');
printTable(me.data);

const jobInfo = await client.get(`${jobPath('team-a/backend-deploy')}/api/json`);

// 触发参数化构建
const form = new URLSearchParams({ BRANCH: 'main' });
const trig = await client.post(`${jobPath('my-job')}/buildWithParameters`, {
  body: form,
  raw: true,                 // 拿原始 Response 对象
});
console.log('queue:', trig.headers.get('location'));
```

`client` 方法：

| 方法 | 用途 |
|---|---|
| `client.get(url, opts)` | GET 请求，返回 `{ status, statusText, headers, data }` |
| `client.post(url, opts)` | POST 请求 |
| `client.request(opts)` | 通用请求；`opts.url` `opts.method` `opts.params` `opts.body` `opts.headers` `opts.raw` `opts.timeout` `opts.noTimeout` |
| `client.getCrumb()` | 获取 CSRF crumb（已缓存），返回 `{ field, value }` |

## 8. 排错

| 现象 | 可能原因 | 处理 |
|---|---|---|
| `Missing Jenkins credentials` | `.env` 没有 / 用户名空 | 跑 `auth-test` 或检查 `.env` |
| HTTP 401 | Token/密码错 | 重新 `auth-test`；确认 Token 在 Jenkins 用户页面有效 |
| HTTP 403 with "No valid crumb" | 反代或网关吞掉 `Jenkins-Crumb` 头 | 检查反代是否透传 Header；脚本已自动获取 crumb |
| HTTP 404 on `/crumbIssuer` | CSRF 已关闭 | 不影响，脚本会自动降级 |
| HTTP 404 on job 路径 | Job 名拼错 / Folder 路径缺斜杠 | 用 `job list` 看 `fullName` |
| Build trigger 返回 201 但没 queueItem | 构建被合并到已有队列项 | 查 `queue list` 找现有项 |
| Console follow 卡住不动 | 构建在 queue 还没开始 building | 等几秒；或 `build last` 查 `building` 状态 |
| 中文乱码 | 终端编码 | Windows: `chcp 65001`；或 `--accept text/plain; charset=utf-8` |
