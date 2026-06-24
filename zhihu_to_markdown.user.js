// ==UserScript==
// @name         知乎专栏转Markdown
// @name:en      Zhihu to Markdown
// @namespace    https://github.com/RustyPiano/zhihu-to-markdown
// @version      1.1.0
// @description  一键将知乎专栏文章转换为Markdown格式，完美支持LaTeX数学公式
// @description:en  Convert Zhihu articles to Markdown with one click, with full LaTeX math support
// @author       RustyPiano
// @license      MIT
// @homepage     https://github.com/RustyPiano/zhihu-to-markdown
// @supportURL   https://github.com/RustyPiano/zhihu-to-markdown/issues
// @match        https://zhuanlan.zhihu.com/p/*
// @match        https://www.zhihu.com/question/*/answer/*
// @icon         https://static.zhihu.com/heifetz/favicon.ico
// @grant        GM_setClipboard
// @grant        GM_notification
// @run-at       document-idle
// ==/UserScript==

/**
 * 知乎专栏转Markdown
 * 
 * 功能特性：
 * - 一键转换知乎专栏文章为Markdown格式
 * - 自动识别行内公式和块级公式（以\\结尾的为块级公式）
 * - 自动替换 \bm 为 \boldsymbol（兼容Typora等编辑器）
 * - 支持标题、引用、列表、链接、图片等常见元素
 * - 转换后自动复制到剪贴板
 * 
 * 使用方法：
 * 1. 安装 Tampermonkey 或 Greasemonkey 浏览器扩展
 * 2. 安装本脚本
 * 3. 访问知乎专栏文章页面
 * 4. 点击页面右侧的「Markdown」悬浮按钮
 * 5. Markdown内容将自动复制到剪贴板
 */

