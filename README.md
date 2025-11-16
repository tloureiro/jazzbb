# jazzbb

jazzbb is an offline-first markdown editor/hub that runs entirely in the browser. It operates directly on local markdown vaults using the File System Access API, provides a live editor powered by TipTap (ProseMirror), and keeps search, metadata, and UI state in sync without any network calls.

## Features

- **Vault management**: open a local folder, read/write `.md` files in place, and manage notes (create, rename, delete) from the sidebar.
- **Single-file mode**: work from a standalone scratch note, then use the header save controls to either store it in the browser vault or write it to disk—with autosave staying off for manual control.
- **Live editor**: Single-pane TipTap / ProseMirror surface that renders Markdown inline as you type. Debounced worker parsing keeps typing responsive while the editor shows formatted content.
- **External change detection**: Single-file sessions poll the opened handle every two seconds and reload changes written by other editors (Chromium browsers only); unsaved edits trigger a warning instead of overwriting.
- **Typography presets**: Five open-license presets (Editorial Classic, Humanist Tech, Swiss Modern + Display, Bookish Oldstyle, Inclusive Readability) accessible from the header. Presets now restyle only the editor and preview content—UI typography remains unchanged—while still tuning body/headline/code families, numeral styles, and spacing inside the document.
- **Theme toggle**: Quick sun/moon button switches between light and night modes without refreshing.
- **Palette picker**: Sample Midnight Jazz, Aurora Glow, Ember Dawn, Cobalt Serenade, or Forest Echo from the new header dropdown; your pick persists per browser profile and syncs with the browser vault.
- **Safe rendering**: Markdown is parsed with `markdown-it`, math/task lists/footnotes are supported, and DOMPurify sanitises all HTML before display.
- **Autosave & notices**: Vault notes auto-save after a brief pause and surface success/error toasts; scratch/single-file sessions remain manual and use the Save to file action.
- **Indexed search**: Worker-backed FlexSearch index updates on load/save, keyboard-friendly overlay (Ctrl/Cmd+P) with highlighted snippets, arrow navigation, and instant note opening.
- **Outline navigator**: Toggle a live heading tree (Ctrl/Cmd+Shift+O), collapse/expand levels with arrow keys, and jump between sections without leaving the editor.
- **Collapsible headings**: Fold any heading inline via the new caret control or `Ctrl/Cmd + Alt/Option + K`. Collapsed sections auto-expand when search jumps into them.
- **Editable titles**: Rename vault notes in the editor header or inline in the sidebar (double-click a note to edit). Names now preserve spacing/casing in browser vault and single-file modes.
- **Frontmatter tools**: YAML frontmatter stays hidden until you toggle it; the `FM` badge (or `Ctrl/Cmd+Alt+F` / palette command) now opens a syntax-highlighted CodeMirror block above the editor and simultaneously reveals the read-only metadata panel in the sidebar. Close either surface and both disappear so they remain in sync.
- **Command palette**: `Ctrl/Cmd+K` opens a searchable list of every action. The palette now tokenizes your query, so you can still find “search notes” by typing “find notes” or say “show frontmatter” even though the labels read “Display…”. It also remembers the last command you ran and surfaces it to the top when the query is empty, letting you reopen it and press Enter to repeat the previous action (toggling commands respect this history, too).

## Release 0.2.6

- Frontmatter editing moved to a dedicated CodeMirror YAML surface with palette-aware token colours and proper focus handling; toggling it also opens/closes the structured frontmatter panel so the views never drift apart.
- The frontmatter indicator doubles as a discrete “frontmatter available” badge—click it, use `Ctrl/Cmd+Alt+F`, or run the palette command (which also remembers the last action you executed) to show/hide both editor and panel.
- Header controls slimmed down: typography and palette selects now collapse to content width, reducing the top bar height and reclaiming horizontal space across smaller screens.
- Added a ready-to-use vault under `samples/vault-sample/` with ten markdown files that cover agendas, journals, YAML metadata, and regressions, making it easier to demo or test vault mode locally.

## Shortcut reference

