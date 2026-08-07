# playwright-qtest-reporter

Upload Playwright test results to
[qTest](https://www.tricentis.com/products/tricentis-qtest) as automated test
logs. Add the Playwright reporter to `playwright.config.ts` and results upload
automatically after each test run. Uses the qTest API.

## Requirements

- Node.js 20+
- A qTest project with API access

## Installation

```sh
npm install --save-dev playwright-qtest-reporter
```

## Quick Start

1. Set endpoint environment variables. These 3 are minimally required:

   ```sh
   export QTEST_BASE_URL="https://{tenant}.qtestnet.com"
   export QTEST_API_TOKEN="{token}"
   export QTEST_PROJECT_ID="{project_id}"
   ```

   Hint: The API token is managed in qTest under **Profile → Personal Access
   Token**. The project ID is visible in the URL when you open a project
   (`https://<instance>.tricentis.com/qtest/projects/<id>/...`).

1. Configure playwright reporter

   ```js
   // playwright.config.ts
   import { defineConfig } from "@playwright/test";

   export default defineConfig({
     reporter: ["playwright-qtest-reporter"],
   });
   ```

1. Run your tests:

   ```sh
   npx playwright test
   ```

The expected outcome for this is that auto-generated test cases go under a root
"Automation" module in the Test Design section, and a Test Execution named
"Automation {date}" is created in the root of the Test Execution section. To
configure this, read the next section.

## Configuration

The reporter is configured, in order of priority, from these sources:

1. **playwright.config.ts**
1. **Environment variables**

That is, values set from environment variables are overriden by the playwright
config file.

### Variables

The reporter reads configuration from environment variables (Environment
Variable header) or Playwright config (Config Name header):

| Environment Variable           | Config Name            | Required | Default                       | Description                                                            |
| ------------------------------ | ---------------------- | -------- | ----------------------------- | ---------------------------------------------------------------------- |
| `QTEST_BASE_URL`               | —                      | no       | `https://qtest.tricentis.com` | qTest instance base URL                                                |
| `QTEST_API_TOKEN`              | —                      | yes      | —                             | qTest API token                                                        |
| `QTEST_PROJECT_ID`             | —                      | yes      | —                             | qTest project ID to upload to                                          |
| `QTEST_LOG_LEVEL`              | —                      | no       | `info`                        | Logger verbosity (`trace`/`debug`/`info`/`warn`/`error`/`silent`)      |
| `QTEST_MAX_ATTACHMENT_SIZE`    | —                      | no       | `10485760` (10 MB)            | Max attachment size in bytes; larger files are skipped                 |
| `QTEST_TEST_SUITE_ID`          | `testSuiteId`          | no       | —                             | qTest test suite ID or PID (`5` or `TS-5`) to attach results to        |
| `QTEST_PARENT_MODULE_ID`       | `parentModuleId`       | no       | —                             | qTest parent module ID or PID (`8` or `MD-8`) to attach results to     |
| `QTEST_WAIT`                   | `wait`                 | no       | —                             | Set to `true`/`1` to wait for the qTest job to complete before exiting |
| `QTEST_SKIP_AUTOMATION_MODULE` | `skipAutomationModule` | no       | —                             | Set to `true`/`1` to skip creating the Automation sub-module           |
| `QTEST_DEBUG`                  | —                      | no       | —                             | Set to any value to enable debug logging                               |

## Controlling where items go

### Test Cases

To prevent test cases from going to the default "Automation" module, set the
**`QTEST_PARENT_MODULE_ID`**/**`parentModuleId`** to be the desired module in
qTest. This places **new** test cases into the desired parent module. Existing
test cases are fingerprinted and hence may use the old module. You may want to
delete the test cases from the old location when moving test cases between
modules.

Additionally, when setting the parent module, qTest still places test cases
within an "Automation" module under the parent. To omit this module, set
**`QTEST_SKIP_AUTOMATION_MODULE`**/**`skipAutomationModule`** to `true`.

### Test Executions

Test executions/runs in qTest are placed within test suites. Set the
**`QTEST_TEST_SUITE_ID`**/**`testSuiteId`** variable to control where test
executions go. These may be changed any time, unlike the test case module.

### Linking test logs to qTest test cases

Each test log carries an `automation_content` value that qTest uses as a
fingerprint to look up (or auto-create) the matching Test Case. By default this
is the test title. To use a stable identifier instead, annotate the test:

```ts
test("creates a customer", async ({ page }) => {
  test.info().annotations.push({
    type: "qtest",
    description: "CustomerService.CreateCustomer",
  });
  // ...
});
```

The annotation value is sent as `automation_content`, so qTest links the result
to any existing Test Case with that Automation Content, or creates one on the
first run. The test log `name` is the test's leaf title, and the browser/project
name (e.g. `chromium`) is stored in the test log `note`. Failed tests also
include a single test step whose `actual_result` holds the failure detail.

An advantage of setting the annotation is for stability across refactors,
preserving old test run history.

### Attachments

Screenshots, videos, and traces captured during a test are uploaded as base64
inline attachments on the matching test log. What gets captured is controlled by
your Playwright config (`screenshot`, `video`, `trace` options and any
`page.screenshot()`/`test.info().attach()` calls) — the reporter passes through
whatever Playwright records. Control the allowed size with
_`QTEST_MAX_ATTACHMENT_SIZE`_; oversized or unreadable files are skipped with a
warning instead of failing the run.

## Development

```sh
npm install
npm run check   # biome format + lint
npm run typecheck
npm test
npm run build   # emits ./dist for the reporter
```
