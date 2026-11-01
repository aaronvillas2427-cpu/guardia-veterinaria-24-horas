# Visual and accessibility review

## Changes
- Clinical command center visual system: Geist UI, monospaced metrics, teal and amber tokens, layered surfaces and 16 px cards.
- System-aware, persisted light/dark preference; grouped desktop sidebar, mobile bottom navigation and command palette.
- Dashboard staffing/load chart, occupancy rings and KPI trends; weekly arrival heatmap with accessible bottom-sheet editing.
- Simulation stepper, indeterminate worker progress, polite announcements and confidence-interval error bars.
- Erlang comparison explanations and delta column, species recommendations, occupancy calendar and event timeline.
- Skip link, semantic headings/landmarks, visible focus, labeled fields, connected inline errors, chart tables, reduced-motion support and accessible confirmation overlays.

## Checks performed
- Axe-core 4.10.3 WCAG 2 A/AA, 2.1 AA and 2.2 AA tags: 11 routes in light desktop, dark desktop and 360 px mobile (33 audits), no reported violations in the final pass.
- All 11 routes: one h1 and one main; individual page metadata preserved.
- No page-level horizontal overflow at 360 px, or with 200% text enlargement at 640 px. Wide data tables retain contained scrolling.
- Keyboard command palette dismissal, heatmap sheet dismissal, hospital detail dismissal and restore confirmation dismissal: Escape closes and focus returns to the trigger.
- 360 px home simulation button: 328 × 56 px, at y=193, visible without scrolling.
- Actual worker simulation results rendered and announced; admission persisted across reload and discharge read back through the UI.
- System dark preference and explicit persisted light preference verified; reduced-motion checks used the emulated preference.
- Invalid numeric input and wrong administration key produced announced inline errors.
- 23 Vitest tests passed, including 20 unchanged engine tests and 2 theme preference tests.
- Every file in src/engine matched its pre-redesign SHA-256 checksum exactly.

## Limits
Automated audits and keyboard/reflow checks do not establish complete WCAG conformance. Manual testing with assistive technologies such as NVDA and VoiceOver has not been performed. Actual operating-system browser zoom was not emulated; 200% text enlargement and narrow-viewport reflow were checked instead. Published-site accessibility was not tested; this app remains unpublished.

The worker supplies a completion response, not numerical progress updates; the progress indicator is deliberately indeterminate. Weekdays and weekend days retain the existing shared scheduling rules. Urgency and consultation KPI trends use the existing combined slotWait series, not separate per-priority hourly series, because the calculation engine remains unchanged.