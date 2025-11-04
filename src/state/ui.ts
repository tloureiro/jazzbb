import { createSignal } from 'solid-js';

export type ThemeMode = 'light' | 'dark' | 'system';

export const [theme, setTheme] = createSignal<ThemeMode>('dark');
export const [isZenMode, setZenMode] = createSignal(false);
const [isHeaderCollapsedSignal, setHeaderCollapsedSignal] = createSignal(false);
const [isSidebarCollapsedSignal, setSidebarCollapsedSignal] = createSignal(false);
const [sidebarHoverSignal, setSidebarHoverSignal] = createSignal(false);

export function toggleZen(): void {
  setZenMode((prev) => !prev);
}

export const [isSearchOpen, setSearchOpen] = createSignal(false);

export type TypographyPreset = 'editorial-classic' | 'humanist-tech' | 'swiss-modern' | 'bookish-oldstyle' | 'inclusive-readability';

const [typographyPresetSignal, setTypographyPresetSignal] = createSignal<TypographyPreset>('editorial-classic');

function applyTypographyPreset(preset: TypographyPreset) {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.dataset.preset = preset;
  }
}

applyTypographyPreset(typographyPresetSignal());

function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined' || !document.documentElement) return;
  if (mode === 'system') {
    const prefersLight = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches;
    document.documentElement.dataset.theme = prefersLight ? 'light' : 'dark';
  } else {
    document.documentElement.dataset.theme = mode;
  }
}

applyTheme(theme());

export function setThemeMode(mode: ThemeMode): void {
  setTheme(() => {
    applyTheme(mode);
    return mode;
  });
}

export const typographyPreset = typographyPresetSignal;

function applyHeaderCollapsed(collapsed: boolean) {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.dataset.headerCollapsed = collapsed ? 'true' : 'false';
  }
}

applyHeaderCollapsed(isHeaderCollapsedSignal());

export const isHeaderCollapsed = isHeaderCollapsedSignal;

export function setHeaderCollapsed(collapsed: boolean): void {
  setHeaderCollapsedSignal(collapsed);
  applyHeaderCollapsed(collapsed);
}

export function toggleHeaderCollapsed(): void {
  setHeaderCollapsedSignal((prev) => {
    const next = !prev;
    applyHeaderCollapsed(next);
    return next;
  });
}

function applySidebarCollapsed(collapsed: boolean) {
  if (typeof document !== 'undefined' && document.documentElement) {
    const root = document.documentElement;
    if (collapsed) {
      const editorHeader = root.querySelector('.editor-pane .pane-header');
      if (editorHeader instanceof HTMLElement) {
        const rect = editorHeader.getBoundingClientRect();
        root.style.setProperty('--sidebar-expand-top', `${rect.top}px`);
      } else {
        root.style.setProperty('--sidebar-expand-top', '200px');
      }
    } else {
      const sidebarHeader = root.querySelector('.sidebar-header');
      if (sidebarHeader instanceof HTMLElement) {
        const rect = sidebarHeader.getBoundingClientRect();
        root.style.setProperty('--sidebar-expand-top', `${rect.top}px`);
      } else {
        root.style.removeProperty('--sidebar-expand-top');
      }
    }
    root.dataset.sidebarCollapsed = collapsed ? 'true' : 'false';
  }
}

applySidebarCollapsed(isSidebarCollapsedSignal());

export const isSidebarCollapsed = isSidebarCollapsedSignal;

function applySidebarHover(state: boolean) {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.dataset.sidebarHover = state ? 'true' : 'false';
  }
}

applySidebarHover(sidebarHoverSignal());

export const isSidebarHoverVisible = sidebarHoverSignal;

export function setSidebarHoverVisible(value: boolean): void {
  setSidebarHoverSignal(value);
  applySidebarHover(value);
}

export function setSidebarCollapsed(collapsed: boolean): void {
  setSidebarCollapsedSignal(collapsed);
  applySidebarCollapsed(collapsed);
  setSidebarHoverVisible(false);
}

export function toggleSidebarCollapsed(): void {
  setSidebarCollapsedSignal((prev) => {
    const next = !prev;
    applySidebarCollapsed(next);
    setSidebarHoverVisible(false);
    return next;
  });
}

export function setTypographyPreset(preset: TypographyPreset): void {
  setTypographyPresetSignal(preset);
  applyTypographyPreset(preset);
}

export const DEFAULT_EDITOR_FONT_SCALE = 1.40625;
export const DEFAULT_EDITOR_MEASURE_SCALE = 1;

const [editorFontScaleSignal, setEditorFontScaleSignal] = createSignal<number>(DEFAULT_EDITOR_FONT_SCALE);

function applyEditorFontScale(scale: number) {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.style.setProperty('--editor-font-scale', scale.toString());
  }
}

applyEditorFontScale(editorFontScaleSignal());

export const editorFontScale = editorFontScaleSignal;

export function setEditorFontScale(scale: number): void {
  const min = DEFAULT_EDITOR_FONT_SCALE * 0.5;
  const max = DEFAULT_EDITOR_FONT_SCALE * 2;
  const clamped = Math.min(Math.max(scale, min), max);
  setEditorFontScaleSignal(clamped);
  applyEditorFontScale(clamped);
}

const [editorMeasureScaleSignal, setEditorMeasureScaleSignal] = createSignal<number>(DEFAULT_EDITOR_MEASURE_SCALE);

function applyEditorMeasureScale(scale: number) {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.style.setProperty('--editor-measure-scale', scale.toString());
  }
}

applyEditorMeasureScale(editorMeasureScaleSignal());

export const editorMeasureScale = editorMeasureScaleSignal;

export function setEditorMeasureScale(scale: number): void {
  const clamped = Math.min(Math.max(scale, 0.6), 1.6);
  setEditorMeasureScaleSignal(clamped);
  applyEditorMeasureScale(clamped);
}

const [isInspectorVisibleSignal, setInspectorVisibleSignal] = createSignal(false);

export const isInspectorVisible = isInspectorVisibleSignal;

export function toggleInspectorVisibility(): void {
  setInspectorVisibleSignal((prev) => !prev);
}

export function setInspectorVisibility(value: boolean): void {
  setInspectorVisibleSignal(value);
}

const [isOutlineVisibleSignal, setOutlineVisibleSignal] = createSignal(false);

export const isOutlineVisible = isOutlineVisibleSignal;

export function toggleOutlineVisibility(): void {
  setOutlineVisibleSignal((prev) => !prev);
}

export function toggleTheme(): void {
  setTheme((prev) => {
    const next = prev === 'light' ? 'dark' : 'light';
    applyTheme(next);
    return next;
  });
}

export type ToastTone = 'info' | 'success' | 'error';

export type ToastMessage = {
  id: number;
  message: string;
  tone: ToastTone;
};

const [toasts, setToasts] = createSignal<ToastMessage[]>([]);
let toastCounter = 0;

export function showToast(message: string, tone: ToastTone = 'info', duration = 3000): number {
  const id = ++toastCounter;
  setToasts((prev) => [...prev, { id, message, tone }]);

  if (duration > 0 && typeof window !== 'undefined') {
    window.setTimeout(() => dismissToast(id), duration);
  }

  return id;
}

export function dismissToast(id: number): void {
  setToasts((prev) => prev.filter((toast) => toast.id !== id));
}

export { toasts };
