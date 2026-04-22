---
name: gitlab
description: 查询或编辑 GitLab 数据（项目、提交、MR、流水线、群组等）。
---

## 角色定义

**你是一个只能使用 gitbeaker CLI 执行命令的工程师。**

- 如果没有安装 gitbeaker，必须先执行 `npm install -g @gitbeaker/cli` 进行安装
- **禁止使用 curl 直接调用 GitLab API**
- **一切信息以 `gitbeaker <command> --help` 的输出为准**，文档仅供参考

---

## 核心规则（必须遵守）

### 规则 0：先查看 --help（最高优先级）

**在执行任何操作前，必须先运行 `gitbeaker <command> --help` 确认实际参数格式！**

**为什么：**
- 文档中的参数格式可能与实际 CLI 不符
- CLI 版本更新可能导致参数变化
- **只有 `--help` 的输出才是权威的**

**正确流程：**
```bash
# 1. 第一次使用某命令前，必须先执行：
gitbeaker <command> --help

# 2. 确认参数后再执行：
gitbeaker <command> <正确的参数格式>
```

### 规则 1：禁止使用 curl

- ✅ 允许：`gitbeaker projects all`、`gitbeaker commits show --project-id=xxx`
- ❌ 禁止：使用 `curl` 直接调用 GitLab API

### 规则 2：认证方式

**方式 1：环境变量（推荐）**
```bash
export GITLAB_HOST=https://gitlab.com
export GITLAB_TOKEN=your-personal-access-token
```

**方式 2：命令行参数**
- `--gb-token <token>` - GitLab 个人访问令牌
- `--gb-host <host>` - GitLab 实例地址
- `--gb-oauth-token <token>` - OAuth 令牌
- `--gb-job-token <token>` - CI/CD Job 令牌

**认证优先级：** 命令行参数 > 环境变量

---

## 命令参考（以 --help 为准）

### 项目操作 (Projects)

| 操作 | 命令 |
|------|------|
| 列出所有项目 | `gitbeaker projects all` |
| 获取项目详情 | `gitbeaker projects show --project-id=<project>` |
| 创建项目 | `gitbeaker projects create --name=<name> --path=<path>` |
| 删除项目 | `gitbeaker projects remove --project-id=<id>` |

**示例：**
```bash
gitbeaker projects all --gb-token=<token> --gb-host=<host>
gitbeaker projects show --project-id="group/project"
gitbeaker projects create --name="my-project" --path="my-project"
gitbeaker projects remove --project-id=1234
```

---

### 提交历史 (Commits)

| 操作 | 命令 |
|------|------|
| 列出项目提交 | `gitbeaker commits all --project-id=<project> --ref-name=<branch>` |
| 获取提交详情 | `gitbeaker commits show --project-id=<project> <sha>` |

**示例：**
```bash
gitbeaker commits all --project-id="group/project" --ref-name="main"
gitbeaker commits show --project-id="group/project" abc123def456
```

---

### 合并请求 (Merge Requests)

| 操作 | 命令 |
|------|------|
| 列出合并请求 | `gitbeaker merge-requests all --project-id=<project>` |
| 获取 MR 详情 | `gitbeaker merge-requests show --project-id=<project> <iid>` |
| 创建 MR | `gitbeaker merge-requests create --project-id=<id> --source-branch=<src> --target-branch=<tgt> --title=<title>` |
| 合并 MR | `gitbeaker merge-requests accept --project-id=<id> <iid>` |
| 关闭 MR | `gitbeaker merge-requests edit --project-id=<id> <iid> --state-event=closed` |

**示例：**
```bash
gitbeaker merge-requests all --project-id="group/project" --state=opened
gitbeaker merge-requests show --project-id="group/project" 42
gitbeaker merge-requests create --project-id="group/project" --source-branch=feature --target-branch=main --title="Add feature"
gitbeaker merge-requests accept --project-id="group/project" 42
```

---

### 流水线 (Pipelines)

| 操作 | 命令 |
|------|------|
| 列出流水线 | `gitbeaker pipelines all --project-id=<project>` |
| 获取流水线详情 | `gitbeaker pipelines show --project-id=<project> <pipeline-id>` |
| 触发流水线 | `gitbeaker pipelines create --project-id=<id> --ref=<branch>` |
| 取消流水线 | `gitbeaker pipelines cancel --project-id=<id> <pipeline-id>` |

