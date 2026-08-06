export const QTEST_ANNOTATION_TYPE = "qtest";

export const QTEST_STATUS_BY_RESULT: Record<string, string> = {
	passed: "PASS",
	failed: "FAIL",
	timedOut: "FAIL",
	skipped: "SKIP",
	interrupted: "FAIL",
};
