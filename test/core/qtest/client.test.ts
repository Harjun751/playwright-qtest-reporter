import { ApiError, AuthError, QTestError } from "@src/utils/errors.js";
import { describe, expect, it, vi } from "vitest";
import { jsonResponse, makeClient } from "./test-utils.js";

describe("QTestClient", () => {
	it("builds the default v3 URL with the /api prefix", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(jsonResponse(200, {}));
		const client = makeClient(fetchMock);
		await client.get("projects/1/test-cases");
		expect(fetchMock).toHaveBeenCalledWith(
			"https://qtest.example.com/api/v3/projects/1/test-cases",
			expect.objectContaining({ method: "GET" }),
		);
	});

	it("uses the requested API version", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(jsonResponse(200, {}));
		const client = makeClient(fetchMock);
		await client.post("projects/1/test-runs/0/auto-test-logs", {
			version: "v3.1",
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://qtest.example.com/api/v3.1/projects/1/test-runs/0/auto-test-logs",
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("appends query parameters", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(jsonResponse(200, {}));
		const client = makeClient(fetchMock);
		await client.get("projects/1/test-cases", {
			query: { parentId: 5, page: 2 },
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://qtest.example.com/api/v3/projects/1/test-cases?parentId=5&page=2",
			expect.objectContaining({ method: "GET" }),
		);
	});

	it("sends the bearer token on every request", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(jsonResponse(200, {}));
		const client = makeClient(fetchMock);
		await client.get("projects/1");
		expect(fetchMock).toHaveBeenCalledWith(
			"https://qtest.example.com/api/v3/projects/1",
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: "bearer secret" }),
			}),
		);
	});

	it("serializes JSON bodies", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(jsonResponse(200, {}));
		const client = makeClient(fetchMock);
		await client.post("projects/1/test-cases", { body: { name: "TC" } });
		expect(fetchMock).toHaveBeenCalledWith(
			"https://qtest.example.com/api/v3/projects/1/test-cases",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ name: "TC" }),
				headers: expect.objectContaining({
					"Content-Type": "application/json",
				}),
			}),
		);
	});

	it("returns parsed JSON from successful responses", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(jsonResponse(200, { id: 42 }));
		const client = makeClient(fetchMock);
		const result = await client.get<{ id: number }>("projects/1/test-cases/42");
		expect(result).toEqual({ id: 42 });
	});

	it("throws AuthError on 401", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(jsonResponse(401, {}));
		const client = makeClient(fetchMock);
		await expect(client.get("projects/1")).rejects.toBeInstanceOf(AuthError);
	});

	it("throws ApiError with status and body on non-retryable errors", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(jsonResponse(400, { message: "bad" }));
		const client = makeClient(fetchMock);
		const error = (await client
			.get("projects/1")
			.catch((e: unknown) => e)) as ApiError;
		expect(error).toBeInstanceOf(ApiError);
		expect(error.statusCode).toBe(400);
		expect(error.responseBody).toEqual({ message: "bad" });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("retries retryable statuses then succeeds", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(jsonResponse(500, {}))
			.mockResolvedValueOnce(jsonResponse(503, {}))
			.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
		const client = makeClient(fetchMock, { maxRetries: 3 });
		const result = await client.get<{ ok: boolean }>("projects/1");
		expect(result).toEqual({ ok: true });
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("gives up after maxRetries on persistent failures", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(jsonResponse(500, {}))
			.mockResolvedValueOnce(jsonResponse(500, {}));
		const client = makeClient(fetchMock, { maxRetries: 2 });
		await expect(client.get("projects/1")).rejects.toBeInstanceOf(ApiError);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("retries transient network errors", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockRejectedValueOnce(new TypeError("fetch failed"))
			.mockResolvedValueOnce(jsonResponse(200, {}));
		const client = makeClient(fetchMock, { maxRetries: 2 });
		const result = await client.get("projects/1");
		expect(result).toBeDefined();
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("wraps persistent network errors in QTestError", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockRejectedValue(new TypeError("fetch failed"));
		const client = makeClient(fetchMock, { maxRetries: 2 });
		const error = (await client
			.get("projects/1")
			.catch((e: unknown) => e)) as QTestError;
		expect(error).toBeInstanceOf(QTestError);
		expect(error.code).toBe("NETWORK_ERROR");
	});

	it("returns undefined for empty response bodies", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response(null, { status: 204 }));
		const client = makeClient(fetchMock);
		const result = await client.delete<void>("projects/1/test-cases/42");
		expect(result).toBeUndefined();
	});
});
