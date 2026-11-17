/**
 * 正则 Worker：把匹配计算移出主线程。
 * 主线程侧用 Promise.race 做超时；超时后 terminate()，因此灾难性回溯只会杀死 Worker，
 * 不会冻结页面。
 */
import { runRegex } from '../tools/regex/logic';

interface Request {
  pattern: string;
  flags: string;
  text: string;
}

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage: (message: unknown) => void;
};

ctx.onmessage = (event) => {
  const { pattern, flags, text } = event.data;
  try {
    const result = runRegex(pattern, flags, text);
    ctx.postMessage({ ok: true, matches: result.matches, truncated: result.truncated });
  } catch (error) {
    ctx.postMessage({ ok: false, error: (error as Error).message });
  }
};
