import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "@src/cli/index.js";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { jsonResponse } from "../../../core/qtest/test-utils.js";

const VALID_REPORT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="example" timestamp="2026-08-05T10:00:00Z" time="0.5" tests="2" failures="1">
    <testcase name="login works" classname="Auth" time="0.2" />
    <testcase name="login fails" classname="Auth" time="0.3">
      <failure message="expected password">Expected "password" to match</failure>
    </testcase>
  </testsuite>
</testsuites>`;

let tempDir: string;

function reportPath(name: string): string {
	return join(tempDir, name);
}

beforeAll(() => {
	tempDir = mkdtempSync(join(tmpdir(), "qtest-upload-"));
});

afterAll(() => {
	rmSync(tempDir, { recursive: true, force: true });
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.clearAllMocks();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("upload", () => {
	it("reports an error and exits 1 when the report file is missing", async () => {
		vi.stubEnv("QTEST_BASE_URL", "https://qtest.example.com");
		vi.stubEnv("QTEST_API_TOKEN", "secret-token");
		vi.stubEnv("QTEST_PROJECT_ID", "42");
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const code = await runCli(["upload", reportPath("missing.xml")]);
		expect(code).toBe(1);
		expect(error).toHaveBeenCalledWith(
			expect.stringContaining("Failed to read report file"),
		);
	});

	it("reports an error and exits 1 when the configuration is invalid", async () => {
		writeFileSync(reportPath("valid.xml"), VALID_REPORT_XML);
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const code = await runCli(["upload", reportPath("valid.xml")]);
		expect(code).toBe(1);
		expect(error).toHaveBeenCalledWith(
			expect.stringContaining("Invalid configuration"),
		);
	});

	it("reports a parse error and exits 1 for malformed XML", async () => {
		vi.stubEnv("QTEST_BASE_URL", "https://qtest.example.com");
		vi.stubEnv("QTEST_API_TOKEN", "secret-token");
		vi.stubEnv("QTEST_PROJECT_ID", "42");
		writeFileSync(reportPath("malformed.xml"), "<testsuites>");
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const code = await runCli(["upload", reportPath("malformed.xml")]);
		expect(code).toBe(1);
		expect(error).toHaveBeenCalledWith(
			expect.stringContaining("Malformed JUnit XML"),
		);
	});

	it("submits and exits without polling when --no-wait is passed", async () => {
		vi.stubEnv("QTEST_BASE_URL", "https://qtest.example.com");
		vi.stubEnv("QTEST_API_TOKEN", "secret-token");
		vi.stubEnv("QTEST_PROJECT_ID", "42");
		writeFileSync(reportPath("nowait.xml"), VALID_REPORT_XML);
		const fetchMock = vi.fn<typeof fetch>().mockImplementation((input) => {
			const url = String(input);
			if (url.includes("auto-test-logs")) {
				return Promise.resolve(
					jsonResponse(201, { id: 99, state: "IN_WAITING" }),
				);
			}
			throw new Error(`Unmocked URL: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		const code = await runCli([
			"upload",
			reportPath("nowait.xml"),
			"--no-wait",
		]);

		expect(code).toBe(0);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining("Job queued: #99"),
		);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Skipping wait"));
	});

	it("submits and waits for job completion", async () => {
		vi.stubEnv("QTEST_BASE_URL", "https://qtest.example.com");
		vi.stubEnv("QTEST_API_TOKEN", "secret-token");
		vi.stubEnv("QTEST_PROJECT_ID", "42");
		writeFileSync(reportPath("wait.xml"), VALID_REPORT_XML);
		const fetchMock = vi.fn<typeof fetch>().mockImplementation((input) => {
			const url = String(input);
			if (url.includes("auto-test-logs")) {
				return Promise.resolve(
					jsonResponse(201, { id: 99, state: "IN_WAITING" }),
				);
			}
			if (url.includes("queue-processing")) {
				return Promise.resolve(jsonResponse(200, { id: 99, state: "SUCCESS" }));
			}
			throw new Error(`Unmocked URL: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		const code = await runCli(["upload", reportPath("wait.xml")]);

		expect(code).toBe(0);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining("Job #99 completed: SUCCESS."),
		);
	});

	it("includes test suite and parent module IDs in the submission", async () => {
		vi.stubEnv("QTEST_BASE_URL", "https://qtest.example.com");
		vi.stubEnv("QTEST_API_TOKEN", "secret-token");
		vi.stubEnv("QTEST_PROJECT_ID", "42");
		writeFileSync(reportPath("ids.xml"), VALID_REPORT_XML);
		let submittedBody: string | null = null;
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockImplementation((input, init) => {
				const url = String(input);
				if (url.includes("auto-test-logs")) {
					submittedBody = init?.body as string;
					return Promise.resolve(
						jsonResponse(201, { id: 99, state: "IN_WAITING" }),
					);
				}
				throw new Error(`Unmocked URL: ${url}`);
			});
		vi.stubGlobal("fetch", fetchMock);

		const code = await runCli([
			"upload",
			reportPath("ids.xml"),
			"--no-wait",
			"--test-suite",
			"5",
			"--parent-module",
			"8",
		]);

		expect(code).toBe(0);
		const body = JSON.parse(submittedBody ?? "{}") as {
			test_suite?: number;
			parent_module?: number;
		};
		expect(body.test_suite).toBe(5);
		expect(body.parent_module).toBe(8);
	});

	it("omits the test suite and lets qTest auto-create by default", async () => {
		vi.stubEnv("QTEST_BASE_URL", "https://qtest.example.com");
		vi.stubEnv("QTEST_API_TOKEN", "secret-token");
		vi.stubEnv("QTEST_PROJECT_ID", "42");
		writeFileSync(reportPath("autocreate.xml"), VALID_REPORT_XML);

		let submittedBody: string | null = null;
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockImplementation((input, init) => {
				const url = String(input);
				if (url.includes("auto-test-logs")) {
					submittedBody = init?.body as string;
					return Promise.resolve(
						jsonResponse(201, { id: 99, state: "IN_WAITING" }),
					);
				}
				throw new Error(`Unmocked URL: ${url}`);
			});
		vi.stubGlobal("fetch", fetchMock);

		const code = await runCli([
			"upload",
			reportPath("autocreate.xml"),
			"--no-wait",
		]);

		expect(code).toBe(0);
		const body = JSON.parse(submittedBody ?? "{}") as {
			test_suite?: number;
		};
		expect(body.test_suite).toBeUndefined();
	});

	it("returns a non-zero exit code for an invalid option value", async () => {
		vi.stubEnv("QTEST_BASE_URL", "https://qtest.example.com");
		vi.stubEnv("QTEST_API_TOKEN", "secret-token");
		vi.stubEnv("QTEST_PROJECT_ID", "42");
		writeFileSync(reportPath("badopt.xml"), VALID_REPORT_XML);
		const writeErr = vi
			.spyOn(process.stderr, "write")
			.mockImplementation(() => true);
		const code = await runCli([
			"upload",
			reportPath("badopt.xml"),
			"--test-suite",
			"abc",
		]);
		expect(code).toBe(1);
		expect(writeErr).toHaveBeenCalled();
	});
});
