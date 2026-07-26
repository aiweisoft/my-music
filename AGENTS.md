# AGENTS.md

> 本文件为在此仓库中工作的智能编码代理提供项目上下文与协作规范。

---

## 1. 项目概述

"科羽音乐"（科技羽翼 声动未来）是一个 **uni-app (Vue 3)** 跨平台本地音乐播放器应用。

| 配置项 | 值 |
|--------|-----|
| 框架 | uni-app / Vue 3 (Options API，不使用 `<script setup>`) |
| AppID | `__UNI__584E088` |
| 版本 | 1.0.0 |
| SCSS | `uni.scss` 提供全局变量，**无需手动 import** |
| 目标平台 | 5+App / H5 / 微信小程序 / 支付宝小程序 / 百度小程序 / 头条小程序 / 快应用 |

---

## 2. 项目结构

```
my-music/
├── pages/                    # 页面目录（每个页面一个文件夹）
│   ├── index/                # 播放页（主播放器 + 专辑封面动画 + 进度/音量控制）
│   └── playlist/             # 歌单管理页（多歌单切换 + 歌曲列表 + CRUD）
├── utils/                    # 共享工具模块（ES module 单例导出）
│   ├── audio-manager.js      #   音频引擎：InnerAudioContext 封装 + 歌单/歌曲/播放模式管理 + 事件总线
│   └── file-picker.js        #   跨平台文件选择器：5+App 用原生 Intent / 其他端用 uni.chooseFile
├── static/                   # 静态资源（不经过编译处理）
├── App.vue                   # 应用根组件（onLaunch / onShow / onHide）
├── main.js                   # 应用入口（createSSRApp，含 VUE2/VUE3 条件编译）
├── manifest.json             # 多平台应用配置（权限、图标、App SDK 等）
├── pages.json                # 页面路由、自定义导航栏、tabBar 配置
├── uni.scss                  # uni-app 内置 SCSS 变量（颜色、字体、间距、圆角等）
├── index.html                # SPA HTML 入口（H5 平台使用）
├── uni.promisify.adaptor.js  # Promise 适配器（兼容旧 API 回调风格）
├── .editorconfig             # 编辑器配置
└── .gitignore                # Git 忽略规则（unpackage/、.DS_Store、.hbuilderx/）
```

**新建页面约定：**
- 每个页面对应 `pages/页面名/页面名.vue` 的结构
- 新建页面后必须在 `pages.json` 的 `pages` 数组中注册路由
- 本项目使用 `navigationStyle: custom` 自定义导航栏，新页面需注意自行处理安全区域

---

## 3. 构建 / 运行 / 测试 / Lint 命令

### 运行项目

本项目依赖 HBuilderX CLI 运行：

```
# HBuilderX CLI 路径
hbuilderx_cli_path = D:\HBuilderX.5.01.2026021122-alpha\HBuilderX\cli.exe
```

- **H5 浏览器**：HBuilderX → 运行 → 运行到浏览器 → Chrome
- **微信小程序**：HBuilderX → 运行 → 运行到小程序模拟器 → 微信开发者工具
- **App**：HBuilderX → 运行 → 运行到手机或模拟器

### 编译打包

HBuilderX → 发行 → 原生 App-云打包 / 小程序-微信。输出目录 `unpackage/`（已 gitignore）。

### 测试

**尚无自动化测试。** 如需添加，使用技能 `write-or-run-testcase-for-uniapp-or-uniappx` 或手动创建测试目录。

### Lint

**未配置 Lint 工具。** `.editorconfig` 已定义：Tab 缩进、等效宽度 4、LF、UTF-8。

---

## 4. 代码风格与协作规则

### 4.1 Vue 单文件组件

- 使用 `<template>` → `<script>` → `<style>` 三段式结构（严格顺序）
- `<script>` 使用 `export default {}` Options API（与现有代码一致，**不使用 `<script setup>`**）
- `<style>` **不加 `scoped`**，页面样式写在各自 .vue 文件中

