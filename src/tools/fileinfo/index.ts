import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { mountPanel } from '../../components/ToolPanel';
import { formatBytes } from '../../utils/text';

/**
 * 文件魔数识别 + strings 提取（纯函数）。
 * 只处理调用方传入的字节，不接触 DOM / 网络，便于单测与后续 Web Worker 化。
 */

export interface Signature {
  offset: number;
  name: string;
  ext: string;
  mime: string;
  note: string;
  magic: string;
}

interface SigDef {
  hex: string;
  name: string;
  ext: string;
  mime: string;
  note: string;
}

const SIGS: SigDef[] = [
  { hex: '89 50 4e 47 0d 0a 1a 0a', name: 'PNG 图像', ext: '.png', mime: 'image/png', note: 'IHDR 紧随其后；常见 LSB 隐写题' },
  { hex: 'ff d8 ff', name: 'JPEG 图像', ext: '.jpg', mime: 'image/jpeg', note: '照片类隐写 / EXIF 题常见' },
  { hex: '47 49 46 38', name: 'GIF 图像', ext: '.gif', mime: 'image/gif', note: 'GIF87a / GIF89a' },
  { hex: '42 4d', name: 'BMP 图像', ext: '.bmp', mime: 'image/bmp', note: '无压缩位图，便于观察像素' },
  { hex: '25 50 44 46', name: 'PDF 文档', ext: '.pdf', mime: 'application/pdf', note: '常含 FlateDecode 压缩流' },
  { hex: '50 4b 03 04', name: 'ZIP 归档', ext: '.zip', mime: 'application/zip', note: 'docx / xlsx / apk / jar 本质都是 ZIP' },
  { hex: '50 4b 05 06', name: 'ZIP 归档（空）', ext: '.zip', mime: 'application/zip', note: '中央目录结束标记' },
  { hex: '52 61 72 21 1a 07 01 00', name: 'RAR5 归档', ext: '.rar', mime: 'application/vnd.rar', note: '' },
  { hex: '52 61 72 21 1a 07 00', name: 'RAR4 归档', ext: '.rar', mime: 'application/vnd.rar', note: '' },
  { hex: '37 7a bc af 27 1c', name: '7-Zip 归档', ext: '.7z', mime: 'application/x-7z-compressed', note: '' },
  { hex: '1f 8b 08', name: 'Gzip 压缩', ext: '.gz', mime: 'application/gzip', note: '常见于 HTTP 压缩 / 备份' },
  { hex: '42 5a 68', name: 'Bzip2 压缩', ext: '.bz2', mime: 'application/x-bzip2', note: '' },
  { hex: 'fd 37 7a 58 5a 00', name: 'XZ 压缩', ext: '.xz', mime: 'application/x-xz', note: '' },
  { hex: '7f 45 4c 46', name: 'ELF 可执行文件', ext: '.elf', mime: 'application/x-executable', note: 'Linux / Pwn 题入口' },
  { hex: '4d 5a', name: 'PE / DOS 可执行文件', ext: '.exe', mime: 'application/x-msdownload', note: 'Windows Reverse 常见' },
  { hex: 'ca fe ba be', name: 'Java Class', ext: '.class', mime: 'application/java-vm', note: '也可能是 Mach-O fat 头' },
  { hex: '00 61 73 6d', name: 'WebAssembly', ext: '.wasm', mime: 'application/wasm', note: '浏览器逆向题常见' },
  { hex: '53 51 4c 69 74 65 20 66 6f 72 6d 61 74 20 33 00', name: 'SQLite 数据库', ext: '.sqlite', mime: 'application/vnd.sqlite3', note: '「SQLite format 3」' },
  { hex: '4f 67 67 53', name: 'Ogg 媒体', ext: '.ogg', mime: 'application/ogg', note: '' },
  { hex: '49 44 33', name: 'MP3（ID3 标签）', ext: '.mp3', mime: 'audio/mpeg', note: '' },
  { hex: 'ac ed 00 05', name: 'Java 序列化数据', ext: '.ser', mime: 'application/x-java-serialized-object', note: '' },
  { hex: 'd4 c3 b2 a1', name: 'PCAP 抓包（小端）', ext: '.pcap', mime: 'application/vnd.tcpdump.pcap', note: '流量分析题入口' },
  { hex: 'a1 b2 c3 d4', name: 'PCAP 抓包（大端）', ext: '.pcap', mime: 'application/vnd.tcpdump.pcap', note: '' },
  { hex: '0a 0d 0d 0a', name: 'PCAPNG', ext: '.pcapng', mime: 'application/x-pcapng', note: '' },
  { hex: '4c 00 00 00 01 14 02 00', name: 'Windows 快捷方式（LNK）', ext: '.lnk', mime: 'application/x-ms-shortcut', note: '取证常见' },
  { hex: '25 21 50 53', name: 'PostScript', ext: '.ps', mime: 'application/postscript', note: '' },
  { hex: '7b 5c 72 74 66', name: 'RTF 文档', ext: '.rtf', mime: 'application/rtf', note: '' },
  { hex: '49 49 2a 00', name: 'TIFF（小端）', ext: '.tiff', mime: 'image/tiff', note: '' },
  { hex: '4d 4d 00 2a', name: 'TIFF（大端）', ext: '.tiff', mime: 'image/tiff', note: '' },
  { hex: '00 00 01 00', name: 'ICO 图标', ext: '.ico', mime: 'image/x-icon', note: '' },
  { hex: 'fe ed fa ce', name: 'Mach-O（32 位）', ext: '', mime: 'application/x-mach-binary', note: 'macOS 可执行文件' },
  { hex: 'fe ed fa cf', name: 'Mach-O（64 位）', ext: '', mime: 'application/x-mach-binary', note: '' },
  { hex: '52 49 46 46', name: 'RIFF 容器', ext: '', mime: 'application/octet-stream', note: '需看 offset 8 判断 WAV / WEBP / AVI' },
];

