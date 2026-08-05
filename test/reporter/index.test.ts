import type {
	TestCase,
	TestError,
	TestResult,
} from "@playwright/test/reporter";
import QTestReporter from "@src/reporter/index.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../core/qtest/test-utils.js";

function fakeTestCase(title: string, titlePath?: string[]): TestCase {
	return {
		id: "test-1",
		title,
		titlePath: () => titlePath ?? [title],
		location: { file: "test.spec.ts", line: 1, column: 1 },
		parent: undefined as never,
		ok: () => true,
		outcome: () => "expected",
		annotations: [],
		expectedStatus: "passed",
		repeatEachIndex: 0,
		results: [],
		retries: 0,
		tags: [],
		timeout: 30000,
		type: "test",
	} as TestCase;
}

function fakeTestResult(
	status: TestResult["status"],
	duration: number,
	errors: TestError[] = [],
): TestResult {
	return {
		status,
		duration,
		errors,
		startTime: new Date("2026-08-05T10:00:00Z"),
		annotations: [],
		attachments: [],
		parallelIndex: 0,
		retry: 0,
		stderr: [],
		stdout: [],
		steps: [],
		workerIndex: 0,
	};
}

function fakeTestError(message: string): TestError {
	return { message };
}

describe("QTestReporter", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	describe("onTestEnd", () => {
		it("maps a passed test to PASS status", () => {
			const reporter = new QTestReporter();
			reporter.onTestEnd(
				fakeTestCase("login works"),
				fakeTestResult("passed", 200),
			);
			const logs = (reporter as unknown as { testLogs: unknown[] }).testLogs;
			expect(logs).toHaveLength(1);
			expect(logs[0]).toEqual(
				expect.objectContaining({
					name: "login works",
					status: "PASS",
				}),
			);
		});

		it("uses the titlePath as the test name, skipping empty segments", () => {
			const reporter = new QTestReporter();
			reporter.onTestEnd(
				fakeTestCase("inner", ["", "root", "inner"]),
				fakeTestResult("passed", 100),
			);
			const logs = (reporter as unknown as { testLogs: unknown[] }).testLogs;
			expect(logs[0]).toEqual(
				expect.objectContaining({ name: "root › inner" }),
			);
		});

		it("maps a failed test to FAIL with error details", () => {
			const reporter = new QTestReporter();
			reporter.onTestEnd(
				fakeTestCase("login fails"),
				fakeTestResult("failed", 300, [fakeTestError("expected X but got Y")]),
			);
			const logs = (reporter as unknown as { testLogs: unknown[] }).testLogs;
			expect(logs[0]).toEqual(
				expect.objectContaining({
					status: "FAIL",
					automation_content: "expected X but got Y",
				}),
			);
		});

		it("sets note to the first error message for failed tests", () => {
			const reporter = new QTestReporter();
			reporter.onTestEnd(
				fakeTestCase("error test"),
				fakeTestResult("failed", 100, [
					fakeTestError("boom"),
					fakeTestError("also failed"),
				]),
			);
			const logs = (reporter as unknown as { testLogs: unknown[] }).testLogs;
			expect(logs[0]).toEqual(expect.objectContaining({ note: "boom" }));
		});

		it("strips ANSI codes from automation_content on failure", () => {
			const reporter = new QTestReporter();
			reporter.onTestEnd(
				fakeTestCase("colorful failure"),
				fakeTestResult("failed", 100, [
					fakeTestError("\x1b[31mred error\x1b[39m"),
				]),
			);
			const logs = (reporter as unknown as { testLogs: unknown[] }).testLogs;
			expect(logs[0]).toEqual(
				expect.objectContaining({ automation_content: "red error" }),
			);
		});

		it("strips ANSI codes from note on failure", () => {
			const reporter = new QTestReporter();
			reporter.onTestEnd(
				fakeTestCase("colorful note"),
				fakeTestResult("failed", 100, [
					fakeTestError("\x1b[2mbold\x1b[22m message"),
				]),
			);
			const logs = (reporter as unknown as { testLogs: unknown[] }).testLogs;
			expect(logs[0]).toEqual(
				expect.objectContaining({ note: "bold message" }),
			);
		});

		it("uses test title as automation_content when a failure has no errors", () => {
			const reporter = new QTestReporter();
			reporter.onTestEnd(
				fakeTestCase("weird failure"),
				fakeTestResult("failed", 50),
			);
			const logs = (reporter as unknown as { testLogs: unknown[] }).testLogs;
			expect(logs[0]).toEqual(
				expect.objectContaining({
					status: "FAIL",
					automation_content: "weird failure",
				}),
			);
		});

		it("maps timedOut to FAIL", () => {
			const reporter = new QTestReporter();
			reporter.onTestEnd(
				fakeTestCase("timeout"),
				fakeTestResult("timedOut", 5000),
			);
			const logs = (reporter as unknown as { testLogs: unknown[] }).testLogs;
			expect(logs[0]).toEqual(expect.objectContaining({ status: "FAIL" }));
		});

		it("maps skipped to SKIP", () => {
			const reporter = new QTestReporter();
			reporter.onTestEnd(fakeTestCase("skipped"), fakeTestResult("skipped", 0));
			const logs = (reporter as unknown as { testLogs: unknown[] }).testLogs;
			expect(logs[0]).toEqual(expect.objectContaining({ status: "SKIP" }));
		});

		it("maps interrupted to FAIL", () => {
			const reporter = new QTestReporter();
			reporter.onTestEnd(
				fakeTestCase("interrupted"),
				fakeTestResult("interrupted", 0),
			);
			const logs = (reporter as unknown as { testLogs: unknown[] }).testLogs;
			expect(logs[0]).toEqual(expect.objectContaining({ status: "FAIL" }));
		});

		it("sets timestamps from startTime and duration", () => {
			const reporter = new QTestReporter();
			reporter.onTestEnd(fakeTestCase("timed"), fakeTestResult("passed", 500));
			const logs = (reporter as unknown as { testLogs: unknown[] }).testLogs;
			expect(logs[0]).toEqual(
				expect.objectContaining({
					exe_start_date: "2026-08-05T10:00:00.000Z",
					exe_end_date: "2026-08-05T10:00:00.500Z",
				}),
			);
		});

		it("sets test_case from qtest annotation", () => {
			const reporter = new QTestReporter();
			const testCase = fakeTestCase("annotated test");
			testCase.annotations = [{ type: "qtest", description: "TC-42" }];
			reporter.onTestEnd(testCase, fakeTestResult("passed", 100));
			const logs = (reporter as unknown as { testLogs: unknown[] }).testLogs;
			expect(logs[0]).toEqual(expect.objectContaining({ test_case: "TC-42" }));
		});

		it("omits test_case when qtest annotation is missing", () => {
			const reporter = new QTestReporter();
			const testCase = fakeTestCase("no annotation");
			testCase.annotations = [{ type: "other", description: "ignored" }];
			reporter.onTestEnd(testCase, fakeTestResult("passed", 100));
			const logs = (reporter as unknown as { testLogs: unknown[] }).testLogs;
			expect(logs[0]).not.toHaveProperty("test_case");
		});
	});

	describe("onEnd", () => {
		it("does nothing when no tests were collected", async () => {
			const reporter = new QTestReporter();
			const fetchMock = vi.fn<typeof fetch>();
			vi.stubGlobal("fetch", fetchMock);
			await reporter.onEnd();
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it("submits collected tests to qTest", async () => {
			vi.stubEnv("QTEST_BASE_URL", "https://qtest.example.com");
			vi.stubEnv("QTEST_API_TOKEN", "secret-token");
			vi.stubEnv("QTEST_PROJECT_ID", "42");
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

			const reporter = new QTestReporter();
			reporter.onTestEnd(
				fakeTestCase("login works"),
				fakeTestResult("passed", 200),
			);
			reporter.onTestEnd(
				fakeTestCase("login fails"),
				fakeTestResult("failed", 300, [fakeTestError("expected X but got Y")]),
			);

			await reporter.onEnd();

			expect(fetchMock).toHaveBeenCalledTimes(1);
			const callUrl = String(fetchMock.mock.calls[0]?.[0] ?? "");
			expect(callUrl).toContain("auto-test-logs");
			expect(callUrl).toContain("type=automation");
		});

		it("waits for job completion when the wait option is set", async () => {
			vi.stubEnv("QTEST_BASE_URL", "https://qtest.example.com");
			vi.stubEnv("QTEST_API_TOKEN", "secret-token");
			vi.stubEnv("QTEST_PROJECT_ID", "42");
			const fetchMock = vi
				.fn<typeof fetch>()
				.mockResolvedValueOnce(
					jsonResponse(201, { id: 1, state: "IN_WAITING" }),
				)
				.mockResolvedValueOnce(jsonResponse(200, { id: 1, state: "SUCCESS" }));
			vi.stubGlobal("fetch", fetchMock);

			const reporter = new QTestReporter({ wait: true });
			reporter.onTestEnd(fakeTestCase("a test"), fakeTestResult("passed", 100));

			const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			await reporter.onEnd();

			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(logSpy).toHaveBeenCalledWith("qTest job #1 completed: SUCCESS");
		});

		it("includes testSuiteId and parentModuleId in the submission", async () => {
			vi.stubEnv("QTEST_BASE_URL", "https://qtest.example.com");
			vi.stubEnv("QTEST_API_TOKEN", "secret-token");
			vi.stubEnv("QTEST_PROJECT_ID", "42");
			let submittedBody: string | null = null;
			const fetchMock = vi
				.fn<typeof fetch>()
				.mockImplementation((input, init) => {
					const url = String(input);
					if (url.includes("auto-test-logs")) {
						submittedBody = init?.body as string;
						return Promise.resolve(
							jsonResponse(201, { id: 7, state: "IN_WAITING" }),
						);
					}
					throw new Error(`Unmocked URL: ${url}`);
				});
			vi.stubGlobal("fetch", fetchMock);

			const reporter = new QTestReporter({
				testSuiteId: 5,
				parentModuleId: 8,
			});
			reporter.onTestEnd(fakeTestCase("a test"), fakeTestResult("passed", 100));

			await reporter.onEnd();

			const body = JSON.parse(submittedBody ?? "{}") as {
				test_suite?: number;
				parent_module?: number;
			};
			expect(body.test_suite).toBe(5);
			expect(body.parent_module).toBe(8);
		});

		it("logs errors instead of throwing when the request fails", async () => {
			vi.stubEnv("QTEST_BASE_URL", "https://qtest.example.com");
			vi.stubEnv("QTEST_API_TOKEN", "secret-token");
			vi.stubEnv("QTEST_PROJECT_ID", "42");
			const fetchMock = vi
				.fn<typeof fetch>()
				.mockRejectedValue(new Error("network error"));
			vi.stubGlobal("fetch", fetchMock);

			const reporter = new QTestReporter();
			reporter.onTestEnd(fakeTestCase("a test"), fakeTestResult("passed", 100));

			const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			await reporter.onEnd();

			expect(logSpy).toHaveBeenCalledWith(
				expect.stringContaining("qTest reporter"),
			);
		});

		it("includes the API response body for HTTP errors", async () => {
			vi.stubEnv("QTEST_BASE_URL", "https://qtest.example.com");
			vi.stubEnv("QTEST_API_TOKEN", "secret-token");
			vi.stubEnv("QTEST_PROJECT_ID", "42");
			const fetchMock = vi
				.fn<typeof fetch>()
				.mockResolvedValue(
					jsonResponse(400, { message: "Test case not found" }),
				);
			vi.stubGlobal("fetch", fetchMock);

			const reporter = new QTestReporter();
			reporter.onTestEnd(fakeTestCase("a test"), fakeTestResult("passed", 100));

			const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			await reporter.onEnd();

			expect(logSpy).toHaveBeenCalledWith(
				expect.stringContaining('{"message":"Test case not found"}'),
			);
		});
	});
});
