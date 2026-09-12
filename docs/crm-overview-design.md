# CRM Overview redesign

Implemented September 12, 2026. The selected direction is a daily workspace: summary metrics, current priorities, a seven-day digest, then deeper analysis. It covers the entire Overview route, including contact/task creation dialogs, filters, task actions and all reports.

## Design choices

- Use the existing Open Sans, navy, blue, gold and semantic theme colors. Reserve the gold primary action for creating a task; use compact, consistently grouped cards and labeled controls.
- Keep priorities near the top. Empty states report that no prioritized items are shown without implying that all open tasks are complete.
- Keep samples and scope near each figure. Forecast details and exact chart numbers are available through keyboard-accessible disclosures.
- The design applies [visual hierarchy and proximity](https://www.nngroup.com/articles/principles-visual-design/) and [recognition rather than recall](https://www.nngroup.com/articles/recognition-and-recall/). It does not add arbitrary goals, fabricated trends, revenue estimates, or urgency.

## What each section measures

The owner selector filters by contact ownership. Tasks are included through their attached contact, regardless of task assignee.

| Section | Scope |
| --- | --- |
| Total contacts and open tasks | Current totals for selected contact owner. |
| New contacts and contacts booked | Selected rolling 7/30/90 days versus the preceding equal period. Booked counts distinct contacts. |
| Booking / registration | All-time observed ratio of separate recorded populations, with denominator shown. |
| Needs attention | Up to ten prioritized overdue tasks, cooling leads and missing follow-ups. |
| Last 7 days | Rolling seven-day activity, independent of the selected range. |
| New contacts & booking events | Calendar-day contact creation and booking event counts; at most thirty days. Exact daily values are available below the grouped bars. |
| Pipeline | Current stages. The stage-weighted estimate includes existing won clients. |
| Evergreen webinar funnel | Independent, all-time recorded stage counts. Live sessions retain their separate reports. |
| Engagement | All-time observed room/registration/booking ratios; watch progress is evergreen. Room opens do not establish attendance or playback. |
| Audience segments and acquisition sources | Current classifications and all-time contact/source totals. |
| Recent activity | Latest eight events across all owners, independent of the filters. |

Metrics retain the existing calculations. The store adds an optional `previousValue` to the new/booked KPIs so the UI can display a zero baseline honestly. Ratios with no denominator show an em dash; ratios above 100% remain visible rather than being silently capped. Chart bars scale against their maximum and preserve all counts when days are grouped.

Metric, source and segment contact links preserve the selected owner and use the all-contacts view. Source values are URL-encoded. Contact lists do not inherit an unsupported date filter. Task and pipeline links open their existing workspaces with their own filters.

## Interactions and safeguards

- Owner/range navigation refreshes the action queue rather than retaining the previous owner's local rows. Controls wait for hydration and display navigation state.
- Complete, snooze, assignment, errors and undo retain their existing API contracts. Snoozing uses tomorrow's calendar date across daylight-saving changes.
- Read-only accounts can browse reports and contacts without Overview mutation controls.
- Both quick-create forms use native dialogs, visible labels, initial focus, Escape dismissal and focus restoration. Pending saves disable duplicate submission and dismissal; failed requests retain all entered values.
- The layout supports mobile and both themes. Scrollable daily data is keyboard-focusable. Automated checks cover the dashboard with disclosures both closed and open, errors, and dialogs.

## Verification

The change has helper tests for ranges, zero baselines, ratios, owner/source URLs and chart totals; unit checks for read-only/hydration behavior; and browser coverage for all sections, mobile layouts, light/dark accessibility, filters, queue mutations/undo and mocked quick-create requests. Browser writes are mocked, and the redesign suite requires an explicit localhost target. Screenshots and temporary tooling remain in ignored `.local/`.

No production records, database migrations, email delivery settings or dependencies are changed by this redesign.