### 4.2 缩进与格式

- **Tab** 缩进，等效宽度 **4** 空格（遵循 `.editorconfig`）
- 换行符 **LF**，文件末尾保留一个空行，去除行尾空白
- 字符集 **UTF-8**

### 4.3 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 页面目录/文件 | 小写短横线，与目录同名 | `pages/my-page/my-page.vue` |
| 组件文件 | PascalCase | `MyComponent.vue` |
| JavaScript 变量/方法 | camelCase | `currentTime`、`handleClick()` |
| 私有方法 | 单下划线前缀 | `_saveToStorage()`、`_onStateChange()` |
| CSS 类名 | 小写短横线 | `.song-item`、`.volume-row` |
| uni-app API | 始终使用 `uni.` 前缀 | `uni.navigateTo()`、`uni.showToast()` |
| 事件处理方法 | `on` + 事件名 | `onProgressTap`、`onVolumeDrag` |

### 4.4 Imports

- 页面通过 `pages.json` 路由注册，**无需手动 import 页面**
- 组件通过 easycom 自动解析 `components/` 目录（无需手动注册）
- 工具模块从 `utils/` 通过相对路径引入：`import audioManager from '../../utils/audio-manager.js'`
- `uni.scss` 中的 SCSS 变量全局可用，无需在页面中 `@import`

### 4.5 条件编译

使用 `#ifdef` / `#ifndef` / `#endif` 预处理指令区分平台（常见标识：`VUE3`、`APP-PLUS`、`H5`、`MP-WEIXIN`、`MP-ALIPAY`、`MP-BAIDU`、`MP-TOUTIAO`）。

### 4.6 项目内代码约定

- **事件总线模式**：工具模块使用 `on(event, callback)` / `off(event, callback)` / `_emit(event, data)` 发布订阅。页面在 `onLoad` 中注册监听、`onUnload` 中移除，回调方法以 `_onXxx` 命名
- **本地持久化**：通过 `uni.getStorageSync()` / `uni.setStorageSync()` 直接读写，key 以 `music_` 前缀命名
- **DOM 查询**：使用 `uni.createSelectorQuery().in(this).select('.class').boundingClientRect(cb).exec()` 获取节点位置
- **选题配色**：深色主题——背景 `#010102`，主色 `#5e6ad2`，主文字 `#f7f8f8`，次文字 `#8a8f98`，边框 `#23252a`，卡片 `#0f1011`
- **尺寸单位**：优先使用 `rpx`（750rpx = 屏幕宽度）

### 4.7 错误处理

- 异步操作使用 `async/await` + `try/catch`
- 向用户展示错误使用 `uni.showToast()` / `uni.showModal()`
- 数据反序列化时使用 try/catch 包裹并回退到默认值（参见 `audio-manager.js` 中的 `_loadFromStorage`）
- 使用 H5 平台 `input` / `textarea` 时**禁止**设置 `box-sizing: border-box`

### 4.8 新增依赖 / 插件

- 通过 `uni_modules` 安装的插件放入 `uni_modules/` 目录（优先级高于 `components/`）
- 引入 npm 包需先在项目根目录 `npm init` 再 `npm install`
- 第三方组件优先查阅 [uni-app 插件市场](https://ext.dcloud.net.cn)

---

## 5. 相关技能

- **运行项目**：`launch-uniapp-or-uniappx`
- **查看运行日志**：`logcat-uniapp-or-uniappx`
- **修复控制台报错**：`fix-console-error-uniapp-or-uniappx`
- **查找匹配插件**：`find-matching-plugin`
- **使用 uni_modules 插件**：`how-to-use-uni-module`
- **编写/运行测试**：`write-or-run-testcase-for-uniapp-or-uniappx`
- **分包优化**：`optimize-subpackage`
- **uni-app 注意事项**：`uniappx-pitfalls-and-tips`
