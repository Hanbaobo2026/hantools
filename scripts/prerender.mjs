import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 构建期预渲染：为每个工具 / 分类生成带独立 title、description、canonical、OG 的静态 HTML 壳。
 * 纯 CSR 站点也能让分享卡片与搜索引擎拿到正确元信息，同时输出 sitemap.xml。
 * 只读取 tools.json，不 import TS 源码，避免构建脚本依赖额外转译。
 */

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const catalog = JSON.parse(await readFile(join(root, 'src', 'data', 'tools.json'), 'utf8'));

const siteName = catalog.site.name;
const origin = String(catalog.site.origin).replace(/\/+$/, '');

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function withMeta(html, { title, description, url }) {
  const fullTitle = title.includes(siteName) ? title : `${title} · ${siteName}`;
  const safeTitle = esc(fullTitle);
  const safeDescription = esc(description);
  return html
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${safeTitle}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
      () => `<meta name="description" content="${safeDescription}" />`,
    )
    .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/, () => `<link rel="canonical" href="${url}" />`)
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/,
      () => `<meta property="og:title" content="${safeTitle}" />`,
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
      () => `<meta property="og:description" content="${safeDescription}" />`,
    )
    .replace(/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/, () => `<meta property="og:url" content="${url}" />`);
}

const template = await readFile(join(dist, 'index.html'), 'utf8');
const generated = [];

// 首页
await writeFile(
  join(dist, 'index.html'),
  withMeta(template, {
    title: `${siteName} · CTF 与开发在线工具集`,
    description:
      '开箱即用的 CTF 与 Web 研发工具箱：编码识别、哈希计算、常用加解密与文本处理，纯前端离线运算，数据不会上传后端。',
    url: `${origin}/`,
  }),
  'utf8',
);

for (const tool of catalog.tools) {
  const url = `${origin}/tools/${tool.slug}`;
  const html = withMeta(template, { title: tool.name['zh-CN'], description: tool.description['zh-CN'], url });
  const dir = join(dist, 'tools', tool.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'index.html'), html, 'utf8');
  // 同时输出 <slug>.html：Cloudflare 的 auto-trailing-slash 会用它直接服务 /tools/<slug>，
  // 避免不同托管平台的目录索引行为差异导致分享卡片失效。
  await writeFile(join(dist, 'tools', `${tool.slug}.html`), html, 'utf8');
  generated.push({ url, priority: '0.8' });
}

for (const category of catalog.categories) {
  const url = `${origin}/category/${category.slug}`;
  const html = withMeta(template, {
    title: `${category.name['zh-CN']} · 工具分类`,
    description: category.description['zh-CN'],
    url,
  });
  const dir = join(dist, 'category', category.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'index.html'), html, 'utf8');
  await writeFile(join(dist, 'category', `${category.slug}.html`), html, 'utf8');
  generated.push({ url, priority: '0.6' });
}

const staticPages = [
  { path: '/tools', title: '全部工具', priority: '0.9' },
  { path: '/about', title: '关于', priority: '0.3' },
  { path: '/privacy', title: '隐私说明', priority: '0.3' },
  { path: '/offline', title: '离线使用', priority: '0.5' },
];

const today = new Date().toISOString().slice(0, 10);
const entries = [
  { url: `${origin}/`, priority: '1.0' },
  ...staticPages.map((page) => ({ url: `${origin}${page.path}`, priority: page.priority })),
  ...generated,
];

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...entries.map(
    (entry) =>
      `  <url><loc>${entry.url}</loc><lastmod>${today}</lastmod><priority>${entry.priority}</priority></url>`,
  ),
  '</urlset>',
  '',
].join('\n');

await writeFile(join(dist, 'sitemap.xml'), sitemap, 'utf8');
console.log(`[prerender] 生成 ${generated.length} 个静态页面 + sitemap.xml（共 ${entries.length} 条 URL）`);
