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
	note?: string;
	attachments?: Attachment[];
	test_step_logs?: TestStepLog[];
	module_names?: string[];
	properties?: PropertyResource[];
	testcase_properties?: PropertyResource[];
	tosca_guid?: string;
	tosca_node_path?: string;
}

export interface AutomationRequest {
	test_suite?: number | string;
	parent_module?: number | string;
	skipCreatingAutomationModule?: boolean;
	execution_date: string;
	test_logs: TestLog[];
}

export interface QueueProcessingResponse {
	id: number;
	state: QueueJobState;
}
