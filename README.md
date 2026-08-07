# playwright-qtest-reporter

Upload Playwright test results to [qTest](https://www.tricentis.com/products/tricentis-qtest) as automated test logs. Add the Playwright reporter to `playwright.config.ts` and results upload automatically after each test run.

## Requirements

- Node.js 20+
- A qTest project with API access

## Installation

```sh
npm install playwright-qtest-reporter
```

## Configuration

The reporter reads configuration from environment variables:

| Variable              | Required | Default                     | Description                                  |
| --------------------- | -------- | --------------------------- | -------------------------------------------- |
| `QTEST_BASE_URL`      | no       | `https://qtest.tricentis.com` | qTest instance base URL                    |
| `QTEST_API_TOKEN`     | yes      | —                           | qTest API token                              |
| `QTEST_PROJECT_ID`    | yes      | —                           | qTest project ID to upload to                |
| `QTEST_LOG_LEVEL`     | no       | `info`                      | Logger verbosity (`trace`/`debug`/`info`/`warn`/`error`/`silent`) |
| `QTEST_MAX_ATTACHMENT_SIZE` | no | `10485760` (10 MB)      | Max attachment size in bytes; larger files are skipped |
| `QTEST_DEBUG`         | no       | —                           | Set to any value to enable debug logging     |

The API token is managed in qTest under **Profile → Personal Access Token**. The project ID is visible in the URL when you open a project (`https://<instance>.tricentis.com/qtest/projects/<id>/...`).

## Playwright Reporter

Add the reporter to your Playwright config. Results are sent to qTest automatically after each test run — no extra steps required.

```ts
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
	reporter: ["playwright-qtest-reporter"],
});
```

The reporter plays well with other reporters. For example, keep the built-in terminal output while uploading:

```ts
reporter: [
	["list"],
	["playwright-qtest-reporter", { wait: true, testSuiteId: 5 }],
],
```

### Reporter options

| Option           | Default | Description                                        |
| ---------------- | ------- | -------------------------------------------------- |
| `wait`           | `false` | Wait for the qTest job to complete before exiting  |
| `testSuiteId`    | —       | qTest test suite ID to attach results to           |
| `parentModuleId` | —       | qTest parent module ID to attach results to        |
| `skipAutomationModule` | `false` | Skip creating the 'Automation' sub-module under the parent module |

### Linking test logs to qTest test cases

Each test log carries an `automation_content` value that qTest uses as a fingerprint to look up (or auto-create) the matching Test Case. By default this is the test title. To use a stable identifier instead, annotate the test:

```ts
test("creates a customer", async ({ page }) => {
	test.info().annotations.push({
		type: "qtest",
		description: "CustomerService.CreateCustomer",
	});
	// ...
});
```

The annotation value is sent as `automation_content`, so qTest links the result to any existing Test Case with that Automation Content, or creates one on the first run. The test log `name` is the test's leaf title, and the browser/project name (e.g. `chromium`) is stored in the test log `note`. Failed tests also include a single test step whose `actual_result` holds the failure detail.

### Attachments

Screenshots, videos, and traces captured during a test are uploaded as base64 inline attachments on the matching test log. What gets captured is controlled by your Playwright config (`screenshot`, `video`, `trace` options and any `page.screenshot()`/`test.info().attach()` calls) — the reporter passes through whatever Playwright records. Control the allowed size with `QTEST_MAX_ATTACHMENT_SIZE`; oversized or unreadable files are skipped with a warning instead of failing the run.

## Development

```sh
npm install
npm run check   # biome format + lint
npm run typecheck
npm test
npm run build   # emits ./dist for the reporter
```
