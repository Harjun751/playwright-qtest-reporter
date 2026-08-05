export type ParsedTestStatus = "passed" | "failed" | "skipped";

export interface ParsedTestCase {
	name: string;
	classname: string;
	durationMs: number;
	status: ParsedTestStatus;
	failureMessage?: string;
	failureDetail?: string;
	output?: string;
}

export interface ParsedTestSuite {
	name: string;
	timestamp?: string;
	durationMs: number;
	tests: number;
	failures: number;
	skipped: number;
	testCases: ParsedTestCase[];
}

export interface ParsedReport {
	suites: ParsedTestSuite[];
	tests: number;
	failures: number;
	skipped: number;
	durationMs: number;
}
