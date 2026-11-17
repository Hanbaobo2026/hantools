import { copyText } from '../utils/clipboard';
import { h } from '../utils/dom';

/**
 * 通用工具面板：字段 + 动作 + 结果 + 状态。
 * 所有工具复用同一套交互，避免每个页面各写一遍表单与复制逻辑；
 * 长任务统一通过 AbortSignal 取消（哈希爆破、大文本处理等）。
 */

export type StatusKind = 'info' | 'ok' | 'warn' | 'error';

export interface PanelField {
  id: string;
  label: string;
  kind?: 'textarea' | 'text' | 'select' | 'number' | 'checkbox' | 'file';
  placeholder?: string;
  rows?: number;
  options?: Array<{ value: string; label: string }>;
  value?: string;
  checked?: boolean;
  hint?: string;
  full?: boolean;
  /** 仅 kind='file' 时生效，例如 image/*,.pcap */
  accept?: string;
}

export interface PanelContext {
  values: Record<string, string>;
  checks: Record<string, boolean>;
  /** kind='file' 字段选中的本地文件（不会上传） */
  files: Record<string, File | null>;
  signal: AbortSignal;
  setOutput(text: string): void;
  getOutput(): string;
  setStatus(text: string, kind?: StatusKind): void;
  busy(value: boolean): void;
}

export type PanelResult = string | { output?: string; status?: { text: string; kind?: StatusKind } } | void;

export interface PanelAction {
  label: string;
  primary?: boolean;
  run(ctx: PanelContext): PanelResult | Promise<PanelResult>;
}

export interface PanelSpec {
  fields: PanelField[];
  actions: PanelAction[];
  outputLabel?: string;
  outputRows?: number;
  outputPlaceholder?: string;
  extras?: HTMLElement[];
  note?: string;
}

export interface PanelHandle {
  destroy(): void;
}