**示例：**
```bash
gitbeaker pipelines all --project-id="group/project"
gitbeaker pipelines show --project-id="group/project" 12345
gitbeaker pipelines create --project-id="group/project" --ref=main
gitbeaker pipelines cancel --project-id="group/project" 12345
```

---

### Issues

| 操作 | 命令 |
|------|------|
| 列出 Issues | `gitbeaker issues all --project-id=<project>` |
| 获取 Issue 详情 | `gitbeaker issues show --project-id=<project> <iid>` |
| 创建 Issue | `gitbeaker issues create --project-id=<id> --title=<title> --description=<desc>` |
| 关闭 Issue | `gitbeaker issues edit --project-id=<id> <iid> --state-event=close` |

**示例：**
```bash
gitbeaker issues all --project-id="group/project"
gitbeaker issues show --project-id="group/project" 100
gitbeaker issues create --project-id="group/project" --title="Bug fix" --description="Steps to reproduce..."
```

---

### 分支操作 (Branches)

| 操作 | 命令 |
|------|------|
| 列出分支 | `gitbeaker branches all --project-id=<project>` |
| 创建分支 | `gitbeaker branches create --project-id=<id> --branch=<name> --ref=<source>` |
| 删除分支 | `gitbeaker branches remove --project-id=<id> <branch>` |

**示例：**
```bash
gitbeaker branches all --project-id="group/project"
gitbeaker branches create --project-id="group/project" --branch=feature/new --ref=main
gitbeaker branches remove --project-id="group/project" feature/old
```

---

### 文件操作 (Repository Files)

| 操作 | 命令 |
|------|------|
| 获取文件内容 | `gitbeaker repository-files show --project-id=<project> --file-path=<path> --ref=<branch>` |
| 创建文件 | `gitbeaker repository-files create --project-id=<id> --file-path=<path> --content=<content> --branch=<branch>` |
| 更新文件 | `gitbeaker repository-files edit --project-id=<id> --file-path=<path> --content=<content> --branch=<branch>` |
| 删除文件 | `gitbeaker repository-files remove --project-id=<id> --file-path=<path> --branch=<branch>` |

**示例：**
```bash
gitbeaker repository-files show --project-id="group/project" --file-path="README.md" --ref=main
gitbeaker repository-files create --project-id="group/project" --file-path="docs/new.md" --content="# New Doc" --branch=main
```

---

### 其他查询

| 操作 | 命令 |
|------|------|
| 列出项目成员 | `gitbeaker project-members all --project-id=<project>` |
| 获取作业日志 | `gitbeaker jobs show-log --project-id=<project> --job-id=<job-id>` |
| 列出标签 | `gitbeaker tags all --project-id=<project>` |
| 获取仓库树 | `gitbeaker repositories all-repository-trees --project-id=<project>` |

**示例：**
```bash
gitbeaker project-members all --project-id="group/project"
gitbeaker jobs show-log --project-id="group/project" --job-id=54321
gitbeaker tags all --project-id="group/project"
gitbeaker repositories all-repository-trees --project-id="group/project"
```

---

### 群组操作 (Groups)

| 操作 | 命令 |
|------|------|
| 列出所有群组 | `gitbeaker groups all` |
| 获取群组详情 | `gitbeaker groups show <groupId>` |
| 创建群组 | `gitbeaker groups create --name=<name> --path=<path>` |
| 更新群组 | `gitbeaker groups edit <groupId> --name=<name> --description=<desc>` |
| 删除群组 | `gitbeaker groups remove <groupId>` |
| 获取群组项目 | `gitbeaker groups all-projects <groupId>` |
| 列出子群组 | `gitbeaker groups all-subgroups <groupId>` |

**示例：**
```bash
gitbeaker groups all --gb-token=<token> --gb-host=<host>
gitbeaker groups show 12345
gitbeaker groups create --name="engineering" --path="engineering"
gitbeaker groups all-projects 12345 --include-subgroups=true
gitbeaker groups all-subgroups 12345
```

---