function hexToBytes(hex: string): number[] {
  return hex.trim().split(/\s+/).map((pair) => Number.parseInt(pair, 16));
}

function matchesAt(bytes: Uint8Array, pattern: number[], offset: number): boolean {
  if (offset + pattern.length > bytes.length) return false;
  for (let i = 0; i < pattern.length; i += 1) {
    if (bytes[offset + i] !== pattern[i]) return false;
  }
  return true;
}

function latin1(bytes: Uint8Array, start: number, end: number): string {
  let out = '';
  for (let i = start; i < end; i += 1) out += String.fromCharCode(bytes[i] as number);
  return out;
}

/** 识别文件魔数（可返回多个候选，例如 ZIP 与 APK 同源） */
export function detectSignatures(bytes: Uint8Array): Signature[] {
  const found: Signature[] = [];

  for (const sig of SIGS) {
    const pattern = hexToBytes(sig.hex);
    if (!matchesAt(bytes, pattern, 0)) continue;

    let { name, ext, mime, note } = sig;
    if (sig.name === 'RIFF 容器') {
      const type = latin1(bytes, 8, 12);
      if (type === 'WAVE') {
        name = 'WAV 音频';
        ext = '.wav';
        mime = 'audio/wav';
        note = 'RIFF/WAVE';
      } else if (type === 'WEBP') {
        name = 'WebP 图像';
        ext = '.webp';
        mime = 'image/webp';
        note = 'RIFF/WEBP';
      } else if (type === 'AVI ') {
        name = 'AVI 视频';
        ext = '.avi';
        mime = 'video/x-msvideo';
        note = 'RIFF/AVI';
      }
    }

    found.push({ offset: 0, name, ext, mime, note, magic: sig.hex.toUpperCase() });
  }

  // offset 4 的 ftyp（MP4 / MOV）
  if (latin1(bytes, 4, 8) === 'ftyp') {
    const brand = latin1(bytes, 8, 12);
    const isQuickTime = brand.startsWith('qt');
    found.push({
      offset: 4,
      name: 'ISO 媒体容器（ftyp）',
      ext: isQuickTime ? '.mov' : '.mp4',
      mime: isQuickTime ? 'video/quicktime' : 'video/mp4',
      note: `brand = ${brand}`,
      magic: latin1(bytes, 4, 12),
    });
  }

  // ISO9660：偏移 0x8001 的 "CD001"
  if (matchesAt(bytes, hexToBytes('43 44 30 30 31'), 0x8001)) {
    found.push({
      offset: 0x8001,
      name: 'ISO 9660 光盘镜像',
      ext: '.iso',
      mime: 'application/x-iso9660-image',
      note: '',
      magic: '43 44 30 30 31',
    });
  }

  return found;
}

