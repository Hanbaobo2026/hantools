import rawCatalog from '../data/tools.json';
import type { CatalogData, CategoryMeta, ToolMeta, ToolModule } from '../types';

/**
 * 保留路径：工具 slug / 别名不得占用，避免路由被工具劫持。
 * 这份列表同时被构建脚本用于校验，任何冲突都会在构建期直接报错。
 */
export const RESERVED_PATHS = new Set([
  '',
  'tools',
  'category',
  'about',
  'privacy',
  'offline',
  'search',
  'api',
  'assets',
  'admin',
  'favicon.svg',
  'icon-512.svg',
  'manifest.webmanifest',
  'sw.js',
  'robots.txt',
  'sitemap.xml',
  'hantools-offline.html',
  '404',
  '404.html',
]);

export interface Catalog {
  site: CatalogData['site'];
  categories: CategoryMeta[];
  tools: ToolMeta[];
  bySlug: Map<string, ToolMeta>;
  byKey: Map<string, ToolMeta>;
  byCategory: Map<string, ToolMeta[]>;
}

function fail(message: string): never {
  throw new Error(`[catalog] ${message}`);
}

/** 纯函数式构建 + 校验，便于单元测试与构建期复用 */
export function buildCatalog(data: CatalogData, reserved: Set<string> = RESERVED_PATHS): Catalog {
  if (!data || !Array.isArray(data.tools) || !Array.isArray(data.categories)) {
    fail('tools.json 结构不合法');
  }

  const categories = [...data.categories].sort((a, b) => a.order - b.order);
  const categorySlugs = new Set(categories.map((c) => c.slug));
  if (categorySlugs.size !== categories.length) fail('存在重复的分类 slug');

  const tools = [...data.tools].sort((a, b) => a.order - b.order);
  const bySlug = new Map<string, ToolMeta>();
  const byKey = new Map<string, ToolMeta>();
  const byCategory = new Map<string, ToolMeta[]>();

  for (const tool of tools) {
    if (byKey.has(tool.key)) fail(`重复的工具 key: ${tool.key}`);
    if (!categorySlugs.has(tool.category)) fail(`工具 ${tool.key} 的分类不存在: ${tool.category}`);
    if (!/^[a-z0-9-]+$/.test(tool.slug)) fail(`slug 只能包含小写字母、数字与连字符: ${tool.slug}`);
    byKey.set(tool.key, tool);

    for (const name of [tool.slug, ...tool.aliases]) {
      if (reserved.has(name)) fail(`工具 ${tool.key} 的路径与保留字冲突: ${name}`);
      if (bySlug.has(name)) fail(`重复的 slug / 别名: ${name}`);
      bySlug.set(name, tool);
    }

    const list = byCategory.get(tool.category) ?? [];
    list.push(tool);
    byCategory.set(tool.category, list);
  }

  return { site: data.site, categories, tools, bySlug, byKey, byCategory };
}

export const catalog: Catalog = buildCatalog(rawCatalog as CatalogData);

/** 按 slug 或别名查找（路由与短链接使用） */
export function findTool(segment: string): ToolMeta | undefined {
  const normalized = segment.trim().toLowerCase();
  return catalog.bySlug.get(normalized);
}

export function categoryOf(slug: string): CategoryMeta | undefined {
  return catalog.categories.find((category) => category.slug === slug);
}

export function toolsInCategory(slug: string): ToolMeta[] {
  return catalog.byCategory.get(slug) ?? [];
}

export function featuredTools(): ToolMeta[] {
  return catalog.tools.filter((tool) => tool.featured);
}

/** 相关工具：同分类优先，不足时按 order 补足 */
export function relatedTools(tool: ToolMeta, limit = 4): ToolMeta[] {
  const same = toolsInCategory(tool.category).filter((item) => item.key !== tool.key);
  const others = catalog.tools.filter((item) => item.category !== tool.category && item.key !== tool.key);
  return [...same, ...others].slice(0, limit);
}

/** 路由与“上一页/下一页”展示用的规范路径 */
export function toolPath(tool: ToolMeta): string {
  return `/tools/${tool.slug}`;
}

const loaders = import.meta.glob<ToolModule>('../tools/*/index.ts');

const loaderByKey = new Map<string, () => Promise<ToolModule>>(
  Object.entries(loaders).map(([path, load]) => {
    const segments = path.split('/');
    const key = segments[segments.length - 2] ?? '';
    return [key, load];
  }),
);

export async function loadToolModule(key: string): Promise<ToolModule> {
  const load = loaderByKey.get(key);
  if (!load) fail(`找不到工具模块目录 src/tools/${key}/index.ts`);
  const module = await load();
  if (typeof module.mount !== 'function') fail(`工具模块缺少 mount(): ${key}`);
  return module;
}

export function moduleKeys(): string[] {
  return [...loaderByKey.keys()];
}
