export type ShortcutPlatform = 'mac' | 'windows';

export type ShortcutGroupId = 'general' | 'vault';

export type ShortcutBinding = {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
};

export type ShortcutDefinition = {
  id: ShortcutId;
  description: string;
  mac: ShortcutBinding;
  windows: ShortcutBinding;
  note?: string;
  group: ShortcutGroupId;
};

export type ShortcutId =
  | 'save-note'
  | 'open-shortcuts'
  | 'toggle-top-bar'
  | 'toggle-outline'
  | 'toggle-sidebar'
  | 'open-file'
  | 'close-document'
  | 'toggle-grammar-checks'
  | 'toggle-heading-collapse'
  | 'toggle-frontmatter-editor'
  | 'toggle-frontmatter-panel'
  | 'toggle-plain-markdown'
  | 'delete-line'
  | 'escape'
  | 'search-notes'
  | 'new-note'
  | 'open-command-palette';

export type ShortcutGroup = {
  title: string;
  items: Array<{ id: ShortcutId; keys: string; description: string; note?: string; custom: boolean }>;
};

type ShortcutOverrides = Partial<Record<ShortcutId, Partial<Record<ShortcutPlatform, ShortcutBinding>>>>;

const SHORTCUT_STORAGE_KEY = 'jazzbb::shortcuts';

const GROUP_LABELS: Record<ShortcutGroupId, string> = {
  general: 'General',
  vault: 'Vault mode',
};

const GROUP_ORDER: ShortcutGroupId[] = ['general', 'vault'];

const shortcutMap = new Map<ShortcutId, ShortcutDefinition>();

const shortcutListeners = new Set<() => void>();

function notifyShortcutListeners() {
  shortcutListeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.warn('Shortcut listener threw', error);
    }
  });
}

export function subscribeToShortcutChanges(listener: () => void): () => void {
  shortcutListeners.add(listener);
  return () => {
    shortcutListeners.delete(listener);
  };
}

function normalizeKeyIdentifier(key: string): string {
  const value = key.trim();
  if (!value) return '';
  const lowered = value.toLowerCase();
  switch (lowered) {
    case ' ':
    case 'space':
    case 'spacebar':
      return 'space';
    case 'esc':
      return 'escape';
    default:
      return lowered;
  }
}

function cloneBinding(binding: ShortcutBinding): ShortcutBinding {
  return {
    key: binding.key,
    meta: Boolean(binding.meta),
    ctrl: Boolean(binding.ctrl),
    alt: Boolean(binding.alt),
    shift: Boolean(binding.shift),
  };
}

function normalizeBinding(binding: ShortcutBinding): ShortcutBinding {
  return {
    key: normalizeKeyIdentifier(binding.key),
    meta: Boolean(binding.meta),
    ctrl: Boolean(binding.ctrl),
    alt: Boolean(binding.alt),
    shift: Boolean(binding.shift),
  };
}

function isModifierOnly(binding: ShortcutBinding): boolean {
  return !binding.key || binding.key === 'meta' || binding.key === 'control' || binding.key === 'shift' || binding.key === 'alt';
}

