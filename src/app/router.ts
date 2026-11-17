/**
 * 极小路由器：History API + 模式匹配（:param），零依赖。
 * 注意：离线单文件以 file:// 打开时 history.pushState 会抛 SecurityError，
 * 因此 file:// 下自动切换为 hash 路由（#/tools/base64），行为与线上一致。
 */

export type RouteHandler = (params: Record<string, string>, query: URLSearchParams) => void | Promise<void>;

export interface RouteDef {
  /** 例如 /tools/:slug、/category/:slug、/about */
  pattern: string;
  handler: RouteHandler;
}

export interface RouterOptions {
  routes: RouteDef[];
  notFound: RouteHandler;
  /** 导航开始前回调（用于清理上一个页面：中断长任务、清空视图） */
  onBeforeNavigate?: () => void;
  /** 每次导航完成后回调（用于更新导航高亮、标题等） */
  onNavigate?: (path: string) => void;
}

export interface Router {
  start(): void;
  navigate(to: string, replace?: boolean): void;
  currentPath(): string;
  setOnNavigate(handler?: (path: string) => void): void;
}

interface CompiledRoute {
  segments: string[];
  handler: RouteHandler;
}

function compile(routes: RouteDef[]): CompiledRoute[] {
  return routes.map((route) => ({
    segments: route.pattern.split('/').filter(Boolean),
    handler: route.handler,
  }));
}

function matchRoute(route: CompiledRoute, segments: string[]): Record<string, string> | null {
  if (route.segments.length !== segments.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < route.segments.length; i += 1) {
    const pattern = route.segments[i] as string;
    const actual = segments[i] as string;
    if (pattern.startsWith(':')) {
      params[pattern.slice(1)] = decodeURIComponent(actual);
    } else if (pattern !== actual) {
      return null;
    }
  }
  return params;
}

/** 规范化路径：去掉末尾斜杠（根路径除外），保证 /tools/ 与 /tools 命中同一路由 */
export function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/** file:// 下无法使用 History API，改用 hash 路由（惰性判断，便于 Node 单测导入） */
function hashMode(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'file:';
}

function currentUrl(): URL {
  if (hashMode()) {
    const raw = window.location.hash.replace(/^#/, '');
    return new URL(raw || '/', 'http://hantools.local');
  }
  return new URL(window.location.href);
}

export function createRouter(options: RouterOptions): Router {
  const routes = compile(options.routes);
  let onNavigate = options.onNavigate;

  async function render(): Promise<void> {
    const url = currentUrl();
    const path = normalizePath(url.pathname);
    const segments = path.split('/').filter(Boolean);

    options.onBeforeNavigate?.();

    let matched: { handler: RouteHandler; params: Record<string, string> } | null = null;
    for (const route of routes) {
      const params = matchRoute(route, segments);
      if (params) {
        matched = { handler: route.handler, params };
        break;
      }
    }

    if (matched) {
      await matched.handler(matched.params, url.searchParams);
    } else {
      await options.notFound({}, url.searchParams);
    }

    onNavigate?.(path);

    if (url.hash) {
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      target?.scrollIntoView({ block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }

  function navigate(to: string, replace = false): void {
    if (hashMode()) {
      const raw = to.startsWith('#') ? to.slice(1) : to;
      const next = `#${raw.startsWith('/') ? raw : `/${raw}`}`;
      const current = window.location.hash || '#/';
      if (replace || current === next) {
        window.history.replaceState(null, '', next);
      } else {
        window.history.pushState(null, '', next);
      }
      void render();
      return;
    }

    const target = new URL(to, window.location.origin);
    if (target.origin !== window.location.origin) {
      window.location.href = to;
      return;
    }
    const sameUrl = target.pathname === window.location.pathname && target.search === window.location.search;
    if (replace || sameUrl) {
      window.history.replaceState({}, '', target);
    } else {
      window.history.pushState({}, '', target);
    }
    void render();
  }

  function onClick(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!anchor) return;
    if (anchor.target && anchor.target !== '_self') return;
    if (anchor.hasAttribute('download')) return;
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) return;

    const target = new URL(href, window.location.origin);
    if (target.origin !== window.location.origin) return;

    // 纯锚点交给浏览器默认行为
    if (target.pathname === window.location.pathname && target.search === window.location.search && target.hash) {
      return;
    }

    event.preventDefault();
    navigate(target.pathname + target.search + target.hash);
  }

  return {
    start() {
      window.addEventListener('popstate', () => void render());
      if (hashMode()) window.addEventListener('hashchange', () => void render());
      document.addEventListener('click', onClick);
      void render();
    },
    navigate,
    currentPath() {
      return normalizePath(window.location.pathname);
    },
    setOnNavigate(handler) {
      onNavigate = handler;
    },
  };
}
