import type { QTestClient } from "../client.js";

export type AttachmentResourceType = "test-logs" | "test-cases" | "test-runs";

export interface AttachmentFile {
	name: string;
	content: Blob;
	contentType: string;
}

export async function uploadAttachment(
	client: QTestClient,
	projectId: number,
	resourceType: AttachmentResourceType,
	resourceId: number,
	file: AttachmentFile,
): Promise<unknown> {
	const form = new FormData();
	form.append("file", file.content, file.name);
	return client.request(
		`projects/${projectId}/${resourceType}/${resourceId}/attachments`,
		{
			method: "POST",
			bodyType: "form",
			body: form,
		},
	);
}
