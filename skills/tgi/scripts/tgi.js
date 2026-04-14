#!/usr/bin/env node

/**
 * 阿里云 DashScope 文生图生成脚本
 * 支持千问(Qwen-Image)和万相(Wan)系列模型
 *
 * 用法:
 *   node generate.js --prompt "一只可爱的猫咪"
 *   node generate.js --model wan2.7-image-pro --prompt "山水画" --size 4K
 *   node generate.js --model qwen-image-2.0-pro --prompt "动漫少女" --negative "畸形,模糊"
 */

import https from 'https';
import fs from 'fs';
import path from 'path';

// ==================== 配置加载 ====================

/**
 * 加载 .env 文件
 */
function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;

  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const equalIndex = trimmed.indexOf('=');
      if (equalIndex === -1) continue;

      const key = trimmed.substring(0, equalIndex).trim();
      let value = trimmed.substring(equalIndex + 1).trim();

      // 去除引号
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    // 忽略读取错误
  }
}

// 加载用户目录的 .tgi.env
const userHome = process.env.HOME || process.env.USERPROFILE;
if (userHome) {
  loadEnvFile(path.join(userHome, '.tgi.env'));
}

// ==================== 配置 ====================

const CONFIG = {
  baseUrl: 'dashscope.aliyuncs.com',
  apiKey: process.env.DASHSCOPE_API_KEY,
  defaultModel: 'qwen-image-2.0-pro',
  defaultOutput: null, // 默认不下载，只输出 URL
  pollInterval: 5000,
  maxPollAttempts: 120,
  // 默认反向提示词
  defaultNegativePrompt: '低分辨率，低画质，肢体畸形，手指畸形，画面过饱和，蜡像感，人脸无细节，过度光滑，画面具有AI感。构图混乱。文字模糊，扭曲。',
  // prompt 简洁阈值（字符数），低于此值自动开启 prompt_extend
  promptExtendThreshold: 30,
};

// ==================== 强校验：模型规格定义 ====================