const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  {
    id: 'save-note',
    description: 'Save the current note',
    mac: { key: 's', meta: true },
    windows: { key: 's', ctrl: true },
    group: 'general',
  },
  {
    id: 'open-shortcuts',
    description: 'Open this shortcuts panel',
    mac: { key: '/', meta: true },
    windows: { key: '/', ctrl: true },
    group: 'general',
  },
  {
    id: 'open-command-palette',
    description: 'Open the command palette',
    mac: { key: 'k', meta: true },
    windows: { key: 'k', ctrl: true },
    group: 'general',
  },
  {
    id: 'toggle-top-bar',
    description: 'Toggle the top bar',
    mac: { key: 'h', meta: true, shift: true },
    windows: { key: 'h', ctrl: true, shift: true },
    group: 'general',
  },
  {
    id: 'toggle-sidebar',
    description: 'Toggle the vault sidebar',
    mac: { key: 'b', meta: true, shift: true },
    windows: { key: 'b', ctrl: true, shift: true },
    group: 'general',
    note: 'Vault only',
  },
  {
    id: 'toggle-outline',
    description: 'Toggle the outline panel',
    mac: { key: 'o', meta: true, shift: true },
    windows: { key: 'o', ctrl: true, shift: true },
    group: 'general',
  },
  {
    id: 'open-file',
    description: 'Open a Markdown file',
    mac: { key: 'o', meta: true, alt: true },
    windows: { key: 'o', ctrl: true, alt: true },
    group: 'general',
  },
  {
    id: 'close-document',
    description: 'Close the current document',
    mac: { key: 'w', meta: true, alt: true },
    windows: { key: 'w', ctrl: true, alt: true },
    group: 'general',
  },
  {
    id: 'toggle-grammar-checks',
    description: 'Toggle grammar checks (browser + Grammarly)',
    mac: { key: 'g', meta: true, alt: true },
    windows: { key: 'g', ctrl: true, alt: true },
    group: 'general',
  },
  {
    id: 'toggle-heading-collapse',
    description: 'Toggle heading collapse for the current section',
    mac: { key: 'k', meta: true, alt: true },
    windows: { key: 'k', ctrl: true, alt: true },
    group: 'general',
  },
  {
    id: 'toggle-frontmatter-editor',
    description: 'Toggle the inline frontmatter editor',
    mac: { key: 'f', meta: true, alt: true },
    windows: { key: 'f', ctrl: true, alt: true },
    group: 'general',
  },
  {
    id: 'toggle-frontmatter-panel',
    description: 'Toggle the frontmatter panel',
    mac: { key: 'f', meta: true, alt: true, shift: true },
    windows: { key: 'f', ctrl: true, alt: true, shift: true },
    group: 'general',
  },
  {
    id: 'toggle-plain-markdown',
    description: 'Toggle plain Markdown view',
    mac: { key: 'm', meta: true, alt: true },
    windows: { key: 'm', ctrl: true, alt: true },
    group: 'general',
  },
  {
    id: 'delete-line',
    description: 'Delete the current line',
    mac: { key: 'd', meta: true },
    windows: { key: 'd', ctrl: true },
    group: 'general',
  },
  {
    id: 'escape',
    description: 'Close search or dismiss dialogs',
    mac: { key: 'escape' },
    windows: { key: 'escape' },
    group: 'general',
  },
  {
    id: 'search-notes',
    description: 'Search notes',
    mac: { key: 'p', meta: true },
    windows: { key: 'p', ctrl: true },
    group: 'vault',
    note: 'Vault only',
  },
  {
    id: 'new-note',
    description: 'Create a new note',
    mac: { key: 'n', meta: true },
    windows: { key: 'n', ctrl: true },
    group: 'vault',
    note: 'Vault only',
  },
];

for (const item of SHORTCUT_DEFINITIONS) {
  shortcutMap.set(item.id, item);
}

let cachedPlatform: ShortcutPlatform | undefined;
let cachedOverrides: ShortcutOverrides | null = null;

function detectPlatform(): ShortcutPlatform {
  if (cachedPlatform) return cachedPlatform;
  if (typeof navigator === 'undefined') {
    cachedPlatform = 'mac';
    return cachedPlatform;
  }
  const platformSource =
    (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    navigator.userAgent ??
    '';
  const normalized = platformSource.toLowerCase();
  cachedPlatform = normalized.includes('mac') || normalized.includes('iphone') || normalized.includes('ipad')
    ? 'mac'
    : 'windows';
  return cachedPlatform;
}

function readStoredOverrides(): ShortcutOverrides {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(SHORTCUT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ShortcutOverrides;
    const sanitized: ShortcutOverrides = {};
    for (const [id, platformOverrides] of Object.entries(parsed) as [ShortcutId, Partial<Record<ShortcutPlatform, ShortcutBinding>>][]) {
      const target: Partial<Record<ShortcutPlatform, ShortcutBinding>> = {};
      for (const [platformKey, binding] of Object.entries(platformOverrides ?? {}) as [
        ShortcutPlatform,
        ShortcutBinding,
      ][]) {
        if (!binding || typeof binding !== 'object') {
          continue;
        }
        const normalized = normalizeBinding(binding);
        if (!normalized.key || isModifierOnly(normalized)) continue;
        target[platformKey] = normalized;
      }
      if (Object.keys(target).length > 0) {
        sanitized[id] = target;
      }
    }
    return sanitized;
  } catch (error) {
    console.warn('Failed to parse stored shortcut overrides', error);
    return {};
  }
}

function writeOverrides(overrides: ShortcutOverrides): void {
  if (typeof window === 'undefined') return;
  const hasOverrides = Object.keys(overrides).some((id) => {
    const entry = overrides[id as ShortcutId];
    return entry && (entry.mac || entry.windows);
  });
  if (!hasOverrides) {
    window.localStorage.removeItem(SHORTCUT_STORAGE_KEY);
    return;
  }
  try {
    window.localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(overrides));
  } catch (error) {
    console.warn('Failed to persist shortcut overrides', error);
  }
}

