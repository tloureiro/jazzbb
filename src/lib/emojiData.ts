import emojiDataset from 'emojibase-data/en/data.json';
import emojiShortcodes from 'emojibase-data/en/shortcodes/emojibase.json';

type RawEmoji = {
  label: string;
  hexcode: string;
  emoji?: string;
  text?: string;
  tags?: string[];
  order?: number;
  skins?: RawEmoji[];
};

type ShortcodeMap = Record<string, string | string[]>;

export type EmojiSuggestion = {
  hexcode: string;
  emoji: string;
  label: string;
  shortcodes: string[];
};

type EmojiSearchEntry = EmojiSuggestion & {
  normalizedLabel: string;
  normalizedShortcodes: string[];
  normalizedTags: string[];
  order: number;
};

const DEFAULT_EMOJI_HEXCODES = [
  '1F600', // 😀 grinning face
  '1F604', // 😄 grinning face with smiling eyes
  '1F602', // 😂 face with tears of joy
  '1F923', // 🤣 rolling on the floor laughing
  '1F60D', // 😍 smiling face with heart-eyes
  '1F642', // 🙂 slightly smiling face
  '1F609', // 😉 winking face
  '1F60A', // 😊 smiling face with smiling eyes
  '1F914', // 🤔 thinking face
  '1F644', // 🙄 face with rolling eyes
  '1F44D', // 👍 thumbs up
  '1F44F', // 👏 clapping hands
  '1F64F', // 🙏 folded hands
  '1F389', // 🎉 party popper
  '2728',  // ✨ sparkles
  '1F525', // 🔥 fire
  '2764',  // ❤️ red heart
  '1F4A1', // 💡 light bulb
  '1F4DD', // 📝 memo
  '1F680', // 🚀 rocket
  '1F440', // 👀 eyes
  '2705',  // ✅ check mark button
];

const EXCLUDED_LABEL_PREFIXES = ['regional indicator', 'keycap'];

const shortcodeMap = emojiShortcodes as ShortcodeMap;

const toShortcodeArray = (value: string | string[] | undefined): string[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const normalizeToken = (token: string): string =>
  token
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeShortcodes = (codes: string[]): string[] => {
  const normalized = new Set<string>();
  codes.forEach((code) => {
    const trimmed = code.replace(/^:+|:+$/g, '');
    if (!trimmed) return;
    normalized.add(normalizeToken(trimmed));
    if (trimmed.includes('_')) {
      normalized.add(normalizeToken(trimmed.replace(/_/g, ' ')));
    }
  });
  return Array.from(normalized);
};

const rawEmojis = (emojiDataset as RawEmoji[]).flatMap((emoji) => {
  const baseTags = emoji.tags ?? [];
  const variants = emoji.skins?.map((skin) => ({
    ...skin,
    tags: baseTags,
  }));
  return [emoji, ...(variants ?? [])];
});

const emojiSearchEntries: EmojiSearchEntry[] = rawEmojis
  .filter((emoji) => emoji.emoji || emoji.text)
  .filter((emoji) => emoji.label)
  .filter((emoji) => !EXCLUDED_LABEL_PREFIXES.some((prefix) => emoji.label.toLowerCase().startsWith(prefix)))
  .map((emoji) => {
    const shortcodes = toShortcodeArray(shortcodeMap[emoji.hexcode]);
    const normalizedShortcodes = normalizeShortcodes(shortcodes);
    const normalizedLabel = normalizeToken(emoji.label);
    const normalizedTags = Array.from(
      new Set((emoji.tags ?? []).map((tag) => normalizeToken(tag)).filter(Boolean)),
    );
    return {
      hexcode: emoji.hexcode,
      emoji: (emoji.emoji ?? emoji.text ?? '').replace(/\uFE0E/g, ''),
      label: emoji.label,
      shortcodes,
      normalizedLabel,
      normalizedShortcodes,
      normalizedTags,
      order: emoji.order ?? Number.MAX_SAFE_INTEGER,
    };
  })
  .filter((entry, index, array) => array.findIndex((item) => item.hexcode === entry.hexcode) === index)
  .filter((entry) => entry.emoji.length > 0);

const defaultSet = new Set(DEFAULT_EMOJI_HEXCODES);

const stripEntry = (entry: EmojiSearchEntry): EmojiSuggestion => ({
  hexcode: entry.hexcode,
  emoji: entry.emoji,
  label: entry.label,
  shortcodes: entry.shortcodes,
});

export const defaultEmojiSuggestions: EmojiSuggestion[] = emojiSearchEntries
  .filter((entry) => defaultSet.has(entry.hexcode))
  .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
  .map(stripEntry);

const computeScore = (entry: EmojiSearchEntry, normalizedQuery: string, rawQuery: string): number => {
  let score = Number.POSITIVE_INFINITY;

  if (rawQuery && entry.emoji === rawQuery) {
    score = Math.min(score, 0);
  }

  if (!normalizedQuery) {
    return score;
  }

  if (entry.normalizedLabel === normalizedQuery) {
    score = Math.min(score, 1);
  } else if (entry.normalizedLabel.startsWith(normalizedQuery)) {
    score = Math.min(score, 3);
  } else if (entry.normalizedLabel.includes(normalizedQuery)) {
    score = Math.min(score, 6);
  }

  entry.normalizedShortcodes.forEach((code) => {
    if (code === normalizedQuery) {
      score = Math.min(score, 0);
    } else if (code.startsWith(normalizedQuery)) {
      score = Math.min(score, 2);
    } else if (code.includes(normalizedQuery)) {
      score = Math.min(score, 5);
    }
  });

  entry.normalizedTags.forEach((tag) => {
    if (tag === normalizedQuery) {
      score = Math.min(score, 4);
    } else if (tag.startsWith(normalizedQuery)) {
      score = Math.min(score, 7);
    } else if (tag.includes(normalizedQuery)) {
      score = Math.min(score, 8);
    }
  });

  return score;
};

export const findEmojiSuggestions = (query: string, limit = 30): EmojiSuggestion[] => {
  const rawQuery = query.trim();
  const normalizedQuery = normalizeToken(rawQuery);

  if (!normalizedQuery) {
    return defaultEmojiSuggestions.slice(0, limit);
  }

  return emojiSearchEntries
    .map((entry) => ({
      entry,
      score: computeScore(entry, normalizedQuery, rawQuery),
    }))
    .filter(({ score }) => Number.isFinite(score))
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.entry.order - b.entry.order ||
        a.entry.label.localeCompare(b.entry.label),
    )
    .slice(0, limit)
    .map(({ entry }) => stripEntry(entry));
};

