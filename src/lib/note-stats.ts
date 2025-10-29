export type NoteStats = {
  words: number;
  characters: number;
  lines: number;
  headings: number;
  tasks: {
    total: number;
    completed: number;
  };
};

const EMPTY_STATS: NoteStats = {
  words: 0,
  characters: 0,
  lines: 0,
  headings: 0,
  tasks: {
    total: 0,
    completed: 0,
  },
};

export function analyzeMarkdownStats(markdown: string | undefined | null): NoteStats {
  if (!markdown) {
    return { ...EMPTY_STATS, tasks: { ...EMPTY_STATS.tasks } };
  }

  const text = markdown.replace(/\r\n?/g, '\n');
  const normalized = text.replace(/\[[ xX]\]/g, ' ');
  const lines = text === '' ? 0 : text.split('\n').filter((line) => line.trim().length > 0).length;

  const words = (normalized.match(/\b[\p{L}\p{N}][\p{L}\p{N}'-]*\b/gu) ?? []).length;
  const characters = text.length;
  const headings = (text.match(/^\s*#{1,6}\s+/gm) ?? []).length;

  const taskMatches = [...text.matchAll(/^\s*(?:[-*+]\s+|\d+\.\s+)\[([ xX])\]/gm)];
  const totalTasks = taskMatches.length;
  const completed = taskMatches.filter((match) => match[1].toLowerCase() === 'x').length;

  return {
    words,
    characters,
    lines,
    headings,
    tasks: {
      total: totalTasks,
      completed,
    },
  };
}

export function hasUnsavedChanges(draft: string, persisted: string): boolean {
  return draft !== persisted;
}
