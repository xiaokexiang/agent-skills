# gitbeaker CLI 命令参考

## 安装

```bash
npm install -g @gitbeaker/cli
```

## 认证方式

### 方式 1：环境变量（推荐）

```bash
export GITLAB_HOST=https://gitlab.com
export GITLAB_TOKEN=your-personal-access-token
```

### 方式 2：命令行参数

| 参数 | 说明 |
|------|------|
| `--gb-token <token>` | GitLab 个人访问令牌 |
| `--gb-host <host>` | GitLab 实例地址 |
| `--gb-oauth-token <token>` | OAuth 令牌 |
| `--gb-job-token <token>` | CI/CD Job 令牌 |

**认证优先级：** 命令行参数 > 环境变量

---

## 命令清单

### 项目操作 (Projects)

| 操作 | 命令 |
|------|------|
| 列出所有项目 | `gb projects all` |
| 获取项目详情 | `gb projects show --project-id=<project>` |
| 创建项目 | `gb projects create --name=<name> --path=<path>` |
| 删除项目 | `gb projects remove --project-id=<id>` |

**示例：**
```bash
# 列出所有项目
gb projects all --gb-token=<token> --gb-host=<host>

# 获取项目详情
gb projects show --project-id="PaaS_BOC/boc-document"

# 创建项目
gb projects create --name="my-project" --path="my-project" --gb-token=<token> --gb-host=<host>

# 删除项目
gb projects remove --project-id=1234
```

---

### 提交历史 (Commits)

| 操作 | 命令 |
|------|------|
| 列出项目提交 | `gb commits all --project-id=<project> --ref-name=<branch>` |
| 获取提交详情 | `gb commits show --project-id=<project> <sha>` |

**示例：**
```bash
# 查询特定分支的提交历史
gb commits all --project-id="PaaS_BOC/boc-document" --ref-name="BOC3.10-TY"

# 获取提交详情
gb commits show --project-id="group/project" abc123def456
```

---

### 合并请求 (Merge Requests)

| 操作 | 命令 |
|------|------|
| 列出合并请求 | `gb merge-requests all --project-id=<project>` |
| 获取 MR 详情 | `gb merge-requests show --project-id=<project> <iid>` |
| 创建 MR | `gb merge-requests create --project-id=<id> --source-branch=<src> --target-branch=<tgt> --title=<title>` |
| 合并 MR | `gb merge-requests accept --project-id=<id> <iid>` |
| 关闭 MR | `gb merge-requests edit --project-id=<id> <iid> --state-event=closed` |

**示例：**
```bash
# 列出打开的 MR
gb merge-requests all --project-id="group/project" --state=opened

# 获取 MR 详情
gb merge-requests show --project-id="group/project" 42

# 创建 MR
gb merge-requests create --project-id="group/project" --source-branch=feature --target-branch=main --title="Add new feature"

# 合并 MR
gb merge-requests accept --project-id="group/project" 42

# 关闭 MR
gb merge-requests edit --project-id="group/project" 42 --state-event=closed
```

---

### 流水线 (Pipelines)

| 操作 | 命令 |
|------|------|
| 列出流水线 | `gb pipelines all --project-id=<project>` |
| 获取流水线详情 | `gb pipelines show --project-id=<project> <pipeline-id>` |
| 触发流水线 | `gb pipelines create --project-id=<id> --ref=<branch>` |
| 取消流水线 | `gb pipelines cancel --project-id=<id> <pipeline-id>` |

**示例：**
```bash
# 列出流水线
gb pipelines all --project-id="group/project"

# 获取流水线详情
gb pipelines show --project-id="group/project" 12345

# 触发流水线
gb pipelines create --project-id="group/project" --ref=main

# 取消流水线
gb pipelines cancel --project-id="group/project" 12345
```

---

### Issues

| 操作 | 命令 |
|------|------|
| 列出 Issues | `gb issues all --project-id=<project>` |
| 获取 Issue 详情 | `gb issues show --project-id=<project> <iid>` |
| 创建 Issue | `gb issues create --project-id=<id> --title=<title> --description=<desc>` |
| 关闭 Issue | `gb issues edit --project-id=<id> <iid> --state-event=close` |

**示例：**
```bash
# 列出所有 Issue
gb issues all --project-id="group/project"

# 获取 Issue 详情
gb issues show --project-id="group/project" 100

# 创建 Issue
gb issues create --project-id="group/project" --title="Bug: login fails" --description="Steps to reproduce..."

# 关闭 Issue
gb issues edit --project-id="group/project" 100 --state-event=close
```

---

### 分支操作 (Branches)

| 操作 | 命令 |
|------|------|
| 列出分支 | `gb branches all --project-id=<project>` |
| 创建分支 | `gb branches create --project-id=<id> --branch=<name> --ref=<source>` |
| 删除分支 | `gb branches remove --project-id=<id> <branch>` |

