import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import stripAnsi from "strip-ansi";
import { loadConfig } from "../config/loader.js";
import { QTestClient } from "../core/qtest/client.js";
import {
	QTEST_ANNOTATION_TYPE,
	QTEST_STATUS_BY_RESULT,
} from "../core/qtest/constants.js";
import { submitTestLogs, waitForJob } from "../core/qtest/endpoints/runs.js";
import type { AutomationRequest, TestLog } from "../core/qtest/types.js";
import { toDateString } from "../utils/date.js";
import { ApiError } from "../utils/errors.js";
import { createLogger } from "../utils/logger.js";
import type { PlaywrightAttachment } from "./attachments.js";
import { toQTestAttachments } from "./attachments.js";

const logger = createLogger("reporter");

export interface QTestReporterOptions {
	wait?: boolean;
	testSuiteId?: number;
	parentModuleId?: number;
	skipAutomationModule?: boolean;
}

export default class QTestReporter implements Reporter {
	private readonly testLogs: TestLog[] = [];
	private readonly pendingAttachments = new Map<
		number,
		PlaywrightAttachment[]
	>();
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

		const browserName = this.buildBrowserName(test);
		const testLog: TestLog = {
			name: test.title,
			status: QTEST_STATUS_BY_RESULT[result.status] ?? "FAIL",
			exe_start_date: startTime.toISOString(),
			exe_end_date: endTime.toISOString(),
			automation_content: stripAnsi(this.buildAutomationContent(test)),
		};
		if (browserName !== undefined) {
			testLog.note = browserName;
		}

		if (result.status === "failed" || result.status === "timedOut") {
			testLog.test_step_logs = [
				{
					description: "Run test",
					expected_result: "Test passes",
					actual_result: this.buildFailureDetail(result, test.title),
					status: "FAIL",
					order: 1,
				},
			];
		}

		this.testLogs.push(testLog);
		if (result.attachments.length > 0) {
			this.pendingAttachments.set(this.testLogs.length - 1, result.attachments);
		}
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
		logger.debug(
			`submitting ${this.testLogs.length} test logs`,
			`pass=${passed}`,
			`fail=${failed}`,
			`skip=${skipped}`,
		);

		try {
			const config = loadConfig();
			await this.populateAttachments(config.maxAttachmentSize);
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

			if (this.options.skipAutomationModule) {
				request.skipCreatingAutomationModule = true;
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

	private async populateAttachments(maxSizeBytes: number): Promise<void> {
		for (const [index, attachments] of this.pendingAttachments) {
			const testLog = this.testLogs[index];
			if (testLog === undefined) {
				continue;
			}
			const converted = await toQTestAttachments(attachments, maxSizeBytes);
			if (converted.length > 0) {
				testLog.attachments = converted;
			}
		}
	}

	private buildAutomationContent(test: TestCase): string {
		const qtestAnnotation = test.annotations.find(
			(a) => a.type === QTEST_ANNOTATION_TYPE,
		);
		if (qtestAnnotation?.description !== undefined) {
			return qtestAnnotation.description;
		}
		return test.title;
	}

	private buildBrowserName(test: TestCase): string | undefined {
		const first = test.titlePath().find((p) => p !== "");
		if (first === undefined || first === test.title) {
			return undefined;
		}
		return first;
	}

	private buildFailureDetail(result: TestResult, fallback: string): string {
		const messages = result.errors
			.map((e) => e.message)
			.filter((m: string | undefined): m is string => m !== undefined);
		return stripAnsi(messages.length > 0 ? messages.join("\n") : fallback);
	}
}
