import type { ToolMeta } from '../types';

/**
 * 搜索评分：纯函数、无 DOM 依赖，便于单测。
 * 支持空格分隔的多关键词（全部命中才算匹配，得分累加）。
 */

export interface ScoredTool {
  tool: ToolMeta;
  score: number;
}

const WEIGHT = {
  nameExact: 120,
  nameStarts: 100,
  pathExact: 95,
  nameIncludes: 80,
  keywordExact: 70,
  keywordStarts: 60,
  pathIncludes: 55,
  tagExact: 50,
  keywordIncludes: 45,
  descriptionIncludes: 25,
} as const;

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

function scoreTerm(tool: ToolMeta, term: string): number {
  const names = [tool.name['zh-CN'], tool.name.en ?? ''].map((n) => n.toLowerCase());
  const paths = [tool.slug, ...tool.aliases].map((p) => p.toLowerCase());
  const keywords = tool.keywords.map((k) => k.toLowerCase());
  const tags = tool.tags.map((t) => t.toLowerCase());

  let score = 0;
  for (const name of names) {
    if (!name) continue;
    if (name === term) score = Math.max(score, WEIGHT.nameExact);
    else if (name.startsWith(term)) score = Math.max(score, WEIGHT.nameStarts);
    else if (name.includes(term)) score = Math.max(score, WEIGHT.nameIncludes);
  }
  for (const path of paths) {
    if (path === term) score = Math.max(score, WEIGHT.pathExact);
    else if (path.includes(term)) score = Math.max(score, WEIGHT.pathIncludes);
  }
  for (const keyword of keywords) {
    if (keyword === term) score = Math.max(score, WEIGHT.keywordExact);
    else if (keyword.startsWith(term)) score = Math.max(score, WEIGHT.keywordStarts);
    else if (keyword.includes(term)) score = Math.max(score, WEIGHT.keywordIncludes);
  }
  for (const tag of tags) {
    if (tag === term) score = Math.max(score, WEIGHT.tagExact);
  }
  if (score === 0 && tool.description['zh-CN'].toLowerCase().includes(term)) {
    score = WEIGHT.descriptionIncludes;
  }
  return score;
}

export function scoreTool(tool: ToolMeta, query: string): number {
  const normalized = normalizeQuery(query);
  if (!normalized) return 0;
  const terms = normalized.split(' ');
  let total = 0;
  for (const term of terms) {
    const termScore = scoreTerm(tool, term);
    if (termScore === 0) return 0;
    total += termScore;
  }
  return total;
}

export function searchTools(tools: ToolMeta[], query: string, limit = 12): ToolMeta[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];
  return tools
    .map((tool) => ({ tool, score: scoreTool(tool, normalized) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.tool.order - b.tool.order)
    .slice(0, limit)
    .map((hit) => hit.tool);
}
