import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function makeListJson(
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
		const entry = {
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
		};
		const existing = suites[spec.file];
		if (existing !== undefined) {
			existing.push(entry);
		} else {
			suites[spec.file] = [entry];
		}
	}

	return JSON.stringify({
		suites: Object.entries(suites).map(([file, s]) => ({
			title: file,
			file,
			specs: s,
		})),
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

function makeSpawnResult(output: string, status = 0, stderr = "") {
	return {
		status,
		stdout: output,
		stderr,
		signal: null,
		pid: 1,
		output: [output, stderr],
	};
}

vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));
vi.mock("node:module", () => ({ createRequire: vi.fn() }));

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { listPlaywrightTests } from "@src/cli/commands/sync/discovery.js";

describe("listPlaywrightTests", () => {
	beforeEach(() => {
		vi.mocked(createRequire).mockReturnValue({
			resolve: vi.fn().mockReturnValue("/fake/playwright/cli.js"),
		} as never);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("parses a single spec from valid JSON", () => {
		vi.mocked(spawnSync).mockReturnValue(
			makeSpawnResult(
				makeListJson([{ file: "login.spec.ts", title: "has title" }]),
			),
		);

		const result = listPlaywrightTests();

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			file: "login.spec.ts",
			title: "has title",
		});
		expect(result[0]?.annotations).toEqual([]);
	});

	it("extracts annotations from the first test of a spec", () => {
		vi.mocked(spawnSync).mockReturnValue(
			makeSpawnResult(
				makeListJson([
					{
						file: "login.spec.ts",
						title: "has title",
						annotations: [{ type: "qtest", description: "TC-42" }],
					},
				]),
			),
		);

		const result = listPlaywrightTests();

		expect(result).toHaveLength(1);
		expect(result[0]?.annotations).toEqual([
			{ type: "qtest", description: "TC-42" },
		]);
	});

	it("deduplicates specs with the same file:title across browser projects", () => {
		vi.mocked(spawnSync).mockReturnValue(
			makeSpawnResult(
				makeListJson([
					{ file: "login.spec.ts", title: "has title" },
					{ file: "login.spec.ts", title: "has title", project: "firefox" },
					{ file: "login.spec.ts", title: "has title", project: "webkit" },
				]),
			),
		);

		const result = listPlaywrightTests();

		expect(result).toHaveLength(1);
	});

	it("keeps distinct specs from the same file", () => {
		vi.mocked(spawnSync).mockReturnValue(
			makeSpawnResult(
				makeListJson([
					{ file: "login.spec.ts", title: "has title" },
					{ file: "login.spec.ts", title: "login fails" },
				]),
			),
		);

		const result = listPlaywrightTests();

		expect(result).toHaveLength(2);
	});

	it("returns an empty array when no specs exist", () => {
		vi.mocked(spawnSync).mockReturnValue(
			makeSpawnResult(JSON.stringify({ suites: [], errors: [], stats: {} })),
		);

		const result = listPlaywrightTests();

		expect(result).toEqual([]);
	});

	it("handles preamble before JSON output", () => {
		const json = makeListJson([{ file: "login.spec.ts", title: "has title" }]);
		vi.mocked(spawnSync).mockReturnValue(
			makeSpawnResult(`Loading dotenv...\nSome other output\n${json}`),
		);

		const result = listPlaywrightTests();

		expect(result).toHaveLength(1);
		expect(result[0]?.title).toBe("has title");
	});

	it("throws when spawnSync returns non-zero status", () => {
		vi.mocked(spawnSync).mockReturnValue(
			makeSpawnResult("", 1, "Playwright not found"),
		);

		expect(() => listPlaywrightTests()).toThrow(
			"playwright --list failed: Playwright not found",
		);
	});

	it("throws when output is not valid JSON", () => {
		vi.mocked(spawnSync).mockReturnValue(
			makeSpawnResult("not valid json at all"),
		);

		expect(() => listPlaywrightTests()).toThrow(
			"Failed to parse playwright --list output as JSON. Ensure @playwright/test is installed.",
		);
	});

	it("throws when JSON is valid but schema shape is wrong", () => {
		vi.mocked(spawnSync).mockReturnValue(
			makeSpawnResult(JSON.stringify({ suites: "not-an-array" })),
		);

		expect(() => listPlaywrightTests()).toThrow(
			"Unexpected playwright --list output format:",
		);
	});

	it("tolerates a spec with no tests array", () => {
		const raw = JSON.stringify({
			suites: [
				{
					title: "login.spec.ts",
					file: "login.spec.ts",
					specs: [
						{
							title: "has title",
							file: "login.spec.ts",
						},
					],
				},
			],
			errors: [],
			stats: {},
		});
		vi.mocked(spawnSync).mockReturnValue(makeSpawnResult(raw));

		const result = listPlaywrightTests();

		expect(result).toHaveLength(1);
		expect(result[0]?.annotations).toEqual([]);
	});
});
