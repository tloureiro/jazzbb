# jazzbb

jazzbb is an offline-first markdown editor / hub that runs entirely in the browser. It operates directly on local markdown vaults using the File System Access API, provides a live editor powered by TipTap (ProseMirror), and keeps search, metadata, and UI state in sync without any network calls.

## Features

- **Vault management**: open a local folder, read/write `.md` files in place, and manage notes (create, rename, delete) from the sidebar.
- **Single-file mode**: work from a standalone scratch note, save it via the top-level Save button, and keep editing with autosave disabled for manual control.
- **Live editor**: Single-pane TipTap / ProseMirror surface that renders Markdown inline as you type. Debounced worker parsing keeps typing responsive while the editor shows formatted content.
- **Typography presets**: Five open-license presets (Editorial Classic, Humanist Tech, Swiss Modern + Display, Bookish Oldstyle, Inclusive Readability) accessible from the header. Presets now restyle only the editor and preview content—UI typography remains unchanged—while still tuning body/headline/code families, numeral styles, and spacing inside the document.
- **Theme toggle**: Quick sun/moon button switches between light and night modes without refreshing.
- **Safe rendering**: Markdown is parsed with `markdown-it`, math/task lists/footnotes are supported, and DOMPurify sanitises all HTML before display.
- **Autosave & notices**: Vault notes auto-save after a brief pause and surface success/error toasts; scratch/single-file sessions remain manual and use the Save button.
- **Indexed search**: Worker-backed FlexSearch index updates on load/save, keyboard-friendly overlay (Ctrl/Cmd+P) with highlighted snippets, arrow navigation, and instant note opening.
- **Inspector metadata**: Dedicated pane summarises title, last modified time, word/character/line counts, task progress, and outgoing links for the active note.
- **Outline navigator**: Toggle a live heading tree (Ctrl/Cmd+Shift+O) to jump across sections without leaving the editor.
- **Editable titles**: Rename vault notes (or set the first save name in scratch mode) directly from the editor header.
- **Keyboard shortcuts**: `Ctrl/Cmd+N` new note, `Ctrl/Cmd+S` save, `Ctrl/Cmd+P` search, `Ctrl/Cmd+/` toggles the shortcut help, `Ctrl/Cmd+D` deletes the current line, and `Esc` closes modals. Sidebar buttons mirror these actions.
- **Browser compatibility note**: Non-Chromium browsers surface a warning banner because the File System Access API is unavailable for saving.
- **Editing coverage**: Headless Puppeteer suites exercise common authoring behaviours (character deletes, paragraph insertion, blockquote wrapping, ordered list conversion, task toggles, heading conversions). Formatting regression tests ensure Markdown constructs (headings, lists, task items, code blocks, images) render consistently.

## Requirements

- Node.js 18+ (project tested against Node 20).
- npm (bundled with Node) or pnpm/yarn if preferred.
- Chromium-based browser (Chrome/Edge/Brave) with File System Access API support for runtime usage.

## Getting Started

```bash
npm install
npm run dev
```

Visit the dev server (default `http://localhost:5173`), then press **Open vault** to pick a local folder. The browser will request permission to read/write files in that directory.

### Running Tests & Linting

```bash
npm run test -- --run   # Vitest unit tests
npm run test:puppeteer   # Puppeteer editing/formatting scenarios
npm run lint            # ESLint + TypeScript checks
```

> Vitest spins up a Vite socket on `127.0.0.1`; ensure your environment permits local binds.

### Project Structure

```
src/
  components/     – Solid components (editor pane, sidebar, header, search panel, code editor)
  lib/            – Markdown rendering helpers
  platform/       – File-system workers, note manager, parser/index wrappers
  state/          – Solid stores for vault/editor/UI
  styles/         – Global styles (dark theme, layout)
  workers/        – Web worker entrypoints (markdown parser, search index)
```

### Typography presets

Use the selector in the top-right toolbar to switch between the five systems. Each preset updates body, heading/UI, and code families, toggles OpenType features (oldstyle or lining numerals, tabular alignment where needed), and adapts spacing/link styling. The active preset is stored on `<html data-preset>`, so custom themes can hook into that attribute.

### Single-file workflow

1. Launch jazzbb and start typing in the scratch editor.
2. Press **Save** – the browser will prompt you to choose a destination (`showSaveFilePicker`).
3. Once saved, the app switches into *single-file* mode: the sidebar indicates the file name, autosave stays off, and subsequent saves write back to the same handle.
4. Use **Open file** in the header to reopen an existing markdown file without mounting an entire vault.


### Development Notes

- Markdown parsing & search run in Web Workers. When adding new worker APIs, extend the wrappers in `src/platform/` and provide unit tests.
- All file mutations should go through `note-manager` helpers (`createNote`, `renameNote`, `deleteNote`, `saveActiveNote`) to keep store caches and the search index in sync.
- Keep accessibility in mind: keyboard interactions for search/editor/sidebar should remain functional after changes.
- Sanitise any new HTML rendering points with DOMPurify.
- Autosave currently runs only in vault mode; single-file workflow is manual.

### Keyboard Reference

| Shortcut            | Action             |
|---------------------|--------------------|
| `Ctrl/Cmd + N`      | Create new note    |
| `Ctrl/Cmd + S`      | Save active note   |
| `Ctrl/Cmd + P`      | Open search overlay|
| `Ctrl/Cmd + Shift + O` | Toggle outline panel|
| `Enter` (title field) | Commit header rename |
| `Esc`               | Close search/overlay|

### Roadmap & Ideas

- Autosave (vault-only) and draft preservation
- Folder tree (expand/collapse, drag & drop)
- Inspector with metadata (word count, future enhancements)
- Inline status toasts for save/search errors
- Export/print helpers for selected notes

## Contributing / Future Sessions

1. Run `npm install` once; reuse `node_modules/` between sessions.
2. Make changes, then `npm run lint` and `npm run test -- --run` before finishing.
3. Update documentation (README, Agents.md) when features, shortcuts, or workflows change.
4. Honour the offline guarantee—no new network dependencies.

## License

MIT

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for a breakdown of bundled dependencies and their respective licenses. Full texts for non-MIT licenses are stored in the `licenses/` directory.
