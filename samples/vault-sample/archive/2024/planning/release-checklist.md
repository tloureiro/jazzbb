# Release Checklist — 2024 Roadmap Kickoff

## Pre-flight
- [x] npm run lint
- [x] npm run test -- --run
- [x] npm run test:e2e
- [ ] npm run test:puppeteer

## Documentation
- [ ] Update README release section to 0.4.0
- [ ] Mention nested folder samples in `samples/vault-sample` description
- [ ] Capture fresh screenshots after table styling merges

## Deployment
1. `npm run build`
2. `./version-deploy.sh`
3. Confirm Cloudflare Pages deploy + smoke test the preview vault

## Notes
Remember to copy the new subfolder samples (`projects/atlas`, `archive/2023/q4`, `archive/2024/planning`, `research/markdown`) into any demo vaults before sharing the build so people can see nested folder behavior in action.
