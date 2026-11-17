import RegexWorker from '../../workers/regex.worker?worker&inline';
import type { RegexMatch } from './logic';

/**
 * 在 Worker 中跑正则；超过 timeoutMs 直接 terminate 并抛 TimeoutError。
 * inline worker 以 blob URL 加载，离线单文件版同样可用（CSP 已允许 worker-src blob:）。
 */

export interface WorkerRegexResult {
  matches: RegexMatch[];
  truncated: boolean;
}

export class RegexTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`正则执行超过 ${timeoutMs}ms，已中止（可能存在灾难性回溯，请简化表达式或缩短输入）`);
    this.name = 'TimeoutError';
  }
}

export function runRegexInWorker(
  pattern: string,
  flags: string,
  text: string,
  timeoutMs = 1500,
): Promise<WorkerRegexResult> {
  return new Promise((resolve, reject) => {
    const worker = new RegexWorker();
    let settled = false;

    const finish = (handler: () => void): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      worker.terminate();
      handler();
    };

    const timer = window.setTimeout(() => finish(() => reject(new RegexTimeoutError(timeoutMs))), timeoutMs);

    worker.onmessage = (event: MessageEvent<{ ok: boolean; matches?: RegexMatch[]; truncated?: boolean; error?: string }>) => {
      const data = event.data;
      if (data.ok) {
        finish(() => resolve({ matches: data.matches ?? [], truncated: Boolean(data.truncated) }));
      } else {
        finish(() => reject(new Error(data.error ?? '正则执行失败')));
      }
    };

    worker.onerror = () => finish(() => reject(new Error('Worker 执行失败')));

    worker.postMessage({ pattern, flags, text });
  });
}
