鼎新实验班 - 20230204882 - 陈雨

# 光影手记 (Shimmer)

用光影记录生活 —— 一款基于 AI 的智能照片管理与分享平台

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Vue 3](https://img.shields.io/badge/Vue-3.5-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)

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
# 编辑 backend/.env 填入数据库密码等配置

# 初始化数据库
mysql -u root -p shimmer < db/init.sql

# 启动
cd backend && npm run dev   # 后端 http://localhost:3000
cd frontend && npm run dev  # 前端 http://localhost:5173
```

## 项目结构

```
Shimmer/
├── frontend/    前端 (Vue 3 + Vite)
├── backend/     后端 (Express + MySQL)
├── db/          数据库脚本
└── docs/        项目文档
```

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Vue 3, Vite, Vue Router, Pinia, Axios |
| 后端 | Express, MySQL2, JWT, bcrypt, Multer, Sharp |
| AI | OpenAI 兼容接口 (Ollama / 任意兼容服务) |

## 开发

| 命令 | 说明 |
|------|------|
| `cd frontend && npm run dev` | 启动前端开发服务器 |
| `cd backend && npm run dev` | 启动后端服务 |
| `cd frontend && npm run build` | 构建前端产物 |

## 许可证

MIT
