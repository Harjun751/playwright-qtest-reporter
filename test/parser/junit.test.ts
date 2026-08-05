import { parseJUnit } from "@src/parser/junit.js";
import { ParseError } from "@src/utils/errors.js";
import { describe, expect, it } from "vitest";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites id="" name="" tests="4" failures="1" skipped="1" time="3.5">
  <testsuite name="login.spec.ts" timestamp="2026-08-05T10:00:00.000Z" hostname="" tests="2" failures="1" skipped="0" time="1.5" errors="0">
    <testcase name="logs in" classname="login.spec.ts" time="0.5">
      <system-out>stdout for logs in</system-out>
    </testcase>
    <testcase name="rejects bad password" classname="login.spec.ts" time="1.0">
      <failure message="expect(received).toBe(expected)" type="FAIL">Error: expect(received).toBe(expected)

    - Expected  + 1
    + Received  + 1</failure>
    </testcase>
  </testsuite>
  <testsuite name="checkout.spec.ts" timestamp="2026-08-05T10:00:02.000Z" hostname="" tests="2" failures="0" skipped="1" time="2.0" errors="0">
    <testcase name="skipped test" classname="checkout.spec.ts" time="0.0">
      <skipped/>
    </testcase>
    <testcase name="pays by card" classname="checkout.spec.ts" time="2.0">
      <system-out>charged ok</system-out>
    </testcase>
  </testsuite>
</testsuites>`;

describe("parseJUnit", () => {
	it("parses suites and their test cases", () => {
		const report = parseJUnit(SAMPLE);
		expect(report.suites.map((suite) => suite.name)).toEqual([
			"login.spec.ts",
			"checkout.spec.ts",
		]);
		expect(report.suites[0]?.testCases.map((tc) => tc.name)).toEqual([
			"logs in",
			"rejects bad password",
		]);
		expect(report.suites[0]?.testCases[0]?.classname).toBe("login.spec.ts");
	});

	it("maps test statuses from failure and skipped elements", () => {
		const report = parseJUnit(SAMPLE);
		const statuses = report.suites.flatMap((suite) =>
			suite.testCases.map((tc) => tc.status),
		);
		expect(statuses).toEqual(["passed", "failed", "skipped", "passed"]);
	});

	it("converts durations from seconds to milliseconds", () => {
		const report = parseJUnit(SAMPLE);
		expect(report.suites[0]?.testCases[0]?.durationMs).toBe(500);
		expect(report.suites[0]?.testCases[1]?.durationMs).toBe(1000);
		expect(report.suites[1]?.durationMs).toBe(2000);
	});

	it("extracts failure message and detail", () => {
		const report = parseJUnit(SAMPLE);
		const failed = report.suites[0]?.testCases[1];
		expect(failed?.failureMessage).toBe("expect(received).toBe(expected)");
		expect(failed?.failureDetail).toContain(
			"Error: expect(received).toBe(expected)",
		);
	});

	it("extracts system-out as output", () => {
		const report = parseJUnit(SAMPLE);
		expect(report.suites[0]?.testCases[0]?.output).toBe("stdout for logs in");
	});

	it("aggregates totals from the suites", () => {
		const report = parseJUnit(SAMPLE);
		expect(report.tests).toBe(4);
		expect(report.failures).toBe(1);
		expect(report.skipped).toBe(1);
		expect(report.durationMs).toBe(3500);
	});

	it("handles a single test case that is not wrapped in an array", () => {
		const xml = `<testsuites>
  <testsuite name="single.spec.ts" time="0.1">
    <testcase name="only test" classname="single.spec.ts" time="0.1"/>
  </testsuite>
</testsuites>`;
		const report = parseJUnit(xml);
		expect(report.tests).toBe(1);
		expect(report.suites[0]?.testCases[0]?.name).toBe("only test");
	});

	it("handles a testsuite as the root element", () => {
		const xml = `<testsuite name="root.spec.ts" tests="1" time="0.1">
  <testcase name="rooted" classname="root.spec.ts" time="0.1"/>
</testsuite>`;
		const report = parseJUnit(xml);
		expect(report.suites).toHaveLength(1);
		expect(report.suites[0]?.name).toBe("root.spec.ts");
		expect(report.tests).toBe(1);
	});

	it("throws ParseError on malformed XML", () => {
		expect(() => parseJUnit("<testsuites><testsuite></testsuites>")).toThrow(
			ParseError,
		);
	});

	it("throws ParseError when no testsuite is present", () => {
		expect(() => parseJUnit("<testsuites></testsuites>")).toThrow(ParseError);
	});
});
