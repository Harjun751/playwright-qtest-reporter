import { listModules } from "@src/core/qtest/endpoints/modules.js";
import { describe, expect, it, vi } from "vitest";
import { jsonResponse, makeClient } from "../test-utils.js";

describe("module endpoints", () => {
	it("lists all modules in a project", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(jsonResponse(200, [{ id: 1, name: "Root" }]));
		const client = makeClient(fetchMock);
		const result = await listModules(client, 7);
		expect(result).toEqual([{ id: 1, name: "Root" }]);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://qtest.example.com/api/v3/projects/7/modules",
			expect.objectContaining({ method: "GET" }),
		);
	});

	it("filters modules by parentId", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(
				jsonResponse(200, [{ id: 2, name: "Child", parent_id: 1 }]),
			);
		const client = makeClient(fetchMock);
		await listModules(client, 7, { parentId: 1 });
		expect(fetchMock).toHaveBeenCalledWith(
			"https://qtest.example.com/api/v3/projects/7/modules?parentId=1",
			expect.objectContaining({ method: "GET" }),
		);
	});
});
