# CRM Contacts redesign

Implemented September 12, 2026. Two image concepts explored a focused contact directory and a split list with a persistent relationship preview. The focused directory was selected to keep contact identity, engagement, and next tasks readable together across the available width.

## Design and scope

- Retain the existing Open Sans, navy, blue, gold, and semantic theme colors. Gold identifies the primary Add contact action; stage colors carry text labels and do not serve as the only status cue.
- Group name, email, initials, and tags in one contact cell. Place stage, evergreen engagement, next task, and added date alongside it. Mobile uses contact cards with the same context and actions.
- Put search and familiar quick views first. Advanced filters and metric definitions expand on demand; active filters remain visible as removable chips. All contacts is an explicit selection that overrides a saved default view.
- Keep the entire list workflow: sorting, density, page size, pagination, saved views, exports, selected/all-matching actions, row management, and add/import dialogs. Full contact profiles continue to use their existing route.
- Native dialogs provide visible labels, keyboard focus containment, Escape dismissal, and focus restoration. Pending requests disable duplicate submissions and dismissal; failures keep draft values. CSV import results remain visible until Done.

## Data and behavior

`resolveContactsQuery` provides one normalized state for server data, toolbar controls, pagination, saved views, table sorting, and export links. It applies saved view/page-size preferences, validates enums and numeric ranges, removes unsupported parameters, and excludes malformed session UUIDs before the database call. Out-of-range pages redirect to the last available page.

The `view=all` URL sentinel never reaches the SQL view filter. Data queries use an empty view and export links omit the sentinel, because the existing production search function does not recognize `all`. Choosing a session selects the live funnel; choosing evergreen clears the session. Session option dates use the session's timezone.

Booked counts contacts with recorded booking events, independently of manually managed pipeline stages. Watch metrics continue to describe evergreen progress, including under live/session filters. All six stage totals are available in the metric disclosure. Aggregate calculations are unchanged: the current demo average includes zero-progress contacts, whereas the production search SQL averages positive watch values. The interface avoids a denominator claim that would disagree with one environment.

Changing filter/sort/page scope clears selection. Page selection and all-matching selection are explicit; excluding one contact from all-matching retains the other matching IDs. Bulk success uses the server's actual affected count. Selected CSV export is available only when all selected rows are present, preventing a silently incomplete export. Existing optimistic concurrency tokens remain on row edits.

Add/edit/stage/owner/tag/task controls require write access. Import/export and Trash controls require administrator access. Existing API authorization remains in place. Trash retains its confirmation and restore semantics.

CSV import preserves the preview-then-confirm API flow and existing field aliases. The parser handles BOMs, quoted commas, escaped quotes, and multiline values; files remain limited to 2 MB and 500 rows. Replacing a file or changing a mapping invalidates the preview. Rejected files clear earlier data, and stale asynchronous reads cannot overwrite a newer selection.

## Validation and local preview

Unit tests cover query/default/export parity, saved-view recovery, session validation, CSV parsing, and header permissions. Browser tests cover filter/reset scope, all-matching selection, concurrency errors, import review and pending guards, focus, mobile overflow, and accessibility in both themes. Existing Contacts regressions and the live-webinar Contacts filter flow are also checked. Browser mutation requests are mocked.

Production Next/OpenNext compilation and the Cloudflare deployment dry-run pass. No production deploy, database migration, dependency update, or email-delivery change is part of this redesign. Local screenshots and temporary test tooling remain in ignored `.local/`.

Preview: `http://127.0.0.1:3101/crm/contacts` (local demo). Use the explicit IPv4 loopback address: a separate IPv6 listener on `localhost:3101` currently returns an unrelated 404.
