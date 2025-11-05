export type ShortcutPlatform = 'mac' | 'windows';

export type ShortcutGroupId = 'general' | 'vault';

export type ShortcutDefinition = {
  id: ShortcutId;
  description: string;
  mac: string;
  windows: string;
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
  | 'toggle-grammarly'
  | 'toggle-heading-collapse'
  | 'toggle-plain-markdown'
  | 'delete-line'
  | 'escape'
  | 'search-notes'
  | 'new-note';

export type ShortcutGroup = {
  title: string;
  items: Array<{ keys: string; description: string; note?: string }>;
};

const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  {
    id: 'save-note',
    description: 'Save the current note',
    mac: 'Cmd + S',
    windows: 'Ctrl + S',
    group: 'general',
  },
  {
    id: 'open-shortcuts',
    description: 'Open this shortcuts panel',
    mac: 'Cmd + /',
    windows: 'Ctrl + /',
    group: 'general',
  },
  {
    id: 'toggle-top-bar',
    description: 'Toggle the top bar',
    mac: 'Cmd + Shift + H',
    windows: 'Ctrl + Shift + H',
    group: 'general',
  },
  {
    id: 'toggle-sidebar',
    description: 'Toggle the vault sidebar',
    mac: 'Cmd + Shift + B',
    windows: 'Ctrl + Shift + B',
    group: 'general',
    note: 'Vault only',
  },
  {
    id: 'toggle-outline',
    description: 'Toggle the outline panel',
    mac: 'Cmd + Shift + O',
    windows: 'Ctrl + Shift + O',
    group: 'general',
  },
  {
    id: 'open-file',
    description: 'Open a Markdown file',
    mac: 'Cmd + Option + O',
    windows: 'Ctrl + Alt + O',
    group: 'general',
  },
  {
    id: 'close-document',
    description: 'Close the current document',
    mac: 'Cmd + Option + W',
    windows: 'Ctrl + Alt + W',
    group: 'general',
  },
  {
    id: 'toggle-grammarly',
    description: 'Toggle Grammarly overlays',
    mac: 'Cmd + Option + G',
    windows: 'Ctrl + Alt + G',
    group: 'general',
  },
  {
    id: 'toggle-heading-collapse',
    description: 'Toggle heading collapse for the current section',
    mac: 'Cmd + Option + K',
    windows: 'Ctrl + Alt + K',
    group: 'general',
  },
  {
    id: 'toggle-plain-markdown',
    description: 'Toggle plain Markdown view',
    mac: 'Cmd + Option + M',
    windows: 'Ctrl + Alt + M',
    group: 'general',
  },
  {
    id: 'delete-line',
    description: 'Delete the current line',
    mac: 'Cmd + D',
    windows: 'Ctrl + D',
    group: 'general',
  },
  {
    id: 'escape',
    description: 'Close search or dismiss dialogs',
    mac: 'Escape',
    windows: 'Escape',
    group: 'general',
  },
  {
    id: 'search-notes',
    description: 'Search notes',
    mac: 'Cmd + P',
    windows: 'Ctrl + P',
    group: 'vault',
    note: 'Vault only',
  },
  {
    id: 'new-note',
    description: 'Create a new note',
    mac: 'Cmd + N',
    windows: 'Ctrl + N',
    group: 'vault',
    note: 'Vault only',
  },
];

const GROUP_LABELS: Record<ShortcutGroupId, string> = {
  general: 'General',
  vault: 'Vault mode',
};

const GROUP_ORDER: ShortcutGroupId[] = ['general', 'vault'];

const shortcutMap = new Map<ShortcutId, ShortcutDefinition>();
for (const item of SHORTCUT_DEFINITIONS) {
  shortcutMap.set(item.id, item);
}

let cachedPlatform: ShortcutPlatform | undefined;

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

export function getActiveShortcutPlatform(): ShortcutPlatform {
  return detectPlatform();
}

export function getShortcutLabel(id: ShortcutId, platform: ShortcutPlatform = getActiveShortcutPlatform()): string {
  const entry = shortcutMap.get(id);
  if (!entry) {
    return '';
  }
  return platform === 'mac' ? entry.mac : entry.windows;
}

export function getShortcutGroups(platform: ShortcutPlatform = getActiveShortcutPlatform()): ShortcutGroup[] {
  const groups: ShortcutGroup[] = [];
  for (const groupId of GROUP_ORDER) {
    const items = SHORTCUT_DEFINITIONS.filter((entry) => entry.group === groupId).map((entry) => ({
      keys: platform === 'mac' ? entry.mac : entry.windows,
      description: entry.description,
      note: entry.note,
    }));
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
