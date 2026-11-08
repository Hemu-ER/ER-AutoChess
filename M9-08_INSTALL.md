# L.I.V.E. M9-08 — M9-03 / 04 / 05 UI regression restoration + M9-07 integration

## WHAT BROKE
M9-07 used the original ER-AutoChess.zip snapshot as its base instead of including M9-03, M9-04 and M9-05. As a result, match-augment.cjs replaced 31 real blue cards with M901_BLUE placeholders, and game.js/index.html removed the M9-04/M9-05 download-card animation and QA / codex UI changes.

## APPLY
1. Back up the project folder.
2. Extract this patch into the root of the existing ER-AutoChess project, replacing matching files. This overlay includes the old M9-03/04/05 assets and the M9-07 integrated versions, so do NOT apply the old M9-07 ZIP after applying this patch.
3. Restart the Node server completely and hard-refresh all browser clients (Ctrl+F5). A service worker / CDN cache, if configured, may require purge.
4. Validate with `npm run test:m9-08`.

## REPAIRED
- 31 functional blue cards restored (B001–B031); 46 approved purple cards retained (Pxx); 54 gray cards unchanged.
- M9-04/M9-05 infusion DOWNLOAD UI, animated card reveals, per-card rerolls, details, codex, four-tab QA restored.
- M9-07 sync-before-prep, scouting tabs, QA right-click editing, purple battle/economy hooks, visual transitions retained.
- Blue battle calculations from M9-03 merged with purple calculations from M9-07; blue hunt/persistent bonuses remain available.

## QA ACTUALLY PERFORMED
- npm run test:m9-08: PASS; includes M7/M8 regressions, M9-01 2–8 player/3 rounds, M9-07 purple 46/46 runtime, M9-04 and M9-05 UI checks, 41 M9-08 assertions.
- Sandboxed browser-rendered QA Lab: 4 tabs, 92 purple checkboxes (46/team), 18-cell board, region button, zero page JavaScript errors. Local image URLs were blocked in this sandbox; that is not evidence of missing assets in deployment.
- Live multiplayer animation transitions were NOT fully E2E-tested in a deployed browser session. Verify on the user's running server.

## KNOWN REMAINING ISSUE
Complex purple card interactions, such as P24 full passive inheritance, are not yet fully verified; this patch restores the missing blue/UI baseline and does not claim those are all correct.

Release type: local recovery overlay; not pushed to remote GitHub or deployed server.
