import { createSignal } from 'solid-js';

export type ThemeMode = 'light' | 'dark' | 'system';

export const [theme, setTheme] = createSignal<ThemeMode>('dark');
export const [isZenMode, setZenMode] = createSignal(false);
const [isHeaderCollapsedSignal, setHeaderCollapsedSignal] = createSignal(false);
const [isSidebarCollapsedSignal, setSidebarCollapsedSignal] = createSignal(false);
const [sidebarHoverSignal, setSidebarHoverSignal] = createSignal(false);

const DEFAULT_SIDEBAR_WIDTH = 26;
const DEFAULT_OUTLINE_WIDTH = 22;
const SIDEBAR_MIN_WIDTH = 12;
const SIDEBAR_MAX_WIDTH = 45;
const OUTLINE_MIN_WIDTH = 12;
const OUTLINE_MAX_WIDTH = 38;
const MAX_COMBINED_PANELS = 76;
const LAYOUT_STORAGE_KEY = 'jazzbb::layout';

type LayoutPreferences = {
  sidebarWidth?: number;
  outlineWidth?: number;
};

function readLayoutPreferences(): LayoutPreferences | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const value = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!value) return undefined;
    return JSON.parse(value) as LayoutPreferences;
  } catch (error) {
    console.warn('Failed to read layout configuration', error);
    return undefined;
  }
}

function writeLayoutPreferences(sidebarWidth: number, outlineWidth: number): void {
  if (typeof window === 'undefined') return;
  const payload: LayoutPreferences = {
    sidebarWidth,
    outlineWidth,
  };
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to persist layout configuration', error);
  }
}

const storedLayout = readLayoutPreferences();

const [sidebarWidthPercentSignal, setSidebarWidthPercentSignal] = createSignal<number>(
  typeof storedLayout?.sidebarWidth === 'number' ? storedLayout.sidebarWidth : DEFAULT_SIDEBAR_WIDTH,
);

const [outlineWidthPercentSignal, setOutlineWidthPercentSignal] = createSignal<number>(
  typeof storedLayout?.outlineWidth === 'number' ? storedLayout.outlineWidth : DEFAULT_OUTLINE_WIDTH,
);

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

export type ColorSchemeId = 'midnight-jazz' | 'aurora-glow' | 'ember-dawn' | 'cobalt-serenade' | 'forest-echo';

type ColorSchemeDefinition = {
  id: ColorSchemeId;
  label: string;
  description: string;
};

const COLOR_SCHEME_STORAGE_KEY = 'jazzbb::color-scheme';
const COLOR_SCHEME_MIGRATION_KEY = 'jazzbb::color-scheme::migrated';
export const DEFAULT_COLOR_SCHEME_ID: ColorSchemeId = 'cobalt-serenade';
export const COLOR_SCHEME_VERSION = 1;

const COLOR_SCHEME_OPTIONS: readonly ColorSchemeDefinition[] = [
  { id: 'cobalt-serenade', label: 'Cobalt Serenade', description: 'Midnight blues and electric cyan accents' },
  { id: 'midnight-jazz', label: 'Midnight Jazz', description: 'Violet neon with smoky blues' },
  { id: 'aurora-glow', label: 'Aurora Glow', description: 'Teal + mint gradients inspired by northern skies' },
  { id: 'ember-dawn', label: 'Ember Dawn', description: 'Soft ambers with copper cues' },
  { id: 'forest-echo', label: 'Forest Echo', description: 'Earthy greens with moss highlights' },
];

const COLOR_SCHEME_IDS = new Set<ColorSchemeId>(COLOR_SCHEME_OPTIONS.map((option) => option.id));
const LEGACY_DEFAULT_COLOR_SCHEME: ColorSchemeId = 'midnight-jazz';

export function normalizeColorSchemeId(value: string | null | undefined): ColorSchemeId {
  if (typeof value === 'string' && COLOR_SCHEME_IDS.has(value as ColorSchemeId)) {
    return value as ColorSchemeId;
  }
  return DEFAULT_COLOR_SCHEME_ID;
}

