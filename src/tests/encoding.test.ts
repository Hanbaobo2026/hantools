import { describe, expect, it } from 'vitest';
import { autoDecode, base32Decode, base32Encode, base64Decode, base64Encode, decodeText, encodeText } from '../tools/base64/index';
import { hexToText, parseHexdump, textToHex, toHexdump } from '../tools/hex/index';
import { formDecode, formEncode, htmlDecode, htmlEncode, unicodeDecode, unicodeEncode, urlDecode, urlEncode } from '../tools/urlcode/index';

describe('base64 / base32 / base16', () => {
  it('编码标准向量', () => {
    expect(base64Encode(new TextEncoder().encode('foo'))).toBe('Zm9v');
    expect(base64Encode(new TextEncoder().encode('fo'))).toBe('Zm8=');
    expect(base32Encode(new TextEncoder().encode('foobar'))).toBe('MZXW6YTBOI======');
    expect(encodeText('Hi', 'base16')).toBe('4869');
    expect(encodeText('Hi', 'base16', { uppercase: true })).toBe('4869'.toUpperCase());
  });

  it('中文往返与 URL-safe 变体', () => {
    const text = '你好，CTF 比赛 🚩';
    expect(decodeText(encodeText(text, 'base64'), 'base64')).toBe(text);
    expect(decodeText(encodeText(text, 'base32'), 'base32')).toBe(text);
    expect(decodeText(encodeText(text, 'base16'), 'base16')).toBe(text);
    const urlSafe = encodeText('\u00ff\u00ff\u00ff', 'base64url');
    expect(urlSafe).not.toContain('=');
    expect(urlSafe).not.toContain('+');
    expect(decodeText(urlSafe, 'base64url')).toBe('\u00ff\u00ff\u00ff');
  });

  it('容错解码：忽略空白 / 缺少 padding', () => {
    expect(base64Decode('Zm 9v').length).toBe(3);
    expect(new TextDecoder().decode(base64Decode('Zm8'))).toBe('fo');
  });

  it('非法输入应抛错', () => {
    expect(() => base64Decode('a')).toThrow(/长度/);
    expect(() => base64Decode('!!!!')).toThrow(/非 Base64/);
    expect(() => base32Decode('0189')).toThrow(/Base32/);
  });

  it('自动识别能挑出 Base64 明文', () => {
    const attempts = autoDecode('ZmxhZ3toZWxsb30=');
    expect(attempts.length).toBeGreaterThan(0);
    expect(attempts[0]?.text).toBe('flag{hello}');
    expect(attempts[0]?.variant).toBe('base64');
  });
});

describe('hex / hexdump', () => {
  it('文本与 hex 互转', () => {
    expect(textToHex('Hi', '')).toBe('4869');
    expect(hexToText('48 69')).toBe('Hi');
    expect(hexToText('0x48,0x69')).toBe('Hi');
    expect(() => hexToText('486')).toThrow(/奇数/);
  });

  it('hexdump 生成与解析可往返', () => {
    const text = 'Hello, CTF! 你好';
    const dump = toHexdump(text);
    expect(dump.split('\n')[0]).toMatch(/^00000000 {2}/);
    const bytes = parseHexdump(dump);
    expect(new TextDecoder().decode(bytes)).toBe(text);
  });

  it('解析 xxd 风格片段', () => {
    const dump = '00000000: 666c 6167 7b78 7d0a  ....flag{x}.';
    expect(new TextDecoder().decode(parseHexdump(dump))).toBe('flag{x}\n');
  });
});

describe('url / html / unicode', () => {
  it('URL 编解码', () => {
    expect(urlEncode('你好 & a=1')).toBe('%E4%BD%A0%E5%A5%BD%20%26%20a%3D1');
    expect(urlDecode('%E4%BD%A0%E5%A5%BD')).toBe('你好');
    expect(() => urlDecode('%E4')).toThrow(/URL 解码失败/);
  });

  it('表单编码空格为 +', () => {
    expect(formEncode('a b&c')).toBe('a+b%26c');
    expect(formDecode('a+b%26c')).toBe('a b&c');
  });

  it('HTML 实体', () => {
    expect(htmlEncode('<a href="x">&\'</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
    expect(htmlEncode('中', true)).toBe('&#x4e2d;');
    expect(htmlDecode('&lt;b&gt;&#65;&#x42;&amp;')).toBe('<b>AB&');
  });

  it('Unicode 转义往返', () => {
    const encoded = unicodeEncode('你好A');
    expect(encoded).toBe('\\u4f60\\u597dA');
    expect(unicodeDecode(encoded)).toBe('你好A');
    expect(unicodeDecode('\\u{1f680}')).toBe('🚀');
  });
});
