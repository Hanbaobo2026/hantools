import { describe, expect, it } from 'vitest';
import { buildCatalog, catalog, findTool, moduleKeys } from '../app/registry';
import { normalizePath } from '../app/router';
import { normalizeQuery, scoreTool, searchTools } from '../app/search';
import rawCatalog from '../data/tools.json';
import type { CatalogData } from '../types';

describe('目录与路由', () => {
  it('内置目录完整且唯一', () => {
    expect(catalog.tools.length).toBe(19);
    expect(new Set(catalog.tools.map((tool) => tool.slug)).size).toBe(19);
    expect(catalog.categories.length).toBe(4);
  });

  it('按 slug 与别名解析（大小写不敏感）', () => {
    expect(findTool('B64')?.key).toBe('base64');
    expect(findTool('md5')?.key).toBe('hash');
    expect(findTool('乱码')?.key).toBe('textfix');
    expect(findTool('no-such-tool')).toBeUndefined();
  });

  it('保留路径冲突会在构建期报错', () => {
    const data = JSON.parse(JSON.stringify(rawCatalog)) as CatalogData;
    data.tools[0]!.slug = 'about';
    expect(() => buildCatalog(data)).toThrow(/保留字/);
  });

  it('重复别名会报错', () => {
    const data = JSON.parse(JSON.stringify(rawCatalog)) as CatalogData;
    data.tools[1]!.aliases = [data.tools[0]!.slug];
    expect(() => buildCatalog(data)).toThrow(/重复/);
  });

  it('每个工具都有实现模块', () => {
    const keys = moduleKeys();
    for (const tool of catalog.tools) expect(keys).toContain(tool.key);
  });

  it('路径规范化', () => {
    expect(normalizePath('/tools/')).toBe('/tools');
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('')).toBe('/');
  });
});

describe('搜索', () => {
  it('按 slug 与中文关键词命中', () => {
    expect(searchTools(catalog.tools, 'base64')[0]?.key).toBe('base64');
    expect(searchTools(catalog.tools, '哈希')[0]?.key).toBe('hash');
    expect(searchTools(catalog.tools, 'md5')[0]?.key).toBe('hash');
    expect(searchTools(catalog.tools, '乱码')[0]?.key).toBe('textfix');
  });

  it('多关键词需全部命中', () => {
    const hash = catalog.byKey.get('hash');
    expect(hash).toBeDefined();
    expect(scoreTool(hash!, '哈希 md5')).toBeGreaterThan(0);
    expect(scoreTool(hash!, '哈希 正则')).toBe(0);
  });

  it('空查询返回空结果', () => {
    expect(searchTools(catalog.tools, '   ')).toEqual([]);
    expect(normalizeQuery('  A  B ')).toBe('a b');
  });
});