/** 粗略判断是否像文本（UTF-8 中文按高位字节计入可打印） */
export function looksLikeText(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, 4096);
  if (sample.length === 0) return false;
  let printable = 0;
  for (const byte of sample) {
    if (byte === 0x09 || byte === 0x0a || byte === 0x0d) printable += 1;
    else if (byte >= 0x20 && byte !== 0x7f) printable += 1;
  }
  return printable / sample.length > 0.92;
}

export interface StringHit {
  offset: number;
  encoding: 'ascii' | 'utf-16le';
  text: string;
}

const MAX_STRING_LENGTH = 200;

function pushRun(
  hits: StringHit[],
  bytes: Uint8Array,
  start: number,
  end: number,
  encoding: StringHit['encoding'],
): void {
  if (end <= start) return;
  let text = latin1(bytes, start, end).slice(0, MAX_STRING_LENGTH);
  if (encoding === 'utf-16le') {
    text = '';
    for (let i = start; i < end; i += 2) text += String.fromCharCode(bytes[i] as number);
    text = text.slice(0, MAX_STRING_LENGTH);
  }
  hits.push({ offset: start, encoding, text });
}

/** 提取 ASCII / UTF-16LE 可打印字符串（类似 strings 命令） */
export function extractStrings(
  bytes: Uint8Array,
  minLength = 4,
  mode: 'ascii' | 'utf-16le' | 'both' = 'both',
  limit = 5000,
): StringHit[] {
  const hits: StringHit[] = [];
  const min = Math.max(1, Math.trunc(minLength));

  if (mode !== 'utf-16le') {
    let start = -1;
    for (let i = 0; i <= bytes.length; i += 1) {
      const byte = i < bytes.length ? (bytes[i] as number) : 0;
      const printable = byte === 0x09 || (byte >= 0x20 && byte <= 0x7e);
      if (printable) {
        if (start < 0) start = i;
      } else if (start >= 0) {
        if (i - start >= min) pushRun(hits, bytes, start, i, 'ascii');
        start = -1;
      }
    }
  }

  if (mode !== 'ascii') {
    let start = -1;
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      const low = bytes[i] as number;
      const high = bytes[i + 1] as number;
      const printable = high === 0 && (low === 0x09 || (low >= 0x20 && low <= 0x7e));
      if (printable) {
        if (start < 0) start = i;
      } else if (start >= 0) {
        if ((i - start) / 2 >= min) pushRun(hits, bytes, start, i, 'utf-16le');
        start = -1;
      }
    }
    if (start >= 0) {
      const end = bytes.length - ((bytes.length - start) % 2);
      if ((end - start) / 2 >= min) pushRun(hits, bytes, start, end, 'utf-16le');
    }
  }

  return hits.slice(0, limit);
}

/** 头部十六进制预览（xxd 风格） */
export function hexPreview(bytes: Uint8Array, maxBytes = 256, bytesPerLine = 16): string {
  const slice = bytes.subarray(0, Math.min(maxBytes, bytes.length));
  const lines: string[] = [];
  for (let offset = 0; offset < slice.length; offset += bytesPerLine) {
    const chunk = slice.subarray(offset, offset + bytesPerLine);
    const hex = Array.from(chunk, (byte) => byte.toString(16).padStart(2, '0')).join(' ');
    const ascii = Array.from(chunk, (byte) =>
      byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.',
    ).join('');
    lines.push(`${offset.toString(16).padStart(8, '0')}  ${hex.padEnd(bytesPerLine * 3 - 1, ' ')}  |${ascii}|`);
  }
  return lines.join('\n');
}

