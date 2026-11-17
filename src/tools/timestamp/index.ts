import { mountPanel } from '../../components/ToolPanel';

/**
 * 时间戳转换（纯函数）。
 * 单位自动识别：绝对值 >= 1e11 视为毫秒，否则视为秒（1e11 秒 ≈ 公元 5138 年）。
 * now 作为参数注入，便于单测固定时间。
 */

export type TimestampUnit = 'auto' | 's' | 'ms';

export interface TimestampInfo {
  ms: number;
  seconds: number;
  iso: string;
  utc: string;
  local: string;
  relative: string;
}

export function detectUnit(value: number): 's' | 'ms' {
  return Math.abs(value) >= 1e11 ? 'ms' : 's';
}

export function relativeTime(targetMs: number, now = Date.now()): string {
  const diff = targetMs - now;
  const abs = Math.abs(diff);
  const units: Array<[number, string]> = [
    [1000, '秒'],
    [60_000, '分钟'],
    [3_600_000, '小时'],
    [86_400_000, '天'],
    [2_592_000_000, '个月'],
    [31_536_000_000, '年'],
  ];
  let divisor = 31_536_000_000;
  let label = '年';
  for (const [unitMs, unitLabel] of units) {
    if (abs < unitMs * 60) {
      divisor = unitMs;
      label = unitLabel;
      break;
    }
  }
  const value = Math.round(diff / divisor);
  if (value === 0) return '就是现在';
  return value > 0 ? `${value} ${label}后` : `${Math.abs(value)} ${label}前`;
}

export function convertTimestamp(input: string, unit: TimestampUnit = 'auto', now = Date.now()): TimestampInfo {
  const trimmed = input.trim();
  if (trimmed === '') throw new Error('请输入时间戳或日期字符串');

  let ms: number;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const numeric = Number.parseFloat(trimmed);
    const detected = unit === 'auto' ? detectUnit(numeric) : unit;
    ms = detected === 's' ? numeric * 1000 : numeric;
  } else {
    ms = Date.parse(trimmed);
  }

  const date = new Date(ms);
  if (!Number.isFinite(ms) || Number.isNaN(date.getTime())) {
    throw new Error('无法解析该时间戳 / 日期，请检查格式');
  }

  return {
    ms,
    seconds: Math.floor(ms / 1000),
    iso: date.toISOString(),
    utc: date.toUTCString(),
    local: date.toLocaleString('zh-CN', { hour12: false }),
    relative: relativeTime(ms, now),
  };
}

export function mount(root: HTMLElement): void {
  mountPanel(root, {
    fields: [
      {
        id: 'input',
        label: '时间戳 / 日期',
        kind: 'text',
        placeholder: '例如 1700000000、1700000000000、2024-01-01 00:00:00、2024-01-01T00:00:00Z',
      },
      {
        id: 'unit',
        label: '单位',
        kind: 'select',
        value: 'auto',
        options: [
          { value: 'auto', label: '自动识别（≥1e11 视为毫秒）' },
          { value: 's', label: '秒（Unix timestamp）' },
          { value: 'ms', label: '毫秒（JS Date）' },
        ],
      },
    ],
    actions: [
      {
        label: '转换',
        primary: true,
        run: ({ values }) => {
          const info = convertTimestamp(values.input ?? '', (values.unit ?? 'auto') as TimestampUnit);
          return [
            `毫秒：${info.ms}`,
            `秒：${info.seconds}`,
            `ISO 8601（UTC）：${info.iso}`,
            `UTC 字符串：${info.utc}`,
            `本地时间：${info.local}`,
            `相对现在：${info.relative}`,
          ].join('\n');
        },
      },
      {
        label: '当前时间戳',
        run: () => {
          const now = Date.now();
          const info = convertTimestamp(String(now), 'ms');
          return [
            `毫秒：${info.ms}`,
            `秒：${info.seconds}`,
            `ISO 8601（UTC）：${info.iso}`,
            `本地时间：${info.local}`,
          ].join('\n');
        },
      },
    ],
    outputLabel: '结果',
    outputRows: 8,
    note: '“本地时间”取决于你的浏览器时区；跨时区协作时优先使用 ISO 8601 / UTC。',
  });
}
