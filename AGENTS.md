<INSTRUCTIONS>
@C:\Users\mazha\.codex\RTK.md

Before milestone or release work, read the relevant project records in `docs/`, especially:

- `docs/architecture.md`
- `docs/api-contract.md`
- `docs/backend-conventions.md`
- `docs/deployment.md`
- `docs/remaining-work-report.md`
- `docs/product-capabilities-report.md`

Treat the repository, executed checks, and current API behavior as authoritative when a planning document is stale.

For every frontend or UI/UX task in this repository:

- Always use the `better-interface` skill as the baseline interface workflow.
- Apply the relevant focused skills: `better-ui`, `better-typography`, `better-colors`, `better-accessibility`, `better-layout`, and `better-writing`.
- Use an interface review before declaring a substantial frontend change complete.
- Stress-test important components across responsive states and the web/mobile surfaces that consume them.
- When exploring multiple component designs, compare variants before implementation.
- When analyzing a reference interface or reproducing an interaction, document the interaction and its states before coding.

For backend or cross-app changes:

- Verify the API contract and role/tenant boundaries before implementation.
- Run the narrowest relevant typecheck, build, smoke test, or browser check after changes.
- Keep local development API configuration pointed at `http://localhost:3001/api` unless the task explicitly targets production.
</INSTRUCTIONS>
