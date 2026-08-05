import {
	createTestCase,
	deleteTestCase,
	getTestCase,
	listTestCases,
	updateTestCase,
} from "@src/core/qtest/endpoints/cases.js";
import { describe, expect, it, vi } from "vitest";
import { jsonResponse, makeClient } from "../test-utils.js";

describe("test case endpoints", () => {
	it("creates a test case", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(jsonResponse(200, { id: 10, name: "TC" }));
		const client = makeClient(fetchMock);
		const result = await createTestCase(client, 7, {
			name: "TC",
			parent_id: 3,
		});
		expect(result.id).toBe(10);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://qtest.example.com/api/v3/projects/7/test-cases",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ name: "TC", parent_id: 3 }),
			}),
		);
	});

	it("gets a single test case", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(jsonResponse(200, { id: 10, name: "TC" }));
		const client = makeClient(fetchMock);
		await getTestCase(client, 7, 10, { expand: "teststep" });
		expect(fetchMock).toHaveBeenCalledWith(
			"https://qtest.example.com/api/v3/projects/7/test-cases/10?expand=teststep",
			expect.objectContaining({ method: "GET" }),
		);
	});

	it("lists test cases with pagination query params", async () => {
		const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
			jsonResponse(200, {
				items: [{ id: 1 }],
				total: 1,
				page: 1,
				pageSize: 20,
			}),
		);
		const client = makeClient(fetchMock);
		const result = await listTestCases(client, 7, {
			parentId: 5,
			page: 2,
			size: 10,
		});
		expect(result.items).toHaveLength(1);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://qtest.example.com/api/v3/projects/7/test-cases?parentId=5&page=2&size=10",
			expect.objectContaining({ method: "GET" }),
		);
	});

	it("updates a test case", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(jsonResponse(200, { id: 10, name: "Renamed" }));
		const client = makeClient(fetchMock);
		await updateTestCase(client, 7, 10, { name: "Renamed" });
		expect(fetchMock).toHaveBeenCalledWith(
			"https://qtest.example.com/api/v3/projects/7/test-cases/10",
			expect.objectContaining({
				method: "PUT",
				body: JSON.stringify({ name: "Renamed" }),
			}),
		);
	});

	it("deletes a test case", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response(null, { status: 204 }));
		const client = makeClient(fetchMock);
		await deleteTestCase(client, 7, 10);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://qtest.example.com/api/v3/projects/7/test-cases/10",
			expect.objectContaining({ method: "DELETE" }),
		);
	});
});
