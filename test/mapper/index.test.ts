import { mapReport } from "@src/mapper/index.js";
import type {
	ParsedReport,
	ParsedTestCase,
	ParsedTestSuite,
} from "@src/parser/types.js";
import { describe, expect, it } from "vitest";

const report: ParsedReport = {
	suites: [
		{
			name: "login.spec.ts",
			timestamp: "2026-08-05T10:00:00.000Z",
			durationMs: 1500,
			tests: 2,
			failures: 1,
			skipped: 0,
			testCases: [
				{
					name: "logs in",
					classname: "login.spec.ts",
					durationMs: 500,
					status: "passed",
					output: "stdout for logs in",
				},
				{
					name: "rejects bad password",
					classname: "login.spec.ts",
					durationMs: 1000,
					status: "failed",
					failureMessage: "expect(received).toBe(expected)",
					failureDetail: "Error: expect(received).toBe(expected)",
				},
			],
		},
		{
			name: "checkout.spec.ts",
			timestamp: "2026-08-05T10:00:02.000Z",
			durationMs: 2000,
			tests: 1,
			failures: 0,
			skipped: 1,
			testCases: [
				{
					name: "skipped test",
					classname: "checkout.spec.ts",
					durationMs: 0,
					status: "skipped",
				},
			],
		},
	],
	tests: 3,
	failures: 1,
	skipped: 1,
	durationMs: 3500,
};

describe("mapReport", () => {
	it("builds an AutomationRequest with one TestLog per test case", () => {
		const result = mapReport(report, {
			executionDate: "2026-08-05",
			now: () => new Date("2026-08-05T12:00:00.000Z"),
		});
		expect(result.execution_date).toBe("2026-08-05");
		expect(result.test_logs.map((log) => log.name)).toEqual([
			"logs in",
			"rejects bad password",
			"skipped test",
		]);
	});

	it("maps statuses to qTest values", () => {
		const result = mapReport(report, { executionDate: "2026-08-05" });
		expect(result.test_logs.map((log) => log.status)).toEqual([
			"PASS",
			"FAIL",
			"SKIP",
		]);
	});

	it("derives start and end dates from the suite timestamp and durations", () => {
		const result = mapReport(report, { executionDate: "2026-08-05" });
		const logs = result.test_logs;
		expect(logs[0]).toMatchObject({
			exe_start_date: "2026-08-05T10:00:00.000Z",
			exe_end_date: "2026-08-05T10:00:00.500Z",
		});
		expect(logs[1]).toMatchObject({
			exe_start_date: "2026-08-05T10:00:00.500Z",
			exe_end_date: "2026-08-05T10:00:01.500Z",
		});
		expect(logs[2]).toMatchObject({
			exe_start_date: "2026-08-05T10:00:02.000Z",
			exe_end_date: "2026-08-05T10:00:02.000Z",
		});
	});

	it("uses the test name as automation_content for every result", () => {
		const result = mapReport(report, { executionDate: "2026-08-05" });
		expect(result.test_logs.map((log) => log.automation_content)).toEqual([
			"logs in",
			"rejects bad password",
			"skipped test",
		]);
	});

	it("puts failure detail into the failed test's test step", () => {
		const result = mapReport(report, { executionDate: "2026-08-05" });
		expect(result.test_logs[1]?.test_step_logs).toEqual([
			{
				description: "Run test",
				expected_result: "Test passes",
				actual_result: "Error: expect(received).toBe(expected)",
				status: "FAIL",
				order: 1,
			},
		]);
		expect(result.test_logs[0]?.test_step_logs).toBeUndefined();
		expect(result.test_logs[2]?.test_step_logs).toBeUndefined();
	});

	it("defaults execution_date from the injected clock", () => {
		const result = mapReport(report, {
			now: () => new Date("2026-08-05T12:00:00.000Z"),
		});
		expect(result.execution_date).toBe("2026-08-05");
	});

	it("backs timestamps off from the clock when a suite has no timestamp", () => {
		const suite = report.suites[0] as ParsedTestSuite;
		const { timestamp: _timestamp, ...rest } = suite;
		const noTimestamp: ParsedReport = {
			...report,
			suites: [{ ...rest }],
		};
		const result = mapReport(noTimestamp, {
			now: () => new Date("2026-08-05T12:00:00.000Z"),
		});
		expect(result.test_logs[0]).toMatchObject({
			exe_start_date: "2026-08-05T11:59:58.500Z",
			exe_end_date: "2026-08-05T11:59:59.000Z",
		});
	});

	it("falls back to failure message when there is no detail", () => {
		const suite = report.suites[0] as ParsedTestSuite;
		const tc = suite.testCases[1] as ParsedTestCase;
		const { failureDetail: _failureDetail, ...restTc } = tc;
		const noDetail: ParsedReport = {
			...report,
			suites: [{ ...suite, testCases: [{ ...restTc }] }],
		};
		const result = mapReport(noDetail, { executionDate: "2026-08-05" });
		expect(result.test_logs[0]?.test_step_logs?.[0]?.actual_result).toBe(
			"expect(received).toBe(expected)",
		);
	});
});