const MODEL_SPECS = {
  'wan2.7-image-pro': {
    apiFormat: 'wan',
    supportsThinking: true,
    supportsSequential: true,
    supportsNegative: false,
    supportsExtend: false,
    sizeFormat: 'abbreviation', // 支持缩写
    sizeRange: { min: 768, max: 4096 },
    defaultSize: '2K',
    aspectRatio: { min: 1 / 8, max: 8 },
    async: true,
  },
  'wan2.7-image': {
    apiFormat: 'wan',
    supportsThinking: true,
    supportsSequential: true,
    supportsNegative: false,
    supportsExtend: false,
    sizeFormat: 'abbreviation',
    sizeRange: { min: 768, max: 2048 },
    defaultSize: '2K',
    aspectRatio: { min: 1 / 8, max: 8 },
    async: true,
  },
  'wan2.6-image': {
    apiFormat: 'wan',
    supportsThinking: false,
    supportsSequential: false,
    supportsNegative: false,
    supportsExtend: false,
    sizeFormat: 'custom',
    sizeRange: { min: 768, max: 1280 },
    defaultSize: '1024*1024',
    maxPixels: 1280 * 1280,
    aspectRatio: { min: 1 / 4, max: 4 },
    async: true,
  },
  'wan2.6-t2i': {
    apiFormat: 'wan',
    supportsThinking: false,
    supportsSequential: false,
    supportsNegative: false,
    supportsExtend: false,
    sizeFormat: 'custom',
    sizeRange: { min: 1280, max: 1440 },
    defaultSize: '1280*1280',
    maxPixels: 1440 * 1440,
    aspectRatio: { min: 1 / 4, max: 4 },
    async: true,
  },
  'wan2.5-t2i-preview': {
    apiFormat: 'wan',
    supportsThinking: false,
    supportsSequential: false,
    supportsNegative: false,
    supportsExtend: false,
    sizeFormat: 'custom',
    sizeRange: { min: 1280, max: 1440 },
    defaultSize: '1280*1280',
    maxPixels: 1440 * 1440,
    aspectRatio: { min: 1 / 4, max: 4 },
    async: true,
  },
  'wan2.2-t2i': {
    apiFormat: 'wan',
    supportsThinking: false,
    supportsSequential: false,
    supportsNegative: false,
    supportsExtend: false,
    sizeFormat: 'custom',
    sizeRange: { min: 512, max: 1440 },
    defaultSize: '1024*1024',
    maxPixels: 1440 * 1440,
    async: true,
  },
  'qwen-image-2.0-pro': {
    apiFormat: 'qwen',
    supportsThinking: false,
    supportsSequential: false,
    supportsNegative: true,
    supportsExtend: true,
    sizeFormat: 'custom',
    sizeRange: { min: 512, max: 2048 },
    defaultSize: '2048*2048',
    maxPixels: 2048 * 2048,
    async: false,
  },
  'qwen-image-2.0-max': {
    apiFormat: 'qwen',
    supportsThinking: false,
    supportsSequential: false,
    supportsNegative: true,
    supportsExtend: true,
    sizeFormat: 'custom',
    sizeRange: { min: 512, max: 2048 },
    defaultSize: '2048*2048',
    maxPixels: 2048 * 2048,
    async: false,
  },
  'qwen-image-2.0': {
    apiFormat: 'qwen',
    supportsThinking: false,
    supportsSequential: false,
    supportsNegative: true,
    supportsExtend: true,
    sizeFormat: 'custom',
    sizeRange: { min: 512, max: 2048 },
    defaultSize: '2048*2048',
    maxPixels: 2048 * 2048,
    async: false,
  },
  'qwen-image-max': {
    apiFormat: 'qwen',
    supportsThinking: false,
    supportsSequential: false,
    supportsNegative: true,
    supportsExtend: true,
    sizeFormat: 'preset',
    presetSizes: ['1664*928', '1472*1104', '1328*1328', '1104*1472', '928*1664'],
    defaultSize: '1664*928',
    async: false,
  },
  'qwen-image-plus': {
    apiFormat: 'qwen',
    supportsThinking: false,
    supportsSequential: false,
    supportsNegative: true,
    supportsExtend: true,
    sizeFormat: 'preset',
    presetSizes: ['1664*928', '1472*1104', '1328*1328', '1104*1472', '928*1664'],
    defaultSize: '1664*928',
    async: false,
  },
};

// 尺寸缩写映射
const SIZE_ABBREVIATIONS = {
  '1K': { width: 1024, height: 1024 },
  '2K': { width: 2048, height: 2048 },
  '4K': { width: 4096, height: 4096 },
};

