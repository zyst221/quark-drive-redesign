# 界面重设计版（非官方）

本目录是 [xingzhe11011/quark-drive](https://github.com/xingzhe11011/quark-drive)（MIT）的本地修改版：
保留其 Rust 后端（登录、文件、传输、回收站、隐私空间），把 React 前端按新的设计稿重做。

## 这版改了什么

- 全新应用壳：浅蓝/白色主界面，官方夸克图标，KDE 原生窗口装饰（圆角、阴影跟随系统）。
- 文件页：面包屑 + 搜索 + 视图切换、工具栏、可排序列表/网格、悬停操作、多选操作条、状态栏。
- 传输中心改为右侧滑出面板：上传/下载分页、进度、速度、暂停/继续/失败重试/取消/移除、清空已完成。
- 扫码登录页重做；Cookie 导入保留。
- 深色模式使用独立色板；跟随系统、浅色、深色三态可从顶栏切换并持久化。
- 支持把文件或文件夹拖进窗口上传（Tauri 拖放事件 → 现有上传队列）。
- 系统托盘：关闭窗口隐藏到托盘、后台继续传输；托盘菜单可显示主窗口、打开传输中心、退出；再次启动会聚焦已有窗口（单实例）。
- 图标替换为官方夸克网盘图标（App Store 官方素材，已做透明圆角处理）。
- 设置页补充 MIT 许可与来源说明。

未做的事：分享链接、按“视频/图片/文档/音频”全盘分类——上游后端没有对应接口，避免做成假功能。

## 构建

系统依赖（Ubuntu / KDE neon 24.04，需要 sudo）：

```bash
sudo apt install -y libwebkit2gtk-4.1-dev libayatana-appindicator3-dev libxdo-dev
```

前端依赖与构建：

```bash
cd apps/desktop
npm ci
npm run build
```

打包 `.deb`（Tauri 会把 Rust 后端也编译进去，首次约 5–15 分钟）：

```bash
cd apps/desktop
npx tauri build --bundles deb
```

产物在仓库根目录的 `target/release/bundle/deb/`。

也可以直接运行 `./build-deb.sh`。

## 开发预览

浏览器演示模式（不需要登录、不需要 WebKitGTK）：

```bash
cd apps/desktop
npm run dev
# 打开 http://localhost:1420，点击“浏览器预览：进入演示界面”
```

## 许可与免责

上游代码为 MIT 许可，见 `LICENSE`。本项目为非官方第三方客户端，与夸克官方无关；
接口来自夸克网页端，可能随时失效，请只操作自己的账号数据。
