/**
 * 单色线性图标（currentColor）。
 * 规范要求图标 19px、线宽 1.7、颜色继承高亮蓝，因此不用多色 emoji。
 */

const PATHS: Record<string, string> = {
  // 尖括号：编码与杂项
  misc: 'M9 6 4 12l5 6M15 6l5 6-5 6M13.5 4l-3 16',
  // 锁：密码学 / 本地计算
  crypto: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5zM12 15v2',
  // 地球：Web 与网络
  web: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c3 3.6 3 14.4 0 18M12 3c-3 3.6-3 14.4 0 18',
  // 扳手：开发辅助
  dev: 'M14.7 6.3a4 4 0 0 1 5 5L9.4 21.6 3 22l.4-6.4zM13 8l3 3',
  // 下载：离线
  download: 'M12 3v13M7 11l5 5 5-5M4 21h16',
  // 闪电：面向 CTF
  bolt: 'M13 2 4 14h6l-1 8 9-12h-6z',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

export function icon(name: keyof typeof PATHS, size = 19): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', PATHS[name] ?? PATHS.dev);
  svg.append(path);
  return svg;
}

/** 分类 slug → 图标；未知分类回退到 dev */
export function categoryIcon(slug: string, size = 19): SVGSVGElement {
  return icon(slug in PATHS ? (slug as keyof typeof PATHS) : 'dev', size);
}
