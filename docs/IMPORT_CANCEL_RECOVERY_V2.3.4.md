# ClayKeeper v2.3.4 - Import Cancel and Recovery

- Trap Series workbooks are checked for LASTNAME, FIRSTNAME, TOTALSCORE, and TRAP 1-4 before import.
- A workbook with a missing required column is blocked before database records are created.
- A **Remove faulty spreadsheet** button clears the invalid workbook from the page.
- A running import now shows progress and provides a **Kill / Stop import** button.
- Cancellation is cooperative and stops safely after the current database operation.
- Cancelled and failed imports remain in history with a **Cleanup import** action.
- Cleanup is available even when the failed import never created a linked event.