// ==================== 工具函数 ====================

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    warning: '\x1b[33m',
    error: '\x1b[31m',
    reset: '\x1b[0m',
  };
  console.log(`${colors[type]}[${type.toUpperCase()}]${colors.reset} ${message}`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    model: CONFIG.defaultModel,
    size: null,
    n: 1,
    output: CONFIG.defaultOutput, // null 表示不下载
    thinking: null, // null 表示未手动设置，万相默认 true，千问忽略
    sequential: false,
    extend: null, // null 表示未手动设置，将根据 prompt 长度自动判断
    negative: null, // null 表示未手动设置，将使用默认值
    watermark: false,
    wide: false, // 显示详细请求信息
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--model':
        parsed.model = next;
        i++;
        break;
      case '--prompt':
        // 处理可能包含空格和特殊字符的 prompt
        // 支持引号包裹或转义空格
        if (next) {
          // 检查是否是引号包裹的字符串
          if (next.startsWith('"') || next.startsWith("'")) {
            const quote = next[0];
            let value = next.slice(1);
            let j = i + 1;
            // 查找闭合引号
            while (j < args.length && !args[j].endsWith(quote)) {
              j++;
            }
            if (j <= i + 1) {
              // 单个参数，去除闭合引号
              parsed.prompt = value.replace(/[\"']$/, '');
            } else {
              // 多个参数合并
              const parts = args.slice(i + 1, j + 1);
              parsed.prompt = parts.join(' ').replace(/^['"]|[\"']$/g, '');
              i = j;
            }
          } else {
            // 普通参数，可能是多个单词
            let j = i + 1;
            let valueParts = [next];
            // 收集直到下一个 -- 开头的参数
            while (j + 1 < args.length && !args[j + 1].startsWith('--')) {
              j++;
              valueParts.push(args[j]);
            }
            parsed.prompt = valueParts.join(' ');
            i = j;
          }
        }
        break;
      case '--negative':
        // 同样处理 negative prompt
        if (next) {
          if (next.startsWith('"') || next.startsWith("'")) {
            const quote = next[0];
            let j = i + 1;
            while (j < args.length && !args[j].endsWith(quote)) {
              j++;
            }
            if (j <= i + 1) {
              parsed.negative = next.slice(1).replace(/[\"']$/, '');
            } else {
              const parts = args.slice(i + 1, j + 1);
              parsed.negative = parts.join(' ').replace(/^['"]|[\"']$/g, '');
              i = j;
            }
          } else {
            let j = i + 1;
            let valueParts = [next];
            while (j + 1 < args.length && !args[j + 1].startsWith('--')) {
              j++;
              valueParts.push(args[j]);
            }
            parsed.negative = valueParts.join(' ');
            i = j;
          }
        }
        break;
      case '--size':
        parsed.size = next;
        i++;
        break;
      case '--n':
        parsed.n = parseInt(next, 10);
        i++;
        break;
      case '--output':
        parsed.output = next;
        i++;
        break;
      case '--thinking':
        parsed.thinking = next === 'true';
        i++;
        break;
      case '--sequential':
        parsed.sequential = next === 'true';
        i++;
        break;
      case '--extend':
        parsed.extend = next === 'true';
        i++;
        break;
      case '--watermark':
        parsed.watermark = next === 'true';
        i++;
        break;
      case '--wide':
        parsed.wide = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
    }
  }

  if (!parsed.prompt) {
    log('错误: 缺少必需的 --prompt 参数', 'error');
    showHelp();
    process.exit(1);
  }

  return parsed;
}

function showHelp() {
  console.log(`
TGI (Text Generate Image) - 阿里云文生图工具

用法: tgi [选项]

选项:
  --model <model>      模型名称 (默认: ${CONFIG.defaultModel})
  --prompt <text>      正向提示词 (必填)
                       支持中英文，可用引号包裹含空格的文本
  --negative <text>    反向提示词 (仅千问系列，默认自动添加通用反向提示词)
  --size <size>        图片尺寸 (默认: 模型默认值)
  --n <number>         生成数量 (默认: 1, 组图模式 1-12)
  --output <dir>       输出目录 (可选，不指定则只返回URL)
  --thinking <bool>    开启思考模式 (万相，默认 true，千问忽略)
  --sequential <bool>  开启组图模式 (万相, 默认: false)
  --extend <bool>      开启Prompt改写 (千问，默认根据prompt长度自动判断)
  --watermark <bool>   添加水印 (默认: false)
  --wide               显示详细请求信息
  --help, -h           显示帮助

支持的模型:
  - wan2.7-image-pro, wan2.7-image
  - wan2.6-image, wan2.6-t2i, wan2.5-t2i-preview, wan2.2-t2i
  - qwen-image-2.0-pro, qwen-image-2.0-max, qwen-image-2.0
  - qwen-image-max, qwen-image-plus

尺寸格式:
  - 万相系列: 1K, 2K, 4K(仅pro) 或 宽*高
  - 千问-2.0: 宽*高 (512*512 - 2048*2048)
  - 千问-max/plus: 仅预设尺寸 (1664*928, 1472*1104, 1328*1328, 1104*1472, 928*1664)

API Key 配置:
  方式1 - 环境变量: export DASHSCOPE_API_KEY="sk-xxx"
  方式2 - 配置文件: 在 ~/.tgi.env 写入 DASHSCOPE_API_KEY=sk-xxx

示例:
  tgi --prompt "一只可爱的猫咪"
  tgi --model wan2.7-image-pro --prompt "山水画" --size 4K
  tgi --model qwen-image-2.0-pro --prompt "动漫少女" --negative "畸形,模糊"
  tgi --prompt "一只可爱的小狗，金毛，在阳光下奔跑" --size 2K
`);
}

function validateConfig() {
  if (!CONFIG.apiKey) {
    log('错误: 未设置 DASHSCOPE_API_KEY', 'error');
    log('', 'info');
    log('请通过以下方式之一配置:', 'info');
    log('  1. 环境变量: export DASHSCOPE_API_KEY="sk-xxx"', 'info');
    log('  2. 配置文件: 在 ~/.tgi.env 写入 DASHSCOPE_API_KEY=sk-xxx', 'info');
    process.exit(1);
  }
}

// ==================== 强校验函数 ====================

/**
 * 校验模型名称
 */
function validateModel(modelName) {
  const spec = MODEL_SPECS[modelName];
  if (!spec) {
    log(`错误: 不支持的模型 "${modelName}"`, 'error');
    log(`支持的模型列表:`, 'info');
    Object.keys(MODEL_SPECS).forEach((m) => log(`  - ${m}`, 'info'));
    process.exit(1);
  }
  return spec;
}

/**
 * 校验尺寸参数 - 强校验
 */
function validateSize(size, spec, modelName) {
  // 如果没有指定尺寸，使用默认值
  if (!size) {
    return spec.defaultSize;
  }

  // 1. 处理缩写格式 (1K, 2K, 4K)
  if (['1K', '2K', '4K'].includes(size.toUpperCase())) {
    const upperSize = size.toUpperCase();

    // 检查模型是否支持缩写格式
    if (spec.sizeFormat !== 'abbreviation' && spec.sizeFormat !== 'both') {
      log(`错误: 模型 "${modelName}" 不支持尺寸缩写 "${size}"`, 'error');
      log(`该模型仅支持自定义格式: 宽*高`, 'info');
      process.exit(1);
    }

    // 4K 仅 wan2.7-image-pro 支持
    if (upperSize === '4K' && modelName !== 'wan2.7-image-pro') {
      log(`错误: 4K 分辨率仅模型 "wan2.7-image-pro" 支持`, 'error');
      log(`模型 "${modelName}" 最大支持 2K (2048*2048)`, 'info');
      process.exit(1);
    }

    return upperSize;
  }

  // 2. 解析自定义尺寸格式
  const match = size.match(/^(\d+)\*(\d+)$/);
  if (!match) {
    log(`错误: 尺寸参数 "${size}" 格式不正确`, 'error');
    log(`支持的格式:`, 'info');
    log(`  - 缩写: 1K, 2K, 4K(仅pro)`, 'info');
    log(`  - 自定义: 宽*高 (如 1024*1024)`, 'info');
    process.exit(1);
  }

  const width = parseInt(match[1], 10);
  const height = parseInt(match[2], 10);
  const pixels = width * height;

  // 3. 预设尺寸模型校验 (qwen-image-max, qwen-image-plus)
  if (spec.sizeFormat === 'preset') {
    if (!spec.presetSizes.includes(size)) {
      log(`错误: 模型 "${modelName}" 仅支持以下预设尺寸:`, 'error');
      spec.presetSizes.forEach((s) => {
        const ratio = getAspectRatioInfo(s);
        log(`  - ${s} (${ratio})`, 'info');
      });
      process.exit(1);
    }
    return size;
  }

  // 4. 尺寸范围校验
  if (spec.sizeRange) {
    const minPixel = spec.sizeRange.min * spec.sizeRange.min;
    const maxPixel = spec.sizeRange.max * spec.sizeRange.max;

    if (width < spec.sizeRange.min ||
        width > spec.sizeRange.max ||
        height < spec.sizeRange.min ||
        height > spec.sizeRange.max) {
      log(`错误: 尺寸 "${size}" 超出模型支持范围`, 'error');
      log(`模型 "${modelName}" 支持的尺寸范围:`, 'info');
      log(`  宽/高: ${spec.sizeRange.min} - ${spec.sizeRange.max} 像素`, 'info');
      log(`  示例: ${spec.sizeRange.min}*${spec.sizeRange.min} 到 ${spec.sizeRange.max}*${spec.sizeRange.max}`, 'info');
      process.exit(1);
    }

    // 总像素校验
    if (spec.maxPixels && pixels > spec.maxPixels) {
      log(`错误: 总像素数 ${pixels.toLocaleString()} 超出限制`, 'error');
      log(`模型 "${modelName}" 最大支持: ${spec.maxPixels.toLocaleString()} 像素`, 'info');
      process.exit(1);
    }
  }

  // 5. 宽高比校验
  if (spec.aspectRatio) {
    const ratio = width / height;
    if (ratio < spec.aspectRatio.min || ratio > spec.aspectRatio.max) {
      log(`错误: 宽高比 ${ratio.toFixed(2)}:1 超出支持范围`, 'error');
      log(`模型 "${modelName}" 支持的宽高比: ${spec.aspectRatio.min}:1 到 ${spec.aspectRatio.max}:1`, 'info');
      process.exit(1);
    }
  }

  return size;
}

/**
 * 获取宽高比信息
 */
function getAspectRatioInfo(size) {
  const [w, h] = size.split('*').map(Number);
  const ratio = w / h;
  if (Math.abs(ratio - 1) < 0.01) return '1:1';
  if (Math.abs(ratio - 16 / 9) < 0.01) return '16:9';
  if (Math.abs(ratio - 9 / 16) < 0.01) return '9:16';
  if (Math.abs(ratio - 4 / 3) < 0.01) return '4:3';
  if (Math.abs(ratio - 3 / 4) < 0.01) return '3:4';
  return `${w}:${h}`;
}

/**
 * 校验参数兼容性
 */
function validateParams(params, spec, modelName) {
  // 1. 反向提示词校验
  if (params.negative && !spec.supportsNegative) {
    log(`错误: 模型 "${modelName}" 不支持反向提示词 (negative_prompt)`, 'error');
    log(`万相系列请在正向提示词中描述不想要的元素`, 'info');
    process.exit(1);
  }

  // 2. 组图模式校验
  if (params.sequential && !spec.supportsSequential) {
    log(`错误: 模型 "${modelName}" 不支持组图模式 (enable_sequential)`, 'error');
    log(`仅 wan2.7-image-pro 和 wan2.7-image 支持组图`, 'info');
    process.exit(1);
  }

  // 3. 组图模式数量校验
  if (spec.supportsSequential && params.sequential) {
    if (params.n < 1 || params.n > 12) {
      log(`错误: 组图模式 n 参数必须在 1-12 之间`, 'error');
      process.exit(1);
    }
  }

  // 4. 思考模式与组图模式互斥
  if (spec.supportsThinking && spec.supportsSequential) {
    if (params.thinking && params.sequential) {
      log(`错误: 思考模式 (thinking_mode) 与组图模式 (enable_sequential) 不能同时开启`, 'error');
      process.exit(1);
    }
  }

  // 5. Prompt改写校验
  if (params.extend !== undefined && !spec.supportsExtend) {
    log(`警告: 模型 "${modelName}" 不支持 Prompt 智能改写，该参数将被忽略`, 'warning');
  }

  // 6. 思考模式校验
  if (params.thinking !== null && params.thinking && !spec.supportsThinking) {
    log(`警告: 模型 "${modelName}" 不支持思考模式，该参数将被忽略`, 'warning');
  }
}

// ==================== 请求体构建 ====================

function buildRequestBody(params, spec) {
  const size = validateSize(params.size, spec, params.model);

  if (spec.apiFormat === 'wan') {
    return buildWanRequestBody(params, spec, size);
  } else {
    return buildQwenRequestBody(params, spec, size);
  }
}

function buildWanRequestBody(params, spec, size) {
  const body = {
    model: params.model,
    input: {
      messages: [
        {
          role: 'user',
          content: [{ text: params.prompt }],
        },
      ],
    },
    parameters: {
      size: size,
    },
  };

  if (params.n > 1 || params.sequential) {
    body.parameters.n = params.n;
  }

  if (spec.supportsThinking && params.sequential !== true) {
    // 如果用户未设置，默认开启 thinking_mode
    body.parameters.thinking_mode = params.thinking !== null ? params.thinking : true;
  }

  if (spec.supportsSequential && params.sequential) {
    body.parameters.enable_sequential = true;
  }

  if (params.watermark) {
    body.parameters.watermark = true;
  }

  return body;
}

function buildQwenRequestBody(params, spec, size) {
  const body = {
    model: params.model,
    input: {
      messages: [
        {
          role: 'user',
          content: [{ text: params.prompt }],
        },
      ],
    },
    parameters: {
      size: size,
    },
  };

  // 处理反向提示词：用户未设置则使用默认值
  if (spec.supportsNegative) {
    if (params.negative) {
      body.parameters.negative_prompt = params.negative;
    } else {
      body.parameters.negative_prompt = CONFIG.defaultNegativePrompt;
    }
  }

  // 处理 Prompt 智能改写：用户未设置则根据 prompt 长度自动判断
  if (spec.supportsExtend) {
    if (params.extend !== null) {
      // 用户手动设置了，使用用户值
      body.parameters.prompt_extend = params.extend;
    } else {
      // 自动判断：prompt 长度低于阈值则开启
      const promptLength = params.prompt ? params.prompt.length : 0;
      const shouldExtend = promptLength < CONFIG.promptExtendThreshold;
      body.parameters.prompt_extend = shouldExtend;

      if (shouldExtend) {
        log(`检测到提示词较简洁（${promptLength} 字符），已自动开启 Prompt 智能改写`, 'info');
      }
    }
  }

  if (params.n > 1) {
    body.parameters.n = params.n;
  }

  if (params.watermark) {
    body.parameters.watermark = true;
  }

  return body;
}

// ==================== HTTP 请求 ====================

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function submitGeneration(body, spec, isAsync) {
  // 根据模型类型选择正确的 API 端点
  const apiPath = spec.apiFormat === 'wan'
    ? '/api/v1/services/aigc/image-generation/generation'
    : '/api/v1/services/aigc/multimodal-generation/generation';

  const options = {
    hostname: CONFIG.baseUrl,
    path: apiPath,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.apiKey}`,
    },
  };

  if (isAsync) {
    options.headers['X-DashScope-Async'] = 'enable';
  }

  return makeRequest(options, body);
}

async function getTaskResult(taskId) {
  const options = {
    hostname: CONFIG.baseUrl,
    path: `/api/v1/tasks/${taskId}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${CONFIG.apiKey}`,
    },
  };

  return makeRequest(options);
}

// ==================== 图片下载 ====================

async function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`下载失败: HTTP ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(outputPath);
        });
      })
      .on('error', reject);
  });
}

