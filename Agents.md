# Agent Notes

## Session Rituals
- Run `npm run lint`, `npm run test -- --run`, and `npm run test:e2e` whenever code changes land. Vitest and Playwright bind to localhost; if a sandbox blocks them, note the failure and rerun once permissions allow.

## Project Snapshot
- **Stack**: SolidJS + Vite + CodeMirror 6; Markdown parsing with `markdown-it` in a Web Worker; DOMPurify for sanitisation; FlexSearch worker for indexing.
- **State**: `editorStore` manages active path, draft text, preview HTML, and link metadata. `vaultStore` tracks note list, file handles, cached parses, and selection.
- **File IO**: Use helpers in `src/platform/note-manager.ts` (`createNote`, `renameNote`, `deleteNote`, `saveActiveNote`) to mutate files so caches/search stay in sync.
- **Keyboard shortcuts**: `Ctrl/Cmd+N` new note, `Ctrl/Cmd+S` save, `Ctrl/Cmd+P` search, `Ctrl/Cmd+K` opens the command palette, `Ctrl/Cmd+Shift+H` collapses the top bar, `Ctrl/Cmd+Shift+B` toggles the vault sidebar, `Ctrl/Cmd+Alt+K` folds the current heading, `Esc` closes overlays. Sidebar buttons mirror these actions, and every binding can be remapped from the shortcut modal (Cmd/Ctrl + /) by clicking the shortcut chip; overrides live in local storage per browser profile.
- **Collapsible headings**: Each heading renders a caret toggle; click it or press `Cmd/Ctrl + Alt + K` to fold/unfold the section. Collapsed regions auto-expand when selection or search jumps inside.
- **Outline panel**: `editorStore` now tracks heading metadata + active heading; toggle with `Ctrl/Cmd+Shift+O` or the header button to jump between sections, collapse/expand levels with arrow keys or the caret, and respect outline hierarchy indentation.
- **Theme toggle & palettes**: `toggleTheme()` flips between `light` and `dark` via the header sun/moon button, and a companion dropdown lets users pick Midnight Jazz, Aurora Glow, Ember Dawn, Cobalt Serenade, or Forest Echo (stored on `data-color-scheme` and persisted in local storage / browser vault settings). Keep `global.css` palettes updated when new surfaces appear.
- **Title editing**: The editor header input binds to `editorStore.displayName`; blur/Enter triggers vault renames via `renameNote`. Double-click a note in the sidebar to inline-rename it; scratch/browser vault naming now preserves spaces/casing rather than slugifying.
- **Browser vault**: Creating a new note while in scratch mode upgrades into an IndexedDB-backed vault. Use `browser-vault-session` helpers to mutate notes/configs and prefer the help panel actions for export/import/delete/reset flows.
- **Browser support note**: Non-Chromium browsers surface a warning banner because they cannot save files.
- **Test suites**: Headless Puppeteer coverage now exercises editing actions (character removal, paragraph insertion, blockquote wrapping, list nesting, task toggles, heading conversions) alongside formatting regressions (code, lists, links, images, task items). Keep specs in `tests/puppeteer/` and `tests/e2e/` in sync with new flows, favouring parser-driven helpers over brittle DOM events.
- **Testing**: Prioritise adding or expanding Playwright/Puppeteer scenarios (alongside unit specs) whenever behaviour changes so regressions stay covered end-to-end.

## Development Guidelines
- Single-file mode uses `workspaceStore` (`scratch`/`single`/`vault`) to route save behavior. `openSingleFile()` populates `workspaceStore.singleFile`; the first manual save in scratch invokes `showSaveFilePicker`. Use `closeSingleFile()` to drop back to scratch mode when the user taps Close file.
- The header now exposes `Save to browser` (scratch-only) to migrate the active draft into the IndexedDB vault and `Save to file` to export the active note without leaving browser vault mode; both remain accessible once the UI renders.
- Typography presets live in `src/styles/typography.css` and are selected via `data-preset` on `<html>` (controlled by `setTypographyPreset`). Header select updates the store; add new presets by extending the CSS + signal.
- When adding features, update the README and this file with any new commands, workflows, or shortcuts.
- Maintain worker symmetry: update `parser-service` / `index-service` wrappers and add unit tests when new worker methods appear.
- Browser vault telemetry relies on `browser-vault-session` + `browser-vault-storage`; persist new settings via `updateBrowserVaultSettings` and remember to refresh quota estimates when storage usage changes.
- Markdown parsing helpers now live in `src/lib/markdown-engine.ts`; the worker and the main-thread fallback both import from there.
- `parser-service` falls back to the shared markdown engine when Web Workers are unavailable—keep both paths feature-equivalent.
- Autosave triggers after ~2s of inactivity (`EditorPane` effect) and uses `showToast` for success/error. Autosave is enabled only in vault mode; scratch/single-file sessions remain manual.
- Editor pane now uses TipTap (ProseMirror) with the markdown extension; keep extensions in sync with markdown-it parsing so worker output matches what users see.
- Toast notifications live in `state/ui.ts` + `ToastTray`; reuse them for future status messaging instead of bespoke banners.
- Keep the search overlay keyboard-accessible (highlighted selection, Enter/Arrow support).
- Outline navigator pulls from `editorStore.headings`; keep heading IDs unique and update tests when parsing changes.
- Ensure both light and dark palettes get updated when introducing new color-dependent UI.
- If title-renaming logic changes, update `commitTitle` in `EditorPane` and keep `normalizeBrowserNoteName` in `browser-vault-session` aligned with scratch/save flows.
- Sanitise any new HTML render paths with DOMPurify or reuse `renderMarkdown` helpers.
- Prefer `npm run test -- --run` (non-watch) to avoid port conflicts.
- `?empty`, `?e`, or `?default` query params force a scratch session without restoring the browser vault—handy for tests.

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
- Search result breadcrumbs & range highlighting
- **Default palette**: Cobalt Serenade is the baseline color scheme everywhere. Older snapshots may still have Midnight Jazz; migration logic in `browser-vault-session` updates them once, so don’t reintroduce the old default.
- **Palette persistence**: `setColorScheme` writes to both localStorage and browser-vault settings—call it for any UI that modifies the palette so the preference survives reloads without `?e`.
- **Shortcut modal UX**: The “Set custom” button is gone; instead, clicking a shortcut chip starts capture mode, and a small “Reset” link appears only when a custom mapping exists. Keep chips and descriptions vertically aligned (flex row with centered items).
- **macOS conflicts**: Avoid using bare `Cmd+N`, `Cmd+O`, etc. for new global shortcuts; Chrome/macOS intercepts them. Prefer combos like `Ctrl+Cmd+...` that don’t overlap with OS defaults.
