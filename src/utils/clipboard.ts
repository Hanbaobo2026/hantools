/**
 * 复制到剪贴板。
 * 优先使用异步 Clipboard API（需安全上下文，HTTPS 已满足）；
 * 失败时降级到隐藏 textarea + execCommand，兼容旧浏览器与部分内嵌环境。
 */
export async function copyText(text: string): Promise<boolean> {
  if (text.length === 0) return false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 继续尝试降级方案 */
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