async function downloadImages(urls, outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = Date.now();
  const downloads = urls.map(async (url, index) => {
    const filename = `image_${timestamp}_${index + 1}.png`;
    const outputPath = path.join(outputDir, filename);
    await downloadImage(url, outputPath);
    return { url, localPath: outputPath, filename };
  });

  return Promise.all(downloads);
}

// ==================== 结果处理 ====================

function extractImageUrls(result, spec) {
  const urls = [];

  if (spec.apiFormat === 'wan') {
    const results = result.output?.results || [];
    results.forEach((item) => {
      if (item.url) urls.push(item.url);
    });
  } else {
    const choices = result.output?.choices || [];
    choices.forEach((choice) => {
      const content = choice.message?.content || [];
      content.forEach((item) => {
        if (item.image) urls.push(item.image);
      });
    });
  }

  return urls;
}

async function pollTaskResult(taskId, spec) {
  log(`任务已提交，ID: ${taskId}`);
  log('等待生成完成...');

  for (let i = 0; i < CONFIG.maxPollAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, CONFIG.pollInterval));

    const result = await getTaskResult(taskId);
    const status = result.output?.task_status;

    if (status === 'SUCCEEDED') {
      log('生成完成!', 'success');
      return result;
    }

    if (status === 'FAILED') {
      throw new Error(`任务失败: ${result.output?.message || '未知错误'}`);
    }

    process.stdout.write(`\r轮询中... (${i + 1}/${CONFIG.maxPollAttempts}) [${status}]`);
  }

  throw new Error('任务超时');
}

