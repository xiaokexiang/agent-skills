---
name: gitlab
description: 查询 GitLab 数据（项目、提交、MR、流水线、群组等）。查询操作直接执行，修改操作需二次确认。必须使用 gitbeaker CLI (gb) 命令执行操作，禁止使用 curl 直接调用 API。
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

---

## 核心限制条件

### 1. 命令使用限制（重要）

**必须使用 `gitbeaker` CLI 命令（或其别名 `gb`）执行所有 GitLab 操作。**

- ✅ 允许：`gb projects all`、`gitbeaker commits show --project-id=xxx`
- ❌ 禁止：使用 `curl` 直接调用 GitLab API

此限制原因：
- `gitbeaker` CLI 封装了 API 细节，处理了认证、错误格式化等
- 使用统一工具链，便于维护和调试
- 避免手动构造 API URL 和处理认证头的复杂性

### 2. 命令选择流程

每次执行操作前，必须遵循以下流程：

#### 步骤 1：解析用户意图
- 确定用户想要操作的数据类型（项目、提交、MR、流水线、文件等）
- 确定操作类型（查询、创建、修改、删除）

#### 步骤 2：选择最合适的命令
- 根据用户意图匹配 `references/usage.md` 中的命令
- 确保参数完整且格式正确

#### 步骤 3：验证命令可用性
- 检查命令语法是否正确
- 确认所有必需参数已提供

#### 步骤 4：处理命令失败
如果首选命令执行失败：
1. **分析错误信息** - 理解失败原因（参数错误、权限不足、资源不存在等）
2. **寻找替代命令** - 回到 `references/usage.md` 查找其他可能的命令形式
3. **调整参数重试** - 根据错误信息修正参数后重试
4. **报告用户** - 如果所有合理命令都失败，向用户报告详细错误信息

**示例：**
```
用户：查看项目 A 的提交历史
首选命令：gb commits all --project-id=A
失败后：尝试 gb commits all --project-id=A --ref-name=main
仍失败：报告用户"无法获取提交历史，可能原因：项目不存在、权限不足、或 GitLab 服务不可用"
```

### 3. 操作分类与执行规则

#### 查询操作（可直接执行）

| 数据类型 | 命令模式 |
|---------|---------|
| 项目列表/详情 | `gb projects all`、`gb projects show` |
| 提交列表/详情 | `gb commits all`、`gb commits show` |
| MR 列表/详情 | `gb merge-requests all`、`gb merge-requests show` |
| 流水线列表/详情 | `gb pipelines all`、`gb pipelines show` |
| Issue 列表/详情 | `gb issues all`、`gb issues show` |
| 分支/标签列表 | `gb branches all`、`gb tags all` |
| 文件内容 | `gb repository-files show` |
| 项目成员 | `gb project-members all` |
| 作业日志 | `gb jobs show-log` |
| 仓库树 | `gb repositories tree` |
| **群组列表/详情** | `gb groups all`、`gb groups show` |
| **群组成员** | `gb group-members all` |
| **群组项目** | `gb groups all-projects` |
| **群组子群组** | `gb groups all-subgroups` |

#### 修改操作（需二次确认）

| 操作类型 | 命令模式 | 确认要求 |
|---------|---------|---------|
| 创建项目/分支/文件/MR/Issue/流水线/**群组** | `gb * create` | 必须展示完整命令并等待确认 |
| 更新文件/MR/Issue/**群组** | `gb * edit` | 必须展示完整命令并等待确认 |
| 删除项目/分支/文件/**群组** | `gb * remove` | 必须展示完整命令并等待确认 |
| 合并 MR | `gb merge-requests accept` | 必须展示完整命令并等待确认 |
| 取消流水线 | `gb pipelines cancel` | 必须展示完整命令并等待确认 |
| 添加/编辑/移除**群组成员** | `gb group-members add/edit/remove` | 必须展示完整命令并等待确认 |

**二次确认流程：**
1. 向用户展示将要执行的完整命令
2. 说明此操作的影响
3. 等待用户明确回复"是"、"确认"、"yes"等肯定词
4. 收到确认后再执行

---

## 执行流程总结

```
1. 接收用户请求
       ↓
2. 检查认证信息（命令行参数 > 环境变量）
       ↓
3. 解析意图 → 选择最匹配的 gitbeaker 命令
       ↓
4. 判断操作类型
   ├─ 查询操作 → 直接执行
   └─ 修改操作 → 二次确认 → 执行
       ↓
5. 处理结果
   ├─ 成功 → 返回结果
   └─ 失败 → 分析错误 → 尝试替代命令 → 仍失败则报告用户
```

---

## 参数规范

1. **项目名称格式**：直接使用原始格式（如 `PaaS_BOC/boc-document`），`/` 不需要 URL 转义
2. **项目 ID 格式**：支持数字 ID（如 `1997`）或项目路径（如 `group/project`）
3. **群组 ID 格式**：支持数字 ID 或群组路径（如 `group-name` 或 `parent/sub-group`）
4. **短别名**：可以使用 `gb` 代替 `gitbeaker`
5. **群组成员访问级别**：10=Guest, 20=Reporter, 30=Developer, 40=Maintainer, 50=Owner

---

## 参考文档

详细命令用法、参数说明和示例请参考 `references/usage.md`。
