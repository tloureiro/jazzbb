# Puppeteer Test Scenarios

## Formatting Coverage (Top 15 Usage Patterns)

1. Paste markdown with level 1–3 headings and verify rendered `<h1>`, `<h2>`, `<h3>`.
2. Paste markdown containing unordered list nesting (two levels) and ensure `<ul>` nests correctly.
3. Paste markdown containing ordered list with multi-digit indices and confirm `<ol>` items preserve numbering.
4. Paste markdown including blockquotes and ensure `<blockquote>` structure matches.
5. Paste markdown featuring fenced code blocks with language hints and confirm `<pre><code>` classes.
6. Paste markdown mixing inline `code` and emphasis and verify `<code>` and `<em>` render inline.
7. Paste markdown with bold text and confirm `<strong>` nodes appear without duplicating markers.
8. Paste markdown containing links (inline + reference style) and ensure `<a>` tags have `href`.
9. Paste markdown with horizontal rules (`---`, `***`, `___`) and verify `<hr>` nodes exist.
10. Paste markdown with tables (pipe syntax) and ensure `<table>` structure renders.
11. Paste markdown containing footnote syntax and confirm footnote reference + definition render.
12. Paste markdown with task list items and ensure checkboxes render via `<li data-checked>`.
13. Paste markdown with front matter blocks and confirm plain text fallback avoids YAML parsing.
14. Paste markdown mixing headings and paragraphs separated by multiple blank lines to ensure extra whitespace is normalized.
15. Paste markdown that includes HTML inline tags (e.g., `<mark>highlight</mark>`) and verify sanitised rendering preserves allowed tags.

## Editing Behaviour Coverage (Human Interaction Top 10)

1. Delete a single character inside a paragraph and ensure content updates.
2. Delete an entire line with shortcut (`Mod+d`) and verify cursor moves to next line.
3. Undo after delete and confirm content restoration.
4. Redo after undo to reapply deletion.
5. Select all content (`Mod+a`) and replace with new text using typing.
6. Insert newline in a heading and ensure heading splits into paragraph + heading.
7. Convert paragraph to heading via markdown (`## ` at line start) and ensure automatic heading conversion.
8. Toggle list item checkbox using keyboard (space) and confirm state change.
9. Drag-select multiple list items and indent them with `Tab`.
10. Paste formatted markdown, convert a heading to plain paragraph by prefix removal, and confirm re-render.

These scenarios will be automated using Puppeteer to exercise real browser paste behaviour, including `Ctrl/Cmd+Shift+V` (plain text paste) paths, and will use anonymised fixture content to avoid leaking sensitive text.