// ==================== 主函数 ====================

async function main() {
  try {
    // 1. 解析参数
    const params = parseArgs();
    validateConfig();

    log(`模型: ${params.model}`);
    log(`提示词: ${params.prompt}`);

    // 2. 强校验：验证模型
    const spec = validateModel(params.model);

    // 3. 强校验：验证参数兼容性
    validateParams(params, spec, params.model);

    // 4. 构建请求体（内部会校验尺寸）
    const body = buildRequestBody(params, spec);
    log(`尺寸: ${body.parameters.size}`);

    // 如果开启 --wide，打印请求参数
    if (params.wide) {
      console.log('\n' + '='.repeat(50));
      console.log(JSON.stringify(body, null, 2));
      console.log('='.repeat(50) + '\n');
    }

    // 5. 提交生成任务
    log('提交生成任务...');
    const submitResult = await submitGeneration(body, spec, spec.async);

    // 检查错误
    if (submitResult.code && submitResult.code !== '200') {
      throw new Error(`API 错误: ${submitResult.code} - ${submitResult.message}`);
    }

    let finalResult;

    if (spec.async) {
      const taskId = submitResult.output?.task_id;
      if (!taskId) {
        throw new Error('未获取到任务 ID');
      }
      finalResult = await pollTaskResult(taskId, spec);
    } else {
      finalResult = submitResult;
      log('生成完成!', 'success');
    }

    // 6. 提取图片 URL
    const urls = extractImageUrls(finalResult, spec);

    if (urls.length === 0) {
      log('警告: 未找到图片 URL', 'warning');
      console.log('完整响应:', JSON.stringify(finalResult, null, 2));
      return;
    }

    // 7. 输出结果
    console.log('\n' + '='.repeat(50));
    log('生成结果:', 'success');
    console.log('='.repeat(50));

    urls.forEach((url, index) => {
      console.log(`\n图片 ${index + 1}:`);
      console.log(`  URL: ${url}`);
    });

    // 8. 如果指定了 -o，则下载图片
    if (params.output) {
      log(`\n下载图片到: ${params.output}`);
      const downloads = await downloadImages(urls, params.output);

      console.log('\n下载完成:');
      downloads.forEach((img, index) => {
        console.log(`  图片 ${index + 1}: ${img.localPath}`);
      });
    }

    const usage = finalResult.usage;
    if (usage) {
      console.log('\n用量信息:');
      console.log(`  尺寸: ${usage.width || 'N/A'} x ${usage.height || 'N/A'}`);
      console.log(`  数量: ${usage.image_count || urls.length}`);
    }

    console.log('\n' + '='.repeat(50));
  } catch (error) {
    log(`错误: ${error.message}`, 'error');
    process.exit(1);
  }
}

main();
