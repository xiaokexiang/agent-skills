---
name: db-cli
description: 多数据库 CLI 工具 - 支持 MySQL 和达梦(Dameng)数据库的 SQL 导入、导出和执行操作。
---

# db-cli Skill

多数据库命令行工具，统一接口操作 MySQL 和达梦数据库。

## 触发场景

- 用户提到数据库操作、SQL 查询、数据导入导出
- 用户需要备份数据库、迁移数据、执行批量 SQL
- 用户询问 MySQL 或达梦数据库相关操作
- 用户使用 /db-cli 命令
- 任何需要连接数据库进行操作的情况

## 支持的数据库和操作

- **支持的数据库：** MySQL, 达梦数据库
- **支持的操作：** import (导入), export (导出), exec (执行 SQL)

## 执行流程

### 自然语言查询处理

1. **阅读参考文档**
   - 读取 `references/usage.md` 获取详细用法、参数说明和命令示例

2. **解析用户需求**
   - 理解数据库操作类型（查询、导入、导出）
   - 识别目标数据库、表名、查询条件等关键信息

3. **构建 SQL 语句**
   - 根据解析结果编写 SQL 语句
   - 使用 `database.table` 格式指定数据库和表名

4. **校验 SQL 语法**
   - 检查 SQL 语法正确性
   - 检查表名、字段名是否符合标识符规范
   - 检查字符串引号、特殊字符转义是否正确
   - 确认语法无误后再进入下一步

5. **检测工具安装**
   - 执行 `which db-cli` (Linux/Mac) 或 `where db-cli` (Windows) 检查安装状态
   - 若未安装，执行 `npm i -g @xiaokexiang/db-cli` 进行安装

6. **构建 db-cli 命令**
   - 参考 `references/usage.md` 中的格式规范构建命令
   - 格式：`db-cli -c '<连接字符串>' exec -q '<SQL语句>'`

7. **执行命令并返回结果**
   - 运行 db-cli 命令
   - 参考 [输出规范] 返回结果

### 直接命令执行

1. **检测工具安装**
   - 执行 `which db-cli` (Linux/Mac) 或 `where db-cli` (Windows) 检查安装状态
   - 若未安装，执行 `npm i -g @xiaokexiang/db-cli` 进行安装

2. **校验命令语法**
   - 检查 db-cli 命令参数是否正确
   - 若命令包含 SQL，参考 [SQL 语法校验规范] 进行校验

3. **执行命令**
   - 执行校验后的命令
   - 参考 [输出规范] 返回结果

## SQL 语法校验规范

执行 SQL 前，必须进行以下检查：

| 检查项 | 说明 | 示例 |
|--------|------|------|
| 关键字拼写 | 确保 SQL 关键字拼写正确 | SELECT, INSERT, UPDATE, DELETE |
| 字符串引号 | 字符串值使用单引号 | `'value'` 正确，`"value"` 错误 |
| 标识符格式 | 数据库/表/字段名使用反引号（可选） | `` `table_name` `` |
| 语句完整性 | 检查必要的子句是否完整 | SELECT 必须有 FROM |
| 参数占位符 | 检查参数是否正确使用 | 使用 `?` 或命名参数 |

### 常见 SQL 语法错误

| 错误类型 | 错误示例 | 正确写法 |
|----------|----------|----------|
| 使用 USE 语句 | `USE db; SELECT * FROM table` | `SELECT * FROM db.table` |
| 双引号字符串 | `WHERE name = "value"` | `WHERE name = 'value'` |
| 缺少空格 | `SELECT*FROM table` | `SELECT * FROM table` |
| 多余分号 | `SELECT * FROM table;`（单条） | `SELECT * FROM table` |

## 输出规范

- **默认行为**：直接返回 db-cli 的原始输出结果，不添加额外解释、分析或总结
- **例外情况**：仅当用户明确要求"解释一下结果"、"分析一下"或"这是什么意思"时，才提供结果分析
- **错误处理**：如果命令执行失败，展示错误信息即可，不过度分析错误原因

## 连接配置

### 连接字符串格式

| 数据库类型 | 格式 | 示例 |
|------------|------|------|
| MySQL | `mysql://user:password@host:port` | `mysql://root:123456@localhost:3306` |
| 达梦数据库 | `dm://user:password@host:port` | `dm://SYSDBA:password@localhost:5236` |

### 重要提示

- 连接字符串**不包含数据库名**，请在 SQL 中使用 `database.table` 格式指定
- **必需参数**：所有命令都需要 `-c, --connection` 指定连接字符串

## 错误处理

| 错误场景 | 解决方案 |
|----------|----------|
| db-cli 命令未找到 | 执行 `npm i -g @xiaokexiang/db-cli` 安装 |
| 连接失败 | 检查连接字符串格式、网络连接和数据库服务状态 |
| SQL 语法错误 | 参考 [SQL 语法校验规范] 检查并修正 SQL |
| SQL 执行错误 | 默认会停止执行，使用 `--continue-on-error` 可跳过错误继续执行 |
| 导入文件不存在 | 检查文件路径是否正确 |

## 参考文档

详细命令用法、参数说明和示例请参考 `references/usage.md`。
