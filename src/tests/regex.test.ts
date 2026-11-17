import { describe, expect, it } from 'vitest';
import { MAX_MATCHES, highlightHtml, replaceRegex, runRegex } from '../tools/regex/logic';

describe('正则纯逻辑', () => {
  it('枚举匹配与捕获组', () => {
    const { matches, truncated } = runRegex('(\\w+)@(\\w+\\.\\w+)', 'g', 'a@b.com c@d.org');
    expect(matches).toHaveLength(2);
    expect(matches[0]?.value).toBe('a@b.com');
    expect(matches[0]?.groups).toEqual(['a', 'b.com']);
    expect(truncated).toBe(false);
  });

  it('缺少 g 时自动补上，零长度匹配不会死循环', () => {
    const { matches } = runRegex('a*', '', 'baa');
    expect(matches.length).toBe(3);
  });

  it('非法正则给出中文错误', () => {
    expect(() => runRegex('(', 'g', 'x')).toThrow(/正则语法错误/);
  });

  it('正则长度上限', () => {
    expect(() => runRegex('a'.repeat(501), 'g', 'x')).toThrow(/字符上限/);
  });

  it('替换与高亮转义', () => {
    expect(replaceRegex('(\\w+)', 'g', 'a b', '[$1]')).toBe('[a] [b]');
    const html = highlightHtml('<x> a', [{ value: 'a', index: 4, groups: [] }]);
    expect(html).toBe('&lt;x&gt; <mark>a</mark>');
  });

  it('匹配条数截断', () => {
    const text = 'a'.repeat(MAX_MATCHES + 10);
    const { matches, truncated } = runRegex('a', 'g', text);
    expect(truncated).toBe(true);
    expect(matches).toHaveLength(MAX_MATCHES);
  });
});
