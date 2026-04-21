# gitbeaker CLI 使用指南

## 安装

```bash
npm install -g gitbeaker
```

## 认证方式

### 方式 1：环境变量（推荐）

```bash
export GITLAB_HOST=https://gitlab.com
export GITLAB_TOKEN=your-personal-access-token
```

### 方式 2：命令行参数

- `--gb-token <token>` - GitLab 个人访问令牌
- `--gb-host <host>` - GitLab 实例地址
- `--gb-oauth-token <token>` - OAuth 令牌
- `--gb-job-token <token>` - CI/CD Job 令牌

## 常用命令

### 项目操作

```bash
# 列出所有项目
gb projects all

# 获取项目详情
gb projects show --project-id=<project>

# 创建项目
gb projects create --name=<name> --path=<path>

# 删除项目
gb projects remove --project-id=<id>
```

### 提交历史

```bash
# 列出项目提交
gb commits all --project-id=<project> --ref-name=<branch>

# 获取提交详情
gb commits show --project-id=<project> <sha>
```

### 合并请求 (MR)

```bash
# 列出合并请求
gb merge-requests all --project-id=<project>

# 获取合并请求详情
gb merge-requests show --project-id=<project> <iid>

# 创建合并请求
gb merge-requests create --project-id=<id> --source-branch=<src> --target-branch=<tgt> --title=<title>

# 合并 MR
gb merge-requests accept --project-id=<id> <iid>

# 关闭 MR
gb merge-requests edit --project-id=<id> <iid> --state-event=closed
```

### 流水线 (Pipeline)

```bash
# 列出流水线
gb pipelines all --project-id=<project>

# 获取流水线详情
gb pipelines show --project-id=<project> <pipeline-id>

# 触发流水线
gb pipelines create --project-id=<id> --ref=<branch>

# 取消流水线
gb pipelines cancel --project-id=<id> <pipeline-id>
```

### Issues

```bash
# 列出 Issues
gb issues all --project-id=<project>

# 获取 Issue 详情
gb issues show --project-id=<project> <iid>

# 创建 Issue
gb issues create --project-id=<id> --title=<title> --description=<desc>

# 关闭 Issue
gb issues edit --project-id=<id> <iid> --state-event=close
```

### 分支操作

```bash
# 列出分支
gb branches all --project-id=<project>

# 创建分支
gb branches create --project-id=<id> --branch=<name> --ref=<source>

# 删除分支
gb branches remove --project-id=<id> <branch>
```

### 文件操作

```bash
# 获取文件内容
gb repository-files show --project-id=<project> --file-path=<path> --ref=<branch>

# 创建文件
gb repository-files create --project-id=<id> --file-path=<path> --content=<content> --branch=<branch> --commit-message=<msg>

# 更新文件
gb repository-files edit --project-id=<id> --file-path=<path> --content=<content> --branch=<branch> --commit-message=<msg>

# 删除文件
gb repository-files remove --project-id=<id> --file-path=<path> --branch=<branch> --commit-message=<msg>
```

### 其他查询

```bash
# 列出项目成员
gb project-members all --project-id=<project>

# 获取作业日志
gb jobs show-log --project-id=<project> --job-id=<job-id>

# 列出标签
gb tags all --project-id=<project>

# 获取仓库树
gb repositories tree --project-id=<project>
```

## 注意事项

1. **项目名称格式**：直接使用原始格式，如 `PaaS_BOC/boc-document`，其中的 `/` 不需要 URL 转义
2. **项目 ID**：支持数字 ID（如 `1997`）或项目路径（如 `group/project`）
3. **短别名**：可以使用 `gb` 代替 `gitbeaker`
