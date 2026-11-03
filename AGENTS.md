<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Rules

- Validate the Dine In table requirement through `order-requirements.ts` at product selection, item insertion, payment opening, and completion, including default and restored carts. Why: no entry path may bypass table selection.

- Sync deletions must originate from durable explicit action tombstones, never missing local records or sync hashes; server rejects deletion of financial history and archives record versions. Why: refresh, partial storage and store switching cannot become destructive sync requests.
- Close Out and End of Day snapshots live in a separate IndexedDB object store and local writes are serialized; keep archives out of synchronized/reset collections. Why: preserve local close-out evidence across app resets, while recognizing browser-data clearing still removes local archives.
- Online bulk reset is disabled; restoration must match the active store and retain its device identity. Why: prevent cross-store overwrites and unsupervised deletion of shared business history.

- Report date ranges and shift/business-day math live in `src/lib/pos/report-range.ts` and `src/lib/pos/shift.ts`; report UIs in `src/components/pos/reports.tsx` consume them. Why: keeps business-day (operating-hours) logic in one place so every report and close-out agrees.
- Finance (income/expense/paid-in/paid-out) lives in src/lib/pos/finance.ts; entries feed shift expected cash via financeOfShift in shift.ts. Why: one source for cash math.
- Stock balance (StockItem.qty) is derived from stockMoves via recomputeStock in src/lib/pos/stock.ts after every sync pull (opname = absolute reset, baseQty = opening). Why: devices must not overwrite each other’s stock with stale absolute values.
- Selected-item payment is a temporary cart view; keep the original cart persisted and update remaining held items atomically with the paid sale. Why: closing payment or refreshing must not lose unpaid items.
- Do not add generic confirmation prompts to inputs, settings or routine cashier actions; inline fields save directly. Why: prompts slowed cashiers and fired on every keystroke.
- Sync uploads only records marked in `db.syncDirty` by real user actions (`trackActionChanges` in store `update`); pull runs before push and settings merge per field. Never upload by diffing local cache vs sync-base hashes. Why: opening/refreshing a device with stale or default data overwrote commissions and reopened closed shifts.
- Server `sync_push` ignores updates that reopen closed shifts/businessDays or move finished sales back. Why: stale copies must not change cash history.
