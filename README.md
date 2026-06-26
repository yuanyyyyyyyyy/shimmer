鼎新实验班 - 20230204882 - 10 - 陈雨 - A2351
# 光影手记 (Shimmer)

用光影记录生活 —— 一款基于 AI 的智能照片管理与分享平台

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Vue 3](https://img.shields.io/badge/Vue-3.5-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)

## 功能特性

- **AI 智能搜索** — 自然语言搜索，自动扩展为关键词和标签
- **照片管理** — 上传、编辑、EXIF 信息读取、公开/私密控制
- **标签系统** — AI 自动打标 + 手动管理，支持按标签筛选
- **收藏功能** — 收藏喜欢的照片，快速访问
- **相册管理** — 创建相册、批量添加照片
- **故事线** — 按日期 + 地点自动聚合照片，AI 生成摘要
- **时间轴** — 年月维度的拍摄统计
- **年度回顾** — AI 生成年度摄影总结
- **分享卡片** — 多种模板，生成可分享的精美卡片
- **暗房效果** — 手电筒交互式照片浏览
- **深色模式** — 支持亮色/深色主题切换

## 快速开始

### 环境要求

- Node.js >= 18
- MySQL >= 8

### 安装运行

```bash
git clone <repository-url>
cd Shimmer

# 安装依赖
cd frontend && npm install && cd ..
cd backend && npm install && cd ..

# 配置环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env 填入数据库密码等配置（见下方"环境变量"）

# 初始化数据库
mysql -u root -p shimmer < db/init.sql

# 启动
cd backend && npm run dev    # 后端 http://localhost:3000
cd frontend && npm run dev   # 前端 http://localhost:5173
```

### 环境变量

在 `backend/.env` 中配置以下变量：

| 变量 | 必填 | 说明 |
|------|------|------|
| `DB_HOST` | 是 | 数据库地址 |
| `DB_USER` | 是 | 数据库用户名 |
| `DB_PASSWORD` | 是 | 数据库密码 |
| `DB_NAME` | 是 | 数据库名，默认 `shimmer` |
| `JWT_SECRET` | 是 | JWT 密钥，生产环境请用复杂随机字符串 |
| `PORT` | 否 | 后端端口，默认 `3000` |
| `FRONTEND_URL` | 否 | 前端地址，默认 `http://localhost:5173` |
| `R2_ENDPOINT` | 部署时 | Cloudflare R2 endpoint |
| `R2_ACCESS_KEY_ID` | 部署时 | R2 访问密钥 ID |
| `R2_SECRET_ACCESS_KEY` | 部署时 | R2 访问密钥 |
| `R2_BUCKET_NAME` | 部署时 | R2 bucket 名称 |
| `R2_PUBLIC_URL` | 部署时 | R2 公开访问 URL |
| `AI_PROVIDER` | 否 | AI 提供商（ollama / openai 等） |
| `AI_MODEL` | 否 | AI 模型名称 |
| `AI_BASE_URL` | 否 | AI API 地址 |
| `AI_API_KEY` | 否 | AI API 密钥 |

## 项目结构

```
Shimmer/
├── frontend/          前端 (Vue 3 + Vite)
│   ├── src/           源码
│   ├── dist/          构建产物
│   └── vite.config.js
├── backend/           后端 (Express + MySQL)
│   ├── src/           源码
│   │   ├── routes/    路由
│   │   ├── services/  业务逻辑（含 AI 服务）
│   │   ├── middleware/ 中间件
│   │   └── config/    配置
│   ├── uploads/       本地上传目录
│   └── .env.example   环境变量模板
├── db/                数据库脚本
│   └── init.sql       建表脚本
├── docs/              项目文档与测试
└── README.md
```

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Vue 3, Vite, Vue Router, Pinia, Axios |
| 后端 | Express, MySQL2, JWT, bcrypt, Multer, Sharp |
| AI | OpenAI 兼容接口 (Ollama / 智谱 GLM / 任意兼容服务) |
| 存储 | Cloudflare R2 (S3 兼容) |
| 数据库 | MySQL 8 |

## 部署

### Cloudflare R2（图片存储）

1. 在 [Cloudflare Dashboard](https://dash.cloudflare.com/) 创建 R2 Bucket
2. 生成 API Token，获取 Access Key ID 和 Secret Access Key
3. 在 R2 设置中开启公开访问，获取 Public URL
4. 将以下变量填入 `backend/.env`：

```
R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<your_key_id>
R2_SECRET_ACCESS_KEY=<your_secret_key>
R2_BUCKET_NAME=shimmer
R2_PUBLIC_URL=https://pub-<hash>.r2.dev
```

### Vercel（前端）

1. 将仓库导入 Vercel
2. 构建配置：
   - **Framework Preset:** Vite
   - **Build Command:** `cd frontend && npm install && npm run build`
   - **Output Directory:** `frontend/dist`
3. 添加环境变量 `VITE_API_URL` 指向后端地址

### 后端部署

后端为标准 Node.js 服务，可部署于任何支持 Node.js 的平台（Railway、Fly.io、自建服务器等）：

```bash
cd backend && npm install && npm start
```

确保 `backend/.env` 中配置了正确的 `FRONTEND_URL` 和 R2 相关变量。

## 开发

| 命令 | 说明 |
|------|------|
| `cd frontend && npm run dev` | 启动前端开发服务器 |
| `cd backend && npm run dev` | 启动后端服务（支持热重载） |
| `cd frontend && npm run build` | 构建前端产物 |

## 许可证

MIT
