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
│   ├── content-uri.js        #   Android content:// 解析与落地（真实路径优先，否则复制到应用私有目录）
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

## 5. 音频播放实现要点（重要，改播放逻辑前必读）

> 本节记录的是踩过的坑和已经验证有效的做法。音频播放是本项目最脆弱的部分，`utils/audio-manager.js` + `utils/content-uri.js` 的现有写法是被真机问题打磨出来的，改动前先读完这一节。

### 5.1 播放引擎生命周期

- 全局只有一个 `AudioManager` 单例（`export default new AudioManager()`），页面**只能通过它**控制播放，不允许自己 `uni.createInnerAudioContext()`。
- **每首歌都重建一次 `InnerAudioContext`**（`play()` → `_createContext()`）。这是刻意的：官方文档明确提示「多次播放新文件时提前销毁实例可避免 -99 错误」。**不要为了性能改成复用 context 只换 `src`**，会引回 -99。
- 销毁顺序固定为 `destroy()`；`release()` 里先 `stop()` 再 `destroy()`，并把 `isPlaying / currentTime / duration / buffered` 一并归零后 `_emit('stateChange')`。
- 后台播放依赖 `this._ctx.sessionCategory = 'playback'`（默认值也是 playback，但显式写死不依赖默认行为）。iOS 端已在 `manifest.json` 的 `app-plus.distribute.ios` 配置 `"UIBackgroundModes": ["audio"]`。
- 音量从 `music_volume` 读取并夹在 0~1（目前没有音量 UI，只有读取逻辑，不要凭空加滑杆而不写回存储）。
- **格式支持**：Android 支持 flac / ogg / ape / wma / mp3 / m4a / wav / aac；iOS 不支持 flac / ogg / ape / wma。若要换成 `uni.getBackgroundAudioManager()`（官方原生的后台播放 + 通知栏），注意它只支持 m4a / aac / mp3 / wav，flac 用户的歌会直接播不了，切换前必须评估。

### 5.2 事件总线契约

`audioManager.on(event, cb)` / `off(event, cb)` / `_emit(event, data)`，页面在 `onLoad` 注册、`onUnload` 移除。

| 事件 | 触发时机 | 页面典型响应 |
|------|----------|--------------|
| `stateChange` | play / pause / stop / release | 更新 `isPlaying` |
| `playlistChange` | 歌单增删改、加歌、清空 | 刷新歌单列表与当前页信息 |
| `trackChange` | 切歌（`play()` 内） | 更新标题/歌手/专辑/封面渐变 |
| `ready` | `onCanplay` | 回填 `duration` |
| `timeUpdate` | `onTimeUpdate`（约 250ms） | 更新进度、缓冲、时间 |
| `error` | `onError` | 目前仅内部处理，页面未订阅 |
| `seeked` | `onSeeked` | 预留 |
| `modeChange` | 切换播放模式 | 预留（播放页直接取 `playMode`） |

页面**不要用 `setInterval` 轮询进度**，订阅 `timeUpdate` 即可（旧的 250ms 定时器已移除）。

### 5.3 Android content:// 是最大的坑

所有 content:// 相关逻辑集中在 `utils/content-uri.js`，`file-picker.js` 和 `audio-manager.js` 都调用它，**禁止再复制一份实现**（历史上重复了两份近 100 行，改一处漏一处）。

#### 数据模型：song 必须同时存 `uri` 和 `path`

```js
{
  id, title, artist, album, duration, size,
  uri:   'content://...',                                // 原始 URI，用于重新复制
  path:  '.../Android/data/<包名>/files/audio/xxx.mp3',   // 应用私有副本，长期可用
  broken: false                                          // 运行时标记：副本丢失
}
```

**铁律：导入时一律把 content:// 复制到应用私有目录，`path` 永远指向副本，绝不长期引用原路径。**

曾经的做法是「原路径能读就直接用」，结果真机出现：**添加后当场能播，彻底退出进程再进来全部播放失败**。原因是原路径的可读性依赖 SAF 的临时授权（进程级），进程一死授权就没了，而存下来的路径仍被当成有效路径直接交给播放器。现在的策略把这条依赖彻底去掉。

**也不允许把副本路径写回 `song.uri`**，`uri` 必须保留原始 content://，否则副本丢失后无法恢复。

#### `ensureLocalCopy(uriStr)`：导入/播放时统一用它

1. 普通本地路径 → 存在就原样返回，不复制；
2. content:// → `copyToAppDir()` 复制到应用私有目录，已复制过则直接复用（按 URI 哈希命名）；
3. 返回 `null` 表示拿不到可播文件，调用方必须按「文件失效」处理，**不能继续把无效路径交给播放器**。

`resolveContentUriPath()` 仍保留，但只用于「读元数据」这类一次性场景，**不能再作为长期播放路径**。

#### 复制目录与命名

