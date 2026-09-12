# CRM Pipeline design

Implemented September 12, 2026 from the selected first concept: a board-first workspace.

## Layout

The six existing metrics share one compact strip, followed by the forecast disclosure and a slim Time in stage summary. Search, owner, source, sort, Add contact, and horizontal navigation share a toolbar. Light neutral columns and blue contact links make the board easy to scan. Card metadata uses consistent icon rows; task cues, owner, segment, tag, and stage controls remain visible.

Columns expand across a wide desktop and retain horizontal scrolling on smaller desktops. Closed outcomes still follow a divider. Mobile keeps its stage picker and single-column cards before the summary. Existing theme tokens support light and dark mode; keyboard focus and selected cards have visible outlines. Styles are scoped to Pipeline components.

## Preserved behavior

- New, Registered, Engaged, Call booked, Client, and Lost remain the same six stages. Cards move by drag-and-drop or their stage dropdown. Collapsed columns remain drop targets.
- Search, owner/source filters, and recent/stalest/name sorting affect the board. The summary and Time in stage continue to use all contacts, independently of those filters.
- Checkbox selection, bulk moves, Clear, column collapse/expand, horizontal arrows, and mobile stage navigation remain available.
- Lost still asks for a predefined reason. Stage updates retain their existing optimistic state, concurrency timestamps, Undo, failure rollback, and Retry behavior.
- Contact links and guided focus, owner assignment, quick tasks, and Add contact retain their existing routes, fields, and requests.
- Card aging borders still mean fewer than three days, three to six days, or seven-plus days in the current stage. Existing segment tones are retained. Watch percentages continue to describe evergreen progress.
- The forecast remains a rounded stage-weighted count of expected clients, using New 5%, Registered 15%, Engaged 35%, Call booked 65%, Client 100%, and Lost 0%. Win rate remains clients divided by closed outcomes. Booked (7 days) continues to count unique booking-event contacts.

No API, store, database, authentication, dependency, or email-delivery changes are included.

## Verification

The focused browser suite exercises filters and global metric scope, sorting, collapse and scrolling, Lost reasons and Undo, bulk moves, drag-and-drop into a collapsed column, failed move retry, owner/task actions, Add contact validation/retry, and mobile overflow. Every mutation is mocked, with a fallback that fails unexpected writes. Existing Pipeline browser and accessibility checks are also run.

Desktop, mobile, and dark layouts were inspected on the local demo; automated accessibility scans of the page content passed in both settled themes. TypeScript, the production Next build, and the unit/API suite pass. ESLint has no errors; its two existing generated-worker warnings remain.

Local preview: `http://127.0.0.1:3101/crm/pipeline`. Use this explicit IPv4 address; the separate `localhost:3101` IPv6 listener belongs to another server. Screenshots and temporary tooling stay in ignored `.local/`.