**示例：**
```bash
# 列出所有分支
gb branches all --project-id="group/project"

# 创建分支
gb branches create --project-id="group/project" --branch=feature/new --ref=main

# 删除分支
gb branches remove --project-id="group/project" feature/old
```

---

### 文件操作 (Repository Files)

| 操作 | 命令 |
|------|------|
| 获取文件内容 | `gb repository-files show --project-id=<project> --file-path=<path> --ref=<branch>` |
| 创建文件 | `gb repository-files create --project-id=<id> --file-path=<path> --content=<content> --branch=<branch> --commit-message=<msg>` |
| 更新文件 | `gb repository-files edit --project-id=<id> --file-path=<path> --content=<content> --branch=<branch> --commit-message=<msg>` |
| 删除文件 | `gb repository-files remove --project-id=<id> --file-path=<path> --branch=<branch> --commit-message=<msg>` |

**示例：**
```bash
# 获取文件内容
gb repository-files show --project-id="group/project" --file-path="README.md" --ref=main

# 创建文件
gb repository-files create --project-id="group/project" --file-path="docs/new.md" --content="# New Doc" --branch=main --commit-message="Add new doc"

# 更新文件
gb repository-files edit --project-id="group/project" --file-path="README.md" --content="Updated content" --branch=main --commit-message="Update README"

# 删除文件
gb repository-files remove --project-id="group/project" --file-path="old.md" --branch=main --commit-message="Remove old file"
```

---

### 其他查询

| 操作 | 命令 |
|------|------|
| 列出项目成员 | `gb project-members all --project-id=<project>` |
| 获取作业日志 | `gb jobs show-log --project-id=<project> --job-id=<job-id>` |
| 列出标签 | `gb tags all --project-id=<project>` |
| 获取仓库树 | `gb repositories tree --project-id=<project>` |

**示例：**
```bash
# 列出项目成员
gb project-members all --project-id="group/project"

# 获取作业日志
gb jobs show-log --project-id="group/project" --job-id=54321

# 列出标签
gb tags all --project-id="group/project"

# 获取仓库树
gb repositories tree --project-id="group/project"
```

---

### 群组操作 (Groups)

| 操作 | 命令 |
|------|------|
| 列出所有群组 | `gb groups all` |
| 获取群组详情 | `gb groups show <groupId>` |
| 创建群组 | `gb groups create --name=<name> --path=<path>` |
| 更新群组 | `gb groups edit <groupId> --name=<name> --description=<desc>` |
| 删除群组 | `gb groups remove <groupId>` |
| 获取群组项目 | `gb groups all-projects <groupId>` |
| 列出子群组 | `gb groups all-subgroups <groupId>` |
| 列出群组成员 | `gb group-members all --group-id=<groupId>` |
| 添加群组成员 | `gb group-members add --group-id=<id> <user-id> --access-level=<level>` |
| 编辑群组成员 | `gb group-members edit --group-id=<id> <user-id> --access-level=<level>` |
| 移除群组成员 | `gb group-members remove --group-id=<id> <user-id>` |

**示例：**
```bash
# 列出所有群组
gb groups all --gb-token=<token> --gb-host=<host>

# 获取群组详情
gb groups show 12345

# 创建群组
gb groups create --name="engineering" --path="engineering" --gb-token=<token> --gb-host=<host>

# 更新群组
gb groups edit 12345 --name="Engineering Team" --description="Team for engineering projects"

# 删除群组
gb groups remove 12345

# 获取群组下的所有项目（包含子群组）
gb groups all-projects 12345 --include-subgroups=true

# 列出子群组
gb groups all-subgroups 12345

# 列出群组成员
gb group-members all --group-id=12345

# 添加群组成员（access-level: 10=Guest, 20=Reporter, 30=Developer, 40=Maintainer, 50=Owner）
gb group-members add --group-id=12345 67890 --access-level=30

# 编辑成员权限
gb group-members edit --group-id=12345 67890 --access-level=40

# 移除群组成员
gb group-members remove --group-id=12345 67890
```

---

## 注意事项

1. **项目名称格式**：直接使用原始格式（如 `PaaS_BOC/boc-document`），`/` 不需要 URL 转义
2. **项目 ID 格式**：支持数字 ID（如 `1997`）或项目路径（如 `group/project`）
3. **短别名**：可以使用 `gb` 代替 `gitbeaker`
4. **认证检查**：执行任何操作前必须验证认证信息（环境变量或命令行参数）
5. **群组 ID 格式**：支持数字 ID 或群组路径（格式：`group-name` 或 `parent-group/sub-group`）
6. **访问级别**：群组成员访问级别 - 10=Guest, 20=Reporter, 30=Developer, 40=Maintainer, 50=Owner
