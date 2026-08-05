import type { AutomationRequest, TestLog } from "../core/qtest/types.js";
import type {
	ParsedReport,
	ParsedTestCase,
	ParsedTestSuite,
} from "../parser/types.js";

export const QTEST_STATUS_BY_RESULT = {
	passed: "PASS",
	failed: "FAIL",
	skipped: "SKIP",
} as const;

export interface MapReportOptions {
	executionDate?: string;
	now?: () => Date;
}

export function mapReport(
	report: ParsedReport,
	options: MapReportOptions = {},
): AutomationRequest {
	const now = options.now ?? (() => new Date());
	const executionDate = options.executionDate ?? toDateString(now());
	return {
		execution_date: executionDate,
		test_logs: report.suites.flatMap((suite) => mapSuite(suite, now)),
	};
}

function mapSuite(suite: ParsedTestSuite, now: () => Date): TestLog[] {
	const timestampMs =
		suite.timestamp === undefined ? NaN : Date.parse(suite.timestamp);
	const suiteStartMs = Number.isNaN(timestampMs)
		? now().getTime() - suite.durationMs
		: timestampMs;

	let cursor = suiteStartMs;
	return suite.testCases.map((testCase) => {
		const startMs = cursor;
		const endMs = startMs + testCase.durationMs;
		cursor = endMs;
		return toTestLog(testCase, startMs, endMs);
	});
}

function toTestLog(
	testCase: ParsedTestCase,
	startMs: number,
	endMs: number,
): TestLog {
	const status = QTEST_STATUS_BY_RESULT[testCase.status];
	const isFailure = testCase.status === "failed";
	const result: TestLog = {
		name: testCase.name,
		status,
		exe_start_date: new Date(startMs).toISOString(),
		exe_end_date: new Date(endMs).toISOString(),
		automation_content: isFailure
			? (testCase.failureDetail ?? testCase.failureMessage ?? testCase.name)
			: testCase.name,
	};
	if (isFailure && testCase.failureMessage !== undefined) {
		result.note = testCase.failureMessage;
	}
	return result;
}

function toDateString(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}