function getOverrides(): ShortcutOverrides {
  if (!cachedOverrides) {
    cachedOverrides = readStoredOverrides();
  }
  return cachedOverrides;
}

function mutateOverrides(mutator: (draft: ShortcutOverrides) => void): void {
  const next = { ...getOverrides() };
  mutator(next);
  cachedOverrides = next;
  writeOverrides(next);
  notifyShortcutListeners();
}

export function getActiveShortcutPlatform(): ShortcutPlatform {
  return detectPlatform();
}

export function getShortcutDefinition(id: ShortcutId): ShortcutDefinition | undefined {
  return shortcutMap.get(id);
}

function resolveBinding(id: ShortcutId, platform: ShortcutPlatform): ShortcutBinding | undefined {
  const override = getOverrides()[id]?.[platform];
  if (override) {
    return cloneBinding(override);
  }
  const definition = shortcutMap.get(id);
  if (!definition) return undefined;
  const binding = platform === 'mac' ? definition.mac : definition.windows;
  return cloneBinding(binding);
}

export function getShortcutBinding(id: ShortcutId, platform: ShortcutPlatform = getActiveShortcutPlatform()): ShortcutBinding | undefined {
  return resolveBinding(id, platform);
}

function formatKeyLabel(key: string): string {
  if (!key) return '';
  switch (key) {
    case 'space':
      return 'Space';
    case 'escape':
      return 'Esc';
    default:
      if (key.length === 1) {
        return key.toUpperCase();
      }
      return key.replace(/(^.|\s.)/g, (match) => match.toUpperCase());
  }
}

function modifierLabels(binding: ShortcutBinding, platform: ShortcutPlatform): string[] {
  const labels: string[] = [];
  if (binding.meta) {
    labels.push(platform === 'mac' ? 'Cmd' : 'Win');
  }
  if (binding.ctrl) {
    labels.push('Ctrl');
  }
  if (binding.alt) {
    labels.push(platform === 'mac' ? 'Option' : 'Alt');
  }
  if (binding.shift) {
    labels.push('Shift');
  }
  return labels;
}

export function formatShortcutBinding(binding: ShortcutBinding, platform: ShortcutPlatform): string {
  const parts = modifierLabels(binding, platform);
  const key = formatKeyLabel(binding.key);
  if (key) {
    parts.push(key);
  }
  return parts.join(' + ');
}

export function getShortcutLabel(id: ShortcutId, platform: ShortcutPlatform = getActiveShortcutPlatform()): string {
  const binding = resolveBinding(id, platform);
  if (!binding) return '';
  return formatShortcutBinding(binding, platform);
}

export function getShortcutGroups(platform: ShortcutPlatform = getActiveShortcutPlatform()): ShortcutGroup[] {
  const groups: ShortcutGroup[] = [];
  for (const groupId of GROUP_ORDER) {
    const items = SHORTCUT_DEFINITIONS.filter((entry) => entry.group === groupId).map((entry) => {
      const binding = resolveBinding(entry.id, platform);
      const defaultBinding = platform === 'mac' ? entry.mac : entry.windows;
      const keys = binding ? formatShortcutBinding(binding, platform) : '';
      const custom =
        Boolean(getOverrides()[entry.id]?.[platform]) &&
        !!binding &&
        (binding.key !== defaultBinding.key ||
          binding.meta !== defaultBinding.meta ||
          binding.ctrl !== defaultBinding.ctrl ||
          binding.alt !== defaultBinding.alt ||
          binding.shift !== defaultBinding.shift);
      return {
        id: entry.id,
        description: entry.description,
        note: entry.note,
        keys,
        custom,
      };
    });
    if (items.length > 0) {
      groups.push({
        title: GROUP_LABELS[groupId],
        items,
      });
    }
  }
  return groups;
}

