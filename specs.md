# jazzbb Product Spec (updated)

## Vision
- Craft an offline-first markdown workspace that runs locally in Chrome (desktop) without a backend.
- Provide a polished live-preview editor: one editing surface that renders markdown formatting inline as you type (no separate preview pane).
- Vault interaction mirrors native file system behaviour; the app remains mostly stateless aside from session cache.

## Target Environment
- Primary browser: Chrome (desktop on Linux/Mac/Windows). Other browsers are nice-to-have.
- Desktop focus; tablet/mobile can come later.

## Vault & Files
- Operate directly on `.md` files in the chosen vault folder; expose only markdown files/folders in navigator.
- Creating, renaming, deleting notes should follow intuitive desktop conventions, respecting the selected location and cursor context.
- Automatically generate unique filenames (path + filename uniqueness). Cursor location decides the new note's placement.
- Attachments: accept image drag & drop; rename uploads with a generated SHA-like identifier; display in editor immediately following standard markdown expectations.
- Config stored in `.json`, located in the vault root. Users can override defaults via manual file editing.

## Editing Experience
- Single live-edit pane (no split preview). Markdown renders inline while typing (headings, emphasis, math, footnotes, task lists, etc.).
- Support strikethrough, inline code, math (block + inline), footnotes, and task lists.
- No Vim/Emacs modes. Keyboard shortcuts: `Ctrl/Cmd+N` new note, `Ctrl/Cmd+S` save, `Ctrl/Cmd+P` search, `Esc` close overlays; extend the set cautiously and keep behaviour discoverable.
- Autosave after inactivity (vault mode only); manual save updates status toasts. Scratch/single-file sessions prompt for a destination and rely on manual saves. Session-only state; refresh is acceptable during development.

- Layout inspired by contemporary note apps and IDEs: collapsible sidebar for files when a vault is mounted, central live editor, inspector pane for metadata. Single-file mode hides vault actions but keeps the same editor surface.
- Outline navigator panel should surface document headings and allow quick jumps (toggle from header, keyboard shortcut encouraged).
- Provide a light/night theme toggle (sun/moon button in header) so the UI is readable in both bright and dark environments.
- Allow renaming notes directly from the editor title field (vault notes rename immediately, scratch titles seed the first-save filename).
- Inspector shows path, timestamps, word/character/line counts, tasks, outgoing links, unsaved status.
- Provide toast notifications for saves/autosaves/errors; no analytics or logging in production bundle.
- Maintain pleasant, writer-focused dark theme (WCAG AA contrast nice-to-have but not required).

## Search
- File-wide search with selectable root path, optional regex toggle; only `.md` files indexed.
- In-note search triggered by button (avoid hijacking browser `Ctrl+F`).
- Search overlay must stay keyboard-accessible with highlighted matches, breadcrumbs, and eventual snippet refinement.

## Formatting & Rendering
- Markdown parsing via shared engine (`markdown-it` + plugins) used by both worker and inline fallback; sanitize with DOMPurify.
- Live preview must work even when parser worker unavailable (fallback inline parsing).

## Testing & Tooling
- Tooling must favor maintained, fast tech (currently Vite + Solid + Vitest + Playwright).
- Headless automated tests only; generate synthetic fixtures when needed.
- Run `npm run lint` + `npm run test -- --run` before finishing work.

## Licensing & Distribution
- MIT license; dependencies must be MIT or more permissive.
- Updates delivered via fresh downloads; no auto-updaters planned.

## Typography
- Provide five open-license presets (Editorial Classic, Humanist Tech, Swiss Modern + Display, Bookish Oldstyle, Inclusive Readability).
- Each preset defines body, heading/UI, and code families with appropriate OpenType features (oldstyle vs lining, tabular figures, ligatures).
- Apply presets via `<html data-preset>` and expose a runtime selector.
- Global baseline: fluid modular scale (~60–70ch measure), body line-height ~1.5, heading ~1.2, link underline thickness/offset, list/table alignment, blockquote styling, code styling (inline vs block ligatures).
- Prefer Noto fallbacks for non-Latin scripts and emoji.
