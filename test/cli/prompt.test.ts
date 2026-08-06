import { promptForModule } from "@src/cli/prompt.js";
import type { QTestClient } from "@src/core/qtest/client.js";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@inquirer/prompts", () => ({ select: vi.fn() }));
vi.mock("../../src/core/qtest/endpoints/modules.js", () => ({
	listModules: vi.fn(),
}));

import { select } from "@inquirer/prompts";
import { listModules } from "@src/core/qtest/endpoints/modules.js";

const mockClient = {} as QTestClient;

describe("promptForModule", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("fetches modules and returns the selected module id", async () => {
		vi.mocked(listModules).mockResolvedValue([
			{ id: 1, name: "Login", pid: "MD-1" },
			{ id: 2, name: "Billing" },
		]);
		vi.mocked(select).mockResolvedValue(2);

		const result = await promptForModule(mockClient, 42);

		expect(result).toBe(2);
		expect(listModules).toHaveBeenCalledWith(mockClient, 42);
		expect(select).toHaveBeenCalledWith({
			message: "Select a qTest module to sync into:",
			choices: [
				{ name: "Login (MD-1)", value: 1 },
				{ name: "Billing", value: 2 },
			],
		});
	});

	it("throws when the project has no modules", async () => {
		vi.mocked(listModules).mockResolvedValue([]);

		await expect(promptForModule(mockClient, 42)).rejects.toThrow(
			"No modules found in the project",
		);
		expect(select).not.toHaveBeenCalled();
	});
});
