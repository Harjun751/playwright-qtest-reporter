# qtest-playwright-integration

Upload Playwright test results to [qTest](https://www.tricentis.com/products/tricentis-qtest) as automated test logs. Two approaches are supported:

- **Playwright Reporter** — add a reporter to `playwright.config.ts` and results upload automatically after each test run.
- **CLI** — generate a JUnit XML file from Playwright and upload it with the `qtest-playwright` command.

## Requirements

- Node.js 20+
- A qTest project with API access

## Installation

```sh
npm install
npm run build
npm link
```

## Configuration

Both the CLI and the reporter read configuration from environment variables:

| Variable              | Required | Default                     | Description                                  |
| --------------------- | -------- | --------------------------- | -------------------------------------------- |
| `QTEST_BASE_URL`      | no       | `https://qtest.tricentis.com` | qTest instance base URL                    |
| `QTEST_API_TOKEN`     | yes      | —                           | qTest API token                              |
| `QTEST_PROJECT_ID`    | yes      | —                           | qTest project ID to upload to                |
| `QTEST_LOG_LEVEL`     | no       | `info`                      | Logger verbosity (`trace`/`debug`/`info`/`warn`/`error`/`silent`) |
| `QTEST_RUN_ID`        | no       | —                           | qTest run ID (reserved for future use)       |
| `QTEST_DEBUG`         | no       | —                           | Set to any value to enable debug logging     |

The API token is managed in qTest under **Profile → Personal Access Token**. The project ID is visible in the URL when you open a project (`https://<instance>.tricentis.com/qtest/projects/<id>/...`).

## Playwright Reporter

Add the reporter to your Playwright config. Results are sent to qTest automatically after each test run — no extra steps required.

```ts
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
	reporter: ["qtest-playwright-integration"],
});
```

The reporter plays well with other reporters. For example, keep the built-in terminal output while uploading:

```ts
reporter: [
	["list"],
	["qtest-playwright-integration", { wait: true, testSuiteId: 5 }],
],
```

### Reporter options

| Option           | Default | Description                                        |
| ---------------- | ------- | -------------------------------------------------- |
| `wait`           | `false` | Wait for the qTest job to complete before exiting  |
| `testSuiteId`    | —       | qTest test suite ID to attach results to           |
| `parentModuleId` | —       | qTest parent module ID to attach results to        |

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

The annotation value is sent as `automation_content`, so qTest links the result to any existing Test Case with that Automation Content, or creates one on the first run. Failed tests also include a single test step whose `actual_result` holds the failure detail.

## CLI

Validate your configuration:

```sh
qtest-playwright config validate
```

Upload a JUnit XML report:

```sh
qtest-playwright upload results.xml
```

Upload without waiting for the submission job:

```sh
qtest-playwright upload results.xml --no-wait
```

Attach results to a specific test suite or parent module:

```sh
qtest-playwright upload results.xml --test-suite 5 --parent-module 8
```

### Options for `upload`

| Option                | Description                                        |
| --------------------- | -------------------------------------------------- |
| `<file>`              | Path to the JUnit XML report (required)            |
| `--test-suite <id>`   | qTest test suite ID to attach results to           |
| `--parent-module <id>` | qTest parent module ID to attach results to       |
| `--no-wait`           | Exit after submitting without polling for completion |

## Generating a JUnit report for the CLI

Configure Playwright to emit a JUnit report, then upload it:

```js
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
	reporter: [["junit", { outputFile: "results.xml" }]],
});
```

```sh
npx playwright test
qtest-playwright upload results.xml
```

> With the Playwright Reporter approach you don't need this step — results are uploaded directly.

## Development

```sh
npm install
npm run check   # biome format + lint
npm run typecheck
npm test
npm run build   # emits ./dist for the CLI binary
```