- 目标目录：`context.getExternalFilesDir(null)/audio`，失败回退 `context.getFilesDir()`。
- **绝对不要用 `getCacheDir()`**：系统随时清理，歌单会一夜之间全变「播放失败」。
- 文件名：`hashString(uriStr) + '_' + 清洗后的原名 + '.' + 扩展名`，扩展名从 `_display_name` 取，取不到按 mime 映射。
- **绝对不要直接拿 `_display_name` 当文件名**：不同目录下同名的 `01.mp3` 会命中同一份缓存，播放时放的是别人的歌。
- 同一 URI 重复调用只会复制一次（同名同哈希直接复用）。
- 删除歌曲/清空歌单时通过 `_releaseSongFile()` 清理副本（其它歌单仍引用则保留），避免副本堆积。

> 代价：导入后文件会存两份（原文件 + 应用副本），存储占用翻倍。这是用空间换「重启后一定能播」的确定性，改策略前先确认能接受。

#### URI 形态与解析规则

| URI 形态 | 解析方式 |
|----------|----------|
| `com.android.externalstorage.documents/document/primary:Music/a.mp3` | 拼 `/storage/emulated/0/Music/a.mp3`；非 primary 拼 `/storage/<volume>/...` |
| `com.android.providers.media.documents/document/audio:123` | 查 MediaStore `_data`，再退 `relative_path + _display_name` |
| `com.android.providers.downloads.documents/document/123` | 查 `content://downloads/public_downloads` 的 `_data` |

#### 复制实现的三级降级（不要简化成一种）

1. `resolver.openInputStream(uri).transferTo(fos)`（最快，Android 10+）；
2. 失败 → `openFileDescriptor` + `FileChannel.transferTo`（兼容 CloudProvider / 部分 ROM）；
3. 再失败 → `BufferedInputStream` 逐字节 `read/write`（最慢但最保险）。

复制完成后必须校验 `File.length() > 0`，为 0 就删掉并返回 `null`，否则会得到一个「能播但没声音」的幽灵文件。

#### 持久化授权

选择文件时用 `Intent.ACTION_OPEN_DOCUMENT` + `FLAG_GRANT_READ_URI_PERMISSION` + `FLAG_GRANT_PERSISTABLE_URI_PERMISSION`，拿到结果后立刻 `takePersistableUriPermission()`（失败不致命，忽略即可）。不要用 `ACTION_GET_CONTENT`，它不保证持久授权。

### 5.4 文件选择器（file-picker.js）

- 入口 `pickAudioFiles(callback, errorCallback)`：App 走原生 Intent，其他端走 `uni.chooseFile`。
- 原生回调通过临时替换 `activity.onActivityResult` 实现，因此：
  - 必须保存并恢复 `_oldOnActivityResult`；
  - **请求码不匹配时必须把回调交还给旧处理器**，不能直接 return（否则会吞掉别的插件/Activity 的结果）；
  - 用 `_isPicking` 防止重复打开；
  - 任何分支都要走 `finishPicking()` 清理全局回调，避免回调跨页面串台。
- 元数据读取用 `MediaMetadataRetriever`，三级 fallback：真实路径 → `setDataSource(context, uri)` → `openAssetFileDescriptor` → `uriStr`。读不到就回退文件名当标题，**不允许因为标签缺失而丢歌**。
- 新增的歌曲统一带 `uri` 字段；`addSongsAt()` 以 `path` 或 `uri` 去重。

### 5.5 歌单与持久化

| Storage key | 内容 |
|-------------|------|
| `music_playlists` | 歌单数组 `[{ id, name, songs: [], currentIndex }]` |
| `music_active_playlist` | 当前激活歌单下标 |
| `music_play_mode` | 播放模式（0 列表循环 / 1 单曲循环 / 2 随机） |
| `music_volume` | 音量 0~1（当前无 UI 写入口） |

- 读存储必须 try/catch 并回退到 `[默认歌单]`（见 `_loadFromStorage`）。
- 所有写操作走 `_saveToStorage()`（内部一次性写三个 key），不要在别处零散 `setStorageSync`。

#### 公开 API 清单（页面只准用这些）

| API | 说明 |
|-----|------|
| `createPlaylist / renamePlaylist / deletePlaylist / setActivePlaylist` | 歌单 CRUD（至少保留一个歌单） |
| `addSongs(files) / addSongsAt(index, files)` | 加歌，返回实际新增数量（自动去重） |
| `removeSong(index) / removeSongAt(plIndex, songIndex)` | 删歌，自动修正 `currentIndex`，并清理无引用的副本 |
| `clearCurrent() / clearPlaylistAt(index)` | 清空歌单（同时清理副本） |
| `validateSongs()` | 启动时校验副本是否还在，标记 `song.broken`，返回失效数量 |
| `play(index) / pause() / toggle() / stop() / next() / prev() / seek(sec)` | 播放控制 |
| `switchPlayMode()` | 0→1→2 循环，并持久化 |
| `release()` | 停止并销毁播放器（「清理缓存」按钮用） |
| `getCurrentSong() / getProgress()` | 只读查询 |

**禁止**页面直接 `audioManager.playlists[i].songs.splice(...)` 或调用 `_saveToStorage()` / `_emit()`。

### 5.6 播放模式与切歌语义

