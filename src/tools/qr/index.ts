import jsQR from 'jsqr';
import * as QRCode from 'qrcode';
import { mountPanel } from '../../components/ToolPanel';
import { h } from '../../utils/dom';

/**
 * 二维码生成 / 识别。
 * 生成走 qrcode（MIT，浏览器构建），识别走 jsQR（Apache-2.0）。
 * 识别只读取本地图片像素，不上传；二维码始终用深色模块 + 白底，保证手机可扫。
 */

export type Ecc = 'L' | 'M' | 'Q' | 'H';

export interface QrOptions {
  errorCorrectionLevel: Ecc;
  width: number;
  margin: number;
  color: { dark: string; light: string };
}

export function qrOptions(ecc: string, size: number, margin: number): QrOptions {
  const level: Ecc = (['L', 'M', 'Q', 'H'] as Ecc[]).includes(ecc as Ecc) ? (ecc as Ecc) : 'M';
  const width = Math.min(1024, Math.max(128, Number.isFinite(size) ? Math.round(size) : 256));
  const marginValue = Math.min(10, Math.max(0, Number.isFinite(margin) ? Math.round(margin) : 2));
  return { errorCorrectionLevel: level, width, margin: marginValue, color: { dark: '#04060f', light: '#ffffff' } };
}

export interface QrDecoded {
  data: string;
  version: number;
}

export function decodeQrPixels(data: Uint8ClampedArray, width: number, height: number): QrDecoded {
  const result = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
  if (!result) throw new Error('没有识别到二维码：换一张更清晰或对比度更高的图片试试');
  return { data: result.data, version: result.version };
}

export async function decodeQrFile(file: File): Promise<QrDecoded> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器无法创建 Canvas 上下文');
  context.drawImage(bitmap, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return decodeQrPixels(image.data, image.width, image.height);
}

export function mount(root: HTMLElement): void {
  const canvas = h('canvas', {
    class: 'qr-canvas',
    attrs: { width: '256', height: '256', 'aria-label': '二维码预览' },
  });
  const download = h('a', {
    class: 'btn btn--small',
    attrs: { download: 'qrcode.png', href: '#' },
    text: '下载 PNG',
  });
  download.addEventListener('click', (event) => {
    if (download.getAttribute('href') === '#') event.preventDefault();
  });
  const preview = h('div', { class: 'qr-preview', attrs: { hidden: true } }, canvas, download);

  mountPanel(root, {
    fields: [
      {
        id: 'content',
        label: '文本 / URL（生成用）',
        kind: 'textarea',
        rows: 4,
        placeholder: '要编码进二维码的内容，例如 flag{...} 或 https://…',
      },
      {
        id: 'ecc',
        label: '纠错等级',
        kind: 'select',
        value: 'M',
        options: [
          { value: 'L', label: 'L（约 7%，容量最大）' },
          { value: 'M', label: 'M（约 15%，默认）' },
          { value: 'Q', label: 'Q（约 25%）' },
          { value: 'H', label: 'H（约 30%，最耐污损）' },
        ],
      },
      { id: 'size', label: '尺寸（px，128–1024）', kind: 'number', value: '256' },
      { id: 'margin', label: '留白（模块数 0–10）', kind: 'number', value: '2' },
      {
        id: 'image',
        label: '二维码图片（识别用）',
        kind: 'file',
        accept: 'image/*',
        hint: '支持拖拽；图片只在本机解析，不会上传',
      },
    ],
    extras: [preview],
    actions: [
      {
        label: '生成二维码',
        primary: true,
        run: async ({ values }) => {
          const text = (values.content ?? '').trim();
          if (text === '') throw new Error('请输入要生成二维码的文本');
          const options = qrOptions(
            values.ecc ?? 'M',
            Number.parseInt(values.size ?? '256', 10),
            Number.parseInt(values.margin ?? '2', 10),
          );
          await QRCode.toCanvas(canvas, text, options);
          preview.hidden = false;
          download.setAttribute('href', canvas.toDataURL('image/png'));
          return {
            output: text,
            status: {
              text: `已生成 ${options.width}px 二维码 · 纠错 ${options.errorCorrectionLevel}`,
              kind: 'ok',
            },
          };
        },
      },
      {
        label: '识别图片',
        run: async ({ files }) => {
          const file = files.image;
          if (!file) throw new Error('请先选择二维码图片');
          const decoded = await decodeQrFile(file);
          return {
            output: decoded.data,
            status: { text: `识别成功 · 版本 ${decoded.version || '未知'}`, kind: 'ok' },
          };
        },
      },
      {
        label: '识别预览',
        run: () => {
          if (preview.hidden) throw new Error('请先生成二维码，或上传图片后用「识别图片」');
          const context = canvas.getContext('2d');
          if (!context) throw new Error('当前浏览器无法读取 Canvas');
          const image = context.getImageData(0, 0, canvas.width, canvas.height);
          const decoded = decodeQrPixels(image.data, image.width, image.height);
          return {
            output: decoded.data,
            status: { text: '预览二维码解码成功', kind: 'ok' },
          };
        },
      },
    ],
    outputLabel: '结果',
    outputRows: 6,
    note: '识别采用 attemptBoth（含反色二维码）；生成时固定深色模块 + 白底，避免深色主题下手机扫不出来。',
  });
}
