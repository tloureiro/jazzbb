# Open Questions — Atlas

| Topic | Context | Next step |
|-------|---------|-----------|
| Nested folders | Should nested directories inherit sort order from parent sidebar state? | Prototype a recursive sort toggle. |
| Search index | FlexSearch worker currently ignores archived folders. Should we include them? | Add a `vaultStore.setSearchScope` spec. |
| Frontmatter editing | How do we surface validation errors without adding toast noise? | Extend `.panel-alert` copy and reuse inline CodeMirror markers. |

## Follow-ups
- [ ] sync with QA on new Playwright coverage for table visuals
- [ ] capture screenshots for docs once palette alignment lands
- [ ] test autosave when the active note lives below `/projects/atlas`
