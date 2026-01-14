# 知乎专栏转Markdown

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/tampermonkey-v4.0+-green.svg" alt="Tampermonkey">
  <img src="https://img.shields.io/badge/platform-Chrome%20%7C%20Firefox%20%7C%20Edge-lightgrey.svg" alt="Platform">
</p>

一键将知乎专栏文章转换为 Markdown 格式，完美支持 LaTeX 数学公式。

## ✨ 功能特性

- 🚀 **一键转换**：点击按钮即可将知乎文章转为 Markdown
- 📐 **完美公式支持**：自动识别行内公式和块级公式
- 📋 **自动复制**：转换后自动复制到剪贴板
- 🎨 **兼容 Typora**：自动将 `\bm` 替换为 `\boldsymbol`
- 📝 **元素支持**：标题、引用、列表、链接、图片、代码块等

## 📦 安装

### 1. 安装浏览器扩展

首先安装用户脚本管理器：

- Chrome/Edge: [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- Firefox: [Tampermonkey](https://addons.mozilla.org/firefox/addon/tampermonkey/) 或 [Greasemonkey](https://addons.mozilla.org/firefox/addon/greasemonkey/)
- Safari: [Userscripts](https://apps.apple.com/app/userscripts/id1463298887)

### 2. 安装脚本

点击下方链接安装脚本：

**[📥 点击安装脚本](https://raw.githubusercontent.com/RustyPiano/zhihu-to-markdown/main/zhihu_to_markdown.user.js)**

或者手动安装：
1. 打开 Tampermonkey 仪表盘
2. 点击「添加新脚本」
3. 复制 [`zhihu_to_markdown.user.js`](./zhihu_to_markdown.user.js) 的内容
4. 粘贴并保存

## 🎯 使用方法

1. 访问知乎专栏文章页面（如 `https://zhuanlan.zhihu.com/p/xxx`）
2. 页面右上角会出现 **「📋 转为Markdown」** 按钮
3. 点击按钮，文章将自动转换为 Markdown 并复制到剪贴板
4. 打开你喜欢的 Markdown 编辑器，粘贴即可

![使用演示](./demo.gif)

## 📐 公式转换规则

| 原始格式 | 转换结果 | 说明 |
|---------|---------|------|
| 不以 `\\` 结尾 | `$公式$` | 行内公式 |
| 以 `\\` 结尾 | `$$\n公式\n$$` | 块级公式 |
| `\bm{x}` | `\boldsymbol{x}` | Typora 兼容 |

## 🔧 支持的页面

- ✅ 知乎专栏文章 (`zhuanlan.zhihu.com/p/*`)
- ✅ 知乎问答回答 (`www.zhihu.com/question/*/answer/*`)

## 📄 示例

**转换前（知乎页面）：**

![知乎页面](./example_before.png)

**转换后（Markdown）：**

```markdown
# 文章标题

> 引用内容，包含公式 $\mu$ 

正文内容，这里有行内公式 $E=mc^2$，以及块级公式：

$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 📝 更新日志

### v1.0.0 (2026-01-14)
- 🎉 首次发布
- 支持知乎专栏和回答页面
- 完整的数学公式支持
- 自动复制到剪贴板

## 📜 许可证

本项目采用 [MIT 许可证](./LICENSE)。

## 🙏 致谢

- 感谢所有使用和反馈的用户
- 灵感来源于对知乎优质数学内容的整理需求
