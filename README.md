# 📸 光影手记 (Shimmer)

> 用光影记录生活 —— 一款基于 AI 的智能照片管理与分享平台

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Vue 3](https://img.shields.io/badge/Vue-3.5-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)

## ✨ 项目简介

**光影手记** 是一款现代化的照片管理应用，集成了 AI 智能功能，让照片管理变得更加轻松有趣。

### 🎯 核心特色

- **🤖 AI 智能助手** — 自动识别照片内容，生成标题、心情描述和标签建议
- **🏷️ 智能标签系统** — 点击即可添加 AI 建议标签，支持自定义标签管理
- **📅 时间轴视图** — 按时间线浏览照片，重温美好回忆
- **🔍 AI 搜索增强** — 智能搜索建议，快速找到目标照片
- **🌓 深色模式** — 舒适的视觉体验，支持亮/暗主题切换
- **👥 多角色支持** — 管理员/普通用户权限分离

---

## 🚀 功能特性

### 📷 照片管理
- ✅ 单张/批量上传照片
- ✅ 自动生成缩略图（使用 Sharp）
- ✅ EXIF 数据自动提取（拍摄日期、GPS 定位）
- ✅ 照片可见性控制（公开/私密）
- ✅ 编辑/删除照片

### 🤖 AI 功能（需配置）
- ✅ **AI 自动补全** — 一键生成标题、心情和标签建议
- ✅ **AI 建议标签点击添加** — 直接点击 AI 建议的标签即可自动创建并选中
  - 已存在的标签直接选中
  - 新标签自动创建后选中
  - 实时状态反馈（未添加/已添加）
- ✅ **AI 搜索增强** — 输入时智能推荐搜索关键词和标签
- ⚙️ 支持 OpenAI 兼容接口配置（在设置页面）

### 🏷️ 标签系统
- ✅ 创建和管理自定义标签
- ✅ 为照片添加多个标签
- ✅ 标签颜色个性化
- ✅ 热门标签展示
- ✅ 按标签筛选照片
- ✅ **AI 建议标签一键添加**（新增）

### 👤 用户系统
- ✅ 用户注册/登录（JWT 认证）
- ✅ 管理员/普通用户角色
- ✅ 个人主页展示
- ✅ 收藏功能

### 🎨 界面体验
- ✅ 响应式设计，适配多端
- ✅ 深色模式切换
- ✅ 流畅的动画过渡效果
- ✅ 拖拽上传支持

---

## 🛠️ 技术栈

### 前端 (Client)
| 技术 | 版本 | 用途 |
|------|------|------|
| [Vue](https://vuejs.org/) | ^3.5 | 渐进式 JavaScript 框架 |
| [Vite](https://vitejs.dev/) | ^5.4 | 构建工具 |
| [Vue Router](https://router.vuejs.org/) | ^4.4 | 路由管理 |
| [Pinia](https://pinia.vuejs.org/) | ^2.2 | 状态管理 |
| [Axios](https://axios-http.com/) | ^1.7 | HTTP 客户端 |

### 后端 (Server)
| 技术 | 版本 | 用途 |
|------|------|------|
| [Express](https://expressjs.com/) | ^4.21 | Web 应用框架 |
| [MySQL2](https://github.com/sidorares/node-mysql2) | ^3.11 | MySQL 驱动 |
| [JWT](https://github.com/auth0/node-jsonwebtoken) | ^9.0 | 身份认证 |
| [bcrypt](https://github.com/kelektiv/node-bcrypt) | ^5.1 | 密码加密 |
| [Multer](https://github.com/expressjs/multer) | ^1.4 | 文件上传处理 |
| [Sharp](https://sharp.pixelplumbing.com/) | ^0.33 | 图片处理 |
| [UUID](https://github.com/uuidjs/uuid) | ^10.0 | 唯一标识符生成 |

---

## 📦 安装与运行

### 📋 前置要求

- **Node.js** >= 18.x
- **MySQL** >= 8.0
- **npm** 或 **pnpm** 或 **yarn**

### 🔧 配置步骤

#### 1. 克隆项目
```bash
git clone <repository-url>
cd Shimmer
```

#### 2. 安装依赖

```bash
# 安装所有依赖（根目录）
npm install

# 或分别安装
cd client && npm install
cd ../server && npm install
```

#### 3. 配置数据库

在 `server` 目录下创建 `.env` 文件（参考 `.env.example`）：

```env
# server/.env

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=shimmer

# JWT 密钥（请替换为随机字符串）
JWT_SECRET=your-super-secret-jwt-key

# 上传目录
UPLOAD_PATH=./uploads

# 服务端口
PORT=3000
```

#### 4. 初始化数据库

```bash
cd server
# 导入数据库结构（SQL 文件位于 server/database/ 目录）
mysql -u root -p shimmer < database/init.sql
```

#### 5. 启动开发服务器

```bash
# 终端 1：启动后端服务
cd server
npm run dev

# 终端 2：启动前端开发服务器
cd client
npm run dev
```

#### 6. 访问应用

打开浏览器访问：**http://localhost:5173**

默认管理员账户需要在数据库中手动创建或通过注册后修改角色。

---

## 📂 项目结构

```
Shimmer/
├── client/                      # 前端应用 (Vue 3 + Vite)
│   ├── src/
│   │   ├── api/                # API 接口封装
│   │   ├── components/         # 可复用组件
│   │   │   └── DragDropUpload.vue  # 拖拽上传组件
│   │   ├── composables/        # 组合式函数
│   │   │   └── useExif.js      # EXIF 数据提取
│   │   ├── router/             # 路由配置
│   │   ├── stores/             # Pinia 状态管理
│   │   ├── styles/             # 全局样式
│   │   ├── views/              # 页面组件
│   │   │   ├── Admin.vue       # 管理后台（含 AI 标签点击添加）
│   │   │   ├── Home.vue        # 首页
│   │   │   ├── Timeline.vue    # 时间轴
│   │   │   ├── Darkroom.vue    # 暗房
│   │   │   ├── Favorites.vue   # 收藏
│   │   │   ├── Settings.vue    # AI 设置
│   │   │   ├── Review.vue      # 回顾页面
│   │   │   └── ...
│   │   ├── App.vue             # 根组件
│   │   └── main.js             # 入口文件
│   ├── package.json
│   └── vite.config.js
│
├── server/                      # 后端应用 (Express + MySQL)
│   ├── src/
│   │   ├── config/             # 配置文件
│   │   ├── middleware/         # 中间件（认证等）
│   │   ├── routes/             # 路由定义
│   │   ├── services/           # 业务逻辑层
│   │   └── app.js              # 应用入口
│   ├── database/               # 数据库脚本
│   ├── .env.example            # 环境变量示例
│   └── package.json
│
├── package-lock.json
└── README.md                   # 本文件
```

---

## 🔗 API 接口说明

### 认证相关
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| GET | `/api/auth/me` | 获取当前用户信息 |

### 照片管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/photos` | 获取照片列表（公开） |
| GET | `/api/photos/admin` | 获取所有照片（管理员） |
| POST | `/api/photos/upload` | 上传单张图片 |
| POST | `/api/photos` | 创建照片记录 |
| PUT | `/api/photos/:id` | 更新照片信息 |
| DELETE | `/api/photos/:id` | 删除照片 |

### 标签管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tags` | 获取所有标签 |
| GET | `/api/tags/popular` | 获取热门标签 |
| POST | `/api/tags` | 创建新标签 |
| GET | `/api/photos/:id/tags` | 获取照片标签 |
| PUT | `/api/photos/:id/tags` | 设置照片标签 |

### AI 功能
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai/metadata` | 生成 AI 元数据（标题、心情、标签） |
| POST | `/api/ai/search-rewrite` | AI 搜索建议 |

> 💡 详细 API 文档请查看 `server/src/routes/` 目录下的路由定义

---

## 🎮 使用指南

### 基础流程

1. **注册/登录** — 创建账户或使用已有账户登录
2. **上传照片** — 进入管理后台，点击"上传照片"
3. **编辑信息** — 填写标题、心情、选择标签
4. **AI 增强**（可选）— 点击"AI 自动补全"按钮获取智能建议
5. **保存发布** — 保存后照片将在首页展示

```

### AI 配置

进入 **AI 设置页面**（`/settings`），配置以下选项：
- AI 服务提供商（OpenAI 兼容接口）
- API Key
- 模型名称
- 其他参数调整

---

## 🎨 界面预览

### 主要页面

| 页面 | 路径 | 说明 |
|------|------|------|
| 首页 | `/` | 照片瀑布流展示，支持搜索和筛选 |
| 时间轴 | `/timeline` | 按时间顺序浏览照片 |
| 暗房 | `/darkroom` | 私密照片空间 |
| 收藏 | `/favorites` | 已收藏的照片 |
| 回顾 | `/review` | 历史回顾与统计 |
| 管理后台 | `/admin` | 照片上传与管理（管理员） |
| AI 设置 | `/settings` | AI 功能配置（管理员） |

---

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启 Pull Request

---

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

---

## 🙏 致谢

- [Vue.js](https://vuejs.org/) — 渐进式 JavaScript 框架
- [Express](https://expressjs.com/) — 高效的 Node.js Web 框架
- [Sharp](https://sharp.pixelplumbing.com/) — 高性能图片处理库
- 所有贡献者和使用者

---

<p align="center">
  <strong>© 光影手记 · 用光影记录生活</strong><br>
  Made with ❤️ and lots of 📸
</p>
