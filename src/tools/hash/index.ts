import { mountPanel } from '../../components/ToolPanel';
import { BUILTIN_WORDLIST, crackHash, hashText, identifyHash } from './logic';
import type { CrackResult, HashAlgo } from './logic';
import { crackHashInWorker, isWorkerFailure } from './worker';

export * from './logic';

const ALGO_OPTIONS: Array<{ value: HashAlgo; label: string }> = [
  { value: 'md5', label: 'MD5' },
  { value: 'sha1', label: 'SHA-1' },
  { value: 'sha224', label: 'SHA-224' },
  { value: 'sha256', label: 'SHA-256' },
  { value: 'sha384', label: 'SHA-384' },
  { value: 'sha512', label: 'SHA-512' },
  { value: 'sha3_256', label: 'SHA3-256' },
  { value: 'sha3_512', label: 'SHA3-512' },
  { value: 'keccak_256', label: 'Keccak-256（以太坊）' },
  { value: 'ripemd160', label: 'RIPEMD-160' },
  { value: 'crc32', label: 'CRC32（校验和）' },
];

export function mount(root: HTMLElement): void {
  mountPanel(root, {
    fields: [
      {
        id: 'input',
        label: '输入文本',
        kind: 'textarea',
        rows: 5,
        placeholder: '要计算哈希的文本；爆破时这里可留空',
      },
      {
        id: 'algo',
        label: '算法',
        kind: 'select',
        value: 'sha256',
        options: ALGO_OPTIONS.map((item) => ({ value: item.value, label: item.label })),
      },
      {
        id: 'target',
        label: '目标摘要（爆破 / 识别用）',
        kind: 'text',
        placeholder: '十六进制摘要，例如 5d41402abc4b2a76b9719d911017c592',
        full: true,
      },
      {
        id: 'wordlist',
        label: '自定义字典（每行一个，留空用内置字典）',
        kind: 'textarea',
        rows: 4,
        placeholder: 'admin\npassword\nflag',
      },
    ],
    actions: [
      {
        label: '计算哈希',
        primary: true,
        run: ({ values }) => hashText(values.input ?? '', (values.algo ?? 'sha256') as HashAlgo),
      },
      {
        label: '全部算法',
        run: ({ values }) => {
          const text = values.input ?? '';
          const lines = ALGO_OPTIONS.map((item) => `${item.label.padEnd(22, ' ')} ${hashText(text, item.value)}`);
          return lines.join('\n');
        },
      },
      {
        label: '识别摘要',
        run: ({ values, setStatus }) => {
          const target = (values.target ?? '').trim() || (values.input ?? '').trim();
          const guesses = identifyHash(target);
          if (guesses.length === 0) {
            setStatus('长度或字符集不像常见摘要；也可能不是十六进制输出', 'warn');
            return '';
          }
          return guesses.map((guess) => `${guess.family}：${guess.note}`).join('\n');
        },
      },
      {
        label: '字典爆破',
        run: async ({ values, signal, setStatus }) => {
          const target = (values.target ?? '').trim() || (values.input ?? '').trim();
          const custom = (values.wordlist ?? '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
          const candidates = custom.length > 0 ? custom : [...BUILTIN_WORDLIST];
          const algo = (values.algo ?? 'sha256') as HashAlgo;
          const onProgress = (done: number, total: number): void =>
            setStatus(`已尝试 ${done} / ${total}`, 'info');

          let result: CrackResult;
          try {
            result = await crackHashInWorker(target, algo, candidates, { signal, onProgress });
          } catch (error) {
            // Worker 不可用时回退主线程；用户取消与业务错误照常抛出
            if ((error as Error).name === 'AbortError' || !isWorkerFailure(error)) throw error;
            result = await crackHash(target, algo, candidates, { signal, onProgress });
          }

          if (result.found) {
            return {
              output: `命中：${result.plaintext}\n（第 ${result.tried} 个候选）`,
              status: { text: '爆破成功', kind: 'ok' },
            };
          }
          return {
            output: '',
            status: { text: `已尝试 ${result.tried} 个候选，未命中；建议换成题目提供的字典`, kind: 'warn' },
          };
        },
      },
    ],
    outputLabel: '结果',
    outputRows: 8,
    note: '字典爆破在 Worker 中运行，主线程可继续操作并可随时取消；只使用你提供的候选或内置小字典，不联网。',
  });
}
