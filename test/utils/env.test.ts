import { readEnvBool, readEnvId, readEnvNumber } from "@src/utils/env.js";
import { describe, expect, it } from "vitest";

function envOf(values: Record<string, string>): NodeJS.ProcessEnv {
	return values;
}

describe("readEnvNumber", () => {
	it("parses a positive integer", () => {
		expect(readEnvNumber(envOf({ PORT: "8080" }), "PORT")).toBe(8080);
	});

	it("returns undefined when the variable is unset", () => {
		expect(readEnvNumber(envOf({}), "PORT")).toBeUndefined();
	});

	it("returns undefined for an empty value", () => {
		expect(readEnvNumber(envOf({ PORT: "" }), "PORT")).toBeUndefined();
	});

	it("returns undefined for non-numeric input", () => {
		expect(readEnvNumber(envOf({ PORT: "abc" }), "PORT")).toBeUndefined();
	});

	it("returns undefined for zero and negatives", () => {
		expect(readEnvNumber(envOf({ PORT: "0" }), "PORT")).toBeUndefined();
		expect(readEnvNumber(envOf({ PORT: "-3" }), "PORT")).toBeUndefined();
	});

	it("returns undefined for non-integers", () => {
		expect(readEnvNumber(envOf({ PORT: "5.5" }), "PORT")).toBeUndefined();
	});
});

describe("readEnvId", () => {
	it("parses a plain positive integer", () => {
		expect(readEnvId(envOf({ ID: "5" }), "ID", "TS")).toBe(5);
	});

	it("returns a prefixed id as a string", () => {
		expect(readEnvId(envOf({ ID: "TS-5" }), "ID", "TS")).toBe("TS-5");
		expect(readEnvId(envOf({ ID: "MD-8" }), "ID", "MD")).toBe("MD-8");
	});

	it("accepts lowercase prefixes", () => {
		expect(readEnvId(envOf({ ID: "ts-5" }), "ID", "TS")).toBe("ts-5");
		expect(readEnvId(envOf({ ID: "Ts-5" }), "ID", "TS")).toBe("Ts-5");
	});

	it("returns undefined for a mismatched prefix", () => {
		expect(readEnvId(envOf({ ID: "MD-5" }), "ID", "TS")).toBeUndefined();
	});

	it("returns undefined for a prefix without digits", () => {
		expect(readEnvId(envOf({ ID: "TS-abc" }), "ID", "TS")).toBeUndefined();
	});

	it("returns undefined when no prefix matches and the value is not numeric", () => {
		expect(readEnvId(envOf({ ID: "abc" }), "ID", "TS")).toBeUndefined();
	});

	it("returns undefined for an empty or unset value", () => {
		expect(readEnvId(envOf({}), "ID", "TS")).toBeUndefined();
		expect(readEnvId(envOf({ ID: "" }), "ID", "TS")).toBeUndefined();
	});

	it("returns undefined for zero and negatives", () => {
		expect(readEnvId(envOf({ ID: "0" }), "ID", "TS")).toBeUndefined();
		expect(readEnvId(envOf({ ID: "-3" }), "ID", "TS")).toBeUndefined();
	});
});

describe("readEnvBool", () => {
	it("parses true variants", () => {
		expect(readEnvBool(envOf({ FLAG: "true" }), "FLAG")).toBe(true);
		expect(readEnvBool(envOf({ FLAG: "1" }), "FLAG")).toBe(true);
		expect(readEnvBool(envOf({ FLAG: "TRUE" }), "FLAG")).toBe(true);
	});

	it("parses false variants", () => {
		expect(readEnvBool(envOf({ FLAG: "false" }), "FLAG")).toBe(false);
		expect(readEnvBool(envOf({ FLAG: "0" }), "FLAG")).toBe(false);
	});

	it("returns undefined when the variable is unset or empty", () => {
		expect(readEnvBool(envOf({}), "FLAG")).toBeUndefined();
		expect(readEnvBool(envOf({ FLAG: "" }), "FLAG")).toBeUndefined();
	});

	it("returns undefined for unrecognized values", () => {
		expect(readEnvBool(envOf({ FLAG: "yes" }), "FLAG")).toBeUndefined();
	});
});
