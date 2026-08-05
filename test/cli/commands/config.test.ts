import { runCli } from "@src/cli/index.js";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("config validate", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
	});

	it("prints the loaded configuration when the environment is valid", async () => {
		vi.stubEnv("QTEST_BASE_URL", "https://qtest.example.com");
		vi.stubEnv("QTEST_API_TOKEN", "secret-token");
		vi.stubEnv("QTEST_PROJECT_ID", "42");
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const code = await runCli(["config", "validate"]);
		expect(code).toBe(0);
		expect(log).toHaveBeenCalledWith(
			"Configuration is valid: baseUrl=https://qtest.example.com projectId=42 logLevel=info",
		);
	});

	it("prints the optional run id when set", async () => {
		vi.stubEnv("QTEST_BASE_URL", "https://qtest.example.com");
		vi.stubEnv("QTEST_API_TOKEN", "secret-token");
		vi.stubEnv("QTEST_PROJECT_ID", "42");
		vi.stubEnv("QTEST_RUN_ID", "7");
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const code = await runCli(["config", "validate"]);
		expect(code).toBe(0);
		expect(log).toHaveBeenCalledWith(
			"Configuration is valid: baseUrl=https://qtest.example.com projectId=42 logLevel=info runId=7",
		);
	});

	it("reports an error and exits 1 when configuration is invalid", async () => {
		vi.stubEnv("QTEST_API_TOKEN", "");
		vi.stubEnv("QTEST_PROJECT_ID", "");
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const code = await runCli(["config", "validate"]);
		expect(code).toBe(1);
		expect(error).toHaveBeenCalledWith(
			expect.stringContaining("Invalid configuration"),
		);
	});
});
