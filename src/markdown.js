const path = require('path');
const { pathToFileURL } = require('url');
const MarkdownIt = require('markdown-it');
const anchorModule = require('markdown-it-anchor');
const taskLists = require('markdown-it-task-lists');
const hljs = require('highlight.js');
const sanitizeHtml = require('sanitize-html');

const anchor = anchorModule.default || anchorModule;

function highlight(code, lang) {
  const language = (lang || '').trim().toLowerCase();
  if (language === 'mermaid') {
    // Rendered client-side by the renderer; keep the source as escaped text.
    return `<pre class="mermaid-block">${md.utils.escapeHtml(code)}</pre>`;
  }
  let html;
  if (language && hljs.getLanguage(language)) {
    html = hljs.highlight(code, { language, ignoreIllegals: true }).value;
  } else {
    html = md.utils.escapeHtml(code);
  }
  const label = language ? `<span class="code-lang">${md.utils.escapeHtml(language)}</span>` : '';
  return `<pre class="code-block">${label}<button class="copy-btn" type="button">Copy</button><code class="hljs${
    language ? ' language-' + md.utils.escapeHtml(language) : ''
  }">${html}</code></pre>`;
}

const md = new MarkdownIt({ html: true, linkify: true, typographer: true, highlight })
  .use(anchor, { slugify: slugify })
  .use(taskLists, { enabled: false, label: true });

function slugify(s) {
  return encodeURIComponent(
    String(s).trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-')
  );
}

const ABSOLUTE_URL = /^([a-z][a-z0-9+.-]*:|\/\/|#)/i;

// Turn relative links/images into absolute file:// URLs so they resolve
// against the markdown file's folder rather than the app's own folder.
function resolveRelative(href, baseDir) {
  if (!href || ABSOLUTE_URL.test(href)) return href;
  const [p, hash] = href.split('#');
  let decoded;
  try {
    decoded = decodeURIComponent(p);
  } catch {
    decoded = p;
  }
  const abs = path.isAbsolute(decoded) ? decoded : path.resolve(baseDir, decoded);
  return pathToFileURL(abs).href + (hash ? '#' + hash : '');
}

function rewriteAttr(attr) {
  const defaultRule =
    md.renderer.rules[attr === 'src' ? 'image' : 'link_open'] ||
    ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
  return (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const i = token.attrIndex(attr);
    if (i >= 0) token.attrs[i][1] = resolveRelative(token.attrs[i][1], env.baseDir);
    return defaultRule(tokens, idx, options, env, self);
  };
}
md.renderer.rules.image = rewriteAttr('src');
md.renderer.rules.link_open = rewriteAttr('href');

const SANITIZE = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'img', 'h1', 'h2', 'details', 'summary', 'input', 'del', 'ins', 'sup', 'sub', 'kbd', 'mark', 'button', 'picture', 'source', 'video', 'audio',
  ]),
  allowedAttributes: {
    '*': ['id', 'class', 'title', 'align', 'width', 'height', 'style', 'aria-hidden', 'tabindex', 'dir', 'lang'],
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'srcset', 'loading'],
    source: ['src', 'srcset', 'media', 'type'],
    video: ['src', 'controls', 'poster', 'loop', 'muted'],
    audio: ['src', 'controls'],
    input: ['type', 'checked', 'disabled'],
    td: ['colspan', 'rowspan', 'style'],
    th: ['colspan', 'rowspan', 'style'],
    ol: ['start', 'type'],
    details: ['open'],
    button: ['type'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'file', 'data'],
  allowedSchemesByTag: { img: ['http', 'https', 'file', 'data'] },
  allowProtocolRelative: false,
};

// Raw HTML inside the markdown (e.g. <img src="docs/x.png">) also needs its relative URLs fixed.
function fixRawHtmlUrls(html, baseDir) {
  return html.replace(/(<(?:img|source|video|audio)\b[^>]*?\s(?:src|poster)=)(["'])(.*?)\2/gi, (m, pre, q, url) =>
    pre + q + resolveRelative(url, baseDir) + q
  ).replace(/(<a\b[^>]*?\shref=)(["'])(.*?)\2/gi, (m, pre, q, url) => pre + q + resolveRelative(url, baseDir) + q);
}

function extractTitle(tokens, filePath) {
  const i = tokens.findIndex((t) => t.type === 'heading_open' && t.tag === 'h1');
  if (i >= 0 && tokens[i + 1]) return tokens[i + 1].content;
  return path.basename(filePath);
}

function extractToc(tokens) {
  const toc = [];
  tokens.forEach((t, i) => {
    if (t.type === 'heading_open' && Number(t.tag[1]) <= 3) {
      toc.push({ level: Number(t.tag[1]), id: t.attrGet('id'), text: tokens[i + 1].content });
    }
  });
  return toc;
}

function renderMarkdown(source, filePath) {
  const env = { baseDir: path.dirname(filePath) };
  const tokens = md.parse(source, env);
  const raw = md.renderer.render(tokens, md.options, env);
  const html = sanitizeHtml(fixRawHtmlUrls(raw, env.baseDir), SANITIZE);
  const words = source.split(/\s+/).filter(Boolean).length;
  return { html, title: extractTitle(tokens, filePath), toc: extractToc(tokens), words };
}

module.exports = { renderMarkdown };
