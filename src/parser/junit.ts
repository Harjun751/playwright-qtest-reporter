import { XMLParser } from "fast-xml-parser";
import { SyntaxValidator } from "fast-xml-validator";
import { ParseError } from "../utils/errors.js";
import type { ParsedReport, ParsedTestCase, ParsedTestSuite } from "./types.js";

interface RawFailure {
	"#text"?: string | number;
	"@_message"?: string;
}

interface RawTestCase {
	"@_name"?: string;
	"@_classname"?: string;
	"@_time"?: string | number;
	failure?: RawFailure | RawFailure[];
	error?: RawFailure | RawFailure[];
	skipped?: unknown;
	"system-out"?: string;
}

interface RawTestSuite {
	"@_name"?: string;
	"@_timestamp"?: string;
	"@_time"?: string | number;
	"@_tests"?: string | number;
	"@_failures"?: string | number;
	"@_skipped"?: string | number;
	testcase?: RawTestCase | RawTestCase[];
}

interface RawReport {
	testsuites?: {
		"@_tests"?: string | number;
		"@_failures"?: string | number;
		"@_skipped"?: string | number;
		"@_time"?: string | number;
		testsuite?: RawTestSuite | RawTestSuite[];
	};
	testsuite?: RawTestSuite | RawTestSuite[];
}

export function parseJUnit(xml: string): ParsedReport {
	assertWellFormed(xml);

	const parser = new XMLParser({ ignoreAttributes: false });
	let raw: RawReport;
	try {
		raw = parser.parse(xml) as RawReport;
	} catch (error) {
		throw new ParseError(
			`Failed to parse JUnit XML: ${(error as Error).message}`,
		);
	}

	const root = raw.testsuites ?? {};
	const rawSuites = root.testsuite ?? raw.testsuite;
	if (rawSuites === undefined) {
		throw new ParseError("JUnit XML does not contain a testsuite element");
	}

	const suites = toArray(rawSuites).map(parseSuite);
	return {
		suites,
		tests: sum(suites, (suite) => suite.tests),
		failures: sum(suites, (suite) => suite.failures),
		skipped: sum(suites, (suite) => suite.skipped),
		durationMs: sum(suites, (suite) => suite.durationMs),
	};
}

function parseSuite(raw: RawTestSuite): ParsedTestSuite {
	const testCases = toArray(raw.testcase).map(parseTestCase);
	const result: ParsedTestSuite = {
		name: attrString(raw["@_name"]) ?? "unknown",
		durationMs: secondsToMs(toNumber(raw["@_time"])),
		tests: toNumber(raw["@_tests"] ?? testCases.length),
		failures: toNumber(
			raw["@_failures"] ??
				testCases.filter((testCase) => testCase.status === "failed").length,
		),
		skipped: toNumber(
			raw["@_skipped"] ??
				testCases.filter((testCase) => testCase.status === "skipped").length,
		),
		testCases,
	};
	const timestamp = attrString(raw["@_timestamp"]);
	if (timestamp !== undefined) {
		result.timestamp = timestamp;
	}
	return result;
}

function parseTestCase(raw: RawTestCase): ParsedTestCase {
	const failures = [...toArray(raw.failure), ...toArray(raw.error)];
	const firstFailure = failures[0];

	const result: ParsedTestCase = {
		name: attrString(raw["@_name"]) ?? "unknown",
		classname: attrString(raw["@_classname"]) ?? "",
		durationMs: secondsToMs(toNumber(raw["@_time"])),
		status:
			raw.skipped !== undefined
				? "skipped"
				: firstFailure !== undefined
					? "failed"
					: "passed",
	};
	const failureMessage =
		firstFailure === undefined
			? undefined
			: attrString(firstFailure["@_message"]);
	if (failureMessage !== undefined) {
		result.failureMessage = failureMessage;
	}
	const failureDetail =
		firstFailure === undefined ? undefined : attrString(firstFailure["#text"]);
	if (failureDetail !== undefined) {
		result.failureDetail = failureDetail;
	}
	const output = attrString(raw["system-out"]);
	if (output !== undefined) {
		result.output = output;
	}
	return result;
}

function secondsToMs(seconds: number): number {
	return Math.round(seconds * 1000);
}

function assertWellFormed(xml: string): void {
	try {
		SyntaxValidator.validate(xml);
	} catch (error) {
		throw new ParseError(`Malformed JUnit XML: ${(error as Error).message}`);
	}
}

function toArray<T>(value: T | T[] | undefined): T[] {
	if (value === undefined) {
		return [];
	}
	return Array.isArray(value) ? value : [value];
}

function sum(
	values: ParsedTestSuite[],
	pick: (value: ParsedTestSuite) => number,
): number {
	return values.reduce((total, value) => total + pick(value), 0);
}

function toNumber(value: unknown): number {
	if (typeof value === "number") {
		return value;
	}
	if (typeof value === "string" && value.trim() !== "") {
		return Number(value);
	}
	return 0;
}

function attrString(value: unknown): string | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}
	const str = String(value).trim();
	return str === "" ? undefined : str;
}