export function getPlatformDisplayName(platform: ShortcutPlatform = getActiveShortcutPlatform()): string {
  return platform === 'mac' ? 'macOS' : 'Windows & Linux';
}

export function setShortcutOverride(
  id: ShortcutId,
  binding: ShortcutBinding,
  platform: ShortcutPlatform = getActiveShortcutPlatform(),
): void {
  const normalized = normalizeBinding(binding);
  if (!normalized.key || isModifierOnly(normalized)) {
    throw new Error('Shortcut must include a non-modifier key.');
  }
  mutateOverrides((draft) => {
    const entry = { ...(draft[id] ?? {}) };
    entry[platform] = normalized;
    draft[id] = entry;
  });
}

export function resetShortcutOverride(id: ShortcutId, platform?: ShortcutPlatform): void {
  mutateOverrides((draft) => {
    if (!draft[id]) return;
    if (platform) {
      delete draft[id]?.[platform];
      if (!draft[id]?.mac && !draft[id]?.windows) {
        delete draft[id];
      }
    } else {
      delete draft[id];
    }
  });
}

export function resetAllShortcuts(platform?: ShortcutPlatform): void {
  mutateOverrides((draft) => {
    if (!platform) {
      for (const key of Object.keys(draft)) {
        delete draft[key as ShortcutId];
      }
      return;
    }
    for (const [id, entry] of Object.entries(draft) as [ShortcutId, Partial<Record<ShortcutPlatform, ShortcutBinding>>][]) {
      delete entry[platform];
      if (!entry.mac && !entry.windows) {
        delete draft[id];
      } else {
        draft[id] = entry;
      }
    }
  });
}

function normalizeEventKey(eventKey: string): string {
  if (!eventKey) return '';
  const normalized = eventKey.length === 1 ? eventKey.toLowerCase() : eventKey.toLowerCase();
  switch (normalized) {
    case ' ':
    case 'spacebar':
      return 'space';
    case 'esc':
      return 'escape';
    case 'dead':
      return '';
    default:
      return normalized;
  }
}

function eventMatchesBinding(event: KeyboardEvent, binding: ShortcutBinding): boolean {
  if (!!binding.meta !== event.metaKey) return false;
  if (!!binding.ctrl !== event.ctrlKey) return false;
  if (!!binding.alt !== event.altKey) return false;
  if (!!binding.shift !== event.shiftKey) return false;
  const key = normalizeEventKey(event.key);
  if (!key) return false;
  return key === binding.key;
}

export function isShortcutEvent(
  event: KeyboardEvent,
  id: ShortcutId,
  platform: ShortcutPlatform = getActiveShortcutPlatform(),
): boolean {
  const binding = resolveBinding(id, platform);
  if (!binding) {
    return false;
  }
  return eventMatchesBinding(event, binding);
}

export function bindingFromEvent(event: KeyboardEvent): ShortcutBinding | null {
  const key = normalizeEventKey(event.key);
  if (!key) return null;
  if (key === 'meta' || key === 'control' || key === 'shift' || key === 'alt') {
    return null;
  }
  return normalizeBinding({
    key,
    meta: event.metaKey,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
  });
}

export function findShortcutUsingBinding(
  binding: ShortcutBinding,
  platform: ShortcutPlatform = getActiveShortcutPlatform(),
  excludeId?: ShortcutId,
): ShortcutId | undefined {
  const normalized = normalizeBinding(binding);
  const candidates = SHORTCUT_DEFINITIONS.map((definition) => {
    const resolved = resolveBinding(definition.id, platform);
    if (!resolved) return null;
    const matches =
      resolved.key === normalized.key &&
      resolved.meta === normalized.meta &&
      resolved.ctrl === normalized.ctrl &&
      resolved.alt === normalized.alt &&
      resolved.shift === normalized.shift;
    if (matches && definition.id !== excludeId) {
      return definition.id;
    }
    return null;
  }).filter(Boolean) as ShortcutId[];
  return candidates[0];
}
