import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { toQTestAttachments } from "@src/reporter/attachments.js";
import log from "loglevel";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("toQTestAttachments", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("converts in-memory body attachments to base64", async () => {
		const converted = await toQTestAttachments(
			[
				{
					name: "screenshot",
					body: Buffer.from("png"),
					contentType: "image/png",
				},
			],
			1024,
		);
		expect(converted).toEqual([
			{
				name: "screenshot",
				content_type: "image/png",
				data: Buffer.from("png").toString("base64"),
			},
		]);
	});

	it("reads path attachments from disk using the basename", async () => {
		const dir = await mkdtemp(join(tmpdir(), "qtest-attachments-"));
		const file = join(dir, "trace.zip");
		await writeFile(file, Buffer.from("zip"));
		try {
			const converted = await toQTestAttachments(
				[{ name: "trace", path: file, contentType: "application/zip" }],
				1024,
			);
			expect(converted).toEqual([
				{
					name: "trace.zip",
					content_type: "application/zip",
					data: Buffer.from("zip").toString("base64"),
				},
			]);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("dedupes repeated attachment names", async () => {
		const converted = await toQTestAttachments(
			[
				{
					name: "screenshot",
					body: Buffer.from("a"),
					contentType: "image/png",
				},
				{
					name: "screenshot",
					body: Buffer.from("b"),
					contentType: "image/png",
				},
			],
			1024,
		);
		expect(converted.map((a) => a.name)).toEqual([
			"screenshot",
			"screenshot-2",
		]);
	});

	it("skips attachments larger than the max size", async () => {
		const warn = vi
			.spyOn(log.getLogger("reporter"), "warn")
			.mockImplementation(() => {});
		const converted = await toQTestAttachments(
			[{ name: "video", body: Buffer.alloc(64), contentType: "video/webm" }],
			32,
		);
		expect(converted).toEqual([]);
		expect(warn).toHaveBeenCalledWith(
			"[reporter]",
			expect.stringContaining("skipping attachment"),
		);
	});

	it("skips attachments with an unreadable path", async () => {
		const warn = vi
			.spyOn(log.getLogger("reporter"), "warn")
			.mockImplementation(() => {});
		const converted = await toQTestAttachments(
			[
				{
					name: "screenshot",
					path: "/nonexistent/shot.png",
					contentType: "image/png",
				},
			],
			1024,
		);
		expect(converted).toEqual([]);
		expect(warn).toHaveBeenCalledWith(
			"[reporter]",
			expect.stringContaining("skipping attachment"),
		);
	});

	it("skips attachments with neither body nor path", async () => {
		const converted = await toQTestAttachments(
			[{ name: "orphan", contentType: "application/octet-stream" }],
			1024,
		);
		expect(converted).toEqual([]);
	});
});