function readColorSchemePreference(): ColorSchemeId {
  if (typeof window === 'undefined') {
    return DEFAULT_COLOR_SCHEME_ID;
  }
  try {
    const stored = window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
    const normalized = normalizeColorSchemeId(stored);
    const hasMigrated = window.localStorage.getItem(COLOR_SCHEME_MIGRATION_KEY) === '1';
    if (
      stored === LEGACY_DEFAULT_COLOR_SCHEME &&
      normalized === LEGACY_DEFAULT_COLOR_SCHEME &&
      DEFAULT_COLOR_SCHEME_ID !== LEGACY_DEFAULT_COLOR_SCHEME &&
      !hasMigrated
    ) {
      try {
        window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, DEFAULT_COLOR_SCHEME_ID);
        window.localStorage.setItem(COLOR_SCHEME_MIGRATION_KEY, '1');
      } catch (error) {
        console.warn('Failed to migrate color scheme preference', error);
      }
      return DEFAULT_COLOR_SCHEME_ID;
    }
    if (!hasMigrated) {
      window.localStorage.setItem(COLOR_SCHEME_MIGRATION_KEY, '1');
    }
    return normalized;
  } catch (error) {
    console.warn('Failed to read color scheme preference', error);
    return DEFAULT_COLOR_SCHEME_ID;
  }
}

const [colorSchemeSignal, setColorSchemeSignal] = createSignal<ColorSchemeId>(readColorSchemePreference());

function applyColorScheme(scheme: ColorSchemeId) {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.dataset.colorScheme = scheme;
  }
}

applyColorScheme(colorSchemeSignal());

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
export const colorScheme = colorSchemeSignal;
export const colorSchemeOptions = COLOR_SCHEME_OPTIONS;

export function setColorScheme(scheme: ColorSchemeId): void {
  const normalized = normalizeColorSchemeId(scheme);
  setColorSchemeSignal(() => {
    applyColorScheme(normalized);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, normalized);
      } catch (error) {
        console.warn('Failed to persist color scheme preference', error);
      }
    }
    return normalized;
  });
}

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

const [plainMarkdownModeSignal, setPlainMarkdownModeSignal] = createSignal(false);

export const isPlainMarkdownMode = plainMarkdownModeSignal;

export function togglePlainMarkdownMode(): void {
  setPlainMarkdownModeSignal((prev) => !prev);
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

export const DEFAULT_EDITOR_FONT_SCALE = 1.1953125;
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

const [isOutlineVisibleSignal, setOutlineVisibleSignal] = createSignal(false);

export const isOutlineVisible = isOutlineVisibleSignal;

export function toggleOutlineVisibility(): void {
  setOutlineVisibleSignal((prev) => !prev);
}

function clampPercent(value: number, min: number, max: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export const sidebarWidthPercent = sidebarWidthPercentSignal;

export function setSidebarWidthPercent(value: number): void {
  const sidebar = clampPercent(value, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH);
  let outline = outlineWidthPercentSignal();
  if (sidebar + outline > MAX_COMBINED_PANELS) {
    outline = clampPercent(MAX_COMBINED_PANELS - sidebar, OUTLINE_MIN_WIDTH, OUTLINE_MAX_WIDTH);
    setOutlineWidthPercentSignal(outline);
  }
  setSidebarWidthPercentSignal(sidebar);
  writeLayoutPreferences(sidebar, outline);
}

export function resetSidebarWidthPercent(): void {
  setSidebarWidthPercent(DEFAULT_SIDEBAR_WIDTH);
}

export const outlineWidthPercent = outlineWidthPercentSignal;

export function setOutlineWidthPercent(value: number): void {
  const outline = clampPercent(value, OUTLINE_MIN_WIDTH, OUTLINE_MAX_WIDTH);
  let sidebar = sidebarWidthPercentSignal();
  if (sidebar + outline > MAX_COMBINED_PANELS) {
    sidebar = clampPercent(MAX_COMBINED_PANELS - outline, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH);
    setSidebarWidthPercentSignal(sidebar);
  }
  setOutlineWidthPercentSignal(outline);
  writeLayoutPreferences(sidebar, outline);
}

export function resetOutlineWidthPercent(): void {
  setOutlineWidthPercent(DEFAULT_OUTLINE_WIDTH);
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
