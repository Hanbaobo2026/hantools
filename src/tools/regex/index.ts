import { mountPanel } from '../../components/ToolPanel';
import { escapeHtml } from '../../utils/text';
import { h } from '../../utils/dom';
import { MAX_MATCHES, highlightHtml, replaceRegex, runRegex } from './logic';
import type { RegexMatch } from './logic';
import { RegexTimeoutError, runRegexInWorker } from './worker';

export * from './logic';

export function mount(root: HTMLElement): void {
  const preview = h('div', { class: 'preview', attrs: { 'aria-live': 'polite' } });

  mountPanel(root, {
    fields: [
      { id: 'pattern', label: '正则表达式', kind: 'text', placeholder: '例如 (\\w+)@(\\w+\\.\\w+)', full: true },
      { id: 'flags', label: '标志位', kind: 'text', value: 'g', placeholder: 'g i m s u y d' },
      { id: 'text', label: '测试文本', kind: 'textarea', rows: 8, placeholder: '粘贴需要匹配的文本' },
      { id: 'replacement', label: '替换模板（$1 $2 …）', kind: 'text', placeholder: '例如 $2 由 $1 提供', full: true },
    ],
    extras: [preview],
    actions: [
      {
        label: '匹配',
        primary: true,
        run: async ({ values }) => {
          const pattern = values.pattern ?? '';
          const flags = values.flags ?? 'g';
          const text = values.text ?? '';
          let matches: RegexMatch[];
          let truncated: boolean;
          try {
            const result = await runRegexInWorker(pattern, flags, text);
            matches = result.matches;
            truncated = result.truncated;
          } catch (error) {
            // 超时说明确实存在灾难性回溯：不要回退到主线程，否则页面会卡死
            if (error instanceof RegexTimeoutError) throw error;
            const fallback = runRegex(pattern, flags, text);
            matches = fallback.matches;
            truncated = fallback.truncated;
          }
          preview.innerHTML = highlightHtml(text, matches);
          if (matches.length === 0) {
            return { output: '没有匹配结果', status: { text: '未找到匹配项', kind: 'warn' } };
          }
          const lines = matches.map((item, index) => {
            const groups = item.groups
              .map((group, groupIndex) => `  $${groupIndex + 1} = ${group ?? '(未参与匹配)'}`)
              .join('\n');
            return `${index + 1}. "${item.value}" @ ${item.index}${groups ? `\n${groups}` : ''}`;
          });
          return {
            output: `共 ${matches.length} 处匹配${truncated ? `（已截断至前 ${MAX_MATCHES} 条）` : ''}\n\n${lines.join('\n\n')}`,
            status: { text: `匹配 ${matches.length} 处`, kind: 'ok' },
          };
        },
      },
      {
        label: '替换',
        run: ({ values }) => {
          const result = replaceRegex(
            values.pattern ?? '',
            values.flags ?? 'g',
            values.text ?? '',
            values.replacement ?? '',
          );
          preview.innerHTML = escapeHtml(result);
          return result;
        },
      },
    ],
    outputLabel: '匹配详情 / 替换结果',
    outputRows: 10,
    note: '匹配在 Worker 中执行并带 1.5 秒超时：灾难性回溯只会中止计算，不会冻结页面。',
  });
}