export function sha256Hex(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

type StringMode = 'ascii' | 'utf-16le' | 'both';

const MAX_HASH_BYTES = 32 * 1024 * 1024;

export function mount(root: HTMLElement): void {
  mountPanel(root, {
    fields: [
      {
        id: 'file',
        label: '选择文件',
        kind: 'file',
        hint: '文件只在浏览器本地读取，不会上传；任意类型均可',
      },
      { id: 'minLen', label: 'strings 最小长度', kind: 'number', value: '4' },
      {
        id: 'mode',
        label: 'strings 编码',
        kind: 'select',
        value: 'both',
        options: [
          { value: 'both', label: 'ASCII + UTF-16LE' },
          { value: 'ascii', label: '仅 ASCII' },
          { value: 'utf-16le', label: '仅 UTF-16LE' },
        ],
      },
    ],
    actions: [
      {
        label: '分析文件',
        primary: true,
        run: async ({ files }) => {
          const file = files.file;
          if (!file) throw new Error('请先选择文件');

          const bytes = new Uint8Array(await file.arrayBuffer());
          const signatures = detectSignatures(bytes);
          const isText = looksLikeText(bytes);

          const lines = [
            `文件：${file.name || '(未命名)'}`,
            `大小：${formatBytes(bytes.length)}（${bytes.length} 字节）`,
            `浏览器声明类型：${file.type || '未知'}`,
          ];

          if (bytes.length <= MAX_HASH_BYTES) {
            lines.push(`SHA-256：${sha256Hex(bytes)}`);
          } else {
            lines.push('SHA-256：文件超过 32 MiB，已跳过（避免长时间占用主线程）');
          }

          lines.push('', '--- 魔数识别 ---');
          if (signatures.length > 0) {
            for (const sig of signatures) {
              const ext = sig.ext ? `建议扩展名 ${sig.ext}，` : '';
              lines.push(
                `${sig.name}（${ext}${sig.mime}）`,
                `  魔数 ${sig.magic} @ offset ${sig.offset}${sig.note ? ` · ${sig.note}` : ''}`,
              );
            }
          } else if (isText) {
            lines.push('未命中已知魔数；内容看起来是文本（源码 / 配置 / Base64 / 日志等）');
          } else {
            lines.push('未命中已知魔数；可能是加密 / 压缩后的数据，或未知格式');
          }

          lines.push('', '--- 头部 256 字节 ---', hexPreview(bytes, 256));

          return {
            output: lines.join('\n'),
            status: {
              text: signatures.length > 0 ? `识别到 ${signatures.length} 个候选类型` : '未命中已知魔数',
              kind: signatures.length > 0 ? 'ok' : 'warn',
            },
          };
        },
      },
      {
        label: '提取 strings',
        run: async ({ files, values }) => {
          const file = files.file;
          if (!file) throw new Error('请先选择文件');

          const bytes = new Uint8Array(await file.arrayBuffer());
          const minLength = Math.max(1, Number.parseInt(values.minLen ?? '4', 10) || 4);
          const mode = (values.mode ?? 'both') as StringMode;
          const hits = extractStrings(bytes, minLength, mode, 3000);

          if (hits.length === 0) {
            return {
              output: '',
              status: { text: `没有找到长度 ≥ ${minLength} 的可打印字符串`, kind: 'warn' },
            };
          }

          const lines = hits.map(
            (hit) => `${hit.offset.toString(16).padStart(8, '0')}  ${hit.encoding.padEnd(8)}  ${hit.text}`,
          );
          return {
            output: lines.join('\n'),
            status: { text: `共 ${hits.length} 条（单次最多显示 3000 条）`, kind: 'ok' },
          };
        },
      },
    ],
    outputLabel: '结果',
    outputRows: 16,
    note: '魔数只能判断"声称的类型"：ZIP 可能是 docx/apk，改过文件头的文件需要结合 strings 与 hex 判断。',
  });
}
