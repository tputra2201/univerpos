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

- Report date ranges and shift/business-day math live in `src/lib/pos/report-range.ts` and `src/lib/pos/shift.ts`; report UIs in `src/components/pos/reports.tsx` consume them. Why: keeps business-day (operating-hours) logic in one place so every report and close-out agrees.
- Finance (income/expense/paid-in/paid-out) lives in src/lib/pos/finance.ts; entries feed shift expected cash via financeOfShift in shift.ts. Why: one source for cash math.
- Stock balance (StockItem.qty) is derived from stockMoves via recomputeStock in src/lib/pos/stock.ts after every sync pull (opname = absolute reset, baseQty = opening). Why: devices must not overwrite each other’s stock with stale absolute values.
