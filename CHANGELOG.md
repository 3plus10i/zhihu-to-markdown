# Changelog

## [1.1.0] — 2026-06-24

### UI 重构
- **按钮样式对齐知乎桌面端设计**：主色 `#1772f6`，hover `#0063e4`，圆角 `3px`，行高 `32px`（参照 `dev/button1` / `dev/button2`）
- **按钮内容**：`[复制SVG图标] Markdown` 横向排列
- **Hover Tooltip**：鼠标悬停显示提示文案，专栏页为"复制文章为markdown格式"，回答页为"复制回答为markdown格式"（参照 `dev/tooltip`）
- **通知简化**：去除独立 toast 元素，点击后按钮文案和颜色临时切换为"已复制"(绿色)，3秒恢复
- **模态框精简**：降级方案仅保留最简 overlay + textarea
- **关闭按钮**：按钮右侧增加 `✕` 关闭按钮，hover 时淡入，点击后隐藏整个按钮组（刷新恢复）
- **底部定位**：按钮组移至页面底部（`bottom: 80px`），避开右上角 popover 菜单区域

### 输出内容增强
- **原文链接**：输出首部加入当前页面 URL
- **作者信息**：提取作者名和个人主页链接，追加到标题之后
- **发布时间**：提取发布时间/编辑时间文本（回答页及专栏页均支持）

### 解析修复
- **重复图片**：跳过 `<noscript>` 元素，避免其内原始 HTML 文本被当作内容输出，导致图片重复
- **图片懒加载**：`src` 优先级改为 `data-original` > `data-actualsrc` > `data-src` > `src`，避免取得 `data:image/svg+xml` 占位符
- **硬换行保留**：`normalizeWhitespace` 改为仅裁行首空白，保留行末双空格（markdown 硬换行标记），使题注紧贴图片显示
- **关键词实体链接**：过滤 `RichContent-EntityWord` class 及 `zhihu.com/search` 链接，仅保留文本
