import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import stripAnsi from "strip-ansi";
import { loadConfig } from "../config/loader.js";
import { QTestClient } from "../core/qtest/client.js";
import { submitTestLogs, waitForJob } from "../core/qtest/endpoints/runs.js";
import type { AutomationRequest, TestLog } from "../core/qtest/types.js";
import { ApiError } from "../utils/errors.js";

export interface QTestReporterOptions {
	wait?: boolean;
	testSuiteId?: number;
	parentModuleId?: number;
}

const QTEST_STATUS_MAP: Record<string, string> = {
	passed: "PASS",
	failed: "FAIL",
	timedOut: "FAIL",
	skipped: "SKIP",
	interrupted: "FAIL",
};

export default class QTestReporter implements Reporter {
	private readonly testLogs: TestLog[] = [];
	private readonly options: QTestReporterOptions;

	constructor(options: QTestReporterOptions = {}) {
		this.options = options;
	}

	printsToStdio(): boolean {
		return false;
	}

	onTestEnd(test: TestCase, result: TestResult): void {
		const startTime = result.startTime;
		const endTime = new Date(startTime.getTime() + result.duration);

		const testLog: TestLog = {
			name: test
				.titlePath()
				.filter((p) => p !== "")
				.join(" › "),
			status: QTEST_STATUS_MAP[result.status] ?? "FAIL",
			exe_start_date: startTime.toISOString(),
			exe_end_date: endTime.toISOString(),
			automation_content: stripAnsi(this.buildAutomationContent(test, result)),
		};

		const qtestAnnotation = test.annotations.find((a) => a.type === "qtest");
		if (qtestAnnotation?.description !== undefined) {
			testLog.test_case = qtestAnnotation.description;
		}

		if (result.status === "failed" || result.status === "timedOut") {
			const firstError = result.errors[0];
			if (firstError?.message !== undefined) {
				testLog.note = stripAnsi(firstError.message);
			}
		}

		this.testLogs.push(testLog);
	}

	async onEnd(): Promise<void> {
		if (this.testLogs.length === 0) {
			return;
		}

		const passed = this.testLogs.filter((l) => l.status === "PASS").length;
		const failed = this.testLogs.filter((l) => l.status === "FAIL").length;
		const skipped = this.testLogs.filter((l) => l.status === "SKIP").length;
		console.log(
			`qTest reporter: submitting ${this.testLogs.length} tests (${passed} passed, ${failed} failed, ${skipped} skipped)`,
		);

		try {
			const config = loadConfig();
			const request: AutomationRequest = {
				execution_date: toDateString(new Date()),
				test_logs: this.testLogs,
			};
			if (this.options.testSuiteId !== undefined) {
				request.test_suite = this.options.testSuiteId;
			}
			if (this.options.parentModuleId !== undefined) {
				request.parent_module = this.options.parentModuleId;
			}

			const client = new QTestClient({
				baseUrl: config.baseUrl,
				apiToken: config.apiToken,
			});

			const { id, state } = await submitTestLogs(
				client,
				config.projectId,
				request,
			);
			console.log(`qTest job #${id}: ${state}`);

			if (this.options.wait) {
				const final = await waitForJob(client, id);
				console.log(`qTest job #${id} completed: ${final.state}`);
			}
		} catch (error) {
			if (error instanceof ApiError) {
				console.log(
					`qTest reporter: ${error.message} — ${JSON.stringify(error.responseBody)}`,
				);
			} else {
				console.log(
					`qTest reporter: ${(error as Error).message ?? "unknown error"}`,
				);
			}
		}
	}

	private buildAutomationContent(test: TestCase, result: TestResult): string {
		if (result.status === "failed" || result.status === "timedOut") {
			const messages = result.errors
				.map((e) => e.message)
				.filter((m: string | undefined): m is string => m !== undefined);
			return messages.length > 0 ? messages.join("\n") : test.title;
		}
		return test.title;
	}
}

function toDateString(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}
