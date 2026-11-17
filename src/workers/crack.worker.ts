/**
 * 字典爆破 Worker：@noble/hashes 计算在 Worker 内完成，主线程只收进度与结果。
 * crackHash 内部每 200 个候选让出一次事件循环，因此 'cancel' 消息能被及时处理。
 */
import { crackHash, type HashAlgo } from '../tools/hash/logic';

interface StartMessage {
  type: 'start';
  target: string;
  algo: HashAlgo;
  candidates: string[];
}

interface CancelMessage {
  type: 'cancel';
}

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<StartMessage | CancelMessage>) => void) | null;
  postMessage: (message: unknown) => void;
};

let controller: AbortController | null = null;

ctx.onmessage = async (event) => {
  if (event.data.type === 'cancel') {
    controller?.abort();
    return;
  }
  if (event.data.type !== 'start') return;

  const { target, algo, candidates } = event.data;
  controller = new AbortController();
  try {
    const result = await crackHash(target, algo, candidates, {
      signal: controller.signal,
      onProgress: (done, total) => ctx.postMessage({ type: 'progress', done, total }),
    });
    ctx.postMessage({
      type: 'done',
      found: result.found,
      plaintext: result.plaintext ?? null,
      tried: result.tried,
    });
  } catch (error) {
    ctx.postMessage({ type: 'error', message: (error as Error).message });
  } finally {
    controller = null;
  }
};
