# TGI (Text Generate Image)

阿里云 DashScope 文生图 CLI 工具，支持千问(Qwen-Image)和万相(Wan)系列模型。

## 快速开始

```bash
# 设置 API Key
export DASHSCOPE_API_KEY="sk-xxx"
# 或在 ~/.tgi.env 写入 DASHSCOPE_API_KEY=sk-xxx

# 生成图片（默认返回 URL）
tgi --prompt "一只可爱的猫咪"

# 下载到指定目录
tgi --prompt "一只可爱的猫咪" --output ./images
```

## 常用命令

```bash
# 千问生成（默认模型）
tgi --prompt "夕阳下的海滩" --size 2048*2048

# 万相 4K 生成
tgi --model wan2.7-image-pro --prompt "壮观的山脉" --size 4K

# 显示请求详情
tgi --prompt "一只猫" --wide

# 组图生成
tgi --model wan2.7-image-pro --prompt "小猫的一天" --n 4 --sequential true
```

## 参数说明

| 参数 | 说明 |
|------|------|
| `--model` | 模型名称 (默认: qwen-image-2.0-pro) |
| `--prompt` | 正向提示词 (必填) |
| `--negative` | 反向提示词 (千问，默认自动添加) |
| `--size` | 图片尺寸 (如 2048*2048, 4K) |
| `--n` | 生成数量 (默认: 1) |
| `--output` | 输出目录 (可选，默认只返回URL) |
| `--thinking` | 思考模式 (万相，默认开启) |
| `--extend` | Prompt改写 (千问，简洁时自动开启) |
| `--wide` | 显示请求详情 |

## 支持的模型

- **千问**: qwen-image-2.0-pro, qwen-image-2.0-max, qwen-image-2.0, qwen-image-max, qwen-image-plus
- **万相**: wan2.7-image-pro, wan2.7-image, wan2.6-image, wan2.6-t2i, wan2.5-t2i-preview

## 特性

- ✨ 智能默认值（简洁 prompt 自动开启改写）
- 🔒 强参数校验（请求前验证，失败不发送）
- 🖼️ 万相支持 4K 和组图模式
- 📝 千问支持反向提示词
- 🐛 `--wide` 调试模式

## 许可证

MIT
