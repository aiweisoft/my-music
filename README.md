# 科羽音乐

> 科技羽翼 声动未来

基于 **uni-app (Vue 3)** 构建的 Android 本地音乐播放器，Linear 极简暗黑风格。

## 功能

- **多歌单管理** — 创建、重命名、删除歌单，歌单间自由切换
- **本地文件导入** — 原生文件选择器，支持多选批量添加音频
- **ID3 标签解析** — 自动提取标题、艺术家、专辑、时长等元数据
- **播放控制** — 播放/暂停、上下曲、进度拖拽、音量调节
- **三种播放模式** — 列表循环、单曲循环、随机播放
- **数据持久化** — 歌单及播放状态自动保存，支持清理缓存

## 技术栈

- **框架**: uni-app / Vue 3 (Options API)
- **音频引擎**: uni.createInnerAudioContext
- **原生能力**: plus.android (文件选择器、MediaMetadataRetriever、ContentResolver)
- **样式**: SCSS，750rpx 适配，Linear 暗黑主题

## 目标平台

Android (APP-PLUS) / H5 / 微信小程序 / 支付宝小程序 / 百度小程序 / 头条小程序

## 项目结构

```
my-music/
├── pages/
│   ├── index/              # 播放页（黑胶动画 + 进度/音量控制 + 播放模式）
│   └── playlist/           # 歌单管理页（横滚标签 + 歌曲列表 + CRUD）
├── utils/
│   ├── audio-manager.js    # 音频引擎（歌单/歌曲/播放控制 + 事件总线 + 持久化）
│   └── file-picker.js      # 跨平台文件选择器 + Android ID3 解析
├── static/                 # 静态资源
├── App.vue                 # 应用根组件
├── main.js                 # 应用入口
├── manifest.json           # 多平台应用配置
├── pages.json              # 页面路由、TabBar 配置
├── uni.scss                # uni-app 内置 SCSS 变量
└── index.html              # SPA HTML 入口 (H5)
```

## 配色方案

| 用途 | 色值 |
|------|------|
| 背景 | `#010102` |
| 强调色 | `#5e6ad2` |
| 主文字 | `#f7f8f8` |
| 次文字 | `#d0d6e0` / `#8a8f98` |
| 弱文字 | `#62666d` |
| 卡片/控件底 | `#0f1011` / `#141516` |
| 边框 | `#23252a` |

## 快速开始

1. 使用 HBuilderX 打开项目
2. 连接 Android 设备，点击「运行 → 运行到手机或模拟器」
3. 或点击「运行 → 运行到浏览器 → Chrome」运行到 H5

## 打包发布

在 HBuilderX 中点击「发行 → 原生 App-云打包」生成 APK，输出目录 `unpackage/`。

## 开发规范

- Tab 缩进，等效宽度 4，换行符 LF，编码 UTF-8
- 页面命名小写短横线，JS 变量/方法 camelCase，CSS 类名小写短横线
- 尺寸单位优先 rpx (750rpx = 屏幕宽度)
- uni-app API 始终使用 `uni.` 前缀
- 私有方法使用单下划线 `_` 前缀
- H5 平台禁止对 `input` / `textarea` 设置 `box-sizing: border-box`
