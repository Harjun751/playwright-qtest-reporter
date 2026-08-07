# AGENTS.md

Project context for working in this repo.

## What it does

Uploads Playwright test results to qTest as automated test logs via a single entry point:

- **Playwright Reporter** — a `Reporter` implementation added to `playwright.config.ts`; submits results directly after each test run.

The reporter reads config from environment variables (`QTEST_BASE_URL`, `QTEST_API_TOKEN`, `QTEST_PROJECT_ID`, `QTEST_LOG_LEVEL`, `QTEST_MAX_ATTACHMENT_SIZE`).

## Build & verify

- `npm run build` — emits to `dist/`. The package `main`/`exports` point at `dist/reporter/index.js`, so **rebuild after any src change** for the reporter to pick it up.
- `npm run check` — biome (format + lint), `--write` so it auto-fixes.
- `npm run typecheck` — `tsc --noEmit`.
- `npm test` — vitest.

Do not spend effort on minor style issues (tabs vs spaces, quote style, import ordering) — biome fixes them on `npm run check`.

## Codebase conventions

- ESM only (`"type": "module"`, `module: nodenext`). Relative imports must use the `.js` extension (e.g. `../../config/loader.js`). The `@src/*` path alias is available in tsconfig and vitest.
- Strict TS: `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, and `verbatimModuleSyntax` are on. Guard optional/indexed access explicitly. Type-only imports must use `import type`.
- `src/index.ts` is an empty placeholder — there is no public library API to maintain.
- Layering:
  - `config/` — env loading, zod schema (`schema.ts`), defaults.
  - `core/qtest/` — `client.ts` (fetch wrapper + retries) and `endpoints/` (runs) against the qTest API.
  - `reporter/` — the Playwright reporter (`index.ts`) and the attachment helper (`attachments.ts`).
  - `utils/` — error hierarchy (`errors.ts`), `loglevel` wrapper (`logger.ts`), date helpers (`date.ts`).
- Errors: `QTestError` base with `code`; subclasses `AuthError`, `ApiError` (has `statusCode` + `responseBody`), `ConfigError`.
- `QTestClient` has an optional `fetch` constructor parameter for dependency injection (defaults to `globalThis.fetch`). This is how tests supply a mock fetch without global stubbing.
- There is no CI/CD configured (no `.github/` workflows).

## Tests

- Tests live in `test/` mirroring `src/`. Run with `npm test` (vitest).
- qTest API calls are mocked by passing a `vi.fn<typeof fetch>()` to `QTestClient`'s optional `fetch` constructor parameter (dependency injection, not global mocking). Use the `makeClient(fetchMock)` helper from `test/core/qtest/test-utils.ts`.

## Key mechanisms

- **Test Design linking** — a Playwright test links to a qTest case via `annotation: { type: "qtest", description: "<automation-content>" }`. The reporter reads it and sends the value as `automation_content` (the Test Log fingerprint), falling back to the test title when the annotation is absent. Failure detail is placed in a single `test_step_logs` entry's `actual_result`.
- **Name and note** — the test log `name` is the test's leaf title (no `project ›` prefix). The first non-empty `titlePath` segment (the browser/project name, e.g. `chromium`) is stored in `note`, so the runner is preserved without cluttering the name.
- **Attachments** — the reporter collects `result.attachments` per test, then in `onEnd` reads each file (or uses its `body`) and sends it as base64 inline in `TestLog.attachments` (see `reporter/attachments.ts`). `QTEST_MAX_ATTACHMENT_SIZE` (default 10 MB) skips oversized files; unreadable files are skipped with a warning.
- **Submission API** — test logs are submitted to the **v3.1** endpoint `projects/{projectId}/test-runs/0/auto-test-logs?type=automation`, which returns a queue job id. Job status is polled at `projects/queue-processing/{jobId}` (v3). `waitForJob` polls every 2s with a 5-minute timeout by default. The request body accepts `test_suite` and `parent_module` as IDs or PIDs (`number | string`).
- **Retries** — the client retries transient failures (429/500/502/503/504 and network errors) up to `maxRetries` (default 3) with exponential backoff (base delay 500ms). 401 maps to `AuthError`.
- **Status mapping** — reporter maps Playwright statuses to qTest: `passed` → PASS, `failed`/`timedOut`/`interrupted` → FAIL, `skipped` → SKIP. ANSI escape codes are stripped from error content before sending.

## Code Quality

### Overall Guideline: Maximize Readability

To achieve this,

1. Avoid long methods - consider shortening when method goes beyond 30 LoC.
2. Avoid deep nesting - no more than 3 levels of indentation
3. Avoid complicated expressions involving many negations and nested parentheses.
4. Avoid magic literals - use named constants.
5. Make the code obvious.
6. Use line breaks to group related segements of code
7. Keep it simple, stupid (KISS)
8. Apply SLAP - avoid multiple layers of abstraction.
9. Make the happy path prominent.
