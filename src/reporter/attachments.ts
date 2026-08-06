import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { TestResult } from "@playwright/test/reporter";
import type { Attachment } from "../core/qtest/types.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("reporter");

export type PlaywrightAttachment = TestResult["attachments"][number];

export async function toQTestAttachments(
	attachments: readonly PlaywrightAttachment[],
	maxSizeBytes: number,
): Promise<Attachment[]> {
	const result: Attachment[] = [];
	const usedNames = new Set<string>();
	for (const attachment of attachments) {
		const content = await readAttachmentContent(attachment);
		if (content === undefined) {
			continue;
		}
		if (content.byteLength > maxSizeBytes) {
			logger.warn(
				`skipping attachment "${attachment.name}": ${content.byteLength} bytes exceeds the ${maxSizeBytes} byte limit`,
			);
			continue;
		}
		result.push({
			name: uniqueName(attachmentName(attachment), usedNames),
			content_type: attachment.contentType,
			data: content.toString("base64"),
		});
	}
	return result;
}

async function readAttachmentContent(
	attachment: PlaywrightAttachment,
): Promise<Buffer | undefined> {
	if (attachment.body !== undefined) {
		return attachment.body;
	}
	if (attachment.path === undefined) {
		return undefined;
	}
	try {
		return await readFile(attachment.path);
	} catch (error) {
		logger.warn(
			`skipping attachment "${attachment.name}": ${errorMessage(error)}`,
		);
		return undefined;
	}
}

function attachmentName(attachment: PlaywrightAttachment): string {
	if (attachment.path !== undefined) {
		const base = basename(attachment.path);
		if (base !== "") {
			return base;
		}
	}
	return attachment.name;
}

function uniqueName(name: string, used: Set<string>): string {
	if (!used.has(name)) {
		used.add(name);
		return name;
	}
	let counter = 2;
	let candidate = `${name}-${counter}`;
	while (used.has(candidate)) {
		counter++;
		candidate = `${name}-${counter}`;
	}
	used.add(candidate);
	return candidate;
}

function errorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}
