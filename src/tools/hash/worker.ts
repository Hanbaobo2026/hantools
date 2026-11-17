import CrackWorker from '../../workers/crack.worker?worker&inline';
import type { CrackResult, HashAlgo } from './logic';

/**
 * 在 Worker 中做字典爆破：主线程保持可交互，并支持 AbortSignal 取消。
 * 传入的候选数组会被结构化克隆到 Worker（只在本机进程内，不涉及网络）。
 */

export interface CrackWorkerOptions {
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

type WorkerMessage =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; found: boolean; plaintext: string | null; tried: number }
  | { type: 'error'; message: string };

export function crackHashInWorker(
  target: string,
  algo: HashAlgo,
  candidates: string[],
  options: CrackWorkerOptions = {},
): Promise<CrackResult> {
  return new Promise((resolve, reject) => {
    const worker = new CrackWorker();
    let settled = false;

    const cleanup = (): void => {
      options.signal?.removeEventListener('abort', onAbort);
      worker.terminate();
    };

    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const onAbort = (): void => {
      fail(Object.assign(new Error('已取消'), { name: 'AbortError' }));
    };

    options.signal?.addEventListener('abort', onAbort, { once: true });

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === 'progress') {
        options.onProgress?.(message.done, message.total);
        return;
      }
      if (settled) return;
      settled = true;
      cleanup();
      if (message.type === 'done') {
        resolve({
          found: message.found,
          plaintext: message.plaintext ?? undefined,
          tried: message.tried,
        });
      } else {
        reject(new Error(message.message));
      }
    };

    worker.onerror = () => fail(new Error('Worker 执行失败'));

    worker.postMessage({ type: 'start', target, algo, candidates });
  });
}

/** 用于区分"Worker 不可用"与业务错误，便于回退到主线程 */
export function isWorkerFailure(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Worker 执行失败');
}
