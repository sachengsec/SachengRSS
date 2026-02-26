# Sacheng RSS

一个现代化的 RSS 阅读器，支持 AI 翻译、离线阅读。

[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC)](https://tailwindcss.com/)

## 功能特性

- **RSS 订阅管理** - 添加、删除、刷新订阅源
- **文章阅读** - 简洁的阅读界面，支持原文跳转
- **阅读状态** - 已读/未读标记、星标收藏
- **AI 翻译** - 集成 AI 翻译功能，支持标题和正文翻译
- **OPML 支持** - 导入/导出 OPML 文件，轻松迁移订阅
- **本地存储** - 数据保存在浏览器本地，保护隐私
- **响应式设计** - 适配桌面和移动设备
- **暗黑模式** - 支持深色主题

## 技术栈

- **框架**: React 19 + TypeScript
- **构建工具**: Vite 7
- **样式**: Tailwind CSS 3.4
- **组件库**: shadcn/ui (Radix UI)
- **状态管理**: React Hooks
- **RSS 解析**: rss-parser
- **存储**: LocalStorage

## 快速开始

### 环境要求

- Node.js 20+
- npm 或 pnpm

### 安装

```bash
# 克隆仓库
git clone https://github.com/sachengsec/SachengRSS.git
cd SachengRSS/app

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 构建

```bash
# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 使用说明

### 添加订阅

1. 点击侧边栏的 "添加订阅" 按钮
2. 输入 RSS 订阅链接
3. 点击确认，等待解析完成

### 导入/导出 OPML

- **导出**: 点击侧边栏 "导出订阅" 按钮，下载 OPML 文件
- **导入**: 点击 "导入订阅"，选择 OPML 文件

### AI 翻译配置

1. 打开文章详情页
2. 点击 "翻译" 按钮
3. 配置 AI API（支持 OpenAI 兼容接口）
4. 保存后即可翻译文章

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `R` | 刷新当前订阅源 |
| `Shift + R` | 刷新所有订阅源 |
| `M` | 标记为已读/未读 |
| `S` | 切换星标状态 |
| `?` | 显示帮助 |

## 项目结构

```
app/
├── src/
│   ├── components/          # React 组件
│   │   ├── ui/             # shadcn/ui 基础组件
│   │   ├── ArticleList.tsx # 文章列表
│   │   ├── ArticleViewer.tsx # 文章阅读器
│   │   ├── Sidebar.tsx     # 侧边栏
│   │   └── MobileNav.tsx   # 移动端导航
│   ├── hooks/              # 自定义 Hooks
│   │   └── useRSS.ts       # RSS 核心逻辑
│   ├── lib/                # 工具函数
│   │   ├── rssParser.ts    # RSS 解析
│   │   ├── opmlParser.ts   # OPML 解析
│   │   ├── storage.ts      # 本地存储
│   │   └── translation.ts  # 翻译功能
│   ├── types/              # TypeScript 类型定义
│   ├── App.tsx             # 主应用组件
│   └── main.tsx            # 入口文件
├── dist/                   # 构建输出目录
└── package.json
```

## 配置说明

### 环境变量

创建 `.env` 文件（参考 `.env.example`）：

```env
# 开发服务器端口
VITE_PORT=3000

# API 代理（开发时使用）
VITE_API_PROXY=
```

## 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 作者

- **sachengsec** - [GitHub](https://github.com/sachengsec)

---

Made with ❤️ by Sacheng
