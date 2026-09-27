# Project instructions

Use Graphify first for architecture and code relationship analysis.
Install with `python -m pip install graphifyy`.
Build or refresh with `graphify extract . --code-only`.
Use `graphify query`, `graphify affected`, `graphify god-nodes`, and `graphify explain` before architecture changes. Verify graph findings in source; never invent relationships.
Keep graphify-out/ ignored by Git. Refresh the graph after changing code.

Helper is a personal assistant, not a KYD clone. KYD integration reads a separate summary and never changes Helper debts or writes to KYD. Preserve encrypted local data and existing backup compatibility.
Runtime is static HTML/CSS/JS, without a build step. Test with `npm test` and a local HTTP server. Never store credentials in source.
