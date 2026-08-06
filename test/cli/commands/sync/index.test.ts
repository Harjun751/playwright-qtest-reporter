import { runCli } from "@src/cli/index.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../../../core/qtest/test-utils.js";

function mockListOutput(
	specs: Array<{
		file: string;
		title: string;
		annotations?: Array<{ type: string; description?: string }>;
		project?: string;
	}>,
): string {
	const suites: Record<string, Array<unknown>> = {};
	for (const spec of specs) {
		const proj = spec.project ?? "chromium";
		const key = spec.file;
		if (!suites[key]) {
			suites[key] = [];
		}
		suites[key].push({
			title: spec.title,
			file: spec.file,
			tests: [
				{
					annotations: spec.annotations ?? [],
					expectedStatus: "passed",
					projectId: proj,
					projectName: proj,
					results: [],
					status: "skipped",
					timeout: 30000,
				},
			],
		});
	}

	const suiteList = Object.entries(suites).map(([file, specs]) => ({
		title: file,
		file,
		specs,
	}));

	return JSON.stringify({
		suites: suiteList,
		errors: [],
		stats: {
			duration: 10,
			expected: 0,
			skipped: specs.length,
			unexpected: 0,
			flaky: 0,
		},
	});
}

function spawnResult(output: string) {
	return {
		status: 0,
		stdout: output,
		stderr: "",
		signal: null,
		pid: 1,
		output: [output, ""],
	};
}

vi.mock("node:child_process", () => ({
	spawnSync: vi.fn(),
}));

import { spawnSync } from "node:child_process";

describe("sync", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it("reports an error when configuration is invalid", async () => {
		vi.mocked(spawnSync).mockReturnValue(spawnResult(mockListOutput([])));
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const code = await runCli(["sync", "--parent-module", "1"]);
		expect(code).toBe(1);
		expect(error).toHaveBeenCalledWith(
			expect.stringContaining("Invalid configuration"),
		);
	});

	it("dry-run lists all tests without creating", async () => {
		vi.stubEnv("QTEST_BASE_URL", "https://qtest.example.com");
		vi.stubEnv("QTEST_API_TOKEN", "secret-token");
		vi.stubEnv("QTEST_PROJECT_ID", "42");
		vi.mocked(spawnSync).mockReturnValue(
			spawnResult(
				mockListOutput([
					{ file: "login.spec.ts", title: "has title" },
					{ file: "login.spec.ts", title: "login fails" },
					{ file: "login.spec.ts", title: "has title", project: "firefox" },
					{ file: "login.spec.ts", title: "login fails", project: "firefox" },
				]),
			),
		);
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockImplementation(() =>
				Promise.resolve(
					jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 100 }),
				),
			);
		vi.stubGlobal("fetch", fetchMock);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		const code = await runCli(["sync", "--parent-module", "1", "--dry-run"]);

		expect(code).toBe(0);
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining(
				"[dry-run] Test Design synchronized: 0 linked, 2 to create",
			),
		);
	});

	it("creates new test cases and links existing ones from qTest", async () => {
		vi.stubEnv("QTEST_BASE_URL", "https://qtest.example.com");
		vi.stubEnv("QTEST_API_TOKEN", "secret-token");
		vi.stubEnv("QTEST_PROJECT_ID", "42");
		vi.mocked(spawnSync).mockReturnValue(
			spawnResult(
				mockListOutput([
					{ file: "login.spec.ts", title: "has title" },
					{ file: "login.spec.ts", title: "login fails" },
				]),
			),
		);
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(
				jsonResponse(200, {
					items: [{ id: 10, pid: "TC-10", name: "has title" }],
					total: 1,
					page: 1,
					pageSize: 100,
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse(200, { id: 11, pid: "TC-11", name: "login fails" }),
			);
		vi.stubGlobal("fetch", fetchMock);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		const code = await runCli(["sync", "--parent-module", "1"]);

		expect(code).toBe(0);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(log).toHaveBeenCalledWith(
			"login.spec.ts: has title → TC-10 (existing)",
		);
		expect(log).toHaveBeenCalledWith(
			"login.spec.ts: login fails → TC-11 (new)",
		);
		expect(log).toHaveBeenCalledWith(
			"Test Design synchronized: 1 linked, 1 created.",
		);
	});

	it("links tests via qtest annotations without querying qTest", async () => {
		vi.stubEnv("QTEST_BASE_URL", "https://qtest.example.com");
		vi.stubEnv("QTEST_API_TOKEN", "secret-token");
		vi.stubEnv("QTEST_PROJECT_ID", "42");
		vi.mocked(spawnSync).mockReturnValue(
			spawnResult(
				mockListOutput([
					{
						file: "login.spec.ts",
						title: "has title",
						annotations: [{ type: "qtest", description: "TC-42" }],
					},
					{
						file: "login.spec.ts",
						title: "login fails",
						annotations: [{ type: "qtest", description: "TC-99" }],
					},
				]),
			),
		);
		const fetchMock = vi.fn<typeof fetch>();
		vi.stubGlobal("fetch", fetchMock);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		const code = await runCli(["sync", "--parent-module", "1"]);

		expect(code).toBe(0);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(log).toHaveBeenCalledWith(
			"login.spec.ts: has title → TC-42 (existing)",
		);
		expect(log).toHaveBeenCalledWith(
			"login.spec.ts: login fails → TC-99 (existing)",
		);
		expect(log).toHaveBeenCalledWith(
			"Test Design synchronized: 2 linked, 0 created.",
		);
	});

	it("deduplicates specs across browser projects", async () => {
		vi.stubEnv("QTEST_BASE_URL", "https://qtest.example.com");
		vi.stubEnv("QTEST_API_TOKEN", "secret-token");
		vi.stubEnv("QTEST_PROJECT_ID", "42");
		vi.mocked(spawnSync).mockReturnValue(
			spawnResult(
				mockListOutput([
					{ file: "login.spec.ts", title: "has title" },
					{ file: "login.spec.ts", title: "has title", project: "firefox" },
					{ file: "login.spec.ts", title: "has title", project: "webkit" },
				]),
			),
		);
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockImplementation(() =>
				Promise.resolve(
					jsonResponse(200, { items: [], total: 0, page: 1, pageSize: 100 }),
				),
			);
		vi.stubGlobal("fetch", fetchMock);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		const code = await runCli(["sync", "--parent-module", "1"]);

		expect(code).toBe(0);
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining("Test Design synchronized: 0 linked, 1 created."),
		);
	});
});
