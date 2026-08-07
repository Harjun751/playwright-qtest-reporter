import {
	loadConfig,
	loadReporterOptionsFromEnvironment,
} from "@src/config/loader.js";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("loadConfig", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("defaults maxAttachmentSize to 10MB", () => {
		vi.stubEnv("QTEST_API_TOKEN", "secret");
		vi.stubEnv("QTEST_PROJECT_ID", "42");
		const config = loadConfig();
		expect(config.maxAttachmentSize).toBe(10 * 1024 * 1024);
	});

	it("reads QTEST_MAX_ATTACHMENT_SIZE from the environment", () => {
		vi.stubEnv("QTEST_API_TOKEN", "secret");
		vi.stubEnv("QTEST_PROJECT_ID", "42");
		vi.stubEnv("QTEST_MAX_ATTACHMENT_SIZE", "2048");
		const config = loadConfig();
		expect(config.maxAttachmentSize).toBe(2048);
	});

	it("reads reporter options from the environment", () => {
		vi.stubEnv("QTEST_API_TOKEN", "secret");
		vi.stubEnv("QTEST_PROJECT_ID", "42");
		vi.stubEnv("QTEST_TEST_SUITE_ID", "5");
		vi.stubEnv("QTEST_WAIT", "true");
		const config = loadConfig();
		expect(config.testSuiteId).toBe(5);
		expect(config.wait).toBe(true);
	});
});

describe("loadReporterOptionsFromEnvironment", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("returns empty options when no reporter env vars are set", () => {
		vi.stubEnv("QTEST_TEST_SUITE_ID", "");
		vi.stubEnv("QTEST_PARENT_MODULE_ID", "");
		vi.stubEnv("QTEST_WAIT", "");
		vi.stubEnv("QTEST_SKIP_AUTOMATION_MODULE", "");
		expect(loadReporterOptionsFromEnvironment()).toEqual({});
	});

	it("maps env vars to reporter options", () => {
		vi.stubEnv("QTEST_TEST_SUITE_ID", "5");
		vi.stubEnv("QTEST_PARENT_MODULE_ID", "8");
		vi.stubEnv("QTEST_WAIT", "true");
		vi.stubEnv("QTEST_SKIP_AUTOMATION_MODULE", "1");
		expect(loadReporterOptionsFromEnvironment()).toEqual({
			testSuiteId: 5,
			parentModuleId: 8,
			wait: true,
			skipAutomationModule: true,
		});
	});

	it("maps prefixed ids from the environment", () => {
		vi.stubEnv("QTEST_TEST_SUITE_ID", "TS-5");
		vi.stubEnv("QTEST_PARENT_MODULE_ID", "md-8");
		expect(loadReporterOptionsFromEnvironment()).toEqual({
			testSuiteId: "TS-5",
			parentModuleId: "md-8",
		});
	});

	it("ignores empty and invalid env values", () => {
		vi.stubEnv("QTEST_TEST_SUITE_ID", "abc");
		vi.stubEnv("QTEST_PARENT_MODULE_ID", "-1");
		vi.stubEnv("QTEST_WAIT", "maybe");
		vi.stubEnv("QTEST_SKIP_AUTOMATION_MODULE", "");
		expect(loadReporterOptionsFromEnvironment()).toEqual({});
	});

	it("ignores ids with the wrong prefix", () => {
		vi.stubEnv("QTEST_TEST_SUITE_ID", "MD-5");
		vi.stubEnv("QTEST_PARENT_MODULE_ID", "TS-9");
		expect(loadReporterOptionsFromEnvironment()).toEqual({});
	});
});
