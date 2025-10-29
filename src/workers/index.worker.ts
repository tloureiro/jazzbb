import { expose } from 'comlink';
import FlexSearch, { Index } from 'flexsearch';

export type SearchHit = {
  path: string;
  title: string;
  snippet: string;
};

export type DocumentRecord = {
  path: string;
  title: string;
  text: string;
};

function makeSnippet(text: string, query: string): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) {
    return text.slice(0, 160);
  }

  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + query.length + 40);
  return text.slice(start, end);
}

class SearchIndex {
  private index: Index<string>;
  private docs: Map<string, DocumentRecord> = new Map();

  constructor() {
    this.index = new FlexSearch.Index({ tokenize: 'forward', preset: 'performance' });
  }

  upsert(doc: DocumentRecord) {
    this.docs.set(doc.path, doc);
    this.index.add(doc.path, doc.text);
  }

  remove(path: string) {
    this.docs.delete(path);
    this.index.remove(path);
  }

  async search(query: string): Promise<SearchHit[]> {
    const raw = await this.index.search(query, { limit: 20 });
    const matches = Array.isArray(raw) ? raw : [];
    return matches
      .map((id) => {
        const doc = this.docs.get(String(id));
        if (!doc) return undefined;
        return {
          path: doc.path,
          title: doc.title,
          snippet: makeSnippet(doc.text, query),
        };
      })
      .filter((hit): hit is SearchHit => Boolean(hit));
  }
}

const instance = new SearchIndex();

const api = {
  upsert(doc: DocumentRecord) {
    instance.upsert(doc);
  },
  remove(path: string) {
    instance.remove(path);
  },
  search(query: string) {
    return instance.search(query);
  },
};

type IndexApi = typeof api;

export type { IndexApi };

expose(api);
