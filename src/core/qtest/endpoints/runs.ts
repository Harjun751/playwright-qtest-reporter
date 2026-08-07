import { QTestError } from "../../../utils/errors.js";
import { createLogger } from "../../../utils/logger.js";
import type { QTestClient } from "../client.js";
import type { AutomationRequest, QueueProcessingResponse } from "../types.js";

const logger = createLogger("qtest/runs");

export async function submitTestLogs(
	client: QTestClient,
	projectId: number,
	body: AutomationRequest,
): Promise<QueueProcessingResponse> {
	logger.debug(
		"submitting test logs",
		`project=${projectId}`,
		`testCount=${body.test_logs.length}`,
		`body=${JSON.stringify(body)}`,
	);
	return client.post<QueueProcessingResponse>(
		`projects/${projectId}/test-runs/0/auto-test-logs`,
		{ body, query: { type: "automation" }, version: "v3.1" },
	);
}

export async function getJobStatus(
	client: QTestClient,
	jobId: number,
): Promise<QueueProcessingResponse> {
	return client.get<QueueProcessingResponse>(
		`projects/queue-processing/${jobId}`,
	);
}

export interface WaitForJobOptions {
	intervalMs?: number;
	timeoutMs?: number;
}

export async function waitForJob(
	client: QTestClient,
	jobId: number,
	options: WaitForJobOptions = {},
): Promise<QueueProcessingResponse> {
	const intervalMs = options.intervalMs ?? 2000;
	const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
	const deadline = Date.now() + timeoutMs;

	for (;;) {
		const status = await getJobStatus(client, jobId);
		logger.debug(`job #${jobId} state: ${status.state}`);
		if (status.state === "SUCCESS") {
			return status;
		}
		if (status.state === "FAILED") {
			throw new QTestError(
				"JOB_FAILED",
				`qTest submission job ${jobId} failed`,
			);
		}
		if (Date.now() + intervalMs > deadline) {
			throw new QTestError(
				"JOB_TIMEOUT",
				`qTest submission job ${jobId} did not complete within ${timeoutMs}ms`,
			);
		}
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}
}