`_next(auto)` 的 `auto` 参数是语义开关，不是冗余参数：

- `onEnded` → `_next(true)`：单曲循环**重播当前曲**，其余模式正常前进/随机；
- `next()` → `_next(false)`：用户主动点下一首，**任何模式下都要切歌**（单曲循环也一样）。

历史 bug：早期 `next()` 里写了 `case 1: break` 再 `play()`，导致单曲循环下「下一首」按钮点了没反应。改这块时别再把两种语义混成一个 `switch`。

`prev()` 保留常见播放器习惯：`currentTime > 3` 秒时先回到本曲开头，否则切上一首。

### 5.7 错误处理与自愈

播放失败的既定策略（**不要在别处再写一套**）：

1. `play()` 前置校验：`_ensurePlayable()` 拿不到路径 → 标记 `song.broken`，计入连续失败并 `_next()` 跳过；**绝不把无效路径交给播放器**；
2. 跳完整个歌单仍无可播文件 → 停播 + **只弹一次** toast「歌曲文件已失效，请清空后重新导入」，避免每次点播放都循环提示；
3. `onError` 里先尝试自愈：若 `song.path` 是应用私有副本，删掉它并按原始 `uri` 重新复制一次再播（每首歌每次运行只重试一次，见 `_repairedIds`）；
4. 自愈无效再按「歌单只有 1 首 / 单曲循环 → 不跳，否则 300ms 后 `_next()`」处理；
5. `_consecutiveErrors` 累计到歌单长度就停止并提示，`onPlay` 时清零；
6. 日志必须同时打出 `uri` 和 `path`，否则无法判断是「路径错」还是「文件坏」。

歌单页会把 `song.broken` 显示为「文件已失效，请重新导入」。

### 5.8 进度条交互细节

- 拖拽用 `_dragPercent` 暂存比例，`touchend` 才真正 `seek()`，避免拖动过程中每一帧都 seek；
- `timeUpdate` 回调里若 `_dragPercent !== undefined` 必须直接 return，否则手指还按着就跳回播放位置；
- seek 前要求 `duration > 0`，否则 `innerAudioContext.seek()` 无效；
- 时间格式由页面 `formatTime()` 处理，`Infinity / NaN` 必须兜底成 `0:00`。

### 5.9 调试与验证方法

```bash
# H5 编译（验证模板 + 非 App 条件编译分支）
"D:\HBuilderX.5.01.2026021122-alpha\HBuilderX\cli.exe" publish web --project <项目绝对路径>

# App 资源包编译（验证 APP-PLUS 分支，不用真机也能过一遍编译）
"D:\HBuilderX.5.01.2026021122-alpha\HBuilderX\cli.exe" publish app --type appResource --project <项目绝对路径>
```

- 两次都要跑：只跑 H5 会漏掉 `#ifdef APP-PLUS` 分支里的语法错误，只跑 App 会漏掉普通分支。
- 日志关键字：`[content-uri]`（URI 解析/复制）、`[play]`（播放路径决策）、`音频播放错误`（含路径）。
- 真机排查顺序：确认 `song.uri` 是否存在 → 看 `[content-uri]` 是否走了 copy → 检查应用私有目录 `Android/data/<包名>/files/audio` 下有没有文件、大小是否正常 → 再看 `getExternalFilesDir` 是否被 ROM 限制。
- **打包限制**：`static/` 及项目内任何文件名不能含中文或全角字符，否则 App 导出直接失败（`科羽音乐_Logo标志.png` 曾导致打包失败，已改名为 `keyu-logo.png`）。

### 5.10 改音频代码前的检查清单

- [ ] 是否只通过 `audioManager` 的公开 API 操作？
- [ ] 新字段是否同时兼容老数据（缺 `uri` 的老歌不能崩）？
- [ ] 有没有把临时路径写回 `song.uri` 或长期保存？
- [ ] 新导入的歌曲 `path` 是否指向应用私有副本（而不是原始共享路径）？
- [ ] 拿到 `null` 路径时是否按「文件失效」处理，而不是硬播？
- [ ] 有没有重复实现 content:// 解析（应调用 `content-uri.js`）？
- [ ] `_next` 的 `auto` 语义是否保持（自动 vs 手动）？
- [ ] 新增事件是否在 `_removeListeners()` 里配套 `off`？
- [ ] H5 与 App 两种条件编译都编译过？
- [ ] 清缓存/杀进程/锁屏三种场景有没有考虑？

---

## 6. 相关技能

- **运行项目**：`launch-uniapp-or-uniappx`
- **查看运行日志**：`logcat-uniapp-or-uniappx`
- **修复控制台报错**：`fix-console-error-uniapp-or-uniappx`
- **查找匹配插件**：`find-matching-plugin`
- **使用 uni_modules 插件**：`how-to-use-uni-module`
- **编写/运行测试**：`write-or-run-testcase-for-uniapp-or-uniappx`
- **分包优化**：`optimize-subpackage`
- **uni-app 注意事项**：`uniappx-pitfalls-and-tips`
