# DB-CLI - 多数据库命令行工具

多数据库 CLI 工具，支持 MySQL 和达梦数据库的 SQL 导入、导出和执行。

## 安装
### 全局安装（推荐）

```bash
npm install -g @xiaokexiang/db-cli
```

安装后可使用 `db-cli` 命令。

## 快速开始

### 1. 连接数据库

```bash
db-cli -c '<连接字符串>' <命令> [选项]
```

**连接字符串格式**：

| 数据库 | 格式 | 示例 |
|--------|------|------|
| 达梦数据库 | `dm://用户名：密码@主机：端口` | `dm://SYSDBA:SYSDBA001@localhost:5236` |
| MySQL | `mysql://用户名：密码@主机：端口` | `mysql://root:password@localhost:3306` |

> **注意**：连接字符串不支持数据库名，所有 schema 请通过 SQL 语句处理。

**示例**：
```bash
# 达梦数据库
db-cli -c 'dm://SYSDBA:SYSDBA001@localhost:5236' exec -q 'SELECT 1'

# MySQL
db-cli -c 'mysql://root:password@localhost:3306' exec -q 'SELECT 1'
```

### 2. 执行 SQL 查询

```bash
# 表格输出（默认）
db-cli -c 'mysql://root:password@localhost:3306' exec -q 'SELECT * FROM users'

# JSON 输出
db-cli -c 'mysql://root:password@localhost:3306' exec -q 'SELECT * FROM users' --format json

# 多条语句执行
db-cli -c 'mysql://root:password@localhost:3306' exec -q 'SELECT 1; SELECT 2;'

# 遇到错误继续执行
db-cli -c 'mysql://root:password@localhost:3306' exec -q 'SELECT 1; INVALID_SQL; SELECT 3;' --continue-on-error
```

### 3. 导入 SQL 文件

```bash
# 导入到 MySQL（推荐：在 SQL 文件中使用 USE 语句）
db-cli -c 'mysql://root:password@localhost:3306' import -f data.sql

# 导入到 MySQL（使用 -s 参数指定数据库）
db-cli -c 'mysql://root:password@localhost:3306' import -s database_name -f data.sql

# 导入到达梦数据库
db-cli -c 'dm://SYSDBA:SYSDBA001@localhost:5236' import -f data.sql

# 遇到错误继续执行
db-cli -c 'mysql://root:password@localhost:3306' import -f data.sql --continue-on-error
```

**SQL 文件格式说明**：
- MySQL: 使用 `;` 作为语句分隔符，支持 `#` 和 `--` 注释，可以在文件开头使用 `USE database_name;` 选择数据库
- 达梦数据库：支持 `/` 和 `;` 作为语句分隔符，支持 `--` 注释

### 4. 导出数据

```bash
# 导出整个数据库（表结构 + 数据）
db-cli -c 'mysql://root:password@localhost:3306' export -s bocloud_upms

# 仅导出表结构
db-cli -c 'mysql://root:password@localhost:3306' export -s bocloud_upms --type=schema

# 仅导出数据
db-cli -c 'mysql://root:password@localhost:3306' export -s bocloud_upms --type=data

# 导出单个表
db-cli -c 'mysql://root:password@localhost:3306' export -s bocloud_upms -t upms_core_account

# 导出多个表
db-cli -c 'mysql://root:password@localhost:3306' export -s bocloud_upms -T users,roles,permissions

# 导出到文件
db-cli -c 'mysql://root:password@localhost:3306' export -s bocloud_upms -o backup.sql

# 自定义查询导出
db-cli -c 'mysql://root:password@localhost:3306' export -q 'SELECT * FROM users WHERE id > 100'
```

## 命令帮助

```bash
# 查看主帮助
db-cli --help

# 查看具体命令帮助
db-cli exec --help
db-cli import --help
db-cli export --help
```
