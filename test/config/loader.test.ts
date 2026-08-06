import { loadConfig } from "@src/config/loader.js";
import { describe, expect, it } from "vitest";

const VALID_ENV = {
	QTEST_API_TOKEN: "secret",
	QTEST_PROJECT_ID: "42",
};

describe("loadConfig", () => {
	it("defaults maxAttachmentSize to 10MB", () => {
		const config = loadConfig({ env: VALID_ENV });
		expect(config.maxAttachmentSize).toBe(10 * 1024 * 1024);
	});

	it("reads QTEST_MAX_ATTACHMENT_SIZE from the environment", () => {
		const config = loadConfig({
			env: { ...VALID_ENV, QTEST_MAX_ATTACHMENT_SIZE: "2048" },
		});
		expect(config.maxAttachmentSize).toBe(2048);
	});
});