export function mountPanel(host: HTMLElement, spec: PanelSpec): PanelHandle {
  const inputs = new Map<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>();
  const checks = new Map<string, HTMLInputElement>();
  const fileInputs = new Map<string, HTMLInputElement>();
  let destroyed = false;
  let controller: AbortController | null = null;

  const fieldNodes = spec.fields.map((field) => {
    const id = `f-${field.id}`;
    const kind = field.kind ?? 'textarea';

    if (kind === 'checkbox') {
      const input = h('input', { attrs: { type: 'checkbox', id } });
      input.checked = Boolean(field.checked);
      checks.set(field.id, input);
      return h('label', { class: 'field field--check' }, input, h('span', { text: field.label }));
    }

    if (kind === 'file') {
      const input = h('input', {
        class: 'file-native',
        attrs: { id, type: 'file', accept: field.accept ?? '' },
      });
      const title = h('span', { class: 'dropzone__title', text: '点击选择文件，或把文件拖到这里' });
      const nameLabel = h('span', { class: 'dropzone__file', text: '未选择文件' });
      const zone = h('div', { class: 'dropzone', attrs: { role: 'button', tabindex: '0', 'aria-label': field.label } }, title, nameLabel);

      input.addEventListener('change', () => {
        nameLabel.textContent = input.files?.[0]?.name ?? '未选择文件';
      });

      zone.addEventListener('click', () => input.click());
      zone.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          input.click();
        }
      });
      zone.addEventListener('dragover', (event) => {
        event.preventDefault();
        zone.dataset.drag = 'true';
      });
      zone.addEventListener('dragleave', () => {
        delete zone.dataset.drag;
      });
      zone.addEventListener('drop', (event) => {
        event.preventDefault();
        delete zone.dataset.drag;
        const file = event.dataTransfer?.files?.[0];
        if (!file) return;
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        nameLabel.textContent = file.name;
      });

      fileInputs.set(field.id, input);
      return h(
        'div',
        { class: 'field field--full' },
        h('label', { class: 'field__label', attrs: { for: id }, text: field.label }),
        zone,
        input,
        field.hint ? h('p', { class: 'field__hint', text: field.hint }) : null,
      );
    }

    let control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    if (kind === 'textarea') {
      control = h('textarea', {
        attrs: { id, rows: field.rows ?? 6, placeholder: field.placeholder ?? '', spellcheck: 'false' },
      });
      control.value = field.value ?? '';
    } else if (kind === 'select') {
      const select = h('select', { attrs: { id } });
      for (const option of field.options ?? []) {
        select.append(h('option', { text: option.label, attrs: { value: option.value } }));
      }
      select.value = field.value ?? field.options?.[0]?.value ?? '';
      control = select;
    } else {
      const input = h('input', {
        attrs: {
          id,
          type: kind === 'number' ? 'number' : 'text',
          placeholder: field.placeholder ?? '',
          spellcheck: 'false',
        },
      });
      input.value = field.value ?? '';
      control = input;
    }
    inputs.set(field.id, control);

    return h(
      'div',
      { class: field.full || kind === 'textarea' ? 'field field--full' : 'field' },
      h('label', { class: 'field__label', attrs: { for: id }, text: field.label }),
      control,
      field.hint ? h('p', { class: 'field__hint', text: field.hint }) : null,
    );
  });

  const output = h('textarea', {
    class: 'panel__output',
    attrs: {
      rows: spec.outputRows ?? 8,
      readonly: true,
      spellcheck: 'false',
      placeholder: spec.outputPlaceholder ?? '结果会显示在这里',
      'aria-label': spec.outputLabel ?? '输出结果',
    },
  });

  const counter = h('span', { class: 'panel__counter', text: '0 字符' });
  const status = h('p', {
    class: 'panel__status',
    attrs: { 'aria-live': 'polite', role: 'status' },
  });

  const cancelButton = h('button', {
    class: 'btn btn--ghost',
    attrs: { type: 'button', hidden: true },
    text: '取消',
    on: { click: () => controller?.abort() },
  });
  function setOutput(text: string): void {
    output.value = text;
    counter.textContent = `${text.length} 字符`;
  }

  function setStatus(text: string, kind: StatusKind = 'info'): void {
    status.textContent = text;
    status.dataset.kind = kind;
  }

  function setBusy(value: boolean): void {
    cancelButton.hidden = !value;
    host.dataset.busy = value ? 'true' : 'false';
  }

  const actionButtons = spec.actions.map((action) =>
    h('button', {
      class: action.primary ? 'btn btn--primary' : 'btn',
      attrs: { type: 'button' },
      text: action.label,
      on: {
        click: () => {
          void execute(action);
        },
      },
    }),
  );

  async function execute(action: PanelAction): Promise<void> {
    if (destroyed) return;
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;

    const values: Record<string, string> = {};
    for (const [id, el] of inputs) values[id] = el.value;
    const checksValues: Record<string, boolean> = {};
    for (const [id, el] of checks) checksValues[id] = el.checked;
    const filesValues: Record<string, File | null> = {};
    for (const [id, el] of fileInputs) filesValues[id] = el.files?.[0] ?? null;

    setBusy(true);
    setStatus('处理中…', 'info');

    try {
      const result = await action.run({
        values,
        checks: checksValues,
        files: filesValues,
        signal,
        setOutput,
        getOutput: () => output.value,
        setStatus,
        busy: setBusy,
      });
      if (typeof result === 'string') {
        setOutput(result);
      } else if (result && typeof result === 'object') {
        if (typeof result.output === 'string') setOutput(result.output);
        if (result.status) setStatus(result.status.text, result.status.kind ?? 'info');
      }
      if (signal.aborted) setStatus('已取消', 'warn');
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        setStatus('已取消', 'warn');
      } else {
        setStatus(`执行失败：${(error as Error)?.message ?? String(error)}`, 'error');
      }
    } finally {
      if (!destroyed && controller?.signal === signal) setBusy(false);
    }
  }

  const copyButton = h('button', {
    class: 'btn btn--small',
    attrs: { type: 'button' },
    text: '复制结果',
    on: {
      click: () => {
        void copyText(output.value).then((ok) => {
          setStatus(ok ? '已复制到剪贴板' : '复制失败，请手动选择文本', ok ? 'ok' : 'warn');
        });
      },
    },
  });

  const clearButton = h('button', {
    class: 'btn btn--small btn--ghost',
    attrs: { type: 'button' },
    text: '清空',
    on: {
      click: () => {
        for (const el of inputs.values()) el.value = '';
        for (const el of checks.values()) el.checked = false;
        for (const el of fileInputs.values()) el.value = '';
        setOutput('');
        setStatus('');
      },
    },
  });

  const keydown = (event: KeyboardEvent): void => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      const primary = spec.actions.find((action) => action.primary) ?? spec.actions[0];
      if (primary) {
        event.preventDefault();
        void execute(primary);
      }
    }
  };
  host.addEventListener('keydown', keydown);

  host.append(
    h('div', { class: 'panel__fields' }, ...fieldNodes),
    h('div', { class: 'panel__actions' }, ...actionButtons, cancelButton),
    ...(spec.extras ?? []),
    h(
      'div',
      { class: 'panel__output-wrap' },
      h(
        'div',
        { class: 'panel__output-head' },
        h('label', { class: 'field__label', text: spec.outputLabel ?? '输出结果' }),
        counter,
        copyButton,
        clearButton,
      ),
      output,
    ),
    status,
    ...(spec.note ? [h('p', { class: 'panel__note', text: spec.note })] : []),
  );

  const handle: PanelHandle = {
    destroy() {
      destroyed = true;
      controller?.abort();
      host.removeEventListener('keydown', keydown);
      host.replaceChildren();
      activePanels.delete(handle);
    },
  };
  activePanels.add(handle);
  return handle;
}

/**
 * 全局面板登记表：路由离开时统一销毁，确保长任务（爆破、大文本处理）被中断，
 * 避免旧页面的异步回调写入已卸载的 DOM。
 */
const activePanels = new Set<PanelHandle>();

export function destroyAllPanels(): void {
  for (const panel of [...activePanels]) panel.destroy();
  activePanels.clear();
}
