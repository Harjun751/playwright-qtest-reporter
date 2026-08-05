import {
	getJobStatus,
	submitTestLogs,
	waitForJob,
} from "@src/core/qtest/endpoints/runs.js";
import type { AutomationRequest } from "@src/core/qtest/types.js";
import { QTestError } from "@src/utils/errors.js";
import { describe, expect, it, vi } from "vitest";
import { jsonResponse, makeClient } from "../test-utils.js";

const automationBody: AutomationRequest = {
	execution_date: "2026-08-05",
	test_logs: [
		{
			name: "login works",
			status: "PASS",
			exe_start_date: "2026-08-05T10:00:00Z",
			exe_end_date: "2026-08-05T10:00:05Z",
			automation_content: "login works",
		},
	],
};

describe("test run / auto-test-log endpoints", () => {
	it("submits test logs to the v3.1 endpoint with type=automation", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(jsonResponse(201, { id: 99, state: "IN_WAITING" }));
		const client = makeClient(fetchMock);
		const result = await submitTestLogs(client, 7, automationBody);
		expect(result).toEqual({ id: 99, state: "IN_WAITING" });
		expect(fetchMock).toHaveBeenCalledWith(
			"https://qtest.example.com/api/v3.1/projects/7/test-runs/0/auto-test-logs?type=automation",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify(automationBody),
			}),
		);
	});

	it("gets job status", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(jsonResponse(200, { id: 99, state: "SUCCESS" }));
		const client = makeClient(fetchMock);
		const result = await getJobStatus(client, 99);
		expect(result.state).toBe("SUCCESS");
		expect(fetchMock).toHaveBeenCalledWith(
			"https://qtest.example.com/api/v3/projects/queue-processing/99",
			expect.objectContaining({ method: "GET" }),
		);
	});

	it("polls until the job reaches SUCCESS", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				jsonResponse(200, { id: 1, state: "IN_PROCESSING" }),
			)
			.mockResolvedValueOnce(jsonResponse(200, { id: 1, state: "PENDING" }))
			.mockResolvedValueOnce(jsonResponse(200, { id: 1, state: "SUCCESS" }));
		const client = makeClient(fetchMock);
		const result = await waitForJob(client, 1, {
			intervalMs: 1,
			timeoutMs: 1000,
		});
		expect(result.state).toBe("SUCCESS");
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("throws QTestError when the job fails", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(jsonResponse(200, { id: 1, state: "FAILED" }));
		const client = makeClient(fetchMock);
		const error = (await waitForJob(client, 1, {
			intervalMs: 1,
			timeoutMs: 100,
		}).catch((e: unknown) => e)) as QTestError;
		expect(error).toBeInstanceOf(QTestError);
		expect(error.code).toBe("JOB_FAILED");
	});

	it("throws QTestError when polling times out", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockImplementation(() =>
				Promise.resolve(jsonResponse(200, { id: 1, state: "IN_PROCESSING" })),
			);
		const client = makeClient(fetchMock);
		const error = (await waitForJob(client, 1, {
			intervalMs: 5,
			timeoutMs: 12,
		}).catch((e: unknown) => e)) as QTestError;
		expect(error).toBeInstanceOf(QTestError);
		expect(error.code).toBe("JOB_TIMEOUT");
	});
});
