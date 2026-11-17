/**
 * 站内跳转与 URL 同步的小封装。
 * file:// 下（离线单文件）History API 不可用，自动退化为 hash 跳转。
 */

export function navigateTo(path: string): void {
  try {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  } catch {
    window.location.hash = `#${path.startsWith('/') ? path : `/${path}`}`;
  }
}

/** 只同步地址栏（筛选参数），不触发导航；file:// 下静默跳过 */
export function replaceUrl(path: string): void {
  try {
    window.history.replaceState({}, '', path);
  } catch {
    /* file:// 忽略 */
  }
}
