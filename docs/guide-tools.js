/**
 * guide-tools.js — small toolbar for study guide pages:
 *   📋 Copy as Markdown · Ask Claude · Ask ChatGPT
 *
 * Security: DOM is built with createElement/textContent only (no innerHTML / eval).
 * External links use fixed https origins and an encodeURIComponent-encoded prompt.
 * The Markdown copy is fetched only from the page's own <link rel="alternate"
 * type="text/markdown"> and only when it is same-origin.
 */
(function () {
    'use strict';

    const CLAUDE_URL = 'https://claude.ai/new?q=';
    const CHATGPT_URL = 'https://chatgpt.com/?q=';

    function publicPageUrl() {
        const canonical = document.querySelector('link[rel="canonical"]');
        const href = canonical && canonical.getAttribute('href');
        if (href && /^https:\/\//.test(href)) return href;
        return location.origin + location.pathname;
    }

    function markdownLink() {
        return document.querySelector('link[rel="alternate"][type="text/markdown"]');
    }

    function buildPrompt(pageUrl, mdUrl) {
        const title = (document.title || 'this study guide').trim();
        let prompt = 'I am studying "' + title + '" (' + pageUrl + ').';
        if (mdUrl) prompt += ' A plain Markdown version is at ' + mdUrl + '.';
        prompt += ' Please read it and help me learn it: summarize the key concepts, ' +
            'point out common pitfalls and decision rules, then quiz me with a few original practice questions.';
        return prompt;
    }

    function makeLink(label, href) {
        const a = document.createElement('a');
        a.className = 'guide-tools-btn';
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = label;
        return a;
    }

    function init() {
        if (document.querySelector('.guide-tools')) return;

        const pageUrl = publicPageUrl();
        const mdLink = markdownLink();
        const mdHref = mdLink ? mdLink.getAttribute('href') : null;
        const mdPublicUrl = mdHref ? new URL(mdHref, pageUrl).href : null;
        const prompt = encodeURIComponent(buildPrompt(pageUrl, mdPublicUrl));

        const bar = document.createElement('div');
        bar.className = 'guide-tools';
        bar.setAttribute('role', 'toolbar');
        bar.setAttribute('aria-label', 'Study guide tools');

        const status = document.createElement('span');
        status.className = 'guide-tools-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');

        if (mdHref) {
            const localMdUrl = new URL(mdHref, location.href);
            const copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.className = 'guide-tools-btn';
            copyBtn.textContent = '📋 Copy as Markdown';
            copyBtn.addEventListener('click', async function () {
                status.textContent = '';
                if (localMdUrl.origin !== location.origin) {
                    status.textContent = 'Markdown copy unavailable.';
                    return;
                }
                try {
                    const res = await fetch(localMdUrl.href, { credentials: 'same-origin' });
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    const text = await res.text();
                    if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard API unavailable');
                    await navigator.clipboard.writeText(text);
                    status.textContent = 'Copied ' + text.length.toLocaleString() + ' characters of Markdown.';
                } catch (err) {
                    console.warn('guide-tools: copy failed', err);
                    status.textContent = 'Copy failed — opening the Markdown file instead.';
                    window.open(localMdUrl.href, '_blank', 'noopener');
                }
            });
            bar.appendChild(copyBtn);
        }

        bar.appendChild(makeLink('Ask Claude ↗', CLAUDE_URL + prompt));
        bar.appendChild(makeLink('Ask ChatGPT ↗', CHATGPT_URL + prompt));
        bar.appendChild(status);

        const host = document.querySelector('.cover-content') ||
            document.querySelector('.page-wrapper') || document.body;
        if (host === document.body || host.classList.contains('page-wrapper')) {
            host.insertBefore(bar, host.firstChild);
        } else {
            host.appendChild(bar);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
