---
name: gitlab
description: 查询 GitLab 数据（项目、提交、MR、流水线等）。查询操作直接执行，修改操作需二次确认。
---

## GitLab 数据访问技能

本技能用于通过 GitLab API 查询和访问 GitLab 仓库数据。

### 环境要求

执行任何操作前，需要 GitLab 认证信息。可以通过以下任一方式提供：

**方式 1：环境变量**（推荐）
```bash
GITLAB_HOST=https://gitlab.com          # 或自托管 GitLab 实例地址
GITLAB_TOKEN=your-personal-access-token # GitLab 个人访问令牌
```

**方式 2：命令行参数**
- `--gb-token <token>` - GitLab 个人访问令牌
- `--gb-host <host>` - GitLab 实例地址
- `--gb-oauth-token <token>` - OAuth 令牌
- `--gb-job-token <token>` - CI/CD Job 令牌

**检查方法：**
- 优先检查命令行参数是否提供
- 如果未提供，检查环境变量 `GITLAB_HOST` 和 `GITLAB_TOKEN`
- 如果都未设置，提示用户先配置认证信息

### 命令匹配与执行流程

1. **解析用户请求** — 确定用户想要查询的数据类型（项目、提交、合并请求、流水线等）
2. **检查环境变量** — 验证 `GITLAB_HOST` 和 `GITLAB_TOKEN` 是否已设置
3. **匹配命令** — 选择最合适的 `gitbeaker` CLI 命令
4. **权限判断** — 判断是查询操作还是修改操作
5. **执行**：
   - **查询操作**：直接执行
   - **修改/删除/新增操作**：必须先向用户展示将要执行的完整命令，等待用户明确确认（回复"是"、"确认"、"yes"等）后才能执行

### 操作分类

#### 查询操作（可直接执行）

| 数据类型 | 命令示例 |
|---------|---------|
| 列出所有项目 | `gb projects all --gb-token=<token> --gb-host=<host>` |
| 获取项目详情 | `gb projects show --project-id=<project>` |
| 列出项目提交 | `gb commits all --project-id=<project> --ref-name=<branch>` |
| 获取提交详情 | `gb commits show --project-id=<project> <sha>` |
| 列出合并请求 | `gb merge-requests all --project-id=<project>` |
| 获取合并请求详情 | `gb merge-requests show --project-id=<project> <iid>` |
| 列出流水线 | `gb pipelines all --project-id=<project>` |
| 获取流水线详情 | `gb pipelines show --project-id=<project> <pipeline-id>` |
| 列出项目成员 | `gb project-members all --project-id=<project>` |
| 获取作业日志 | `gb jobs show-log --project-id=<project> --job-id=<job-id>` |
| 列出 Issues | `gb issues all --project-id=<project>` |
| 获取 Issue 详情 | `gb issues show --project-id=<project> <iid>` |
| 列出分支 | `gb branches all --project-id=<project>` |
| 列出标签 | `gb tags all --project-id=<project>` |
| 获取仓库树 | `gb repositories tree --project-id=<project>` |
| 获取文件内容 | `gb repository-files show --project-id=<project> --file-path=<path> --ref=<branch>` |

**注意：**
- 项目名称直接使用，如 `PaaS_BOC/boc-document`，**不要**对 `/` 进行 URL 转义
- `--project-id` 参数可以是数字 ID 或项目路径（格式：`group/project`）

#### 修改操作（需二次确认）

| 操作类型 | 命令示例 |
|---------|---------|
| 创建项目 | `gb projects create --name=<name> --path=<path>` |
| 删除项目 | `gb projects remove --project-id=<id>` |
| 创建合并请求 | `gb merge-requests create --project-id=<id> --source-branch=<src> --target-branch=<tgt> --title=<title>` |
| 合并 MR | `gb merge-requests accept --project-id=<id> <iid>` |
| 关闭 MR | `gb merge-requests edit --project-id=<id> <iid> --state-event=closed` |
| 创建 Issue | `gb issues create --project-id=<id> --title=<title> --description=<desc>` |
| 关闭 Issue | `gb issues edit --project-id=<id> <iid> --state-event=close` |
| 触发流水线 | `gb pipelines create --project-id=<id> --ref=<branch>` |
| 取消流水线 | `gb pipelines cancel --project-id=<id> <pipeline-id>` |
| 创建分支 | `gb branches create --project-id=<id> --branch=<name> --ref=<source>` |
| 删除分支 | `gb branches remove --project-id=<id> <branch>` |
| 创建文件 | `gb repository-files create --project-id=<id> --file-path=<path> --content=<content> --branch=<branch> --commit-message=<msg>` |
| 更新文件 | `gb repository-files edit --project-id=<id> --file-path=<path> --content=<content> --branch=<branch> --commit-message=<msg>` |
| 删除文件 | `gb repository-files remove --project-id=<id> --file-path=<path> --branch=<branch> --commit-message=<msg>` |

### 二次确认流程

当用户请求涉及修改、删除或新增操作时：

1. **向用户展示将要执行的命令**：
   ```
   ⚠️ 此操作将修改 GitLab 数据

   将要执行的命令：
   gitbeaker <command> <args>

   是否确认执行？(是/否)
   ```

2. **等待用户明确确认** — 用户必须回复"是"、"确认"、"yes"、"confirm"等肯定词

3. **执行命令** — 收到确认后再执行

4. **取消操作** — 用户回复"否"、"取消"、"no"、"cancel"等则不执行

### 命令输出处理

- 默认输出：直接展示 `gitbeaker` 命令的原始输出
- 格式化输出：对于结构化数据（如 JSON），可以适当格式化以便阅读
- 错误处理：如果命令执行失败，向用户展示错误信息并提供可能的解决建议

### 常用查询示例

**查询所有项目：**
```bash
gb projects all --gb-token=<token> --gb-host=<host>
```

**查询特定项目的提交历史（特定分支）：**
```bash
gb commits all --project-id=<group/project> --ref-name=<branch-name> --gb-token=<token> --gb-host=<host>
```
示例：`gb commits all --project-id="PaaS_BOC/boc-document" --ref-name="BOC3.10-TY" --gb-host="http://223.112.233.194:8888" --gb-token="xxx"`

**查询特定项目的打开的合并请求：**
```bash
gb merge-requests all --project-id=<group/project> --state=opened
```

**查询特定流水线详情：**
```bash
gb pipelines show --project-id=<project> <pipeline-id>
```

**查询文件内容：**
```bash
gb repository-files show --project-id=<project> --file-path=<file-path> --ref=<branch>
```

### 注意事项

1. **项目名称**：直接使用原始格式，如 `PaaS_BOC/boc-document`，其中的 `/` 不需要 URL 转义
2. **项目 ID 格式**：`--project-id` 参数支持数字 ID（如 `1997`）或项目路径（如 `PaaS_BOC/boc-document`）
3. **短别名**：可以使用 `gb` 代替 `gitbeaker`
4. **认证优先级**：命令行参数（`--gb-token`、`--gb-host`）优先于环境变量

## 参考文档

详细命令用法、参数说明和示例请参考 `references/usage.md`。
