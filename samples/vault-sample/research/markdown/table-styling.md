# Table Styling Research

## CSS Notes
- `.tiptap-editor table` now uses the same border + spacing rules as `.markdown-body table`.
- Typography presets keep uppercase headers + letter spacing; consider relaxing this for dense data tables.
- Need a utility class for striped rows that respects both light/dark palettes.

## Experiments
1. **Alignment tokens** — markdown-it adds `style="text-align"` inline; evaluate migrating to class-based alignment for theme overrides.
2. **Column widths** — TipTap’s table extension outputs `<colgroup>` but we ignore the widths. Could map markdown alignment syntax to percentage columns.
3. **Nested content** — embed task lists or callouts inside table cells to ensure padding prevents layout glitches.

## Next Steps
- [ ] Prototype a `.table--compact` modifier in `global.css`.
- [ ] Add a sample note that mixes tables with frontmatter badges.
- [ ] Extend the Playwright visual spec to cover striped rows once styles exist.
