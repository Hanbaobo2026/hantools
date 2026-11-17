import { catalog } from './registry';

/** 页面级 meta 更新（标题 / 描述 / canonical / OG）。纯展示用，无副作用。 */
export function setPageMeta(title: string, description?: string, path?: string): void {
  const suffix = catalog.site.name;
  const needsSuffix = title !== suffix && !title.startsWith(suffix);
  document.title = needsSuffix ? `${title} · ${suffix}` : title;
  if (description) {
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
  }
  const canonical = `${catalog.site.origin}${path ?? window.location.pathname}`;
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical);
  document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', `${title} · ${suffix}`);
}
