// ==UserScript==
// @name         复制知乎内容为Markdown
// @namespace    https://github.com/3plus10i/zhihu-to-markdown
// @version      2.0.0
// @description  一键将知乎回答和文章复制为Markdown格式，支持公式、图片、链接卡片、艾特用户等几乎所有元素
// @author       3plus10i
// @license      MIT
// @homepage     https://github.com/3plus10i/zhihu-to-markdown
// @match        https://zhuanlan.zhihu.com/p/*
// @match        https://www.zhihu.com/question/*/answer/*
// @icon         https://static.zhihu.com/heifetz/favicon.ico
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

/**
 * 复制知乎内容为Markdown
 * Forked from RustyPiano/zhihu-to-markdown (MIT License)
 * 
 * 功能特性：
 * - 一键复制知乎回答/专栏文章为Markdown
 * - 支持标题、引用、列表、链接、图片、代码、公式、链接卡片、艾特用户等几乎所有元素
 * - 附带作者名、作者主页、回答/文章链接、回答/文章时间戳等元信息
 * 
 * 使用方法：
 * 点击知乎回答/文章页面右侧「Markdown」按钮以复制
 */

(function () {
    'use strict';

    // 知乎设计一致风格
    const ZH = {
        blue: '#1772f6',
        blueHover: '#0063e4',
        white: '#fff',
        grayBorder: '#ebedf0',
        fontFamily: '-apple-system,BlinkMacSystemFont,"Helvetica Neue","PingFang SC","Microsoft YaHei","Source Han Sans SC","Noto Sans CJK SC","WenQuanYi Micro Hei","MiSans L3","Segoe UI",sans-serif',
    };

    // 常数配置
    const CONFIG = {
        buttonBottom: '80px',
        buttonRight: '35px',
        // 设为 true 强制走降级模态框（测试用）
        debugModal: false,
        // 设为 true 强制触发复制失败提示（测试用）
        debugFailure: false,
    };

    /**
     * 处理器注册表 必须特异性高的靠前
     * @type {Array<{test: (node: Node) => boolean, handle: (node: Node) => string}>}
     */
    const handlers = [
        // 节点类型基础 
        { test: n => n.nodeType === Node.TEXT_NODE,
          handle: n => n.textContent.replace(/\s+/g, ' ') },
        { test: n => n.nodeType !== Node.ELEMENT_NODE,
          handle: () => '' },

        // 知乎特色元素（类选择器匹配，优先于通用标签） 
        { test: n => n.matches?.('span.ztext-math'),
          handle: parseMathFormula },
        { test: n => n.matches?.('span.UserLink'),
          handle: parseUserLink },
        { test: n => n.matches?.('span[data-search-entity]'),
          handle: n => n.textContent },
        { test: n => n.matches?.('div.RichText-LinkCardContainer'),
          handle: parseLinkCard },

        // 通用 HTML 元素 
        { test: n => isTag(n, 'a'),
          handle: parseLink },
        { test: n => isTag(n, 'br'),
          handle: () => '\n' },
        { test: n => isTag(n, 'strong', 'b'),
          handle: n => wrapInline(n, '**') },
        { test: n => isTag(n, 'em', 'i'),
          handle: n => wrapInline(n, '*') },
        { test: n => isTag(n, 'code'),
          handle: n => `\`${n.textContent}\`` },
        { test: n => isTag(n, 'pre'),
          handle: parseCodeBlock },
        { test: n => isTag(n, 'p'),
          handle: parseParagraph },
        { test: n => isTag(n, 'blockquote'),
          handle: parseBlockquote },
        { test: n => isHeading(n),
          handle: parseHeading },
        { test: n => isTag(n, 'ul', 'ol'),
          handle: parseList },
        { test: n => isTag(n, 'img'),
          handle: parseImage },
        { test: n => isTag(n, 'figure'),
          handle: n => { const c = parseChildren(n).trim(); return c ? `\n\n${c}\n\n` : ''; } },
        { test: n => isTag(n, 'figcaption'),
          handle: n => { const c = parseChildren(n).trim(); return c ? `\n*${c}*\n` : ''; } },
        { test: n => isTag(n, 'noscript'),
          handle: () => '' },
        { test: n => isTag(n, 'hr'),
          handle: () => '\n\n---\n\n' },
    ];

    // 匹配工具

    /** 判断节点是否匹配指定标签名 */
    function isTag(node, ...names) {
        return node.nodeType === Node.ELEMENT_NODE
            && names.some(name => node.tagName === name.toUpperCase());
    }

    /** 判断是否为标题 */
    function isHeading(node) {
        return node.nodeType === Node.ELEMENT_NODE && /^H[1-6]$/.test(node.tagName);
    }

    // 分发与递归

    /**
     * 找到首个匹配的处理器并执行
     */
    function dispatch(node) {
        for (const { test, handle } of handlers) {
            if (test(node)) return handle(node);
        }
        // 所有处理器均未命中则递归解析子节点
        return parseChildren(node);
    }

    /**
     * 递归解析子节点列表
     */
    function parseChildren(element) {
        return Array.from(element.childNodes).map(dispatch).join('');
    }

    // 处理器实现

    /**
     * 粗体/斜体等内联包裹元素
     */
    function wrapInline(element, marker) {
        const text = parseChildren(element).trim();
        return text ? `${marker}${text}${marker}` : '';
    }

    /**
     * 解析数学公式
     */
    function parseMathFormula(element) {
        let tex = element.getAttribute('data-tex') || '';
        const isBlock = tex.trim().endsWith('\\\\');

        if (isBlock) {
            tex = tex.trim().replace(/\\\\$/, '').trim();
            return `\n\n$$\n${tex}\n$$\n\n`;
        }
        return `$${tex}$`;
    }

    /**
     * 解析链接，并去掉知乎直答和关键词内部搜索链接
     */
    function parseLink(element) {
        let href = element.getAttribute('href') || '';
        const text = parseChildren(element).trim();

        if (element.classList.contains('RichContent-EntityWord')
            || href.includes('zhida.zhihu.com/search')
            || href.includes('www.zhihu.com/search')) {
            return text;
        }

        if (href && text) {
            if (href.startsWith('//')) href = 'https:' + href;
            return `[${text}](${href})`;
        }
        return text;
    }

    /**
     * 解析知乎正文中的用户艾特链接
     */
    function parseUserLink(element) {
        const link = element.querySelector('a.UserLink-link');
        if (!link) return element.textContent;
        let href = link.getAttribute('href') || '';
        if (href.startsWith('//')) href = 'https:' + href;
        const text = link.textContent.trim();
        return text ? `[${text}](${href})` : '';
    }

    /**
     * 解析链接卡片
     */
    function parseLinkCard(element) {
        const card = element.querySelector('a.LinkCard');
        if (!card) return '';
        let href = card.getAttribute('href') || '';
        if (href.startsWith('//')) href = 'https:' + href;
        const title = card.querySelector('.LinkCard-title')?.textContent.trim() || '';
        const tag = card.querySelector('a.tag')?.textContent.trim() || '链接';
        if (!title || !href) return '';
        return `\n\n> **[${tag}]** [${title}](${href})\n\n`;
    }

    /**
     * 解析代码块
     */
    function parseCodeBlock(element) {
        const code = element.querySelector('code');
        const language = code?.className.match(/language-(\w+)/)?.[1] || '';
        const content = code?.textContent || element.textContent;
        return `\n\n\`\`\`${language}\n${content}\n\`\`\`\n\n`;
    }

    /**
     * 解析段落，处理知乎空段落
     */
    function parseParagraph(element) {
        if (element.classList.contains('ztext-empty-paragraph')) {
            return '\n\n';
        }
        const content = parseChildren(element).trim();
        return content ? `\n\n${content}\n\n` : '';
    }

    /**
     * 解析引用块（保留空行以支持多段引用）
     */
    function parseBlockquote(element) {
        const content = parseChildren(element).trim();
        if (!content) return '';
        const lines = content.split('\n');
        const quoted = lines.map(line => line.trim() ? `> ${line.trim()}` : '>').join('\n');
        return `\n\n${quoted}\n\n`;
    }

    /**
     * 解析标题 h1~h6
     */
    function parseHeading(element) {
        const level = parseInt(element.tagName[1]);
        const content = parseChildren(element).trim();
        return content ? `\n\n${'#'.repeat(level)} ${content}\n\n` : '';
    }

    /**
     * 解析列表（仅处理一级列表项）
     */
    function parseList(element) {
        const isOrdered = isTag(element, 'ol');
        const items = Array.from(element.querySelectorAll(':scope > li')).map((li, i) => {
            const content = parseChildren(li).trim();
            return isOrdered ? `${i + 1}. ${content}` : `- ${content}`;
        });
        return `\n\n${items.join('\n')}\n\n`;
    }

    /**
     * 解析图片（处理知乎懒加载，data-original 优先级最高）
     */
    function parseImage(element) {
        const src = element.getAttribute('data-original') ||
            element.getAttribute('data-actualsrc') ||
            element.getAttribute('data-src') ||
            element.getAttribute('src') || '';
        const alt = element.getAttribute('alt') || '';
        return src ? `![${alt}](${src})  ` : '';
    }

    // 工具函数 

    /**
     * 规范化空白字符
     */
    function normalizeWhitespace(text) {
        let lines = text.split('\n').map(line => line.replace(/^[ \t]+/, ''));  // 保留行末的双空格 markdown 硬换行标记
        text = lines.join('\n');
        // 去掉段落间的重复空行
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

        // 文章: Post-RichTextContainer > RichText.ztext.Post-RichText
        // 回答: RichContent > RichContent-inner > RichText.ztext.CopyrightRichText-richText
        const contentSelectors = [
            '.RichText.ztext.Post-RichText',              // 文章
            '.RichContent-inner .RichText.ztext',         // 回答
            '.Post-RichTextContainer .RichText',          // 文章降级
            '.RichText.ztext',                            // 兜底
        ];

        let content = null;
        for (const selector of contentSelectors) {
            content = document.querySelector(selector);
            if (content) break;
        }

        if (CONFIG.debugFailure) content = null;
        if (!content) {
            showToast('未找到文章内容', false);
            return null;
        }

        // 解析正文
        let body = parseChildren(content);
        body = normalizeWhitespace(body);

        // 构建头部：标题 + 作者 + 时间
        let header = '';
        const title = getTitle();
        if (title) header += `# ${title}\n\n`;

        const { name, url } = getAuthorInfo();
        const timeStr = getTimeInfo();
        header += `原文：${location.href}  \n`;  // 双空格是必须的
        if (name && url) header += `作者：[${name}](${url})  \n`;
        if (timeStr) header += `${timeStr}\n`;
        if (header && !header.endsWith('\n\n')) header += '\n\n';

        return header + body;
    }

    // UI 组件 

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
                position:absolute;bottom:calc(100% + 8px);left:50%;
                transform:translateX(-50%);
                background:rgba(25,27,31,.8);color:#fff;
                border-radius:4px;font-size:13px;
                padding:6px 8px;white-space:nowrap;
                font-family:${ZH.fontFamily};
                opacity:0;visibility:hidden;
                transition:opacity .2s ease,visibility .2s ease;
                pointer-events:none;
            }
            #zhihu-md-wrapper:hover .zhihu-md-tooltip {
                opacity:1;visibility:visible;
                transition-delay:0.75s;
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
                opacity:0;transition:opacity .5s ease;
            }
            #zhihu-md-wrapper:hover #zhihu-md-close-btn {
                opacity:1;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 悬浮按钮  复制 icon + 文字，hover 显示 tooltip
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

        closeBtn.addEventListener('click', () => {
            wrapper.style.display = 'none';
        });

        btn.addEventListener('click', handleConvert);

        wrapper.appendChild(btn);
        wrapper.appendChild(closeBtn);
        wrapper.appendChild(tooltip);
        document.body.appendChild(wrapper);
    }


    /**
     * 复用按钮为toast
     */
    function showToast(text, ok) {
        const btn = document.getElementById('zhihu-to-markdown-btn');
        if (!btn) return;
        const span = btn.querySelector('.zhihu-md-btn-text');
        if (!span) return;
        const orig = span.textContent;
        span.textContent = text;
        btn.style.background = ok ? '#00c853' : '#f44336';
        btn.style.borderColor = ok ? '#00c853' : '#f44336';
        setTimeout(() => {
            span.textContent = orig;
            btn.style.background = ZH.blue;
            btn.style.borderColor = ZH.blue;
        }, 3000);
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
     * 手动复制模态框（降级方案，几乎不会触发）
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

    // 初始化 

    function init() {
        if (document.getElementById('zhihu-md-wrapper')) return;
        createButton();
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
