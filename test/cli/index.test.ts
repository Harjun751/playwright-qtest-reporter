import { runCli } from "@src/cli/index.js";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("CLI entrypoint", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("prints the program version", async () => {
		const write = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);
		const code = await runCli(["--version"]);
		expect(code).toBe(0);
		expect(write).toHaveBeenCalledWith("1.0.0\n");
	});

	it("prints help without exiting successfully", async () => {
		const write = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);
		const code = await runCli(["--help"]);
		expect(code).toBe(0);
		expect(write).toHaveBeenCalled();
	});

	it("returns a non-zero exit code for unknown commands", async () => {
		const writeErr = vi
			.spyOn(process.stderr, "write")
			.mockImplementation(() => true);
		const code = await runCli(["bogus"]);
		expect(code).not.toBe(0);
		expect(writeErr).toHaveBeenCalled();
	});
});