Full macOS and Windows/Linux shortcut tables live in [`SHORTCUTS.md`](SHORTCUTS.md); update that file whenever you add, rename, or rebind a shortcut so everyone stays aligned.
- **Keyboard shortcuts**: `Ctrl/Cmd+N` new note, `Ctrl/Cmd+S` save, `Ctrl/Cmd+P` search, `Ctrl/Cmd+K` opens the command palette, `Ctrl/Cmd+/` toggles the shortcut help, `Ctrl/Cmd+D` deletes the current line, `Ctrl/Cmd+Shift+H` collapses the top bar, `Ctrl/Cmd+Shift+B` collapses the vault sidebar, and `Esc` closes modals. Sidebar buttons mirror these actions, and every shortcut can be rebound from the help panel—custom bindings stay in your browser’s storage.
- **Browser vault**: Seamlessly graduate from a scratch note into an IndexedDB-backed vault, keep notes/config offline, export/import the entire vault as a `.zip`, and save individual notes to disk without leaving the browser vault.
- **Browser compatibility note**: Non-Chromium browsers surface a warning banner because the File System Access API is unavailable for saving.
- **Editing coverage**: Headless Puppeteer suites exercise common authoring behaviours (character deletes, paragraph insertion, blockquote wrapping, ordered list conversion, task toggles, heading conversions). Formatting regression tests ensure Markdown constructs (headings, lists, task items, code blocks, images) render consistently.

## Requirements

- Node.js 18+ (project tested against Node 20).
- npm (bundled with Node) or pnpm/yarn if preferred.
- Chromium-based browser (Chrome/Edge/Brave) with File System Access API support for runtime usage. Firefox is currently not supported because the API is unavailable there.

## Getting Started

```bash
npm install
npm run dev
```

Visit the dev server (default `http://localhost:5173`), then press **Open vault** to pick a local folder. The browser will request permission to read/write files in that directory.

### Browser vault mode

- Start in scratch, press **Save to browser** to capture the current draft in IndexedDB, or hit **New** (or `Cmd/Ctrl+N`) to spin up an additional note inside the browser vault.
- While browsing an in-browser vault, use **Save to browser** to persist edits and **Save to file** to export the active note without switching modes.
- The header badge indicates the active workspace (`Browser vault`, `File vault`, or `Single file`).
- Export the current browser vault as a `.zip`, import an archived vault, or reset/delete it from the help panel (`?` button).
- Hit the app with `?empty`, `?e`, or `?default` to load the default scratch workspace without restoring stored data. Notes/configs persist for the next normal load.

### Sample vault

Point the “Open vault” picker at `samples/vault-sample/` to load ten ready-made markdown files that exercise frontmatter, outlines, tasks, and general editing flows. It’s handy for demos, automated tests, or verifying release builds without touching your personal notes.

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
2. Press **Save to file** – the browser will prompt you to choose a destination (`showSaveFilePicker`).
3. Once saved, the app switches into *single-file* mode: the sidebar indicates the file name, autosave stays off, and subsequent saves write back to the same handle.
4. Use **Open file** in the header to reopen an existing markdown file without mounting an entire vault.
5. Press **Close file** when you want to leave single-file mode and return to a fresh scratch note.
6. Jazzbb watches the opened file every two seconds and reloads external changes automatically (Chromium browsers only).


### Development Notes

- Markdown parsing & search run in Web Workers. When adding new worker APIs, extend the wrappers in `src/platform/` and provide unit tests.
- All file mutations should go through `note-manager` helpers (`createNote`, `renameNote`, `deleteNote`, `saveActiveNote`) to keep store caches and the search index in sync.
- Browser vault storage lives in IndexedDB (`browser-vault-session`). Remember to persist settings via `updateBrowserVaultSettings` when introducing new editor/UI preferences.
- Keep accessibility in mind: keyboard interactions for search/editor/sidebar should remain functional after changes.
- Sanitise any new HTML rendering points with DOMPurify.
- Autosave currently runs only in vault mode; single-file workflow is manual.

### Keyboard Reference

| Shortcut            | Action             |
|---------------------|--------------------|
| `Ctrl/Cmd + N`      | Create new note    |
| `Ctrl/Cmd + S`      | Save active note   |
| `Ctrl/Cmd + P`      | Open search overlay|
| `Ctrl/Cmd + K` | Open command palette (press Enter immediately to repeat the last command) |
| `Ctrl/Cmd + Shift + O` | Toggle outline panel|
| `Ctrl/Cmd + Shift + H` | Collapse/expand top bar |
| `Ctrl/Cmd + Shift + B` | Collapse/expand vault sidebar |
| `Ctrl/Cmd + Alt/Option + K` | Toggle collapse for the current heading |
| `Ctrl/Cmd + Alt/Option + F` | Toggle frontmatter block |
| `Enter` (title field) | Commit header rename |
| `Esc`               | Close search/overlay|

Open the shortcut panel (`Ctrl/Cmd + /`) to view, customise, or reset every binding. Click any shortcut chip to record a new binding, then press the keys you want—jazzbb will remember the preference for the current browser profile.

### Roadmap & Ideas

- Autosave (vault-only) and draft preservation
- Folder tree (expand/collapse, drag & drop)
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
