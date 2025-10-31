# Agent Notes

## Session Rituals
- Run `npm run lint`, `npm run test -- --run`, and `npm run test:e2e` whenever code changes land. Vitest and Playwright bind to localhost; if a sandbox blocks them, note the failure and rerun once permissions allow.

## Project Snapshot
- **Stack**: SolidJS + Vite + CodeMirror 6; Markdown parsing with `markdown-it` in a Web Worker; DOMPurify for sanitisation; FlexSearch worker for indexing.
- **State**: `editorStore` manages active path, draft text, preview HTML, and link metadata. `vaultStore` tracks note list, file handles, cached parses, and selection.
- **File IO**: Use helpers in `src/platform/note-manager.ts` (`createNote`, `renameNote`, `deleteNote`, `saveActiveNote`) to mutate files so caches/search stay in sync.
- **Keyboard shortcuts**: `Ctrl/Cmd+N` new note, `Ctrl/Cmd+S` save, `Ctrl/Cmd+P` search, `Esc` closes overlays. Sidebar buttons mirror these actions.
- **Outline panel**: `editorStore` now tracks heading metadata + active heading; toggle with `Ctrl/Cmd+Shift+O` or the header button to jump between sections.
- **Theme toggle**: `toggleTheme()` flips between `light` and `dark` via the header sun/moon button; remember to update palettes in `global.css` when new surfaces appear.
- **Title editing**: The editor header input binds to `editorStore.displayName`; blur/Enter triggers vault renames via `renameNote`, while scratch titles seed the first save filename.
- **Browser support note**: Non-Chromium browsers surface a warning banner because they cannot save files.
- **Test suites**: Headless Puppeteer coverage now exercises editing actions (character removal, paragraph insertion, blockquote wrapping, list nesting, task toggles, heading conversions) alongside formatting regressions (code, lists, links, images, task items). Keep specs in `tests/puppeteer/` and `tests/e2e/` in sync with new flows, favouring parser-driven helpers over brittle DOM events.
- **Testing**: Prioritise adding or expanding Playwright/Puppeteer scenarios (alongside unit specs) whenever behaviour changes so regressions stay covered end-to-end.

## Development Guidelines
- Single-file mode uses `workspaceStore` (`scratch`/`single`/`vault`) to route save behavior. `openSingleFile()` populates `workspaceStore.singleFile`; the first manual save in scratch invokes `showSaveFilePicker`.
- Typography presets live in `src/styles/typography.css` and are selected via `data-preset` on `<html>` (controlled by `setTypographyPreset`). Header select updates the store; add new presets by extending the CSS + signal.
- When adding features, update the README and this file with any new commands, workflows, or shortcuts.
- Maintain worker symmetry: update `parser-service` / `index-service` wrappers and add unit tests when new worker methods appear.
- Markdown parsing helpers now live in `src/lib/markdown-engine.ts`; the worker and the main-thread fallback both import from there.
- `parser-service` falls back to the shared markdown engine when Web Workers are unavailable—keep both paths feature-equivalent.
- Inspector pane now uses `src/lib/note-stats.ts` to display word/character/line counts, task completion, and link totals. Keep stats logic in sync with preview parsing if new syntaxes appear.
- Autosave triggers after ~2s of inactivity (`EditorPane` effect) and uses `showToast` for success/error. Autosave is enabled only in vault mode; scratch/single-file sessions remain manual.
- Editor pane now uses TipTap (ProseMirror) with the markdown extension; keep extensions in sync with markdown-it parsing so worker output matches what users see.
- Toast notifications live in `state/ui.ts` + `ToastTray`; reuse them for future status messaging instead of bespoke banners.
- Keep the search overlay keyboard-accessible (highlighted selection, Enter/Arrow support).
- Outline navigator pulls from `editorStore.headings`; keep heading IDs unique and update tests when parsing changes.
- Ensure both light and dark palettes get updated when introducing new color-dependent UI.
- If title-renaming logic changes, update `commitTitle` in `EditorPane` and ensure scratch save flows still slugify the name before `.md`.
- Sanitise any new HTML render paths with DOMPurify or reuse `renderMarkdown` helpers.
- Prefer `npm run test -- --run` (non-watch) to avoid port conflicts.

## Quick Commands
```bash
npm install
npm run dev
npm run lint
npm run test -- --run
```

## Outstanding Ideas / TODOs
- Autosave drafts & status toasts
- Folder hierarchy and drag-drop reordering
- Inspector enhancements (metadata improvements)
- Search result breadcrumbs & range highlighting
