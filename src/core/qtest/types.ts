export type QueueJobState =
	| "IN_WAITING"
	| "IN_PROCESSING"
	| "FAILED"
	| "PENDING"
	| "SUCCESS";

export interface PropertyResource {
	field_id: number;
	field_value: string | number | boolean;
}

export interface Attachment {
	name: string;
	content_type: string;
	data?: string;
	web_url?: string;
}

export interface TestStepLog {
	description: string;
	expected_result: string;
	actual_result: string;
	status: string;
	order?: number;
}

export interface TestLog {
	name: string;
	status: string;
	exe_start_date: string;
	exe_end_date: string;
	automation_content: string;
	attachments?: Attachment[];
	test_step_logs?: TestStepLog[];
	testcase_properties?: PropertyResource[];
	tosca_guid?: string;
	tosca_node_path?: string;
}

export interface AutomationRequest {
	test_suite?: number;
	parent_module?: number;
	execution_date: string;
	test_logs: TestLog[];
}

export interface TestStep {
	description: string;
	expected: string;
	order?: number;
}

export interface TestCase {
	name: string;
	parent_id?: number;
	order?: number;
	description?: string;
	precondition?: string;
	properties?: PropertyResource[];
	test_steps?: TestStep[];
	id?: number;
	pid?: string;
	web_url?: string;
	test_case_version_id?: number;
}

export interface PagedResource<T> {
	items: T[];
	total: number;
	page: number;
	pageSize: number;
}

export interface QueueProcessingResponse {
	id: number;
	state: QueueJobState;
}

export interface Module {
	id: number;
	name: string;
	pid?: string;
	parent_id?: number;
	order?: number;
}