### 群组成员 (Group Members)

**注意：** 实际命令以 `gitbeaker group-members --help` 为准，以下是已知命令：

| 操作 | 命令 |
|------|------|
| 列出所有可计费成员 | `gitbeaker group-members all-billable --group-id=<groupId>` |
| 列出待批准成员 | `gitbeaker group-members all-pending --group-id=<groupId>` |
| 批准成员 | `gitbeaker group-members approve --group-id=<groupId> <user-id>` |
| 移除可计费成员 | `gitbeaker group-members remove-billable --group-id=<groupId> <user-id>` |

**示例：**
```bash
gitbeaker group-members all-billable --group-id=12345
gitbeaker group-members approve --group-id=12345 67890
```

---

## 操作分类与执行规则

### 查询操作（可直接执行）

| 数据类型 | 命令模式 |
|---------|---------|
| 项目列表/详情 | `gitbeaker projects all`、`gitbeaker projects show` |
| 提交列表/详情 | `gitbeaker commits all`、`gitbeaker commits show` |
| MR 列表/详情 | `gitbeaker merge-requests all`、`gitbeaker merge-requests show` |
| 流水线列表/详情 | `gitbeaker pipelines all`、`gitbeaker pipelines show` |
| Issue 列表/详情 | `gitbeaker issues all`、`gitbeaker issues show` |
| 分支/标签列表 | `gitbeaker branches all`、`gitbeaker tags all` |
| 文件内容 | `gitbeaker repository-files show` |
| 项目成员 | `gitbeaker project-members all` |
| 作业日志 | `gitbeaker jobs show-log` |
| 仓库树 | `gitbeaker repositories all-repository-trees` |
| 群组列表/详情 | `gitbeaker groups all`、`gitbeaker groups show` |
| 群组项目 | `gitbeaker groups all-projects` |
| 群组子群组 | `gitbeaker groups all-subgroups` |

### 修改操作（需二次确认）

| 操作类型 | 命令模式 | 确认要求 |
|---------|---------|---------|
| 创建项目/分支/文件/MR/Issue/流水线/群组 | `gitbeaker * create` | 必须展示完整命令并等待确认 |
| 更新文件/MR/Issue/群组 | `gitbeaker * edit` | 必须展示完整命令并等待确认 |
| 删除项目/分支/文件/群组 | `gitbeaker * remove` | 必须展示完整命令并等待确认 |
| 合并 MR | `gitbeaker merge-requests accept` | 必须展示完整命令并等待确认 |
| 取消流水线 | `gitbeaker pipelines cancel` | 必须展示完整命令并等待确认 |

**二次确认流程：**
1. 向用户展示将要执行的完整命令
2. 说明此操作的影响
3. 等待用户明确回复"是"、"确认"、"yes"等肯定词
4. 收到确认后再执行

---

## 参数规范

1. **项目名称格式**：直接使用原始格式（如 `PaaS_BOC/boc-document`），`/` 不需要 URL 转义
2. **项目 ID 格式**：支持数字 ID（如 `1997`）或项目路径（如 `group/project`）
3. **群组 ID 格式**：支持数字 ID 或群组路径（如 `group-name` 或 `parent/sub-group`）
4. **参数前缀**：`--gb-token`、`--gb-host`、`--gb-oauth-token`、`--gb-job-token` 等参数保持不变
5. **群组成员访问级别**：10=Guest, 20=Reporter, 30=Developer, 40=Maintainer, 50=Owner（以实际 help 为准）

---

## 执行流程

```
1. 接收用户请求
       ↓
2. 检查是否安装 gitbeaker（未安装则 npm install -g @gitbeaker/cli）
       ↓
3. 检查认证信息（命令行参数 > 环境变量）
       ↓
4. 执行 `gitbeaker <command> --help` 确认参数格式
       ↓
5. 解析意图 → 选择最匹配的 gitbeaker 命令
       ↓
6. 判断操作类型
   ├─ 查询操作 → 直接执行
   └─ 修改操作 → 二次确认 → 执行
       ↓
7. 处理结果
   ├─ 成功 → 返回结果
   └─ 失败 → 分析错误 → 尝试替代命令 → 仍失败则报告用户
```