(function () {
    'use strict';

    // ==================== 知乎设计风格 ====================
    const ZH = {
        blue: '#1772f6',
        blueHover: '#0063e4',
        white: '#fff',
        grayBorder: '#ebedf0',
        fontFamily: '-apple-system,BlinkMacSystemFont,"Helvetica Neue","PingFang SC","Microsoft YaHei","Source Han Sans SC","Noto Sans CJK SC","WenQuanYi Micro Hei","MiSans L3","Segoe UI",sans-serif',
    };

    // ==================== 配置 ====================
    const CONFIG = {
        buttonBottom: '80px',
        buttonRight: '35px',
        toastDuration: 3000,
        // 设为 true 强制走降级模态框（测试用）
        debugModal: false,
    };

    // ==================== 核心解析逻辑 ====================

    /**
     * 解析HTML元素为Markdown文本
     * @param {Node} element - 要解析的DOM节点
     * @returns {string} Markdown文本
     */
    function parseElement(element) {
        // 文本节点
        if (element.nodeType === Node.TEXT_NODE) {
            return element.textContent.replace(/\s+/g, ' ');
        }

        // 非元素节点跳过
        if (element.nodeType !== Node.ELEMENT_NODE) {
            return '';
        }

        const tagName = element.tagName.toLowerCase();

        // 数学公式 <span class="ztext-math">
        if (tagName === 'span' && element.classList.contains('ztext-math')) {
            return parseMathFormula(element);
        }

        // 链接 <a>
        if (tagName === 'a') {
            return parseLink(element);
        }

        // 换行 <br>
        if (tagName === 'br') {
            return '\n';
        }

        // 粗体
        if (tagName === 'strong' || tagName === 'b') {
            const text = parseChildren(element).trim();
            return text ? `**${text}**` : '';
        }

        // 斜体
        if (tagName === 'em' || tagName === 'i') {
            const text = parseChildren(element).trim();
            return text ? `*${text}*` : '';
        }

        // 行内代码
        if (tagName === 'code') {
            return `\`${element.textContent}\``;
        }

        // 代码块
        if (tagName === 'pre') {
            const code = element.querySelector('code');
            const language = code?.className.match(/language-(\w+)/)?.[1] || '';
            const content = code?.textContent || element.textContent;
            return `\n\n\`\`\`${language}\n${content}\n\`\`\`\n\n`;
        }

        // 段落
        if (tagName === 'p') {
            if (element.classList.contains('ztext-empty-paragraph')) {
                return '\n\n';
            }
            const content = parseChildren(element).trim();
            return content ? `\n\n${content}\n\n` : '';
        }

        // 引用块
        if (tagName === 'blockquote') {
            return parseBlockquote(element);
        }

        // 标题 h1-h6
        if (/^h[1-6]$/.test(tagName)) {
            const level = parseInt(tagName[1]);
            const content = parseChildren(element).trim();
            return `\n\n${'#'.repeat(level)} ${content}\n\n`;
        }

        // 列表
        if (tagName === 'ul' || tagName === 'ol') {
            return parseList(element, tagName);
        }

        // 图片
        if (tagName === 'img') {
            return parseImage(element);
        }

        // figure（通常包含图片）
        if (tagName === 'figure') {
            const content = parseChildren(element).trim();
            return `\n\n${content}\n\n`;
        }

        // 图片说明
        if (tagName === 'figcaption') {
            const content = parseChildren(element).trim();
            return content ? `\n*${content}*\n` : '';
        }

        // 知乎搜索实体链接
        if (tagName === 'span' && element.hasAttribute('data-search-entity')) {
            return element.textContent;
        }

        // <noscript> — JS环境下子节点为原始文本，直接跳过
        if (tagName === 'noscript') {
            return '';
        }

        // 分隔线
        if (tagName === 'hr') {
            return '\n\n---\n\n';
        }

        // 默认：递归解析子元素
        return parseChildren(element);
    }

    /**
     * 解析子元素
     */
    function parseChildren(element) {
        return Array.from(element.childNodes).map(parseElement).join('');
    }

    /**
     * 解析数学公式
     */
    function parseMathFormula(element) {
        let tex = element.getAttribute('data-tex') || '';

        // 替换 \bm 为 \boldsymbol（Typora等编辑器兼容）
        tex = tex.replace(/\\bm\b/g, '\\boldsymbol');

        // 判断是否为块级公式：以 \\ 结尾
        const isBlock = tex.trim().endsWith('\\\\');

        if (isBlock) {
            // 块级公式：去掉末尾的 \\
            tex = tex.trim().replace(/\\\\$/, '').trim();
            return `\n\n$$\n${tex}\n$$\n\n`;
        } else {
            // 行内公式
            return `$${tex}$`;
        }
    }

    /**
     * 解析链接
     */
    function parseLink(element) {
        const href = element.getAttribute('href') || '';
        const text = parseChildren(element).trim();

        // 知乎关键词实体链接(知乎直答，内部搜索) → 仅保留文本
        if (element.classList.contains('RichContent-EntityWord')
            || href.includes('zhida.zhihu.com/search')
            || href.includes('www.zhihu.com/search')) {
            return text;
        }

        if (href && text) {
            return `[${text}](${href})`;
        }
        return text;
    }

    /**
     * 解析引用块
     */
    function parseBlockquote(element) {
        const content = parseChildren(element).trim();
        const lines = content.split('\n').filter(line => line.trim());
        const quoted = lines.map(line => `> ${line.trim()}`).join('\n');
        return `\n\n${quoted}\n\n`;
    }

    /**
     * 解析列表
     */
    function parseList(element, tagName) {
        const items = Array.from(element.querySelectorAll(':scope > li')).map((li, i) => {
            const content = parseChildren(li).trim();
            return tagName === 'ul' ? `- ${content}` : `${i + 1}. ${content}`;
        });
        return `\n\n${items.join('\n')}\n\n`;
    }

    /**
     * 解析图片
     */
    function parseImage(element) {
        // 这里的优先级必须后置src属性，否则会错误抓到懒加载占位符
        const src = element.getAttribute('data-original') ||
            element.getAttribute('data-actualsrc') ||
            element.getAttribute('data-src') ||
            element.getAttribute('src') || '';
        const alt = element.getAttribute('alt') || '';
        return src ? `![${alt}](${src})  ` : '';
    }

    // ==================== 工具函数 ====================

    /**
     * 规范化空白字符
     */
    function normalizeWhitespace(text) {
        let lines = text.split('\n').map(line => line.replace(/^[ \t]+/, ''));  // 保留行末的双空格 markdown 硬换行标记
        text = lines.join('\n');
        text = text.replace(/\n{3,}/g, '\n\n');
        return text.trim();
    }

    /**
     * 获取文章标题
     */
    function getTitle() {
        const selectors = [
            'h1.Post-Title',
            '.QuestionHeader-title',
            'h1[data-zop]',
            'title'
        ];

        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el) {
                let title = el.textContent.trim();
                title = title.replace(/\s*-\s*知乎$/, '');
                return title;
            }
        }
        return '';
    }

    /**
     * 获取作者名和个人主页链接
     */
    function getAuthorInfo() {
        const nameEl = document.querySelector('.AuthorInfo-head .UserLink-link');
        if (!nameEl || !nameEl.textContent.trim()) return { name: '', url: '' };
        const name = nameEl.textContent.trim();
        let url = nameEl.getAttribute('href') || '';
        if (url.startsWith('//')) url = 'https:' + url;
        return { name, url };
    }

    /**
     * 获取发布时间 / 编辑时间文本
     */
    function getTimeInfo() {
        const el = document.querySelector('.ContentItem-time.full')  // 回答页
                || document.querySelector('.ContentItem-time[role="button"]')  // 专栏页
                || document.querySelector('.ContentItem-time');
        return el ? el.textContent.trim().replace(/\s+/g, ' ') : '';
    }

    /**
     * 转换为Markdown
     */
    function convertToMarkdown() {
        // 查找文章内容区域
        const contentSelectors = [
            '.RichText.ztext.Post-RichText',
            '.RichText.ztext.css-1g0fqss',
            '.RichText.ztext',
            '.Post-RichTextContainer .RichText'
        ];

        let contentDiv = null;
        for (const selector of contentSelectors) {
            contentDiv = document.querySelector(selector);
            if (contentDiv) break;
        }

        if (!contentDiv) {
            alert('未找到文章内容区域\n\n请确保当前页面是知乎专栏文章或回答页面。');
            return null;
        }

        // 解析正文
        let body = parseChildren(contentDiv);
        body = normalizeWhitespace(body);

        // 构建头部：标题 + 作者 + 时间
        let header = '';
        const title = getTitle();
        if (title) header += `# ${title}\n\n`;

        const { name, url } = getAuthorInfo();
        const timeStr = getTimeInfo();
        const pageUrl = location.href;
        if (pageUrl) header += `原文：${pageUrl}  \n`;  // 双空格是必须的
        if (name && url) header += `作者：[${name}](${url})  \n`;
        if (timeStr) header += `${timeStr}\n`;
        if (header && !header.endsWith('\n\n')) header += '  \n';

        return header + body;
    }

    // ==================== UI 组件 ====================

    /**
     * 注入 tooltip 箭头样式
     */
    function injectTooltipStyle() {
        if (document.getElementById('zhihu-md-style')) return;
        const style = document.createElement('style');
        style.id = 'zhihu-md-style';
        style.textContent = `
            #zhihu-md-wrapper {
                position:fixed;bottom:${CONFIG.buttonBottom};right:${CONFIG.buttonRight};
                z-index:9999;display:flex;align-items:center;gap:4px;
                font-family:${ZH.fontFamily};
            }
            #zhihu-to-markdown-btn {
                padding:4px 4px;
                background:${ZH.blue};color:${ZH.white};
                border:1px solid ${ZH.blue};border-radius:3px;
                cursor:pointer;font-size:16px;font-weight:400;
                font-family:inherit;
                box-shadow:0 2px 8px rgba(0,0,0,.12);outline:none;
                transition:background-color .2s ease,border-color .2s ease,box-shadow .2s ease;
            }
            #zhihu-to-markdown-btn:hover {
                background:${ZH.blueHover};border-color:${ZH.blueHover};
                box-shadow:0 4px 12px rgba(23,114,246,.25);
            }
            .zhihu-md-tooltip {
                position:fixed;z-index:10000;
                background:rgba(25,27,31,.8);color:#fff;
                border-radius:4px;font-size:13px;
                padding:6px 8px;white-space:nowrap;
                font-family:${ZH.fontFamily};
                opacity:0;visibility:hidden;
                transition:opacity .15s ease,visibility .15s ease;
                pointer-events:none;
            }
            .zhihu-md-tooltip-arrow {
                position:absolute;bottom:0;left:50%;
                width:16px;height:8px;
                transform:translate(-50%,100%);
                overflow:hidden;
            }
            .zhihu-md-tooltip-arrow::after {
                content:'';display:block;
                width:8px;height:8px;
                background:rgba(25,27,31,.8);
                transform:rotate(45deg);
                margin:-4px auto 0;
            }
            #zhihu-md-close-btn {
                width:20px;height:20px;
                border-radius:50%;border:none;
                background:rgba(0,0,0,.06);color:#646566;
                cursor:pointer;font-size:13px;line-height:20px;
                text-align:center;padding:0;outline:none;
                font-family:inherit;flex-shrink:0;
                display:flex;align-items:center;justify-content:center;
                opacity:0;transition:opacity .15s ease;
            }
            #zhihu-md-wrapper:hover #zhihu-md-close-btn {
                opacity:1;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 悬浮按钮 —— 复制 icon + 文字，hover 显示 tooltip
     */
    function createButton() {
        injectTooltipStyle();

        const wrapper = document.createElement('div');
        wrapper.id = 'zhihu-md-wrapper';

        const btn = document.createElement('button');
        btn.id = 'zhihu-to-markdown-btn';
        btn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7.024 3.75c0-.966.784-1.75 1.75-1.75h10.477c.966 0 1.75.783 1.75 1.75v11.498a1.75 1.75 0 0 1-1.75 1.75H8.774a1.75 1.75 0 0 1-1.75-1.75V3.75Zm1.75-.25a.25.25 0 0 0-.25.25v11.498c0 .139.112.25.25.25h10.477a.25.25 0 0 0 .25-.25V3.75a.25.25 0 0 0-.25-.25H8.774Z"/><path d="M5.5 7.5H3.75a.25.25 0 0 0-.25.25v11.498c0 .139.112.25.25.25h10.008a.25.25 0 0 0 .25-.25V17.5h1.5v1.998a1.75 1.75 0 0 1-1.75 1.75H3.75A1.75 1.75 0 0 1 2 19.498V7.75C2 6.784 2.784 6 3.75 6H5.5v1.5Z"/></svg>
            <span class="zhihu-md-btn-text">Markdown</span>
        </span>`;

        const closeBtn = document.createElement('button');
        closeBtn.id = 'zhihu-md-close-btn';
        closeBtn.innerHTML = '&#x2715;';
        closeBtn.title = '隐藏此按钮';

        const tooltip = document.createElement('div');
        tooltip.className = 'zhihu-md-tooltip';
        const isPost = location.hostname === 'zhuanlan.zhihu.com';
        tooltip.innerHTML = `<div class="zhihu-md-tooltip-arrow"></div>${isPost ? '复制文章为markdown格式' : '复制回答为markdown格式'}`;
        document.body.appendChild(tooltip);

        // tooltip 基于 wrapper 定位
        wrapper.addEventListener('mouseenter', () => {
            const r = wrapper.getBoundingClientRect();
            tooltip.style.left = `${r.left + r.width / 2}px`;
            tooltip.style.top = `${r.top - 8}px`;
            tooltip.style.transform = 'translate(-50%, -100%)';
            tooltip.style.opacity = '1';
            tooltip.style.visibility = 'visible';
        });
        wrapper.addEventListener('mouseleave', () => {
            tooltip.style.opacity = '0';
            tooltip.style.visibility = 'hidden';
        });

        closeBtn.addEventListener('click', () => {
            wrapper.style.display = 'none';
            tooltip.style.display = 'none';
        });

        btn.addEventListener('click', handleConvert);

        wrapper.appendChild(closeBtn);
        wrapper.appendChild(btn);
        document.body.appendChild(wrapper);

        return { btn, wrapper, tooltip };
    }

    let btnEl = null;
    let tooltipEl = null;

    /**
     * 按钮文案临时切换（复用按钮元素）
     */
    function showToast(text, ok) {
        if (!btnEl) return;
        const span = btnEl.querySelector('.zhihu-md-btn-text');
        if (!span) return;
        const orig = span.textContent;
        span.textContent = text;
        btnEl.style.background = ok ? '#00c853' : '#f44336';
        btnEl.style.borderColor = ok ? '#00c853' : '#f44336';
        setTimeout(() => {
            span.textContent = orig;
            btnEl.style.background = ZH.blue;
            btnEl.style.borderColor = ZH.blue;
        }, CONFIG.toastDuration);
    }

    /**
     * 处理转换
     */
    function handleConvert() {
        const markdown = convertToMarkdown();
        if (!markdown) return;
        copyToClipboard(markdown);
    }

    /**
     * 复制到剪贴板
     */
    function copyToClipboard(text) {
        if (CONFIG.debugModal) { showModal(text); return; }
        const done = () => showToast('已复制', true);

        if (typeof GM_setClipboard !== 'undefined') {
            GM_setClipboard(text, 'text');
            done();
            return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(() => showModal(text));
            return;
        }
        showModal(text);
    }

    /**
     * 最简模态框（降级方案，几乎不会触发）
     */
    function showModal(content) {
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed', inset: '0', zIndex: '10000',
            background: 'rgba(0,0,0,.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        });

        const card = document.createElement('div');
        Object.assign(card.style, {
            background: '#fff', borderRadius: '8px', padding: '24px',
            maxWidth: '640px', width: '90%',
            boxShadow: '0 8px 24px rgba(0,0,0,.15)',
            fontFamily: ZH.fontFamily,
        });

        card.innerHTML = `<div style="font-size:16px;font-weight:600;color:#323232;margin-bottom:16px;">自动复制失败，请手动全选并复制</div>`;

        const textarea = document.createElement('textarea');
        textarea.readOnly = true;
        textarea.value = content;
        Object.assign(textarea.style, {
            width: '100%', height: '400px', padding: '12px',
            fontSize: '13px', lineHeight: '1.6',
            fontFamily: 'Monaco,Menlo,Consolas,monospace',
            border: `1px solid ${ZH.grayBorder}`,
            borderRadius: '4px', resize: 'none', outline: 'none',
            boxSizing: 'border-box',
        });

        card.appendChild(textarea);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        setTimeout(() => textarea.select(), 0);
    }

    // ==================== 初始化 ====================

    function init() {
        if (document.getElementById('zhihu-md-wrapper')) return;
        const objs = createButton();
        btnEl = objs.btn;
        tooltipEl = objs.tooltip;
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
