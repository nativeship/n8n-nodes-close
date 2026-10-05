import { NodeConnectionTypes, NodeApiError, NodeOperationError, type IDataObject, type IExecuteFunctions, type IHttpRequestOptions, type INodeExecutionData, type INodeType, type INodeTypeDescription, type JsonObject } from "n8n-workflow";
import { requestWithRetry, selectCredentialApplications } from "../../shared/http";

// Generated with ts-morph
type CredentialApplication = { credentialType: string; type: 'apiKey' | 'basic' | 'bearer' | 'oauth2' | 'custom'; location?: 'header' | 'query'; parameter?: string; injections?: Array<{ target: 'header' | 'query' | 'body'; name: string; value: string }> };
type RetryContract = { mode: string; retryConnectionFailures?: boolean; retryTimeouts?: boolean; retryRateLimits?: boolean; retryServerErrors?: boolean; maxAttempts: number; maxElapsedMs: number; baseBackoffMs: number; maxBackoffMs: number; jitterRatio: number; idempotency?: { target: 'header' | 'query' | 'body'; parameter: string } };
type PaginationContract = { style: string; page?: string; limit?: string; cursor?: string; responseCursor?: string; hasMore?: string; itemPath?: string; advancement?: string; maxPages: number; maxItems: number; maxElapsedMs: number; maxMemoryBytes: number; repeatedCursorLimit: number; repeatedPageLimit: number; pageSize: number };

function normalizeParameterValue(value: unknown): IDataObject[string] {
  if (value && typeof value === 'object' && 'value' in value) return (value as { value: IDataObject[string] }).value;
  return value as IDataObject[string];
}


type BodyFieldContract = {
  name: string;
  displayName?: string;
  description?: string;
  placeholder?: string;
  type?: string;
  format?: string;
  required?: boolean;
  minValue?: number;
  maxValue?: number;
  enum?: unknown[];
  default?: unknown;
  example?: unknown;
  pattern?: string;
  fields?: BodyFieldContract[];
  items?: BodyFieldContract;
  additionalValue?: BodyFieldContract;
  alternatives?: BodyFieldContract[];
  composition?: 'oneOf' | 'anyOf';
  representation?: string;
  nullable?: boolean;
};

function normalizeJsonValue(value: unknown, label: string, context: IExecuteFunctions, itemIndex: number): IDataObject | IDataObject[] | string | number | boolean | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed) as IDataObject | IDataObject[] | string | number | boolean | null;
    } catch (error) {
      throw new NodeOperationError(context.getNode(), `${label} must be valid JSON: ${(error as Error).message}`, { itemIndex });
    }
  }
  if (value === null || Array.isArray(value) || (value && typeof value === 'object') || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value as IDataObject | IDataObject[] | string | number | boolean | null;
  throw new NodeOperationError(context.getNode(), `${label} must be valid JSON`, { itemIndex });
}


function validateBodyValue(value: unknown, contract: BodyFieldContract, path: string, context: IExecuteFunctions, itemIndex: number): void {
  if (value === undefined || value === '') {
    if (contract.required) throw new NodeOperationError(context.getNode(), `${path} is required`, { itemIndex });
    return;
  }
  if (value === null) {
    if (contract.nullable) return;
    throw new NodeOperationError(context.getNode(), `${path} must not be null`, { itemIndex });
  }
  if (contract.alternatives?.length) {
    selectAlternativeValue(value, contract, path, context, itemIndex);
    return;
  }
  if (contract.type === 'string' && typeof value !== 'string') throw new NodeOperationError(context.getNode(), `${path} must be a string`, { itemIndex });
  if (contract.type === 'boolean' && typeof value !== 'boolean') throw new NodeOperationError(context.getNode(), `${path} must be a boolean`, { itemIndex });
  if (contract.type === 'number' && typeof value !== 'number') throw new NodeOperationError(context.getNode(), `${path} must be a number`, { itemIndex });
  if (contract.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value))) throw new NodeOperationError(context.getNode(), `${path} must be an integer`, { itemIndex });
  if (contract.enum?.length) {
    const enumValueMatches = (candidate: unknown): boolean => candidate === value ||
      (candidate === null && value === 'null') ||
      (candidate === 'null' && value === null) ||
      Boolean(candidate && value && typeof candidate === 'object' && typeof value === 'object' && JSON.stringify(candidate) === JSON.stringify(value));
    const scalarEnum = contract.enum.every((candidate) => candidate === null || ['string', 'number', 'boolean'].includes(typeof candidate));
    const matches = contract.type === 'array' && Array.isArray(value) && scalarEnum
      ? value.every((item) => contract.enum!.some((candidate) => candidate === item || (candidate === null && item === 'null') || (candidate === 'null' && item === null)))
      : contract.enum.some(enumValueMatches);
    if (!matches) throw new NodeOperationError(context.getNode(), `${path} must be one of: ${contract.enum.join(', ')}`, { itemIndex });
  }
  if (contract.type === 'number' || contract.type === 'integer') {
    const numeric = value as number;
    if (contract.minValue !== undefined && numeric < contract.minValue) throw new NodeOperationError(context.getNode(), `${path} must be at least ${contract.minValue}`, { itemIndex });
    if (contract.maxValue !== undefined && numeric > contract.maxValue) throw new NodeOperationError(context.getNode(), `${path} must be at most ${contract.maxValue}`, { itemIndex });
  }
  if (contract.pattern && typeof value === 'string' && !new RegExp(contract.pattern).test(value)) throw new NodeOperationError(context.getNode(), `${path} must match ${contract.pattern}`, { itemIndex });
  if (contract.format === 'email' && typeof value === 'string' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value)) throw new NodeOperationError(context.getNode(), `${path} must be an email address`, { itemIndex });
  if ((contract.format === 'uri' || contract.format === 'url') && typeof value === 'string') {
    try {
      new URL(value);
    } catch {
      throw new NodeOperationError(context.getNode(), `${path} must be a URL`, { itemIndex });
    }
  }
  if (contract.format === 'uuid' && typeof value === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) throw new NodeOperationError(context.getNode(), `${path} must be a UUID`, { itemIndex });
  if (contract.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NodeOperationError(context.getNode(), `${path} must be a JSON object`, { itemIndex });
    const objectValue = value as IDataObject;
    for (const child of contract.fields ?? []) validateBodyValue(objectValue[child.name], child, `${path}.${child.name}`, context, itemIndex);
    if (contract.additionalValue) {
      const known = new Set((contract.fields ?? []).map((field) => field.name));
      for (const [key, childValue] of Object.entries(objectValue)) {
        if (!known.has(key)) {
          if (contract.additionalValue.alternatives?.length && contract.additionalValue.representation === 'raw') continue;
          validateBodyValue(childValue, contract.additionalValue, `${path}.${key}`, context, itemIndex);
        }
      }
    }
  }
  if (contract.type === 'array') {
    if (!Array.isArray(value)) throw new NodeOperationError(context.getNode(), `${path} must be a JSON array`, { itemIndex });
    if (contract.items) value.forEach((item, index) => validateBodyValue(item, contract.items!, `${path}[${index}]`, context, itemIndex));
  }
}

function setBodyField(body: IDataObject, contract: BodyFieldContract, value: unknown, context: IExecuteFunctions, itemIndex: number): void {
  const normalized = contract.type === 'object' || contract.type === 'array' || contract.type === 'alternative' || contract.representation === 'raw'
    ? normalizeJsonValue(value, contract.displayName ?? contract.name, context, itemIndex)
    : normalizeParameterValue(value);
  const selected = contract.alternatives?.length ? selectAlternativeValue(normalized, contract, contract.name, context, itemIndex) : normalized;
  validateBodyValue(selected, { ...contract, alternatives: undefined, composition: undefined }, contract.name, context, itemIndex);
  body[contract.name] = selected as IDataObject[string];
}


function selectAlternativeValue(value: unknown, contract: BodyFieldContract, path: string, context: IExecuteFunctions, itemIndex: number): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NodeOperationError(context.getNode(), `${path} must include an explicit schema alternative and value`, { itemIndex });
  const selectedName = String((value as IDataObject).schemaAlternative ?? '');
  const selected = (contract.alternatives ?? []).find((alternative) => alternative.name === selectedName);
  if (!selected) throw new NodeOperationError(context.getNode(), `${path} schema alternative must be one of: ${(contract.alternatives ?? []).map((alternative) => alternative.name).join(', ')}`, { itemIndex });
  const selectedValue = (value as IDataObject).value;
  validateBodyValue(selectedValue, selected, path, context, itemIndex);
  return selectedValue;
}




function selectResponseFields(value: IDataObject, fields: string[]): IDataObject {
  if (fields.length === 0) return value;
  const selected: IDataObject = {};
  if (value.id !== undefined) selected.id = value.id;
  for (const field of fields) if (value[field] !== undefined) selected[field] = value[field];
  return selected;
}

function valueAtPath(value: unknown, path: string): unknown {
  if (!path) return value;
  return path.split('.').filter(Boolean).reduce((current: unknown, segment) => {
    if (current === undefined || current === null) return undefined;
    if (Array.isArray(current)) return current[Number(segment)];
    return (current as IDataObject)[segment];
  }, value);
}

export class Close implements INodeType {
  description: INodeTypeDescription = {
        displayName: "Close",
        name: "close",
        icon: {
            light: "file:close.svg",
            dark: "file:close.dark.svg"
        },
        group: [],
        version: [
            1
        ],
        subtitle: "={{((JSON.parse(\"\\u007b\\\"activities\\\":\\u007b\\\"activities_list\\\":\\\"listActivity: activity\\\"\\u007d,\\\"activitiesCalls\\\":\\u007b\\\"activities.calls_create\\\":\\\"createCall: activitiesCall\\\",\\\"activities.calls_delete\\\":\\\"deleteLoggedCall: activitiesCall\\\",\\\"activities.calls_get\\\":\\\"getCall: activitiesCall\\\",\\\"activities.calls_list\\\":\\\"findCalls: activitiesCall\\\",\\\"activities.calls_update\\\":\\\"updateCall: activitiesCall\\\"\\u007d,\\\"activitiesCustomActivities\\\":\\u007b\\\"activities.custom_activities_create\\\":\\\"createCustomActivity: activitiesCustomActivity\\\",\\\"activities.custom_activities_get\\\":\\\"getCustomActivity: activitiesCustomActivity\\\",\\\"activities.custom_activities_list\\\":\\\"findCustomActivities: activitiesCustomActivity\\\",\\\"activities.custom_activities_update\\\":\\\"updateCustomActivity: activitiesCustomActivity\\\"\\u007d,\\\"activitiesEmails\\\":\\u007b\\\"activities.emails_create\\\":\\\"createEmail: activitiesEmail\\\",\\\"activities.emails_delete\\\":\\\"deleteEmail: activitiesEmail\\\",\\\"activities.emails_list\\\":\\\"listEmails: activitiesEmail\\\"\\u007d,\\\"activitiesFormSubmissions\\\":\\u007b\\\"activities.form_submissions_list\\\":\\\"listFormSubmissions: activitiesFormSubmission\\\"\\u007d,\\\"activitiesLeadStatusChanges\\\":\\u007b\\\"activities.lead_status_changes_list\\\":\\\"listLeadStatusChanges: activitiesLeadStatusChange\\\"\\u007d,\\\"activitiesMeetings\\\":\\u007b\\\"activities.meetings_get\\\":\\\"getMeeting: activitiesMeeting\\\",\\\"activities.meetings_list\\\":\\\"findMeetings: activitiesMeeting\\\"\\u007d,\\\"activitiesNotes\\\":\\u007b\\\"activities.notes_create\\\":\\\"createNote: activitiesNote\\\",\\\"activities.notes_get\\\":\\\"getNote: activitiesNote\\\",\\\"activities.notes_list\\\":\\\"findNotes: activitiesNote\\\",\\\"activities.notes_update\\\":\\\"updateNote: activitiesNote\\\"\\u007d,\\\"activitiesOpportunityStatusChanges\\\":\\u007b\\\"activities.opportunity_status_changes_list\\\":\\\"listOpportunityStatusChanges: activitiesOpportunityStatusChange\\\"\\u007d,\\\"activitiesSms\\\":\\u007b\\\"activities.sms_create\\\":\\\"createSms: activitiesSm\\\",\\\"activities.sms_list\\\":\\\"listSmsMessages: activitiesSm\\\"\\u007d,\\\"activitiesTaskCompletions\\\":\\u007b\\\"activities.task_completions_list\\\":\\\"listTaskCompletions: activitiesTaskCompletion\\\"\\u007d,\\\"activitiesWhatsappMessages\\\":\\u007b\\\"activities.whatsapp_messages_create\\\":\\\"createWhatsAppMessage: activitiesWhatsappMessage\\\",\\\"activities.whatsapp_messages_get\\\":\\\"getWhatsAppMessage: activitiesWhatsappMessage\\\",\\\"activities.whatsapp_messages_list\\\":\\\"findWhatsAppMessages: activitiesWhatsappMessage\\\"\\u007d,\\\"bulkActionsEdit\\\":\\u007b\\\"bulk_actions.edit_create\\\":\\\"createBulkAction: bulkActionsEdit\\\"\\u007d,\\\"bulkActionsEmail\\\":\\u007b\\\"bulk_actions.email_create\\\":\\\"createBulkEmail: bulkActionsEmail\\\"\\u007d,\\\"bulkActionsSequenceSubscriptions\\\":\\u007b\\\"bulk_actions.sequence_subscriptions_create\\\":\\\"createBulkWorkflowSubscriptionAction: bulkActionsSequenceSubscription\\\"\\u007d,\\\"connectedAccounts\\\":\\u007b\\\"connected_accounts_get\\\":\\\"getConnectedAccount: connectedAccount\\\",\\\"connected_accounts_list\\\":\\\"findConnectedAccounts: connectedAccount\\\"\\u007d,\\\"contacts\\\":\\u007b\\\"contacts_create\\\":\\\"createContact: contact\\\",\\\"contacts_get\\\":\\\"getContact: contact\\\",\\\"contacts_list\\\":\\\"findContacts: contact\\\",\\\"contacts_update\\\":\\\"updateContact: contact\\\"\\u007d,\\\"customObjects\\\":\\u007b\\\"custom_objects_create\\\":\\\"createCustomObject: customObject\\\",\\\"custom_objects_get\\\":\\\"getCustomObject: customObject\\\",\\\"custom_objects_list\\\":\\\"findCustomObjects: customObject\\\",\\\"custom_objects_update\\\":\\\"updateCustomObject: customObject\\\"\\u007d,\\\"events\\\":\\u007b\\\"events_list\\\":\\\"listEvents: event\\\"\\u007d,\\\"exports\\\":\\u007b\\\"exports_create_lead\\\":\\\"createLeadExport: export\\\",\\\"exports_create_opportunity\\\":\\\"createOpportunityExport: export\\\",\\\"exports_list\\\":\\\"listExports: export\\\"\\u007d,\\\"groups\\\":\\u007b\\\"groups_get\\\":\\\"getGroup: group\\\",\\\"groups_list\\\":\\\"findGroups: group\\\"\\u007d,\\\"leads\\\":\\u007b\\\"leads_create\\\":\\\"createLead: lead\\\",\\\"leads_get\\\":\\\"getLead: lead\\\",\\\"leads_list\\\":\\\"findLeads: lead\\\",\\\"leads_merge\\\":\\\"mergeTwoLeads: lead\\\",\\\"leads_update\\\":\\\"updateLead: lead\\\"\\u007d,\\\"opportunities\\\":\\u007b\\\"opportunities_create\\\":\\\"createOpportunity: opportunity\\\",\\\"opportunities_get\\\":\\\"getOpportunity: opportunity\\\",\\\"opportunities_list\\\":\\\"findOpportunities: opportunity\\\",\\\"opportunities_update\\\":\\\"updateOpportunity: opportunity\\\"\\u007d,\\\"phoneNumbers\\\":\\u007b\\\"phone_numbers_update\\\":\\\"toggleForwardingOnPhoneNumber: phoneNumber\\\"\\u007d,\\\"reporting\\\":\\u007b\\\"reporting_get_activity\\\":\\\"runActivityReport: reporting\\\",\\\"reporting_get_custom\\\":\\\"runOpportunityReport: reporting\\\",\\\"reporting_get_funnel_stages\\\":\\\"runOpportunityFunnelReportByStage: reporting\\\",\\\"reporting_get_funnel_totals\\\":\\\"runOpportunityFunnelTotalsReport: reporting\\\",\\\"reporting_get_lead_statuses\\\":\\\"runLeadStatusChangeReport: reporting\\\",\\\"reporting_get_opportunity_statuses\\\":\\\"runOpportunityStatusChangeReport: reporting\\\",\\\"reporting_get_sent_emails\\\":\\\"runSentEmailReport: reporting\\\"\\u007d,\\\"sequences\\\":\\u007b\\\"sequences_create_subscription\\\":\\\"subscribeContactToWorkflow: sequence\\\",\\\"sequences_get_subscription\\\":\\\"getWorkflowSubscription: sequence\\\",\\\"sequences_list_subscriptions\\\":\\\"findWorkflowSubscriptions: sequence\\\",\\\"sequences_update_subscription\\\":\\\"updateWorkflowSubscription: sequence\\\"\\u007d,\\\"smartViews\\\":\\u007b\\\"smart_views_create\\\":\\\"createLeadSmartView: smartView\\\",\\\"smart_views_update\\\":\\\"updateLeadSmartView: smartView\\\"\\u007d,\\\"tasks\\\":\\u007b\\\"tasks_create\\\":\\\"createTask: task\\\",\\\"tasks_get\\\":\\\"getTask: task\\\",\\\"tasks_list\\\":\\\"findTasks: task\\\",\\\"tasks_update\\\":\\\"updateTask: task\\\"\\u007d,\\\"unsubscribedEmails\\\":\\u007b\\\"unsubscribed_emails_create\\\":\\\"unsubscribeEmail: unsubscribedEmail\\\",\\\"unsubscribed_emails_delete\\\":\\\"resubscribeEmail: unsubscribedEmail\\\",\\\"unsubscribed_emails_list\\\":\\\"listUnsubscribedEmails: unsubscribedEmail\\\"\\u007d,\\\"users\\\":\\u007b\\\"users_get\\\":\\\"getUser: user\\\",\\\"users_list\\\":\\\"findUsers: user\\\",\\\"users_list_availabilities\\\":\\\"listUserAvailability: user\\\"\\u007d\\u007d\"))[$parameter[\"resource\"]] || {})[$parameter[\"operation\"]] || ($parameter[\"operation\"] + \": \" + $parameter[\"resource\"])}}",
        description: "Close is a sales CRM that brings calling, email, SMS, pipelines, tasks, and reporting into one platform.",
        documentationUrl: "https://api.close.com/api/v1",
        hints: [
            {
                message: "Operation \"activities.calls_list\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"activities.custom_activities_list\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"activities.emails_list\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"activities.form_submissions_list\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"activities.meetings_list\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"activities.notes_list\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"activities.sms_list\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"activities.lead_status_changes_list\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"activities.opportunity_status_changes_list\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"activities.task_completions_list\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"activities.whatsapp_messages_list\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"contacts_list\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"exports_list\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"groups_list\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"leads_list\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"opportunities_list\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            }
        ],
        defaults: {
            name: "Close"
        },
        usableAsTool: true,
        inputs: [
            NodeConnectionTypes.Main
        ],
        outputs: [
            NodeConnectionTypes.Main
        ],
        credentials: [
            {
                name: "closeApi",
                required: true,
                displayOptions: {
                    show: {
                        authentication: [
                            "ApiKeyAuth"
                        ]
                    }
                }
            },
            {
                name: "closeOAuth2Api",
                required: true,
                displayOptions: {
                    show: {
                        authentication: [
                            "OAuth2"
                        ]
                    }
                }
            }
        ],
        properties: [
            {
                displayName: "Authentication",
                name: "authentication",
                type: "options",
                noDataExpression: true,
                default: "ApiKeyAuth",
                options: [
                    {
                        name: "API Key Auth",
                        value: "ApiKeyAuth"
                    },
                    {
                        name: "OAuth2",
                        value: "OAuth2"
                    }
                ]
            },
            {
                displayName: "Resource",
                name: "resource",
                type: "options",
                noDataExpression: true,
                default: "activities",
                options: [
                    {
                        name: "Activities Call",
                        value: "activitiesCalls"
                    },
                    {
                        name: "Activities Custom Activity",
                        value: "activitiesCustomActivities"
                    },
                    {
                        name: "Activities Email",
                        value: "activitiesEmails"
                    },
                    {
                        name: "Activities Form Submission",
                        value: "activitiesFormSubmissions"
                    },
                    {
                        name: "Activities Lead Status Change",
                        value: "activitiesLeadStatusChanges"
                    },
                    {
                        name: "Activities Meeting",
                        value: "activitiesMeetings"
                    },
                    {
                        name: "Activities Note",
                        value: "activitiesNotes"
                    },
                    {
                        name: "Activities Opportunity Status Change",
                        value: "activitiesOpportunityStatusChanges"
                    },
                    {
                        name: "Activities Sm",
                        value: "activitiesSms"
                    },
                    {
                        name: "Activities Task Completion",
                        value: "activitiesTaskCompletions"
                    },
                    {
                        name: "Activities Whatsapp Message",
                        value: "activitiesWhatsappMessages"
                    },
                    {
                        name: "Activity",
                        value: "activities"
                    },
                    {
                        name: "Bulk Actions Edit",
                        value: "bulkActionsEdit"
                    },
                    {
                        name: "Bulk Actions Email",
                        value: "bulkActionsEmail"
                    },
                    {
                        name: "Bulk Actions Sequence Subscription",
                        value: "bulkActionsSequenceSubscriptions"
                    },
                    {
                        name: "Connected Account",
                        value: "connectedAccounts"
                    },
                    {
                        name: "Contact",
                        value: "contacts"
                    },
                    {
                        name: "Custom Object",
                        value: "customObjects"
                    },
                    {
                        name: "Event",
                        value: "events"
                    },
                    {
                        name: "Export",
                        value: "exports"
                    },
                    {
                        name: "Group",
                        value: "groups"
                    },
                    {
                        name: "Lead",
                        value: "leads"
                    },
                    {
                        name: "Opportunity",
                        value: "opportunities"
                    },
                    {
                        name: "Phone Number",
                        value: "phoneNumbers"
                    },
                    {
                        name: "Reporting",
                        value: "reporting"
                    },
                    {
                        name: "Sequence",
                        value: "sequences"
                    },
                    {
                        name: "Smart View",
                        value: "smartViews"
                    },
                    {
                        name: "Task",
                        value: "tasks"
                    },
                    {
                        name: "Unsubscribed Email",
                        value: "unsubscribedEmails"
                    },
                    {
                        name: "User",
                        value: "users"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activities"
                        ]
                    }
                },
                default: "activities_list",
                options: [
                    {
                        name: "List",
                        value: "activities_list",
                        action: "List activity",
                        description: "Lists activity records filtered by lead, user, contact, or activity type"
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activities"
                        ],
                        operation: [
                            "activities_list"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Activity At Gt",
                        name: "activity_at__gt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Gte",
                        name: "activity_at__gte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Lt",
                        name: "activity_at__lt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Lte",
                        name: "activity_at__lte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Contact ID",
                        name: "contact_id",
                        type: "json",
                        default: [],
                        description: "Filter by contact IDs (comma-separated)"
                    },
                    {
                        displayName: "Contact ID In",
                        name: "contact_id__in",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Created Gt",
                        name: "date_created__gt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Gte",
                        name: "date_created__gte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Lt",
                        name: "date_created__lt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Lte",
                        name: "date_created__lte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    },
                    {
                        displayName: "ID In",
                        name: "id__in",
                        type: "json",
                        default: [],
                        description: "Filter by activity IDs (comma-separated)"
                    },
                    {
                        displayName: "Lead ID",
                        name: "lead_id",
                        type: "json",
                        default: [],
                        description: "Filter by lead IDs (comma-separated)"
                    },
                    {
                        displayName: "Lead ID In",
                        name: "lead_id__in",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Limit",
                        name: "_limit",
                        type: "number",
                        default: 100,
                        description: "Number of results to return"
                    },
                    {
                        displayName: "Order By",
                        name: "_order_by",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Organization ID",
                        name: "organization_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Skip",
                        name: "_skip",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip before returning, for pagination"
                    },
                    {
                        displayName: "Type",
                        name: "_type",
                        type: "json",
                        default: [],
                        description: "Filter by activity type, e.g. call (comma-separated)"
                    },
                    {
                        displayName: "Type In",
                        name: "_type__in",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "json",
                        default: [],
                        description: "Filter by user IDs (comma-separated)"
                    },
                    {
                        displayName: "User ID In",
                        name: "user_id__in",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCalls"
                        ]
                    }
                },
                default: "activities.calls_create",
                options: [
                    {
                        name: "Create Call",
                        value: "activities.calls_create",
                        action: "Create call activities calls",
                        description: "Creates a call activity on a lead. activities calls."
                    },
                    {
                        name: "Delete Logged Call",
                        value: "activities.calls_delete",
                        action: "Delete logged call activities calls",
                        description: "Deletes a logged call. activities calls."
                    },
                    {
                        name: "Find Calls",
                        value: "activities.calls_list",
                        action: "Find calls activities calls",
                        description: "Finds call activities, including available recordings and transcripts. activities calls."
                    },
                    {
                        name: "Get Call",
                        value: "activities.calls_get",
                        action: "Get call activities calls",
                        description: "Returns a call activity by ID. activities calls."
                    },
                    {
                        name: "Update Call",
                        value: "activities.calls_update",
                        action: "Update call activities calls",
                        description: "Updates an existing call activity. activities calls."
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCalls"
                        ],
                        operation: [
                            "activities.calls_create"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Activity At",
                        name: "activity_at",
                        type: "dateTime",
                        default: ""
                    },
                    {
                        displayName: "Contact ID",
                        name: "contact_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Conversation Type ID",
                        name: "conversation_type_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Created By",
                        name: "created_by",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Created",
                        name: "date_created",
                        type: "dateTime",
                        default: ""
                    },
                    {
                        displayName: "Direction",
                        name: "direction",
                        type: "options",
                        default: "inbound",
                        options: [
                            {
                                name: "Inbound",
                                value: "inbound"
                            },
                            {
                                name: "Null",
                                value: "null"
                            },
                            {
                                name: "Outbound",
                                value: "outbound"
                            }
                        ]
                    },
                    {
                        displayName: "Duration",
                        name: "duration",
                        type: "number",
                        default: 0,
                        typeOptions: {
                            maxValue: 604800
                        }
                    },
                    {
                        displayName: "Lead ID",
                        name: "lead_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Note",
                        name: "note",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Note HTML",
                        name: "note_html",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Organization ID",
                        name: "organization_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Outcome ID",
                        name: "outcome_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Phone",
                        name: "phone",
                        type: "string",
                        default: "",
                        description: "Phone number in e.164 format"
                    },
                    {
                        displayName: "Playbook ID",
                        name: "playbook_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Quality Info",
                        name: "quality_info",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Recording URL",
                        name: "recording_url",
                        type: "string",
                        default: "",
                        hint: "Expected format: uri"
                    },
                    {
                        displayName: "Source",
                        name: "source",
                        type: "options",
                        default: "Close.io",
                        options: [
                            {
                                name: "Close.Io",
                                value: "Close.io"
                            },
                            {
                                name: "External",
                                value: "External"
                            },
                            {
                                name: "Null",
                                value: "null"
                            }
                        ]
                    },
                    {
                        displayName: "Status",
                        name: "status",
                        type: "options",
                        default: "created",
                        options: [
                            {
                                name: "Busy",
                                value: "busy"
                            },
                            {
                                name: "Cancel",
                                value: "cancel"
                            },
                            {
                                name: "Completed",
                                value: "completed"
                            },
                            {
                                name: "Created",
                                value: "created"
                            },
                            {
                                name: "Failed",
                                value: "failed"
                            },
                            {
                                name: "In Progress",
                                value: "in-progress"
                            },
                            {
                                name: "No Answer",
                                value: "no-answer"
                            },
                            {
                                name: "Null",
                                value: "null"
                            },
                            {
                                name: "Timeout",
                                value: "timeout"
                            }
                        ]
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Voicemail URL",
                        name: "voicemail_url",
                        type: "string",
                        default: "",
                        hint: "Expected format: uri"
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCalls"
                        ],
                        operation: [
                            "activities.calls_create"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "status",
                    "_type",
                    "activity_at",
                    "contact_id",
                    "created_by",
                    "created_by_name",
                    "date_created",
                    "date_updated",
                    "lead_id"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCalls"
                        ],
                        operation: [
                            "activities.calls_create"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Activity At",
                        value: "activity_at"
                    },
                    {
                        name: "Contact ID",
                        value: "contact_id"
                    },
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Created By Name",
                        value: "created_by_name"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Lead ID",
                        value: "lead_id"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Outcome ID",
                        value: "outcome_id"
                    },
                    {
                        name: "Sequence ID",
                        value: "sequence_id"
                    },
                    {
                        name: "Sequence Name",
                        value: "sequence_name"
                    },
                    {
                        name: "Sequence Subscription ID",
                        value: "sequence_subscription_id"
                    },
                    {
                        name: "Source",
                        value: "source"
                    },
                    {
                        name: "Status",
                        value: "status"
                    },
                    {
                        name: "Type",
                        value: "_type"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    },
                    {
                        name: "Updated By Name",
                        value: "updated_by_name"
                    },
                    {
                        name: "User ID",
                        value: "user_id"
                    },
                    {
                        name: "User Name",
                        value: "user_name"
                    },
                    {
                        name: "Users",
                        value: "users"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCalls"
                        ],
                        operation: [
                            "activities.calls_delete"
                        ]
                    }
                }
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCalls"
                        ],
                        operation: [
                            "activities.calls_get"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCalls"
                        ],
                        operation: [
                            "activities.calls_get"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCalls"
                        ],
                        operation: [
                            "activities.calls_get"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "status",
                    "_type",
                    "activity_at",
                    "contact_id",
                    "created_by",
                    "created_by_name",
                    "date_created",
                    "date_updated",
                    "lead_id"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCalls"
                        ],
                        operation: [
                            "activities.calls_get"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Activity At",
                        value: "activity_at"
                    },
                    {
                        name: "Contact ID",
                        value: "contact_id"
                    },
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Created By Name",
                        value: "created_by_name"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Lead ID",
                        value: "lead_id"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Outcome ID",
                        value: "outcome_id"
                    },
                    {
                        name: "Sequence ID",
                        value: "sequence_id"
                    },
                    {
                        name: "Sequence Name",
                        value: "sequence_name"
                    },
                    {
                        name: "Sequence Subscription ID",
                        value: "sequence_subscription_id"
                    },
                    {
                        name: "Source",
                        value: "source"
                    },
                    {
                        name: "Status",
                        value: "status"
                    },
                    {
                        name: "Type",
                        value: "_type"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    },
                    {
                        name: "Updated By Name",
                        value: "updated_by_name"
                    },
                    {
                        name: "User ID",
                        value: "user_id"
                    },
                    {
                        name: "User Name",
                        value: "user_name"
                    },
                    {
                        name: "Users",
                        value: "users"
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCalls"
                        ],
                        operation: [
                            "activities.calls_list"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Activity At Gt",
                        name: "activity_at__gt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Gte",
                        name: "activity_at__gte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Lt",
                        name: "activity_at__lt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Lte",
                        name: "activity_at__lte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Contact ID",
                        name: "contact_id",
                        type: "json",
                        default: [],
                        description: "Filter by contact IDs (comma-separated)"
                    },
                    {
                        displayName: "Date Created Gt",
                        name: "date_created__gt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Gte",
                        name: "date_created__gte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Lt",
                        name: "date_created__lt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Lte",
                        name: "date_created__lte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    },
                    {
                        displayName: "ID In",
                        name: "id__in",
                        type: "json",
                        default: [],
                        description: "Filter by activity IDs (comma-separated)"
                    },
                    {
                        displayName: "Lead ID",
                        name: "lead_id",
                        type: "json",
                        default: [],
                        description: "Filter by lead IDs (comma-separated)"
                    },
                    {
                        displayName: "Limit",
                        name: "_limit",
                        type: "number",
                        default: 100,
                        description: "Number of results to return"
                    },
                    {
                        displayName: "Organization ID",
                        name: "organization_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Skip",
                        name: "_skip",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip before returning, for pagination"
                    },
                    {
                        displayName: "Type",
                        name: "_type",
                        type: "json",
                        default: [],
                        description: "Filter by activity type, e.g. call (comma-separated)"
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "json",
                        default: [],
                        description: "Filter by user IDs (comma-separated)"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCalls"
                        ],
                        operation: [
                            "activities.calls_update"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCalls"
                        ],
                        operation: [
                            "activities.calls_update"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Activity At",
                        name: "activity_at",
                        type: "dateTime",
                        default: ""
                    },
                    {
                        displayName: "Contact ID",
                        name: "contact_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Conversation Type ID",
                        name: "conversation_type_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Duration",
                        name: "duration",
                        type: "number",
                        default: 0,
                        typeOptions: {
                            maxValue: 604800
                        }
                    },
                    {
                        displayName: "Lead ID",
                        name: "lead_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Note",
                        name: "note",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Note HTML",
                        name: "note_html",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Outcome ID",
                        name: "outcome_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Phone",
                        name: "phone",
                        type: "string",
                        default: "",
                        description: "Phone number in e.164 format"
                    },
                    {
                        displayName: "Playbook ID",
                        name: "playbook_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Quality Info",
                        name: "quality_info",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Recording URL",
                        name: "recording_url",
                        type: "string",
                        default: "",
                        hint: "Expected format: uri"
                    },
                    {
                        displayName: "Status",
                        name: "status",
                        type: "options",
                        default: "created",
                        options: [
                            {
                                name: "Busy",
                                value: "busy"
                            },
                            {
                                name: "Cancel",
                                value: "cancel"
                            },
                            {
                                name: "Completed",
                                value: "completed"
                            },
                            {
                                name: "Created",
                                value: "created"
                            },
                            {
                                name: "Failed",
                                value: "failed"
                            },
                            {
                                name: "In Progress",
                                value: "in-progress"
                            },
                            {
                                name: "No Answer",
                                value: "no-answer"
                            },
                            {
                                name: "Null",
                                value: "null"
                            },
                            {
                                name: "Timeout",
                                value: "timeout"
                            }
                        ]
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Voicemail URL",
                        name: "voicemail_url",
                        type: "string",
                        default: "",
                        hint: "Expected format: uri"
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCalls"
                        ],
                        operation: [
                            "activities.calls_update"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "status",
                    "_type",
                    "activity_at",
                    "contact_id",
                    "created_by",
                    "created_by_name",
                    "date_created",
                    "date_updated",
                    "lead_id"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCalls"
                        ],
                        operation: [
                            "activities.calls_update"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Activity At",
                        value: "activity_at"
                    },
                    {
                        name: "Contact ID",
                        value: "contact_id"
                    },
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Created By Name",
                        value: "created_by_name"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Lead ID",
                        value: "lead_id"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Outcome ID",
                        value: "outcome_id"
                    },
                    {
                        name: "Sequence ID",
                        value: "sequence_id"
                    },
                    {
                        name: "Sequence Name",
                        value: "sequence_name"
                    },
                    {
                        name: "Sequence Subscription ID",
                        value: "sequence_subscription_id"
                    },
                    {
                        name: "Source",
                        value: "source"
                    },
                    {
                        name: "Status",
                        value: "status"
                    },
                    {
                        name: "Type",
                        value: "_type"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    },
                    {
                        name: "Updated By Name",
                        value: "updated_by_name"
                    },
                    {
                        name: "User ID",
                        value: "user_id"
                    },
                    {
                        name: "User Name",
                        value: "user_name"
                    },
                    {
                        name: "Users",
                        value: "users"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCustomActivities"
                        ]
                    }
                },
                default: "activities.custom_activities_create",
                options: [
                    {
                        name: "Create Custom Activity",
                        value: "activities.custom_activities_create",
                        action: "Create custom activity activities custom activities",
                        description: "Creates a custom activity for a lead. activities custom activities."
                    },
                    {
                        name: "Find Custom Activities",
                        value: "activities.custom_activities_list",
                        action: "Find custom activities activities custom activities",
                        description: "Finds custom activities that match the supplied filters. activities custom activities."
                    },
                    {
                        name: "Get Custom Activity",
                        value: "activities.custom_activities_get",
                        action: "Get custom activity activities custom activities",
                        description: "Returns a custom activity by ID. activities custom activities."
                    },
                    {
                        name: "Update Custom Activity",
                        value: "activities.custom_activities_update",
                        action: "Update custom activity activities custom activities",
                        description: "Updates an existing custom activity. activities custom activities."
                    }
                ]
            },
            {
                displayName: "Custom Activity Type ID",
                name: "custom_activity_type_id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCustomActivities"
                        ],
                        operation: [
                            "activities.custom_activities_create"
                        ]
                    }
                }
            },
            {
                displayName: "Lead ID",
                name: "lead_id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCustomActivities"
                        ],
                        operation: [
                            "activities.custom_activities_create"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCustomActivities"
                        ],
                        operation: [
                            "activities.custom_activities_create"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Activity At",
                        name: "activity_at",
                        type: "dateTime",
                        default: ""
                    },
                    {
                        displayName: "Contact ID",
                        name: "contact_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Created By",
                        name: "created_by",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Created",
                        name: "date_created",
                        type: "dateTime",
                        default: ""
                    },
                    {
                        displayName: "Organization ID",
                        name: "organization_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Pinned",
                        name: "pinned",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable pinned"
                    },
                    {
                        displayName: "Status",
                        name: "status",
                        type: "options",
                        default: "draft",
                        options: [
                            {
                                name: "Draft",
                                value: "draft"
                            },
                            {
                                name: "Published",
                                value: "published"
                            }
                        ]
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCustomActivities"
                        ],
                        operation: [
                            "activities.custom_activities_create"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "status",
                    "_type",
                    "activity_at",
                    "contact_id",
                    "created_by",
                    "created_by_name",
                    "custom_activity_type_id",
                    "date_created",
                    "date_updated"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCustomActivities"
                        ],
                        operation: [
                            "activities.custom_activities_create"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Activity At",
                        value: "activity_at"
                    },
                    {
                        name: "Comment Summary",
                        value: "comment_summary"
                    },
                    {
                        name: "Contact ID",
                        value: "contact_id"
                    },
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Created By Name",
                        value: "created_by_name"
                    },
                    {
                        name: "Custom Activity Type ID",
                        value: "custom_activity_type_id"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Last Published At",
                        value: "last_published_at"
                    },
                    {
                        name: "Lead ID",
                        value: "lead_id"
                    },
                    {
                        name: "Mentions",
                        value: "mentions"
                    },
                    {
                        name: "Mentions Updated At",
                        value: "mentions_updated_at"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Pinned",
                        value: "pinned"
                    },
                    {
                        name: "Pinned At",
                        value: "pinned_at"
                    },
                    {
                        name: "Source",
                        value: "source"
                    },
                    {
                        name: "Status",
                        value: "status"
                    },
                    {
                        name: "Type",
                        value: "_type"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    },
                    {
                        name: "Updated By Name",
                        value: "updated_by_name"
                    },
                    {
                        name: "User ID",
                        value: "user_id"
                    },
                    {
                        name: "User Name",
                        value: "user_name"
                    },
                    {
                        name: "Users",
                        value: "users"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCustomActivities"
                        ],
                        operation: [
                            "activities.custom_activities_get"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCustomActivities"
                        ],
                        operation: [
                            "activities.custom_activities_get"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCustomActivities"
                        ],
                        operation: [
                            "activities.custom_activities_get"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "status",
                    "_type",
                    "activity_at",
                    "contact_id",
                    "created_by",
                    "created_by_name",
                    "custom_activity_type_id",
                    "date_created",
                    "date_updated"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCustomActivities"
                        ],
                        operation: [
                            "activities.custom_activities_get"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Activity At",
                        value: "activity_at"
                    },
                    {
                        name: "Comment Summary",
                        value: "comment_summary"
                    },
                    {
                        name: "Contact ID",
                        value: "contact_id"
                    },
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Created By Name",
                        value: "created_by_name"
                    },
                    {
                        name: "Custom Activity Type ID",
                        value: "custom_activity_type_id"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Last Published At",
                        value: "last_published_at"
                    },
                    {
                        name: "Lead ID",
                        value: "lead_id"
                    },
                    {
                        name: "Mentions",
                        value: "mentions"
                    },
                    {
                        name: "Mentions Updated At",
                        value: "mentions_updated_at"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Pinned",
                        value: "pinned"
                    },
                    {
                        name: "Pinned At",
                        value: "pinned_at"
                    },
                    {
                        name: "Source",
                        value: "source"
                    },
                    {
                        name: "Status",
                        value: "status"
                    },
                    {
                        name: "Type",
                        value: "_type"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    },
                    {
                        name: "Updated By Name",
                        value: "updated_by_name"
                    },
                    {
                        name: "User ID",
                        value: "user_id"
                    },
                    {
                        name: "User Name",
                        value: "user_name"
                    },
                    {
                        name: "Users",
                        value: "users"
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCustomActivities"
                        ],
                        operation: [
                            "activities.custom_activities_list"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Activity At Gt",
                        name: "activity_at__gt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Gte",
                        name: "activity_at__gte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Lt",
                        name: "activity_at__lt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Lte",
                        name: "activity_at__lte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Contact ID",
                        name: "contact_id",
                        type: "json",
                        default: [],
                        description: "Filter by contact IDs (comma-separated)"
                    },
                    {
                        displayName: "Custom Activity Type ID",
                        name: "custom_activity_type_id",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Custom Activity Type ID In",
                        name: "custom_activity_type_id__in",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Created Gt",
                        name: "date_created__gt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Gte",
                        name: "date_created__gte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Lt",
                        name: "date_created__lt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Lte",
                        name: "date_created__lte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    },
                    {
                        displayName: "ID In",
                        name: "id__in",
                        type: "json",
                        default: [],
                        description: "Filter by activity IDs (comma-separated)"
                    },
                    {
                        displayName: "Lead ID",
                        name: "lead_id",
                        type: "json",
                        default: [],
                        description: "Filter by lead IDs (comma-separated)"
                    },
                    {
                        displayName: "Limit",
                        name: "_limit",
                        type: "number",
                        default: 100,
                        description: "Number of results to return"
                    },
                    {
                        displayName: "Organization ID",
                        name: "organization_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Skip",
                        name: "_skip",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip before returning, for pagination"
                    },
                    {
                        displayName: "Type",
                        name: "_type",
                        type: "json",
                        default: [],
                        description: "Filter by activity type, e.g. call (comma-separated)"
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "json",
                        default: [],
                        description: "Filter by user IDs (comma-separated)"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCustomActivities"
                        ],
                        operation: [
                            "activities.custom_activities_update"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCustomActivities"
                        ],
                        operation: [
                            "activities.custom_activities_update"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Activity At",
                        name: "activity_at",
                        type: "dateTime",
                        default: ""
                    },
                    {
                        displayName: "Contact ID",
                        name: "contact_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Pinned",
                        name: "pinned",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable pinned"
                    },
                    {
                        displayName: "Status",
                        name: "status",
                        type: "options",
                        default: "draft",
                        options: [
                            {
                                name: "Draft",
                                value: "draft"
                            },
                            {
                                name: "Published",
                                value: "published"
                            }
                        ]
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCustomActivities"
                        ],
                        operation: [
                            "activities.custom_activities_update"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "status",
                    "_type",
                    "activity_at",
                    "contact_id",
                    "created_by",
                    "created_by_name",
                    "custom_activity_type_id",
                    "date_created",
                    "date_updated"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesCustomActivities"
                        ],
                        operation: [
                            "activities.custom_activities_update"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Activity At",
                        value: "activity_at"
                    },
                    {
                        name: "Comment Summary",
                        value: "comment_summary"
                    },
                    {
                        name: "Contact ID",
                        value: "contact_id"
                    },
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Created By Name",
                        value: "created_by_name"
                    },
                    {
                        name: "Custom Activity Type ID",
                        value: "custom_activity_type_id"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Last Published At",
                        value: "last_published_at"
                    },
                    {
                        name: "Lead ID",
                        value: "lead_id"
                    },
                    {
                        name: "Mentions",
                        value: "mentions"
                    },
                    {
                        name: "Mentions Updated At",
                        value: "mentions_updated_at"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Pinned",
                        value: "pinned"
                    },
                    {
                        name: "Pinned At",
                        value: "pinned_at"
                    },
                    {
                        name: "Source",
                        value: "source"
                    },
                    {
                        name: "Status",
                        value: "status"
                    },
                    {
                        name: "Type",
                        value: "_type"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    },
                    {
                        name: "Updated By Name",
                        value: "updated_by_name"
                    },
                    {
                        name: "User ID",
                        value: "user_id"
                    },
                    {
                        name: "User Name",
                        value: "user_name"
                    },
                    {
                        name: "Users",
                        value: "users"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesEmails"
                        ]
                    }
                },
                default: "activities.emails_create",
                options: [
                    {
                        name: "Create Email",
                        value: "activities.emails_create",
                        action: "Create email activities emails",
                        description: "Creates an email activity for a lead or contact. activities emails."
                    },
                    {
                        name: "Delete Email",
                        value: "activities.emails_delete",
                        action: "Delete email activities emails",
                        description: "Deletes an email activity. activities emails."
                    },
                    {
                        name: "List Emails",
                        value: "activities.emails_list",
                        action: "List emails activities emails",
                        description: "Lists email activities that match the supplied filters. activities emails."
                    }
                ]
            },
            {
                displayName: "Lead ID",
                name: "lead_id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesEmails"
                        ],
                        operation: [
                            "activities.emails_create"
                        ]
                    }
                }
            },
            {
                displayName: "Status",
                name: "status",
                type: "options",
                default: "inbox",
                required: true,
                options: [
                    {
                        name: "Draft",
                        value: "draft"
                    },
                    {
                        name: "Error",
                        value: "error"
                    },
                    {
                        name: "Inbox",
                        value: "inbox"
                    },
                    {
                        name: "Outbox",
                        value: "outbox"
                    },
                    {
                        name: "Scheduled",
                        value: "scheduled"
                    },
                    {
                        name: "Sent",
                        value: "sent"
                    }
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesEmails"
                        ],
                        operation: [
                            "activities.emails_create"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesEmails"
                        ],
                        operation: [
                            "activities.emails_create"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Activity At",
                        name: "activity_at",
                        type: "dateTime",
                        default: ""
                    },
                    {
                        displayName: "Attachments",
                        name: "attachments",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Bcc",
                        name: "bcc",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Body HTML",
                        name: "body_html",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Body Text",
                        name: "body_text",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Cc",
                        name: "cc",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Contact ID",
                        name: "contact_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Created By",
                        name: "created_by",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Created",
                        name: "date_created",
                        type: "dateTime",
                        default: ""
                    },
                    {
                        displayName: "Email Account ID",
                        name: "email_account_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Followup Date",
                        name: "followup_date",
                        type: "dateTime",
                        default: ""
                    },
                    {
                        displayName: "Followup Sequence Add Cc Bcc",
                        name: "followup_sequence_add_cc_bcc",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable followup sequence add cc bcc"
                    },
                    {
                        displayName: "Followup Sequence Delay",
                        name: "followup_sequence_delay",
                        type: "number",
                        default: 0,
                        typeOptions: {
                            minValue: 86400
                        }
                    },
                    {
                        displayName: "Followup Sequence ID",
                        name: "followup_sequence_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "In Reply To ID",
                        name: "in_reply_to_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Opens",
                        name: "opens",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Organization ID",
                        name: "organization_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Sender",
                        name: "sender",
                        type: "string",
                        default: "",
                        hint: "Expected format: email"
                    },
                    {
                        displayName: "Subject",
                        name: "subject",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Template ID",
                        name: "template_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "To",
                        name: "to",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesEmails"
                        ],
                        operation: [
                            "activities.emails_create"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "status",
                    "_type",
                    "activity_at",
                    "agent_action_reason",
                    "agent_config_id",
                    "body_html",
                    "body_preview",
                    "body_text",
                    "bulk_email_action_id"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesEmails"
                        ],
                        operation: [
                            "activities.emails_create"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Activity At",
                        value: "activity_at"
                    },
                    {
                        name: "Agent Action Reason",
                        value: "agent_action_reason"
                    },
                    {
                        name: "Agent Config ID",
                        value: "agent_config_id"
                    },
                    {
                        name: "Attachments",
                        value: "attachments"
                    },
                    {
                        name: "Bcc",
                        value: "bcc"
                    },
                    {
                        name: "Body HTML",
                        value: "body_html"
                    },
                    {
                        name: "Body Preview",
                        value: "body_preview"
                    },
                    {
                        name: "Body Text",
                        value: "body_text"
                    },
                    {
                        name: "Bulk Email Action ID",
                        value: "bulk_email_action_id"
                    },
                    {
                        name: "Cc",
                        value: "cc"
                    },
                    {
                        name: "Contact ID",
                        value: "contact_id"
                    },
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Created By Name",
                        value: "created_by_name"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Scheduled",
                        value: "date_scheduled"
                    },
                    {
                        name: "Date Sent",
                        value: "date_sent"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "Direction",
                        value: "direction"
                    },
                    {
                        name: "Email Account ID",
                        value: "email_account_id"
                    },
                    {
                        name: "Envelope",
                        value: "envelope"
                    },
                    {
                        name: "Followup Sequence Add Cc Bcc",
                        value: "followup_sequence_add_cc_bcc"
                    },
                    {
                        name: "Followup Sequence Delay",
                        value: "followup_sequence_delay"
                    },
                    {
                        name: "Followup Sequence ID",
                        value: "followup_sequence_id"
                    },
                    {
                        name: "Has Reply",
                        value: "has_reply"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "In Reply To ID",
                        value: "in_reply_to_id"
                    },
                    {
                        name: "Lead ID",
                        value: "lead_id"
                    },
                    {
                        name: "Message IDs",
                        value: "message_ids"
                    },
                    {
                        name: "Need SMTP Credentials",
                        value: "need_smtp_credentials"
                    },
                    {
                        name: "Opens",
                        value: "opens"
                    },
                    {
                        name: "Opens Summary",
                        value: "opens_summary"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "References",
                        value: "references"
                    },
                    {
                        name: "Send As ID",
                        value: "send_as_id"
                    },
                    {
                        name: "Send Attempts",
                        value: "send_attempts"
                    },
                    {
                        name: "Sender",
                        value: "sender"
                    },
                    {
                        name: "Sequence ID",
                        value: "sequence_id"
                    },
                    {
                        name: "Sequence Name",
                        value: "sequence_name"
                    },
                    {
                        name: "Sequence Subscription ID",
                        value: "sequence_subscription_id"
                    },
                    {
                        name: "Status",
                        value: "status"
                    },
                    {
                        name: "Subject",
                        value: "subject"
                    },
                    {
                        name: "Template ID",
                        value: "template_id"
                    },
                    {
                        name: "Template Name",
                        value: "template_name"
                    },
                    {
                        name: "Thread ID",
                        value: "thread_id"
                    },
                    {
                        name: "To",
                        value: "to"
                    },
                    {
                        name: "Type",
                        value: "_type"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    },
                    {
                        name: "Updated By Name",
                        value: "updated_by_name"
                    },
                    {
                        name: "User ID",
                        value: "user_id"
                    },
                    {
                        name: "User Name",
                        value: "user_name"
                    },
                    {
                        name: "Users",
                        value: "users"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesEmails"
                        ],
                        operation: [
                            "activities.emails_delete"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesEmails"
                        ],
                        operation: [
                            "activities.emails_list"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Activity At Gt",
                        name: "activity_at__gt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Gte",
                        name: "activity_at__gte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Lt",
                        name: "activity_at__lt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Lte",
                        name: "activity_at__lte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Contact ID",
                        name: "contact_id",
                        type: "json",
                        default: [],
                        description: "Filter by contact IDs (comma-separated)"
                    },
                    {
                        displayName: "Date Created Gt",
                        name: "date_created__gt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Gte",
                        name: "date_created__gte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Lt",
                        name: "date_created__lt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Lte",
                        name: "date_created__lte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    },
                    {
                        displayName: "ID In",
                        name: "id__in",
                        type: "json",
                        default: [],
                        description: "Filter by activity IDs (comma-separated)"
                    },
                    {
                        displayName: "Lead ID",
                        name: "lead_id",
                        type: "json",
                        default: [],
                        description: "Filter by lead IDs (comma-separated)"
                    },
                    {
                        displayName: "Limit",
                        name: "_limit",
                        type: "number",
                        default: 100,
                        description: "Number of results to return"
                    },
                    {
                        displayName: "Organization ID",
                        name: "organization_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Skip",
                        name: "_skip",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip before returning, for pagination"
                    },
                    {
                        displayName: "Type",
                        name: "_type",
                        type: "json",
                        default: [],
                        description: "Filter by activity type, e.g. call (comma-separated)"
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "json",
                        default: [],
                        description: "Filter by user IDs (comma-separated)"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesFormSubmissions"
                        ]
                    }
                },
                default: "activities.form_submissions_list",
                options: [
                    {
                        name: "List Form Submissions",
                        value: "activities.form_submissions_list",
                        action: "List form submissions activities form submissions",
                        description: "Lists form submission activities for your organization. activities form submissions."
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesFormSubmissions"
                        ],
                        operation: [
                            "activities.form_submissions_list"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Activity At Gt",
                        name: "activity_at__gt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Gte",
                        name: "activity_at__gte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Lt",
                        name: "activity_at__lt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Lte",
                        name: "activity_at__lte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Contact ID",
                        name: "contact_id",
                        type: "json",
                        default: [],
                        description: "Filter by contact IDs (comma-separated)"
                    },
                    {
                        displayName: "Contact ID In",
                        name: "contact_id__in",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Created Gt",
                        name: "date_created__gt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Gte",
                        name: "date_created__gte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Lt",
                        name: "date_created__lt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Lte",
                        name: "date_created__lte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    },
                    {
                        displayName: "Form ID",
                        name: "form_id",
                        type: "json",
                        default: [],
                        description: "Filter by a specific form ID"
                    },
                    {
                        displayName: "Form ID In",
                        name: "form_id__in",
                        type: "string",
                        default: "",
                        description: "Filter by multiple form IDs (comma-separated)"
                    },
                    {
                        displayName: "ID In",
                        name: "id__in",
                        type: "json",
                        default: [],
                        description: "Filter by activity IDs (comma-separated)"
                    },
                    {
                        displayName: "Lead ID",
                        name: "lead_id",
                        type: "json",
                        default: [],
                        description: "Filter by lead IDs (comma-separated)"
                    },
                    {
                        displayName: "Lead ID In",
                        name: "lead_id__in",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Limit",
                        name: "_limit",
                        type: "number",
                        default: 100,
                        description: "Number of results to return"
                    },
                    {
                        displayName: "Organization ID",
                        name: "organization_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Skip",
                        name: "_skip",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip before returning, for pagination"
                    },
                    {
                        displayName: "Type",
                        name: "_type",
                        type: "json",
                        default: [],
                        description: "Filter by activity type, e.g. call (comma-separated)"
                    },
                    {
                        displayName: "Type In",
                        name: "_type__in",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "json",
                        default: [],
                        description: "Filter by user IDs (comma-separated)"
                    },
                    {
                        displayName: "User ID In",
                        name: "user_id__in",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesLeadStatusChanges"
                        ]
                    }
                },
                default: "activities.lead_status_changes_list",
                options: [
                    {
                        name: "List Lead Status Changes",
                        value: "activities.lead_status_changes_list",
                        action: "List lead status changes activities lead status changes",
                        description: "Lists lead status changes that match the supplied filters. activities lead status changes."
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesLeadStatusChanges"
                        ],
                        operation: [
                            "activities.lead_status_changes_list"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Activity At Gt",
                        name: "activity_at__gt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Gte",
                        name: "activity_at__gte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Lt",
                        name: "activity_at__lt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Lte",
                        name: "activity_at__lte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Contact ID",
                        name: "contact_id",
                        type: "json",
                        default: [],
                        description: "Filter by contact IDs (comma-separated)"
                    },
                    {
                        displayName: "Date Created Gt",
                        name: "date_created__gt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Gte",
                        name: "date_created__gte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Lt",
                        name: "date_created__lt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Lte",
                        name: "date_created__lte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    },
                    {
                        displayName: "ID In",
                        name: "id__in",
                        type: "json",
                        default: [],
                        description: "Filter by activity IDs (comma-separated)"
                    },
                    {
                        displayName: "Lead ID",
                        name: "lead_id",
                        type: "json",
                        default: [],
                        description: "Filter by lead IDs (comma-separated)"
                    },
                    {
                        displayName: "Limit",
                        name: "_limit",
                        type: "number",
                        default: 100,
                        description: "Number of results to return"
                    },
                    {
                        displayName: "Organization ID",
                        name: "organization_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Skip",
                        name: "_skip",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip before returning, for pagination"
                    },
                    {
                        displayName: "Type",
                        name: "_type",
                        type: "json",
                        default: [],
                        description: "Filter by activity type, e.g. call (comma-separated)"
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "json",
                        default: [],
                        description: "Filter by user IDs (comma-separated)"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesMeetings"
                        ]
                    }
                },
                default: "activities.meetings_get",
                options: [
                    {
                        name: "Find Meetings",
                        value: "activities.meetings_list",
                        action: "Find meetings activities meetings",
                        description: "Finds meetings that match the supplied filters. activities meetings."
                    },
                    {
                        name: "Get Meeting",
                        value: "activities.meetings_get",
                        action: "Get meeting activities meetings",
                        description: "Returns a meeting activity by ID. activities meetings."
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesMeetings"
                        ],
                        operation: [
                            "activities.meetings_get"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesMeetings"
                        ],
                        operation: [
                            "activities.meetings_get"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesMeetings"
                        ],
                        operation: [
                            "activities.meetings_get"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "title",
                    "status",
                    "_type",
                    "activity_at",
                    "actual_duration",
                    "calendar_event_link",
                    "connected_account_id",
                    "contact_id",
                    "conversation_type_id"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesMeetings"
                        ],
                        operation: [
                            "activities.meetings_get"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Activity At",
                        value: "activity_at"
                    },
                    {
                        name: "Actual Duration",
                        value: "actual_duration"
                    },
                    {
                        name: "Attached Call IDs",
                        value: "attached_call_ids"
                    },
                    {
                        name: "Attendees",
                        value: "attendees"
                    },
                    {
                        name: "Calendar Event Link",
                        value: "calendar_event_link"
                    },
                    {
                        name: "Calendar Event Uids",
                        value: "calendar_event_uids"
                    },
                    {
                        name: "Comment Summary",
                        value: "comment_summary"
                    },
                    {
                        name: "Conference Links",
                        value: "conference_links"
                    },
                    {
                        name: "Connected Account ID",
                        value: "connected_account_id"
                    },
                    {
                        name: "Contact ID",
                        value: "contact_id"
                    },
                    {
                        name: "Conversation Type ID",
                        value: "conversation_type_id"
                    },
                    {
                        name: "Conversation Type Reason",
                        value: "conversation_type_reason"
                    },
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Created By Name",
                        value: "created_by_name"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "Duration",
                        value: "duration"
                    },
                    {
                        name: "Ends At",
                        value: "ends_at"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Integrations",
                        value: "integrations"
                    },
                    {
                        name: "Is Recurring",
                        value: "is_recurring"
                    },
                    {
                        name: "Lead ID",
                        value: "lead_id"
                    },
                    {
                        name: "Location",
                        value: "location"
                    },
                    {
                        name: "Note",
                        value: "note"
                    },
                    {
                        name: "Notetaker ID",
                        value: "notetaker_id"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Outcome Autofill Confidence",
                        value: "outcome_autofill_confidence"
                    },
                    {
                        name: "Outcome Autofill Reasoning",
                        value: "outcome_autofill_reasoning"
                    },
                    {
                        name: "Outcome ID",
                        value: "outcome_id"
                    },
                    {
                        name: "Outcome Reason",
                        value: "outcome_reason"
                    },
                    {
                        name: "Paused Subscriptions",
                        value: "_paused_subscriptions"
                    },
                    {
                        name: "Playbook ID",
                        value: "playbook_id"
                    },
                    {
                        name: "Playbook Reason",
                        value: "playbook_reason"
                    },
                    {
                        name: "Provider Calendar Event ID",
                        value: "provider_calendar_event_id"
                    },
                    {
                        name: "Provider Calendar IDs",
                        value: "provider_calendar_ids"
                    },
                    {
                        name: "Provider Calendar Type",
                        value: "provider_calendar_type"
                    },
                    {
                        name: "Source",
                        value: "source"
                    },
                    {
                        name: "Starts At",
                        value: "starts_at"
                    },
                    {
                        name: "Status",
                        value: "status"
                    },
                    {
                        name: "Summary",
                        value: "summary"
                    },
                    {
                        name: "Title",
                        value: "title"
                    },
                    {
                        name: "Transcripts",
                        value: "transcripts"
                    },
                    {
                        name: "Type",
                        value: "_type"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    },
                    {
                        name: "Updated By Name",
                        value: "updated_by_name"
                    },
                    {
                        name: "User ID",
                        value: "user_id"
                    },
                    {
                        name: "User Name",
                        value: "user_name"
                    },
                    {
                        name: "User Note",
                        value: "user_note"
                    },
                    {
                        name: "User Note Date Updated",
                        value: "user_note_date_updated"
                    },
                    {
                        name: "User Note HTML",
                        value: "user_note_html"
                    },
                    {
                        name: "User Note Mentions",
                        value: "user_note_mentions"
                    },
                    {
                        name: "Users",
                        value: "users"
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesMeetings"
                        ],
                        operation: [
                            "activities.meetings_list"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Activity At Gt",
                        name: "activity_at__gt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Gte",
                        name: "activity_at__gte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Lt",
                        name: "activity_at__lt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Lte",
                        name: "activity_at__lte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Contact ID",
                        name: "contact_id",
                        type: "json",
                        default: [],
                        description: "Filter by contact IDs (comma-separated)"
                    },
                    {
                        displayName: "Date Created Gt",
                        name: "date_created__gt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Gte",
                        name: "date_created__gte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Lt",
                        name: "date_created__lt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Lte",
                        name: "date_created__lte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    },
                    {
                        displayName: "ID In",
                        name: "id__in",
                        type: "json",
                        default: [],
                        description: "Filter by activity IDs (comma-separated)"
                    },
                    {
                        displayName: "Lead ID",
                        name: "lead_id",
                        type: "json",
                        default: [],
                        description: "Filter by lead IDs (comma-separated)"
                    },
                    {
                        displayName: "Limit",
                        name: "_limit",
                        type: "number",
                        default: 100,
                        description: "Number of results to return"
                    },
                    {
                        displayName: "Organization ID",
                        name: "organization_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Skip",
                        name: "_skip",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip before returning, for pagination"
                    },
                    {
                        displayName: "Type",
                        name: "_type",
                        type: "json",
                        default: [],
                        description: "Filter by activity type, e.g. call (comma-separated)"
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "json",
                        default: [],
                        description: "Filter by user IDs (comma-separated)"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesNotes"
                        ]
                    }
                },
                default: "activities.notes_create",
                options: [
                    {
                        name: "Create Note",
                        value: "activities.notes_create",
                        action: "Create note activities notes",
                        description: "Creates a note on a lead. activities notes."
                    },
                    {
                        name: "Find Notes",
                        value: "activities.notes_list",
                        action: "Find notes activities notes",
                        description: "Finds notes that match the supplied filters. activities notes."
                    },
                    {
                        name: "Get Note",
                        value: "activities.notes_get",
                        action: "Get note activities notes",
                        description: "Returns a note activity by ID. activities notes."
                    },
                    {
                        name: "Update Note",
                        value: "activities.notes_update",
                        action: "Update note activities notes",
                        description: "Updates an existing note. activities notes."
                    }
                ]
            },
            {
                displayName: "Lead ID",
                name: "lead_id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesNotes"
                        ],
                        operation: [
                            "activities.notes_create"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesNotes"
                        ],
                        operation: [
                            "activities.notes_create"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Activity At",
                        name: "activity_at",
                        type: "dateTime",
                        default: ""
                    },
                    {
                        displayName: "Attachments",
                        name: "attachments",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Contact ID",
                        name: "contact_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Created By",
                        name: "created_by",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Created",
                        name: "date_created",
                        type: "dateTime",
                        default: ""
                    },
                    {
                        displayName: "Note",
                        name: "note",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Note HTML",
                        name: "note_html",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Organization ID",
                        name: "organization_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Pinned",
                        name: "pinned",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable pinned"
                    },
                    {
                        displayName: "Title",
                        name: "title",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesNotes"
                        ],
                        operation: [
                            "activities.notes_create"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "title",
                    "_type",
                    "activity_at",
                    "agent_action_reason",
                    "agent_config_id",
                    "contact_id",
                    "created_by",
                    "created_by_name",
                    "date_created"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesNotes"
                        ],
                        operation: [
                            "activities.notes_create"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Activity At",
                        value: "activity_at"
                    },
                    {
                        name: "Agent Action Reason",
                        value: "agent_action_reason"
                    },
                    {
                        name: "Agent Config ID",
                        value: "agent_config_id"
                    },
                    {
                        name: "Attachments",
                        value: "attachments"
                    },
                    {
                        name: "Comment Summary",
                        value: "comment_summary"
                    },
                    {
                        name: "Contact ID",
                        value: "contact_id"
                    },
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Created By Name",
                        value: "created_by_name"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Lead ID",
                        value: "lead_id"
                    },
                    {
                        name: "Note",
                        value: "note"
                    },
                    {
                        name: "Note HTML",
                        value: "note_html"
                    },
                    {
                        name: "Note Mentions",
                        value: "note_mentions"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Pinned",
                        value: "pinned"
                    },
                    {
                        name: "Pinned At",
                        value: "pinned_at"
                    },
                    {
                        name: "Source",
                        value: "source"
                    },
                    {
                        name: "Title",
                        value: "title"
                    },
                    {
                        name: "Type",
                        value: "_type"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    },
                    {
                        name: "Updated By Name",
                        value: "updated_by_name"
                    },
                    {
                        name: "User ID",
                        value: "user_id"
                    },
                    {
                        name: "User Name",
                        value: "user_name"
                    },
                    {
                        name: "Users",
                        value: "users"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesNotes"
                        ],
                        operation: [
                            "activities.notes_get"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesNotes"
                        ],
                        operation: [
                            "activities.notes_get"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesNotes"
                        ],
                        operation: [
                            "activities.notes_get"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "title",
                    "_type",
                    "activity_at",
                    "agent_action_reason",
                    "agent_config_id",
                    "contact_id",
                    "created_by",
                    "created_by_name",
                    "date_created"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesNotes"
                        ],
                        operation: [
                            "activities.notes_get"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Activity At",
                        value: "activity_at"
                    },
                    {
                        name: "Agent Action Reason",
                        value: "agent_action_reason"
                    },
                    {
                        name: "Agent Config ID",
                        value: "agent_config_id"
                    },
                    {
                        name: "Attachments",
                        value: "attachments"
                    },
                    {
                        name: "Comment Summary",
                        value: "comment_summary"
                    },
                    {
                        name: "Contact ID",
                        value: "contact_id"
                    },
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Created By Name",
                        value: "created_by_name"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Lead ID",
                        value: "lead_id"
                    },
                    {
                        name: "Note",
                        value: "note"
                    },
                    {
                        name: "Note HTML",
                        value: "note_html"
                    },
                    {
                        name: "Note Mentions",
                        value: "note_mentions"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Pinned",
                        value: "pinned"
                    },
                    {
                        name: "Pinned At",
                        value: "pinned_at"
                    },
                    {
                        name: "Source",
                        value: "source"
                    },
                    {
                        name: "Title",
                        value: "title"
                    },
                    {
                        name: "Type",
                        value: "_type"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    },
                    {
                        name: "Updated By Name",
                        value: "updated_by_name"
                    },
                    {
                        name: "User ID",
                        value: "user_id"
                    },
                    {
                        name: "User Name",
                        value: "user_name"
                    },
                    {
                        name: "Users",
                        value: "users"
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesNotes"
                        ],
                        operation: [
                            "activities.notes_list"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Activity At Gt",
                        name: "activity_at__gt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Gte",
                        name: "activity_at__gte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Lt",
                        name: "activity_at__lt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Lte",
                        name: "activity_at__lte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Contact ID",
                        name: "contact_id",
                        type: "json",
                        default: [],
                        description: "Filter by contact IDs (comma-separated)"
                    },
                    {
                        displayName: "Date Created Gt",
                        name: "date_created__gt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Gte",
                        name: "date_created__gte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Lt",
                        name: "date_created__lt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Lte",
                        name: "date_created__lte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    },
                    {
                        displayName: "ID In",
                        name: "id__in",
                        type: "json",
                        default: [],
                        description: "Filter by activity IDs (comma-separated)"
                    },
                    {
                        displayName: "Lead ID",
                        name: "lead_id",
                        type: "json",
                        default: [],
                        description: "Filter by lead IDs (comma-separated)"
                    },
                    {
                        displayName: "Limit",
                        name: "_limit",
                        type: "number",
                        default: 100,
                        description: "Number of results to return"
                    },
                    {
                        displayName: "Organization ID",
                        name: "organization_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Skip",
                        name: "_skip",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip before returning, for pagination"
                    },
                    {
                        displayName: "Type",
                        name: "_type",
                        type: "json",
                        default: [],
                        description: "Filter by activity type, e.g. call (comma-separated)"
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "json",
                        default: [],
                        description: "Filter by user IDs (comma-separated)"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesNotes"
                        ],
                        operation: [
                            "activities.notes_update"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesNotes"
                        ],
                        operation: [
                            "activities.notes_update"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Activity At",
                        name: "activity_at",
                        type: "dateTime",
                        default: ""
                    },
                    {
                        displayName: "Attachments",
                        name: "attachments",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Contact ID",
                        name: "contact_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Note",
                        name: "note",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Note HTML",
                        name: "note_html",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Pinned",
                        name: "pinned",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable pinned"
                    },
                    {
                        displayName: "Title",
                        name: "title",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesNotes"
                        ],
                        operation: [
                            "activities.notes_update"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "title",
                    "_type",
                    "activity_at",
                    "agent_action_reason",
                    "agent_config_id",
                    "contact_id",
                    "created_by",
                    "created_by_name",
                    "date_created"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesNotes"
                        ],
                        operation: [
                            "activities.notes_update"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Activity At",
                        value: "activity_at"
                    },
                    {
                        name: "Agent Action Reason",
                        value: "agent_action_reason"
                    },
                    {
                        name: "Agent Config ID",
                        value: "agent_config_id"
                    },
                    {
                        name: "Attachments",
                        value: "attachments"
                    },
                    {
                        name: "Comment Summary",
                        value: "comment_summary"
                    },
                    {
                        name: "Contact ID",
                        value: "contact_id"
                    },
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Created By Name",
                        value: "created_by_name"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Lead ID",
                        value: "lead_id"
                    },
                    {
                        name: "Note",
                        value: "note"
                    },
                    {
                        name: "Note HTML",
                        value: "note_html"
                    },
                    {
                        name: "Note Mentions",
                        value: "note_mentions"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Pinned",
                        value: "pinned"
                    },
                    {
                        name: "Pinned At",
                        value: "pinned_at"
                    },
                    {
                        name: "Source",
                        value: "source"
                    },
                    {
                        name: "Title",
                        value: "title"
                    },
                    {
                        name: "Type",
                        value: "_type"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    },
                    {
                        name: "Updated By Name",
                        value: "updated_by_name"
                    },
                    {
                        name: "User ID",
                        value: "user_id"
                    },
                    {
                        name: "User Name",
                        value: "user_name"
                    },
                    {
                        name: "Users",
                        value: "users"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesOpportunityStatusChanges"
                        ]
                    }
                },
                default: "activities.opportunity_status_changes_list",
                options: [
                    {
                        name: "List Opportunity Status Changes",
                        value: "activities.opportunity_status_changes_list",
                        action: "List opportunity status changes activities opportunity status changes",
                        description: "Lists opportunity status changes that match the supplied filters. activities opportunity status changes."
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesOpportunityStatusChanges"
                        ],
                        operation: [
                            "activities.opportunity_status_changes_list"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Activity At Gt",
                        name: "activity_at__gt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Gte",
                        name: "activity_at__gte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Lt",
                        name: "activity_at__lt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Lte",
                        name: "activity_at__lte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Contact ID",
                        name: "contact_id",
                        type: "json",
                        default: [],
                        description: "Filter by contact IDs (comma-separated)"
                    },
                    {
                        displayName: "Date Created Gt",
                        name: "date_created__gt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Gte",
                        name: "date_created__gte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Lt",
                        name: "date_created__lt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Lte",
                        name: "date_created__lte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    },
                    {
                        displayName: "ID In",
                        name: "id__in",
                        type: "json",
                        default: [],
                        description: "Filter by activity IDs (comma-separated)"
                    },
                    {
                        displayName: "Lead ID",
                        name: "lead_id",
                        type: "json",
                        default: [],
                        description: "Filter by lead IDs (comma-separated)"
                    },
                    {
                        displayName: "Limit",
                        name: "_limit",
                        type: "number",
                        default: 100,
                        description: "Number of results to return"
                    },
                    {
                        displayName: "Opportunity ID",
                        name: "opportunity_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Organization ID",
                        name: "organization_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Skip",
                        name: "_skip",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip before returning, for pagination"
                    },
                    {
                        displayName: "Type",
                        name: "_type",
                        type: "json",
                        default: [],
                        description: "Filter by activity type, e.g. call (comma-separated)"
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "json",
                        default: [],
                        description: "Filter by user IDs (comma-separated)"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesSms"
                        ]
                    }
                },
                default: "activities.sms_create",
                options: [
                    {
                        name: "Create SMS",
                        value: "activities.sms_create",
                        action: "Create SMS activities SMS",
                        description: "Creates an SMS activity. activities SMS."
                    },
                    {
                        name: "List SMS Messages",
                        value: "activities.sms_list",
                        action: "List SMS messages activities SMS",
                        description: "Lists SMS activities that match the supplied filters. activities SMS."
                    }
                ]
            },
            {
                displayName: "Status",
                name: "status",
                type: "options",
                default: "inbox",
                required: true,
                options: [
                    {
                        name: "Draft",
                        value: "draft"
                    },
                    {
                        name: "Error",
                        value: "error"
                    },
                    {
                        name: "Inbox",
                        value: "inbox"
                    },
                    {
                        name: "Outbox",
                        value: "outbox"
                    },
                    {
                        name: "Scheduled",
                        value: "scheduled"
                    },
                    {
                        name: "Sent",
                        value: "sent"
                    }
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesSms"
                        ],
                        operation: [
                            "activities.sms_create"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesSms"
                        ],
                        operation: [
                            "activities.sms_create"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Activity At",
                        name: "activity_at",
                        type: "dateTime",
                        default: ""
                    },
                    {
                        displayName: "Attachments",
                        name: "attachments",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Caller ID Mode",
                        name: "caller_id_mode",
                        type: "options",
                        default: "fixed",
                        options: [
                            {
                                name: "Auto",
                                value: "auto"
                            },
                            {
                                name: "Fixed",
                                value: "fixed"
                            },
                            {
                                name: "Null",
                                value: "null"
                            }
                        ]
                    },
                    {
                        displayName: "Contact ID",
                        name: "contact_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Created By",
                        name: "created_by",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Created",
                        name: "date_created",
                        type: "dateTime",
                        default: ""
                    },
                    {
                        displayName: "Direction",
                        name: "direction",
                        type: "options",
                        default: "inbound",
                        options: [
                            {
                                name: "Inbound",
                                value: "inbound"
                            },
                            {
                                name: "Null",
                                value: "null"
                            },
                            {
                                name: "Outbound",
                                value: "outbound"
                            }
                        ]
                    },
                    {
                        displayName: "Lead ID",
                        name: "lead_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Local Phone",
                        name: "local_phone",
                        type: "string",
                        default: "",
                        description: "Phone number in e.164 format"
                    },
                    {
                        displayName: "Organization ID",
                        name: "organization_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Remote Phone",
                        name: "remote_phone",
                        type: "string",
                        default: "",
                        description: "Phone number in e.164 format"
                    },
                    {
                        displayName: "Send To Inbox",
                        name: "send_to_inbox",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable send to inbox"
                    },
                    {
                        displayName: "Source",
                        name: "source",
                        type: "options",
                        default: "Close.io",
                        options: [
                            {
                                name: "Close.Io",
                                value: "Close.io"
                            },
                            {
                                name: "External",
                                value: "External"
                            },
                            {
                                name: "Null",
                                value: "null"
                            }
                        ]
                    },
                    {
                        displayName: "Template ID",
                        name: "template_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Text",
                        name: "text",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesSms"
                        ],
                        operation: [
                            "activities.sms_create"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "status",
                    "_type",
                    "activity_at",
                    "agent_action_reason",
                    "agent_config_id",
                    "caller_id_mode",
                    "caller_id_reason",
                    "contact_id",
                    "cost"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesSms"
                        ],
                        operation: [
                            "activities.sms_create"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Activity At",
                        value: "activity_at"
                    },
                    {
                        name: "Agent Action Reason",
                        value: "agent_action_reason"
                    },
                    {
                        name: "Agent Config ID",
                        value: "agent_config_id"
                    },
                    {
                        name: "Caller ID Mode",
                        value: "caller_id_mode"
                    },
                    {
                        name: "Caller ID Reason",
                        value: "caller_id_reason"
                    },
                    {
                        name: "Contact ID",
                        value: "contact_id"
                    },
                    {
                        name: "Cost",
                        value: "cost"
                    },
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Created By Name",
                        value: "created_by_name"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Scheduled",
                        value: "date_scheduled"
                    },
                    {
                        name: "Date Sent",
                        value: "date_sent"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "Direction",
                        value: "direction"
                    },
                    {
                        name: "Error Message",
                        value: "error_message"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Lead ID",
                        value: "lead_id"
                    },
                    {
                        name: "Local Country ISO",
                        value: "local_country_iso"
                    },
                    {
                        name: "Local Phone",
                        value: "local_phone"
                    },
                    {
                        name: "Local Phone Formatted",
                        value: "local_phone_formatted"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Remote Country ISO",
                        value: "remote_country_iso"
                    },
                    {
                        name: "Remote Phone",
                        value: "remote_phone"
                    },
                    {
                        name: "Remote Phone Formatted",
                        value: "remote_phone_formatted"
                    },
                    {
                        name: "Sequence ID",
                        value: "sequence_id"
                    },
                    {
                        name: "Sequence Name",
                        value: "sequence_name"
                    },
                    {
                        name: "Sequence Subscription ID",
                        value: "sequence_subscription_id"
                    },
                    {
                        name: "Source",
                        value: "source"
                    },
                    {
                        name: "Status",
                        value: "status"
                    },
                    {
                        name: "Template ID",
                        value: "template_id"
                    },
                    {
                        name: "Text",
                        value: "text"
                    },
                    {
                        name: "Type",
                        value: "_type"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    },
                    {
                        name: "Updated By Name",
                        value: "updated_by_name"
                    },
                    {
                        name: "User ID",
                        value: "user_id"
                    },
                    {
                        name: "User Name",
                        value: "user_name"
                    },
                    {
                        name: "Users",
                        value: "users"
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesSms"
                        ],
                        operation: [
                            "activities.sms_list"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Activity At Gt",
                        name: "activity_at__gt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Gte",
                        name: "activity_at__gte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Lt",
                        name: "activity_at__lt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Lte",
                        name: "activity_at__lte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Contact ID",
                        name: "contact_id",
                        type: "json",
                        default: [],
                        description: "Filter by contact IDs (comma-separated)"
                    },
                    {
                        displayName: "Date Created Gt",
                        name: "date_created__gt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Gte",
                        name: "date_created__gte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Lt",
                        name: "date_created__lt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Lte",
                        name: "date_created__lte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    },
                    {
                        displayName: "ID In",
                        name: "id__in",
                        type: "json",
                        default: [],
                        description: "Filter by activity IDs (comma-separated)"
                    },
                    {
                        displayName: "Lead ID",
                        name: "lead_id",
                        type: "json",
                        default: [],
                        description: "Filter by lead IDs (comma-separated)"
                    },
                    {
                        displayName: "Limit",
                        name: "_limit",
                        type: "number",
                        default: 100,
                        description: "Number of results to return"
                    },
                    {
                        displayName: "Organization ID",
                        name: "organization_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Skip",
                        name: "_skip",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip before returning, for pagination"
                    },
                    {
                        displayName: "Type",
                        name: "_type",
                        type: "json",
                        default: [],
                        description: "Filter by activity type, e.g. call (comma-separated)"
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "json",
                        default: [],
                        description: "Filter by user IDs (comma-separated)"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesTaskCompletions"
                        ]
                    }
                },
                default: "activities.task_completions_list",
                options: [
                    {
                        name: "List Task Completions",
                        value: "activities.task_completions_list",
                        action: "List task completions activities task completions",
                        description: "Lists completed task activities that match the supplied filters. activities task completions."
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesTaskCompletions"
                        ],
                        operation: [
                            "activities.task_completions_list"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Activity At Gt",
                        name: "activity_at__gt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Gte",
                        name: "activity_at__gte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Lt",
                        name: "activity_at__lt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Lte",
                        name: "activity_at__lte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Contact ID",
                        name: "contact_id",
                        type: "json",
                        default: [],
                        description: "Filter by contact IDs (comma-separated)"
                    },
                    {
                        displayName: "Date Created Gt",
                        name: "date_created__gt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Gte",
                        name: "date_created__gte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Lt",
                        name: "date_created__lt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Lte",
                        name: "date_created__lte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    },
                    {
                        displayName: "ID In",
                        name: "id__in",
                        type: "json",
                        default: [],
                        description: "Filter by activity IDs (comma-separated)"
                    },
                    {
                        displayName: "Lead ID",
                        name: "lead_id",
                        type: "json",
                        default: [],
                        description: "Filter by lead IDs (comma-separated)"
                    },
                    {
                        displayName: "Limit",
                        name: "_limit",
                        type: "number",
                        default: 100,
                        description: "Number of results to return"
                    },
                    {
                        displayName: "Organization ID",
                        name: "organization_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Skip",
                        name: "_skip",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip before returning, for pagination"
                    },
                    {
                        displayName: "Type",
                        name: "_type",
                        type: "json",
                        default: [],
                        description: "Filter by activity type, e.g. call (comma-separated)"
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "json",
                        default: [],
                        description: "Filter by user IDs (comma-separated)"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesWhatsappMessages"
                        ]
                    }
                },
                default: "activities.whatsapp_messages_create",
                options: [
                    {
                        name: "Create WhatsApp Message",
                        value: "activities.whatsapp_messages_create",
                        action: "Create whatsapp message activities whatsapp messages",
                        description: "Creates a whatsapp message activity. activities whatsapp messages."
                    },
                    {
                        name: "Find WhatsApp Messages",
                        value: "activities.whatsapp_messages_list",
                        action: "Find whatsapp messages activities whatsapp messages",
                        description: "Finds whatsapp message activities that match the supplied filters. activities whatsapp messages."
                    },
                    {
                        name: "Get WhatsApp Message",
                        value: "activities.whatsapp_messages_get",
                        action: "Get whatsapp message activities whatsapp messages",
                        description: "Returns a whatsapp message activity by ID. activities whatsapp messages."
                    }
                ]
            },
            {
                displayName: "Activity At",
                name: "activity_at",
                type: "dateTime",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesWhatsappMessages"
                        ],
                        operation: [
                            "activities.whatsapp_messages_create"
                        ]
                    }
                }
            },
            {
                displayName: "Contact ID",
                name: "contact_id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesWhatsappMessages"
                        ],
                        operation: [
                            "activities.whatsapp_messages_create"
                        ]
                    }
                }
            },
            {
                displayName: "Direction",
                name: "direction",
                type: "options",
                default: "incoming",
                required: true,
                description: "Direction of communication. outgoing means the communication flowing from the user to the lead/contact. inbound means the opposite.",
                options: [
                    {
                        name: "Incoming",
                        value: "incoming"
                    },
                    {
                        name: "Outgoing",
                        value: "outgoing"
                    }
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesWhatsappMessages"
                        ],
                        operation: [
                            "activities.whatsapp_messages_create"
                        ]
                    }
                }
            },
            {
                displayName: "External Whatsapp Message ID",
                name: "external_whatsapp_message_id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesWhatsappMessages"
                        ],
                        operation: [
                            "activities.whatsapp_messages_create"
                        ]
                    }
                }
            },
            {
                displayName: "Lead ID",
                name: "lead_id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesWhatsappMessages"
                        ],
                        operation: [
                            "activities.whatsapp_messages_create"
                        ]
                    }
                }
            },
            {
                displayName: "Local Phone",
                name: "local_phone",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesWhatsappMessages"
                        ],
                        operation: [
                            "activities.whatsapp_messages_create"
                        ]
                    }
                }
            },
            {
                displayName: "Message Markdown",
                name: "message_markdown",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesWhatsappMessages"
                        ],
                        operation: [
                            "activities.whatsapp_messages_create"
                        ]
                    }
                }
            },
            {
                displayName: "Remote Phone",
                name: "remote_phone",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesWhatsappMessages"
                        ],
                        operation: [
                            "activities.whatsapp_messages_create"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesWhatsappMessages"
                        ],
                        operation: [
                            "activities.whatsapp_messages_create"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Attachments",
                        name: "attachments",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Integration Link",
                        name: "integration_link",
                        type: "string",
                        default: "",
                        hint: "Expected format: uri"
                    },
                    {
                        displayName: "Response To ID",
                        name: "response_to_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Send To Inbox",
                        name: "send_to_inbox",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable send to inbox"
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesWhatsappMessages"
                        ],
                        operation: [
                            "activities.whatsapp_messages_create"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "_type",
                    "activity_at",
                    "contact_id",
                    "created_by",
                    "created_by_name",
                    "date_created",
                    "date_updated",
                    "direction",
                    "external_whatsapp_message_id"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesWhatsappMessages"
                        ],
                        operation: [
                            "activities.whatsapp_messages_create"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Activity At",
                        value: "activity_at"
                    },
                    {
                        name: "Attachments",
                        value: "attachments"
                    },
                    {
                        name: "Contact ID",
                        value: "contact_id"
                    },
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Created By Name",
                        value: "created_by_name"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "Direction",
                        value: "direction"
                    },
                    {
                        name: "External Whatsapp Message ID",
                        value: "external_whatsapp_message_id"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Integration Link",
                        value: "integration_link"
                    },
                    {
                        name: "Integration Name",
                        value: "integration_name"
                    },
                    {
                        name: "Lead ID",
                        value: "lead_id"
                    },
                    {
                        name: "Local Phone",
                        value: "local_phone"
                    },
                    {
                        name: "Local Phone Formatted",
                        value: "local_phone_formatted"
                    },
                    {
                        name: "Message HTML",
                        value: "message_html"
                    },
                    {
                        name: "Message Markdown",
                        value: "message_markdown"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Remote Phone",
                        value: "remote_phone"
                    },
                    {
                        name: "Remote Phone Formatted",
                        value: "remote_phone_formatted"
                    },
                    {
                        name: "Response To ID",
                        value: "response_to_id"
                    },
                    {
                        name: "Sequence ID",
                        value: "sequence_id"
                    },
                    {
                        name: "Sequence Name",
                        value: "sequence_name"
                    },
                    {
                        name: "Sequence Subscription ID",
                        value: "sequence_subscription_id"
                    },
                    {
                        name: "Source",
                        value: "source"
                    },
                    {
                        name: "Text",
                        value: "text"
                    },
                    {
                        name: "Type",
                        value: "_type"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    },
                    {
                        name: "Updated By Name",
                        value: "updated_by_name"
                    },
                    {
                        name: "User ID",
                        value: "user_id"
                    },
                    {
                        name: "User Name",
                        value: "user_name"
                    },
                    {
                        name: "Users",
                        value: "users"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesWhatsappMessages"
                        ],
                        operation: [
                            "activities.whatsapp_messages_get"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesWhatsappMessages"
                        ],
                        operation: [
                            "activities.whatsapp_messages_get"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesWhatsappMessages"
                        ],
                        operation: [
                            "activities.whatsapp_messages_get"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "_type",
                    "activity_at",
                    "contact_id",
                    "created_by",
                    "created_by_name",
                    "date_created",
                    "date_updated",
                    "direction",
                    "external_whatsapp_message_id"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesWhatsappMessages"
                        ],
                        operation: [
                            "activities.whatsapp_messages_get"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Activity At",
                        value: "activity_at"
                    },
                    {
                        name: "Attachments",
                        value: "attachments"
                    },
                    {
                        name: "Contact ID",
                        value: "contact_id"
                    },
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Created By Name",
                        value: "created_by_name"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "Direction",
                        value: "direction"
                    },
                    {
                        name: "External Whatsapp Message ID",
                        value: "external_whatsapp_message_id"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Integration Link",
                        value: "integration_link"
                    },
                    {
                        name: "Integration Name",
                        value: "integration_name"
                    },
                    {
                        name: "Lead ID",
                        value: "lead_id"
                    },
                    {
                        name: "Local Phone",
                        value: "local_phone"
                    },
                    {
                        name: "Local Phone Formatted",
                        value: "local_phone_formatted"
                    },
                    {
                        name: "Message HTML",
                        value: "message_html"
                    },
                    {
                        name: "Message Markdown",
                        value: "message_markdown"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Remote Phone",
                        value: "remote_phone"
                    },
                    {
                        name: "Remote Phone Formatted",
                        value: "remote_phone_formatted"
                    },
                    {
                        name: "Response To ID",
                        value: "response_to_id"
                    },
                    {
                        name: "Sequence ID",
                        value: "sequence_id"
                    },
                    {
                        name: "Sequence Name",
                        value: "sequence_name"
                    },
                    {
                        name: "Sequence Subscription ID",
                        value: "sequence_subscription_id"
                    },
                    {
                        name: "Source",
                        value: "source"
                    },
                    {
                        name: "Text",
                        value: "text"
                    },
                    {
                        name: "Type",
                        value: "_type"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    },
                    {
                        name: "Updated By Name",
                        value: "updated_by_name"
                    },
                    {
                        name: "User ID",
                        value: "user_id"
                    },
                    {
                        name: "User Name",
                        value: "user_name"
                    },
                    {
                        name: "Users",
                        value: "users"
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "activitiesWhatsappMessages"
                        ],
                        operation: [
                            "activities.whatsapp_messages_list"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Activity At Gt",
                        name: "activity_at__gt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Gte",
                        name: "activity_at__gte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Lt",
                        name: "activity_at__lt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Activity At Lte",
                        name: "activity_at__lte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Contact ID",
                        name: "contact_id",
                        type: "json",
                        default: [],
                        description: "Filter by contact IDs (comma-separated)"
                    },
                    {
                        displayName: "Date Created Gt",
                        name: "date_created__gt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Gte",
                        name: "date_created__gte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Lt",
                        name: "date_created__lt",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "Date Created Lte",
                        name: "date_created__lte",
                        type: "json",
                        default: {
                            schemaAlternative: "",
                            value: ""
                        }
                    },
                    {
                        displayName: "External Whatsapp Message ID",
                        name: "external_whatsapp_message_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    },
                    {
                        displayName: "ID In",
                        name: "id__in",
                        type: "json",
                        default: [],
                        description: "Filter by activity IDs (comma-separated)"
                    },
                    {
                        displayName: "Lead ID",
                        name: "lead_id",
                        type: "json",
                        default: [],
                        description: "Filter by lead IDs (comma-separated)"
                    },
                    {
                        displayName: "Limit",
                        name: "_limit",
                        type: "number",
                        default: 100,
                        description: "Number of results to return"
                    },
                    {
                        displayName: "Organization ID",
                        name: "organization_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Skip",
                        name: "_skip",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip before returning, for pagination"
                    },
                    {
                        displayName: "Type",
                        name: "_type",
                        type: "json",
                        default: [],
                        description: "Filter by activity type, e.g. call (comma-separated)"
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "json",
                        default: [],
                        description: "Filter by user IDs (comma-separated)"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "bulkActionsEdit"
                        ]
                    }
                },
                default: "bulk_actions.edit_create",
                options: [
                    {
                        name: "Create Bulk Action",
                        value: "bulk_actions.edit_create",
                        action: "Create bulk action bulk actions edit",
                        description: "Starts a bulk edit for lead statuses or custom fields. bulk actions edit."
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "bulkActionsEdit"
                        ],
                        operation: [
                            "bulk_actions.edit_create"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "status",
                    "type",
                    "created_by",
                    "custom_field_name",
                    "custom_field_value",
                    "date_created",
                    "date_updated",
                    "lead_status_id",
                    "n_leads"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "bulkActionsEdit"
                        ],
                        operation: [
                            "bulk_actions.edit_create"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Custom Field Name",
                        value: "custom_field_name"
                    },
                    {
                        name: "Custom Field Value",
                        value: "custom_field_value"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Lead Status ID",
                        value: "lead_status_id"
                    },
                    {
                        name: "N Leads",
                        value: "n_leads"
                    },
                    {
                        name: "N Leads Processed",
                        value: "n_leads_processed"
                    },
                    {
                        name: "N Objects",
                        value: "n_objects"
                    },
                    {
                        name: "N Objects Processed",
                        value: "n_objects_processed"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Query",
                        value: "query"
                    },
                    {
                        name: "Results Limit",
                        value: "results_limit"
                    },
                    {
                        name: "S Query",
                        value: "s_query"
                    },
                    {
                        name: "Send Done Email",
                        value: "send_done_email"
                    },
                    {
                        name: "Sort",
                        value: "sort"
                    },
                    {
                        name: "Status",
                        value: "status"
                    },
                    {
                        name: "Type",
                        value: "type"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "bulkActionsEmail"
                        ]
                    }
                },
                default: "bulk_actions.email_create",
                options: [
                    {
                        name: "Create Bulk Email",
                        value: "bulk_actions.email_create",
                        action: "Create bulk email bulk actions email",
                        description: "Starts a bulk email for the selected lead search. bulk actions email."
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "bulkActionsEmail"
                        ],
                        operation: [
                            "bulk_actions.email_create"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "status",
                    "contact_preference",
                    "created_by",
                    "date_created",
                    "date_updated",
                    "email_account_id",
                    "n_leads",
                    "n_leads_processed",
                    "n_objects"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "bulkActionsEmail"
                        ],
                        operation: [
                            "bulk_actions.email_create"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Contact Preference",
                        value: "contact_preference"
                    },
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "Email Account ID",
                        value: "email_account_id"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "N Leads",
                        value: "n_leads"
                    },
                    {
                        name: "N Leads Processed",
                        value: "n_leads_processed"
                    },
                    {
                        name: "N Objects",
                        value: "n_objects"
                    },
                    {
                        name: "N Objects Processed",
                        value: "n_objects_processed"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Query",
                        value: "query"
                    },
                    {
                        name: "Results Limit",
                        value: "results_limit"
                    },
                    {
                        name: "S Query",
                        value: "s_query"
                    },
                    {
                        name: "Send Done Email",
                        value: "send_done_email"
                    },
                    {
                        name: "Sender",
                        value: "sender"
                    },
                    {
                        name: "Sort",
                        value: "sort"
                    },
                    {
                        name: "Status",
                        value: "status"
                    },
                    {
                        name: "Template ID",
                        value: "template_id"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "bulkActionsSequenceSubscriptions"
                        ]
                    }
                },
                default: "bulk_actions.sequence_subscriptions_create",
                options: [
                    {
                        name: "Create Bulk Workflow Subscription Action",
                        value: "bulk_actions.sequence_subscriptions_create",
                        action: "Create bulk workflow subscription action bulk actions sequence subscriptions",
                        description: "Starts a bulk action to subscribe contacts to a sequence. bulk actions sequence subscriptions."
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "bulkActionsSequenceSubscriptions"
                        ],
                        operation: [
                            "bulk_actions.sequence_subscriptions_create"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "status",
                    "action_type",
                    "caller_id_mode",
                    "contact_preference",
                    "created_by",
                    "date_created",
                    "date_updated",
                    "from_phone_number_id",
                    "n_leads"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "bulkActionsSequenceSubscriptions"
                        ],
                        operation: [
                            "bulk_actions.sequence_subscriptions_create"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Action Type",
                        value: "action_type"
                    },
                    {
                        name: "Caller ID Mode",
                        value: "caller_id_mode"
                    },
                    {
                        name: "Calls Assigned To",
                        value: "calls_assigned_to"
                    },
                    {
                        name: "Contact Preference",
                        value: "contact_preference"
                    },
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "From Phone Number ID",
                        value: "from_phone_number_id"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "N Leads",
                        value: "n_leads"
                    },
                    {
                        name: "N Leads Processed",
                        value: "n_leads_processed"
                    },
                    {
                        name: "N Objects",
                        value: "n_objects"
                    },
                    {
                        name: "N Objects Processed",
                        value: "n_objects_processed"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Query",
                        value: "query"
                    },
                    {
                        name: "Results Limit",
                        value: "results_limit"
                    },
                    {
                        name: "S Query",
                        value: "s_query"
                    },
                    {
                        name: "Send Done Email",
                        value: "send_done_email"
                    },
                    {
                        name: "Sender Account ID",
                        value: "sender_account_id"
                    },
                    {
                        name: "Sender Email",
                        value: "sender_email"
                    },
                    {
                        name: "Sender Name",
                        value: "sender_name"
                    },
                    {
                        name: "Sequence ID",
                        value: "sequence_id"
                    },
                    {
                        name: "Sort",
                        value: "sort"
                    },
                    {
                        name: "Status",
                        value: "status"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "connectedAccounts"
                        ]
                    }
                },
                default: "connected_accounts_get",
                options: [
                    {
                        name: "Find",
                        value: "connected_accounts_list",
                        action: "Find connected accounts",
                        description: "Finds connected accounts that match the supplied filters"
                    },
                    {
                        name: "Get",
                        value: "connected_accounts_get",
                        action: "Get connected account",
                        description: "Returns a connected account by ID"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "connectedAccounts"
                        ],
                        operation: [
                            "connected_accounts_get"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "connectedAccounts"
                        ],
                        operation: [
                            "connected_accounts_get"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "json",
                        default: []
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "connectedAccounts"
                        ],
                        operation: [
                            "connected_accounts_list"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "contacts"
                        ]
                    }
                },
                default: "contacts_create",
                options: [
                    {
                        name: "Create",
                        value: "contacts_create",
                        action: "Create contact",
                        description: "Creates a contact on a lead"
                    },
                    {
                        name: "Find",
                        value: "contacts_list",
                        action: "Find contacts",
                        description: "Finds contacts that match the supplied filters"
                    },
                    {
                        name: "Get",
                        value: "contacts_get",
                        action: "Get contact",
                        description: "Returns a contact by ID"
                    },
                    {
                        name: "Update",
                        value: "contacts_update",
                        action: "Update contact",
                        description: "Updates an existing contact"
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "contacts"
                        ],
                        operation: [
                            "contacts_create"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Created By",
                        name: "created_by",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Created",
                        name: "date_created",
                        type: "dateTime",
                        default: ""
                    },
                    {
                        displayName: "Emails",
                        name: "emails",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    },
                    {
                        displayName: "Lead ID",
                        name: "lead_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Name",
                        name: "name",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Phones",
                        name: "phones",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "",
                        description: "Iana timezone identifier"
                    },
                    {
                        displayName: "Title",
                        name: "title",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "URLs",
                        name: "urls",
                        type: "json",
                        default: []
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "contacts"
                        ],
                        operation: [
                            "contacts_create"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "name",
                    "title",
                    "created_by",
                    "date_created",
                    "date_updated",
                    "display_name",
                    "lead_id",
                    "lead_suggestions_operation_id",
                    "organization_id"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "contacts"
                        ],
                        operation: [
                            "contacts_create"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "Display Name",
                        value: "display_name"
                    },
                    {
                        name: "Emails",
                        value: "emails"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Integration Links",
                        value: "integration_links"
                    },
                    {
                        name: "Lead ID",
                        value: "lead_id"
                    },
                    {
                        name: "Lead Suggestions Operation ID",
                        value: "lead_suggestions_operation_id"
                    },
                    {
                        name: "Name",
                        value: "name"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Phones",
                        value: "phones"
                    },
                    {
                        name: "Recent Calls",
                        value: "recent_calls"
                    },
                    {
                        name: "Subscriptions",
                        value: "subscriptions"
                    },
                    {
                        name: "Timezone",
                        value: "timezone"
                    },
                    {
                        name: "Timezone Source",
                        value: "timezone_source"
                    },
                    {
                        name: "Title",
                        value: "title"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    },
                    {
                        name: "URLs",
                        value: "urls"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "contacts"
                        ],
                        operation: [
                            "contacts_get"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "contacts"
                        ],
                        operation: [
                            "contacts_get"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "contacts"
                        ],
                        operation: [
                            "contacts_get"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "name",
                    "title",
                    "created_by",
                    "date_created",
                    "date_updated",
                    "display_name",
                    "lead_id",
                    "lead_suggestions_operation_id",
                    "organization_id"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "contacts"
                        ],
                        operation: [
                            "contacts_get"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "Display Name",
                        value: "display_name"
                    },
                    {
                        name: "Emails",
                        value: "emails"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Integration Links",
                        value: "integration_links"
                    },
                    {
                        name: "Lead ID",
                        value: "lead_id"
                    },
                    {
                        name: "Lead Suggestions Operation ID",
                        value: "lead_suggestions_operation_id"
                    },
                    {
                        name: "Name",
                        value: "name"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Phones",
                        value: "phones"
                    },
                    {
                        name: "Recent Calls",
                        value: "recent_calls"
                    },
                    {
                        name: "Subscriptions",
                        value: "subscriptions"
                    },
                    {
                        name: "Timezone",
                        value: "timezone"
                    },
                    {
                        name: "Timezone Source",
                        value: "timezone_source"
                    },
                    {
                        name: "Title",
                        value: "title"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    },
                    {
                        name: "URLs",
                        value: "urls"
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "contacts"
                        ],
                        operation: [
                            "contacts_list"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    },
                    {
                        displayName: "Lead ID",
                        name: "lead_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Limit",
                        name: "_limit",
                        type: "number",
                        default: 100,
                        description: "Number of results to return"
                    },
                    {
                        displayName: "Skip",
                        name: "_skip",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip before returning, for pagination"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "contacts"
                        ],
                        operation: [
                            "contacts_update"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "contacts"
                        ],
                        operation: [
                            "contacts_update"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Emails",
                        name: "emails",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    },
                    {
                        displayName: "Lead ID",
                        name: "lead_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Name",
                        name: "name",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Phones",
                        name: "phones",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "",
                        description: "Iana timezone identifier"
                    },
                    {
                        displayName: "Title",
                        name: "title",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "URLs",
                        name: "urls",
                        type: "json",
                        default: []
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "contacts"
                        ],
                        operation: [
                            "contacts_update"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "name",
                    "title",
                    "created_by",
                    "date_created",
                    "date_updated",
                    "display_name",
                    "lead_id",
                    "lead_suggestions_operation_id",
                    "organization_id"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "contacts"
                        ],
                        operation: [
                            "contacts_update"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "Display Name",
                        value: "display_name"
                    },
                    {
                        name: "Emails",
                        value: "emails"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Integration Links",
                        value: "integration_links"
                    },
                    {
                        name: "Lead ID",
                        value: "lead_id"
                    },
                    {
                        name: "Lead Suggestions Operation ID",
                        value: "lead_suggestions_operation_id"
                    },
                    {
                        name: "Name",
                        value: "name"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Phones",
                        value: "phones"
                    },
                    {
                        name: "Recent Calls",
                        value: "recent_calls"
                    },
                    {
                        name: "Subscriptions",
                        value: "subscriptions"
                    },
                    {
                        name: "Timezone",
                        value: "timezone"
                    },
                    {
                        name: "Timezone Source",
                        value: "timezone_source"
                    },
                    {
                        name: "Title",
                        value: "title"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    },
                    {
                        name: "URLs",
                        value: "urls"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "customObjects"
                        ]
                    }
                },
                default: "custom_objects_create",
                options: [
                    {
                        name: "Create",
                        value: "custom_objects_create",
                        action: "Create custom object",
                        description: "Creates a custom object for a lead"
                    },
                    {
                        name: "Find",
                        value: "custom_objects_list",
                        action: "Find custom objects",
                        description: "Finds custom objects that match the supplied filters"
                    },
                    {
                        name: "Get",
                        value: "custom_objects_get",
                        action: "Get custom object",
                        description: "Returns a custom object by ID"
                    },
                    {
                        name: "Update",
                        value: "custom_objects_update",
                        action: "Update custom object",
                        description: "Updates an existing custom object"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "customObjects"
                        ],
                        operation: [
                            "custom_objects_get"
                        ]
                    }
                }
            },
            {
                displayName: "Lead ID",
                name: "lead_id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "customObjects"
                        ],
                        operation: [
                            "custom_objects_list"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "customObjects"
                        ],
                        operation: [
                            "custom_objects_list"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Custom Object Type ID",
                        name: "custom_object_type_id",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "customObjects"
                        ],
                        operation: [
                            "custom_objects_update"
                        ]
                    }
                }
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "events"
                        ]
                    }
                },
                default: "events_list",
                options: [
                    {
                        name: "List",
                        value: "events_list",
                        action: "List events",
                        description: "Lists events that match the supplied filters"
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "events"
                        ],
                        operation: [
                            "events_list"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Action",
                        name: "action",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Updated Gt",
                        name: "date_updated__gt",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Updated Gte",
                        name: "date_updated__gte",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Updated Lt",
                        name: "date_updated__lt",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Updated Lte",
                        name: "date_updated__lte",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Lead ID",
                        name: "lead_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Limit",
                        name: "_limit",
                        type: "number",
                        default: 100,
                        description: "Number of results to return"
                    },
                    {
                        displayName: "Object ID",
                        name: "object_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Object Type",
                        name: "object_type",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Skip",
                        name: "_skip",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip before returning, for pagination"
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "exports"
                        ]
                    }
                },
                default: "exports_create_lead",
                options: [
                    {
                        name: "Create Lead",
                        value: "exports_create_lead",
                        action: "Create lead export",
                        description: "Creates an export for leads that match the supplied filters"
                    },
                    {
                        name: "Create Opportunity",
                        value: "exports_create_opportunity",
                        action: "Create opportunity export",
                        description: "Creates an export for opportunities that match the supplied filters"
                    },
                    {
                        name: "List",
                        value: "exports_list",
                        action: "List exports",
                        description: "Lists exports and their status"
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "exports"
                        ],
                        operation: [
                            "exports_create_lead"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "status",
                    "type",
                    "created_by",
                    "date_created",
                    "date_format",
                    "date_updated",
                    "download_url",
                    "format",
                    "limit"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "exports"
                        ],
                        operation: [
                            "exports_create_lead"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Format",
                        value: "date_format"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "Download URL",
                        value: "download_url"
                    },
                    {
                        name: "Fields",
                        value: "fields"
                    },
                    {
                        name: "Format",
                        value: "format"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Limit",
                        value: "limit"
                    },
                    {
                        name: "N Docs",
                        value: "n_docs"
                    },
                    {
                        name: "N Docs Processed",
                        value: "n_docs_processed"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Params",
                        value: "params"
                    },
                    {
                        name: "Query",
                        value: "query"
                    },
                    {
                        name: "Results Limit",
                        value: "results_limit"
                    },
                    {
                        name: "S Query",
                        value: "s_query"
                    },
                    {
                        name: "Send Done Email",
                        value: "send_done_email"
                    },
                    {
                        name: "Sort",
                        value: "sort"
                    },
                    {
                        name: "Status",
                        value: "status"
                    },
                    {
                        name: "Type",
                        value: "type"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "exports"
                        ],
                        operation: [
                            "exports_create_opportunity"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "status",
                    "type",
                    "created_by",
                    "date_created",
                    "date_format",
                    "date_updated",
                    "download_url",
                    "format",
                    "limit"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "exports"
                        ],
                        operation: [
                            "exports_create_opportunity"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Format",
                        value: "date_format"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "Download URL",
                        value: "download_url"
                    },
                    {
                        name: "Fields",
                        value: "fields"
                    },
                    {
                        name: "Format",
                        value: "format"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Limit",
                        value: "limit"
                    },
                    {
                        name: "N Docs",
                        value: "n_docs"
                    },
                    {
                        name: "N Docs Processed",
                        value: "n_docs_processed"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Params",
                        value: "params"
                    },
                    {
                        name: "Query",
                        value: "query"
                    },
                    {
                        name: "Results Limit",
                        value: "results_limit"
                    },
                    {
                        name: "S Query",
                        value: "s_query"
                    },
                    {
                        name: "Send Done Email",
                        value: "send_done_email"
                    },
                    {
                        name: "Sort",
                        value: "sort"
                    },
                    {
                        name: "Status",
                        value: "status"
                    },
                    {
                        name: "Type",
                        value: "type"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "exports"
                        ],
                        operation: [
                            "exports_list"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    },
                    {
                        displayName: "Limit",
                        name: "_limit",
                        type: "number",
                        default: 100,
                        description: "Number of results to return"
                    },
                    {
                        displayName: "Skip",
                        name: "_skip",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip before returning, for pagination"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "groups"
                        ]
                    }
                },
                default: "groups_get",
                options: [
                    {
                        name: "Find",
                        value: "groups_list",
                        action: "Find groups",
                        description: "Finds groups that match the supplied filters"
                    },
                    {
                        name: "Get",
                        value: "groups_get",
                        action: "Get group",
                        description: "Returns a group by ID"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "groups"
                        ],
                        operation: [
                            "groups_get"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "groups"
                        ],
                        operation: [
                            "groups_get"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "groups"
                        ],
                        operation: [
                            "groups_list"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "leads"
                        ]
                    }
                },
                default: "leads_create",
                options: [
                    {
                        name: "Create",
                        value: "leads_create",
                        action: "Create lead",
                        description: "Creates a lead with the supplied details"
                    },
                    {
                        name: "Find",
                        value: "leads_list",
                        action: "Find leads",
                        description: "Finds leads that match the supplied filters"
                    },
                    {
                        name: "Get",
                        value: "leads_get",
                        action: "Get lead",
                        description: "Returns a lead by ID"
                    },
                    {
                        name: "Merge Two",
                        value: "leads_merge",
                        action: "Merge two leads",
                        description: "Merges one lead into another"
                    },
                    {
                        name: "Update",
                        value: "leads_update",
                        action: "Update lead",
                        description: "Updates an existing lead"
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "leads"
                        ],
                        operation: [
                            "leads_create"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "name",
                    "description",
                    "contacts_summary",
                    "created_by",
                    "created_by_name",
                    "date_created",
                    "date_updated",
                    "display_name",
                    "html_url"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "leads"
                        ],
                        operation: [
                            "leads_create"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Addresses",
                        value: "addresses"
                    },
                    {
                        name: "Contact IDs",
                        value: "contact_ids"
                    },
                    {
                        name: "Contacts",
                        value: "contacts"
                    },
                    {
                        name: "Contacts Summary",
                        value: "contacts_summary"
                    },
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Created By Name",
                        value: "created_by_name"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "Description",
                        value: "description"
                    },
                    {
                        name: "Display Name",
                        value: "display_name"
                    },
                    {
                        name: "HTML URL",
                        value: "html_url"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Integration Links",
                        value: "integration_links"
                    },
                    {
                        name: "Localtime",
                        value: "localtime"
                    },
                    {
                        name: "Name",
                        value: "name"
                    },
                    {
                        name: "Opportunities",
                        value: "opportunities"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Primary Address Full",
                        value: "primary_address_full"
                    },
                    {
                        name: "Primary Address Summary",
                        value: "primary_address_summary"
                    },
                    {
                        name: "Primary Email",
                        value: "primary_email"
                    },
                    {
                        name: "Primary Phone",
                        value: "primary_phone"
                    },
                    {
                        name: "Recent Calls",
                        value: "recent_calls"
                    },
                    {
                        name: "Source",
                        value: "source"
                    },
                    {
                        name: "Status ID",
                        value: "status_id"
                    },
                    {
                        name: "Status Label",
                        value: "status_label"
                    },
                    {
                        name: "Summaries",
                        value: "summaries"
                    },
                    {
                        name: "Tasks",
                        value: "tasks"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    },
                    {
                        name: "Updated By Name",
                        value: "updated_by_name"
                    },
                    {
                        name: "URL",
                        value: "url"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "leads"
                        ],
                        operation: [
                            "leads_get"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "leads"
                        ],
                        operation: [
                            "leads_get"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "leads"
                        ],
                        operation: [
                            "leads_get"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "name",
                    "description",
                    "contacts_summary",
                    "created_by",
                    "created_by_name",
                    "date_created",
                    "date_updated",
                    "display_name",
                    "html_url"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "leads"
                        ],
                        operation: [
                            "leads_get"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Addresses",
                        value: "addresses"
                    },
                    {
                        name: "Contact IDs",
                        value: "contact_ids"
                    },
                    {
                        name: "Contacts",
                        value: "contacts"
                    },
                    {
                        name: "Contacts Summary",
                        value: "contacts_summary"
                    },
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Created By Name",
                        value: "created_by_name"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "Description",
                        value: "description"
                    },
                    {
                        name: "Display Name",
                        value: "display_name"
                    },
                    {
                        name: "HTML URL",
                        value: "html_url"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Integration Links",
                        value: "integration_links"
                    },
                    {
                        name: "Localtime",
                        value: "localtime"
                    },
                    {
                        name: "Name",
                        value: "name"
                    },
                    {
                        name: "Opportunities",
                        value: "opportunities"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Primary Address Full",
                        value: "primary_address_full"
                    },
                    {
                        name: "Primary Address Summary",
                        value: "primary_address_summary"
                    },
                    {
                        name: "Primary Email",
                        value: "primary_email"
                    },
                    {
                        name: "Primary Phone",
                        value: "primary_phone"
                    },
                    {
                        name: "Recent Calls",
                        value: "recent_calls"
                    },
                    {
                        name: "Source",
                        value: "source"
                    },
                    {
                        name: "Status ID",
                        value: "status_id"
                    },
                    {
                        name: "Status Label",
                        value: "status_label"
                    },
                    {
                        name: "Summaries",
                        value: "summaries"
                    },
                    {
                        name: "Tasks",
                        value: "tasks"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    },
                    {
                        name: "Updated By Name",
                        value: "updated_by_name"
                    },
                    {
                        name: "URL",
                        value: "url"
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "leads"
                        ],
                        operation: [
                            "leads_list"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    },
                    {
                        displayName: "Limit",
                        name: "_limit",
                        type: "number",
                        default: 100,
                        description: "Number of results to return"
                    },
                    {
                        displayName: "Skip",
                        name: "_skip",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip before returning, for pagination"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "leads"
                        ],
                        operation: [
                            "leads_update"
                        ]
                    }
                }
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "leads"
                        ],
                        operation: [
                            "leads_update"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "name",
                    "description",
                    "contacts_summary",
                    "created_by",
                    "created_by_name",
                    "date_created",
                    "date_updated",
                    "display_name",
                    "html_url"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "leads"
                        ],
                        operation: [
                            "leads_update"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Addresses",
                        value: "addresses"
                    },
                    {
                        name: "Contact IDs",
                        value: "contact_ids"
                    },
                    {
                        name: "Contacts",
                        value: "contacts"
                    },
                    {
                        name: "Contacts Summary",
                        value: "contacts_summary"
                    },
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Created By Name",
                        value: "created_by_name"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "Description",
                        value: "description"
                    },
                    {
                        name: "Display Name",
                        value: "display_name"
                    },
                    {
                        name: "HTML URL",
                        value: "html_url"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Integration Links",
                        value: "integration_links"
                    },
                    {
                        name: "Localtime",
                        value: "localtime"
                    },
                    {
                        name: "Name",
                        value: "name"
                    },
                    {
                        name: "Opportunities",
                        value: "opportunities"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Primary Address Full",
                        value: "primary_address_full"
                    },
                    {
                        name: "Primary Address Summary",
                        value: "primary_address_summary"
                    },
                    {
                        name: "Primary Email",
                        value: "primary_email"
                    },
                    {
                        name: "Primary Phone",
                        value: "primary_phone"
                    },
                    {
                        name: "Recent Calls",
                        value: "recent_calls"
                    },
                    {
                        name: "Source",
                        value: "source"
                    },
                    {
                        name: "Status ID",
                        value: "status_id"
                    },
                    {
                        name: "Status Label",
                        value: "status_label"
                    },
                    {
                        name: "Summaries",
                        value: "summaries"
                    },
                    {
                        name: "Tasks",
                        value: "tasks"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    },
                    {
                        name: "Updated By Name",
                        value: "updated_by_name"
                    },
                    {
                        name: "URL",
                        value: "url"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "opportunities"
                        ]
                    }
                },
                default: "opportunities_create",
                options: [
                    {
                        name: "Create",
                        value: "opportunities_create",
                        action: "Create opportunity",
                        description: "Creates an opportunity for a lead"
                    },
                    {
                        name: "Find",
                        value: "opportunities_list",
                        action: "Find opportunities",
                        description: "Finds opportunities that match the supplied filters"
                    },
                    {
                        name: "Get",
                        value: "opportunities_get",
                        action: "Get opportunity",
                        description: "Returns an opportunity by ID"
                    },
                    {
                        name: "Update",
                        value: "opportunities_update",
                        action: "Update opportunity",
                        description: "Updates an existing opportunity"
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "opportunities"
                        ],
                        operation: [
                            "opportunities_create"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Attachments",
                        name: "attachments",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Confidence",
                        name: "confidence",
                        type: "number",
                        default: 0
                    },
                    {
                        displayName: "Contact ID",
                        name: "contact_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Created By",
                        name: "created_by",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Created",
                        name: "date_created",
                        type: "dateTime",
                        default: ""
                    },
                    {
                        displayName: "Date Won",
                        name: "date_won",
                        type: "dateTime",
                        default: "",
                        description: "If omitted when setting status_id to a won status, close sets today's date using the UTC offset in x-tz-offset"
                    },
                    {
                        displayName: "Lead ID",
                        name: "lead_id",
                        type: "string",
                        default: "",
                        description: "Opportunities belong to exactly one lead. if not provided, a new lead will be created (appearing as \"untitled\" in the UI)."
                    },
                    {
                        displayName: "Note",
                        name: "note",
                        type: "string",
                        default: "",
                        description: "Plaintext/markdown version of the note. if `note_html` is also provided in the same request, this value is ignored and `note` is derived from the HTML instead."
                    },
                    {
                        displayName: "Note HTML",
                        name: "note_html",
                        type: "string",
                        default: "",
                        description: "Rich-text HTML version of the note. when set, `note` is automatically populated with the plaintext version (tags become markdown), overriding any `note` value passed in the same request."
                    },
                    {
                        displayName: "Pipeline ID",
                        name: "pipeline_id",
                        type: "string",
                        default: "",
                        description: "ID of the opportunity pipeline. if status_id is also set, it must belong to this pipeline; otherwise the pipeline\u2019s first status is used."
                    },
                    {
                        displayName: "Status ID",
                        name: "status_id",
                        type: "string",
                        default: "",
                        description: "Choose an opportunity status. if omitted, close uses the organization's default status or, when pipeline_id is set, that pipeline's first status. see the opportunity status API."
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Value",
                        name: "value",
                        type: "number",
                        default: 0
                    },
                    {
                        displayName: "Value Period",
                        name: "value_period",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "opportunities"
                        ],
                        operation: [
                            "opportunities_create"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "annualized_expected_value",
                    "annualized_value",
                    "confidence",
                    "contact_id",
                    "contact_name",
                    "created_by",
                    "created_by_name",
                    "date_created",
                    "date_lost"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "opportunities"
                        ],
                        operation: [
                            "opportunities_create"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Annualized Expected Value",
                        value: "annualized_expected_value"
                    },
                    {
                        name: "Annualized Value",
                        value: "annualized_value"
                    },
                    {
                        name: "Attachments",
                        value: "attachments"
                    },
                    {
                        name: "Comment Summary",
                        value: "comment_summary"
                    },
                    {
                        name: "Confidence",
                        value: "confidence"
                    },
                    {
                        name: "Contact ID",
                        value: "contact_id"
                    },
                    {
                        name: "Contact Name",
                        value: "contact_name"
                    },
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Created By Name",
                        value: "created_by_name"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Lost",
                        value: "date_lost"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "Date Won",
                        value: "date_won"
                    },
                    {
                        name: "Expected Value",
                        value: "expected_value"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Integration Links",
                        value: "integration_links"
                    },
                    {
                        name: "Is Stalled",
                        value: "is_stalled"
                    },
                    {
                        name: "Lead ID",
                        value: "lead_id"
                    },
                    {
                        name: "Lead Name",
                        value: "lead_name"
                    },
                    {
                        name: "Lead Primary Email",
                        value: "lead_primary_email"
                    },
                    {
                        name: "Lead Primary Phone",
                        value: "lead_primary_phone"
                    },
                    {
                        name: "Note",
                        value: "note"
                    },
                    {
                        name: "Note HTML",
                        value: "note_html"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Pipeline ID",
                        value: "pipeline_id"
                    },
                    {
                        name: "Pipeline Name",
                        value: "pipeline_name"
                    },
                    {
                        name: "Stall Status",
                        value: "stall_status"
                    },
                    {
                        name: "Status Display Name",
                        value: "status_display_name"
                    },
                    {
                        name: "Status ID",
                        value: "status_id"
                    },
                    {
                        name: "Status Label",
                        value: "status_label"
                    },
                    {
                        name: "Status Type",
                        value: "status_type"
                    },
                    {
                        name: "Suggested Action",
                        value: "suggested_action"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    },
                    {
                        name: "Updated By Name",
                        value: "updated_by_name"
                    },
                    {
                        name: "User ID",
                        value: "user_id"
                    },
                    {
                        name: "User Name",
                        value: "user_name"
                    },
                    {
                        name: "Value",
                        value: "value"
                    },
                    {
                        name: "Value Currency",
                        value: "value_currency"
                    },
                    {
                        name: "Value Formatted",
                        value: "value_formatted"
                    },
                    {
                        name: "Value Period",
                        value: "value_period"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "opportunities"
                        ],
                        operation: [
                            "opportunities_get"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "opportunities"
                        ],
                        operation: [
                            "opportunities_get"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "opportunities"
                        ],
                        operation: [
                            "opportunities_get"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "annualized_expected_value",
                    "annualized_value",
                    "confidence",
                    "contact_id",
                    "contact_name",
                    "created_by",
                    "created_by_name",
                    "date_created",
                    "date_lost"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "opportunities"
                        ],
                        operation: [
                            "opportunities_get"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Annualized Expected Value",
                        value: "annualized_expected_value"
                    },
                    {
                        name: "Annualized Value",
                        value: "annualized_value"
                    },
                    {
                        name: "Attachments",
                        value: "attachments"
                    },
                    {
                        name: "Comment Summary",
                        value: "comment_summary"
                    },
                    {
                        name: "Confidence",
                        value: "confidence"
                    },
                    {
                        name: "Contact ID",
                        value: "contact_id"
                    },
                    {
                        name: "Contact Name",
                        value: "contact_name"
                    },
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Created By Name",
                        value: "created_by_name"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Lost",
                        value: "date_lost"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "Date Won",
                        value: "date_won"
                    },
                    {
                        name: "Expected Value",
                        value: "expected_value"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Integration Links",
                        value: "integration_links"
                    },
                    {
                        name: "Is Stalled",
                        value: "is_stalled"
                    },
                    {
                        name: "Lead ID",
                        value: "lead_id"
                    },
                    {
                        name: "Lead Name",
                        value: "lead_name"
                    },
                    {
                        name: "Lead Primary Email",
                        value: "lead_primary_email"
                    },
                    {
                        name: "Lead Primary Phone",
                        value: "lead_primary_phone"
                    },
                    {
                        name: "Note",
                        value: "note"
                    },
                    {
                        name: "Note HTML",
                        value: "note_html"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Pipeline ID",
                        value: "pipeline_id"
                    },
                    {
                        name: "Pipeline Name",
                        value: "pipeline_name"
                    },
                    {
                        name: "Stall Status",
                        value: "stall_status"
                    },
                    {
                        name: "Status Display Name",
                        value: "status_display_name"
                    },
                    {
                        name: "Status ID",
                        value: "status_id"
                    },
                    {
                        name: "Status Label",
                        value: "status_label"
                    },
                    {
                        name: "Status Type",
                        value: "status_type"
                    },
                    {
                        name: "Suggested Action",
                        value: "suggested_action"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    },
                    {
                        name: "Updated By Name",
                        value: "updated_by_name"
                    },
                    {
                        name: "User ID",
                        value: "user_id"
                    },
                    {
                        name: "User Name",
                        value: "user_name"
                    },
                    {
                        name: "Value",
                        value: "value"
                    },
                    {
                        name: "Value Currency",
                        value: "value_currency"
                    },
                    {
                        name: "Value Formatted",
                        value: "value_formatted"
                    },
                    {
                        name: "Value Period",
                        value: "value_period"
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "opportunities"
                        ],
                        operation: [
                            "opportunities_list"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Date Created",
                        name: "date_created",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Created Gt",
                        name: "date_created__gt",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Created Gte",
                        name: "date_created__gte",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Created Lt",
                        name: "date_created__lt",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Created Lte",
                        name: "date_created__lte",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Updated",
                        name: "date_updated",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Updated Gt",
                        name: "date_updated__gt",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Updated Gte",
                        name: "date_updated__gte",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Updated Lt",
                        name: "date_updated__lt",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Updated Lte",
                        name: "date_updated__lte",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Won",
                        name: "date_won",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Won Gt",
                        name: "date_won__gt",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Won Gte",
                        name: "date_won__gte",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Won Lt",
                        name: "date_won__lt",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Won Lte",
                        name: "date_won__lte",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    },
                    {
                        displayName: "Group By",
                        name: "_group_by",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Is Stalled",
                        name: "is_stalled",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Lead ID",
                        name: "lead_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Lead Query",
                        name: "lead_query",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Lead Saved Search ID",
                        name: "lead_saved_search_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Limit",
                        name: "_limit",
                        type: "number",
                        default: 100,
                        description: "Number of results to return"
                    },
                    {
                        displayName: "Order By",
                        name: "_order_by",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Organization ID",
                        name: "organization_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Query",
                        name: "query",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Skip",
                        name: "_skip",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip before returning, for pagination"
                    },
                    {
                        displayName: "Status",
                        name: "status",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Status ID",
                        name: "status_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Status ID In",
                        name: "status_id__in",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Status In",
                        name: "status__in",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Status Label",
                        name: "status_label",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Status Label In",
                        name: "status_label__in",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Status Type",
                        name: "status_type",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Status Type In",
                        name: "status_type__in",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "User ID In",
                        name: "user_id__in",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Value Period",
                        name: "value_period",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Value Period In",
                        name: "value_period__in",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "opportunities"
                        ],
                        operation: [
                            "opportunities_update"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "opportunities"
                        ],
                        operation: [
                            "opportunities_update"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Attachments",
                        name: "attachments",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Confidence",
                        name: "confidence",
                        type: "number",
                        default: 0
                    },
                    {
                        displayName: "Contact ID",
                        name: "contact_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Won",
                        name: "date_won",
                        type: "dateTime",
                        default: "",
                        description: "If omitted when setting status_id to a won status, close sets today's date using the UTC offset in x-tz-offset"
                    },
                    {
                        displayName: "Note",
                        name: "note",
                        type: "string",
                        default: "",
                        description: "Plaintext/markdown version of the note. if `note_html` is also provided in the same request, this value is ignored and `note` is derived from the HTML instead."
                    },
                    {
                        displayName: "Note HTML",
                        name: "note_html",
                        type: "string",
                        default: "",
                        description: "Rich-text HTML for the note. setting it also generates the plaintext note, overriding any note sent in the same request. pass null to clear note_html and note."
                    },
                    {
                        displayName: "Status",
                        name: "status",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Status ID",
                        name: "status_id",
                        type: "string",
                        default: "",
                        description: "Setting a won status automatically sets date_won if it is unset. changing the status from won to active or lost does not update date_won."
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Value",
                        name: "value",
                        type: "number",
                        default: 0
                    },
                    {
                        displayName: "Value Period",
                        name: "value_period",
                        type: "options",
                        default: "one_time",
                        options: [
                            {
                                name: "Annual",
                                value: "annual"
                            },
                            {
                                name: "Monthly",
                                value: "monthly"
                            },
                            {
                                name: "One Time",
                                value: "one_time"
                            }
                        ]
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "opportunities"
                        ],
                        operation: [
                            "opportunities_update"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "annualized_expected_value",
                    "annualized_value",
                    "confidence",
                    "contact_id",
                    "contact_name",
                    "created_by",
                    "created_by_name",
                    "date_created",
                    "date_lost"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "opportunities"
                        ],
                        operation: [
                            "opportunities_update"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Annualized Expected Value",
                        value: "annualized_expected_value"
                    },
                    {
                        name: "Annualized Value",
                        value: "annualized_value"
                    },
                    {
                        name: "Attachments",
                        value: "attachments"
                    },
                    {
                        name: "Comment Summary",
                        value: "comment_summary"
                    },
                    {
                        name: "Confidence",
                        value: "confidence"
                    },
                    {
                        name: "Contact ID",
                        value: "contact_id"
                    },
                    {
                        name: "Contact Name",
                        value: "contact_name"
                    },
                    {
                        name: "Created By",
                        value: "created_by"
                    },
                    {
                        name: "Created By Name",
                        value: "created_by_name"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Lost",
                        value: "date_lost"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "Date Won",
                        value: "date_won"
                    },
                    {
                        name: "Expected Value",
                        value: "expected_value"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Integration Links",
                        value: "integration_links"
                    },
                    {
                        name: "Is Stalled",
                        value: "is_stalled"
                    },
                    {
                        name: "Lead ID",
                        value: "lead_id"
                    },
                    {
                        name: "Lead Name",
                        value: "lead_name"
                    },
                    {
                        name: "Lead Primary Email",
                        value: "lead_primary_email"
                    },
                    {
                        name: "Lead Primary Phone",
                        value: "lead_primary_phone"
                    },
                    {
                        name: "Note",
                        value: "note"
                    },
                    {
                        name: "Note HTML",
                        value: "note_html"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Pipeline ID",
                        value: "pipeline_id"
                    },
                    {
                        name: "Pipeline Name",
                        value: "pipeline_name"
                    },
                    {
                        name: "Stall Status",
                        value: "stall_status"
                    },
                    {
                        name: "Status Display Name",
                        value: "status_display_name"
                    },
                    {
                        name: "Status ID",
                        value: "status_id"
                    },
                    {
                        name: "Status Label",
                        value: "status_label"
                    },
                    {
                        name: "Status Type",
                        value: "status_type"
                    },
                    {
                        name: "Suggested Action",
                        value: "suggested_action"
                    },
                    {
                        name: "Updated By",
                        value: "updated_by"
                    },
                    {
                        name: "Updated By Name",
                        value: "updated_by_name"
                    },
                    {
                        name: "User ID",
                        value: "user_id"
                    },
                    {
                        name: "User Name",
                        value: "user_name"
                    },
                    {
                        name: "Value",
                        value: "value"
                    },
                    {
                        name: "Value Currency",
                        value: "value_currency"
                    },
                    {
                        name: "Value Formatted",
                        value: "value_formatted"
                    },
                    {
                        name: "Value Period",
                        value: "value_period"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "phoneNumbers"
                        ]
                    }
                },
                default: "phone_numbers_update",
                options: [
                    {
                        name: "Toggle Forwarding On Phone Number",
                        value: "phone_numbers_update",
                        action: "Toggle forwarding on phone number phone numbers",
                        description: "Enables or disables call forwarding for a phone number. phone_numbers."
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "phoneNumbers"
                        ],
                        operation: [
                            "phone_numbers_update"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "phoneNumbers"
                        ],
                        operation: [
                            "phone_numbers_update"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Forward To",
                        name: "forward_to",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Forward To Enabled",
                        name: "forward_to_enabled",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable forward to enabled"
                    },
                    {
                        displayName: "Inbound Ring Duration",
                        name: "inbound_ring_duration",
                        type: "number",
                        default: 0,
                        description: "Number of seconds (15-90) to ring this number on inbound calls before moving on (e.g. to voicemail)",
                        typeOptions: {
                            minValue: 15,
                            maxValue: 90
                        }
                    },
                    {
                        displayName: "Label",
                        name: "label",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Participants",
                        name: "participants",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Phone Numbers",
                        name: "phone_numbers",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Press 1 To Accept",
                        name: "press_1_to_accept",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable press 1 to accept"
                    },
                    {
                        displayName: "Voicemail Greeting URL",
                        name: "voicemail_greeting_url",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "phoneNumbers"
                        ],
                        operation: [
                            "phone_numbers_update"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "type",
                    "address_id",
                    "bundle_id",
                    "carrier",
                    "carrier_type",
                    "country",
                    "date_created",
                    "date_updated",
                    "forward_to"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "phoneNumbers"
                        ],
                        operation: [
                            "phone_numbers_update"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Address ID",
                        value: "address_id"
                    },
                    {
                        name: "Bundle ID",
                        value: "bundle_id"
                    },
                    {
                        name: "Carrier",
                        value: "carrier"
                    },
                    {
                        name: "Carrier Type",
                        value: "carrier_type"
                    },
                    {
                        name: "Country",
                        value: "country"
                    },
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "Forward To",
                        value: "forward_to"
                    },
                    {
                        name: "Forward To Enabled",
                        value: "forward_to_enabled"
                    },
                    {
                        name: "Forward To Formatted",
                        value: "forward_to_formatted"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Inbound Ring Duration",
                        value: "inbound_ring_duration"
                    },
                    {
                        name: "Is Group Number",
                        value: "is_group_number"
                    },
                    {
                        name: "Is Premium",
                        value: "is_premium"
                    },
                    {
                        name: "Is Verified",
                        value: "is_verified"
                    },
                    {
                        name: "Label",
                        value: "label"
                    },
                    {
                        name: "Last Billed Price",
                        value: "last_billed_price"
                    },
                    {
                        name: "Mms Enabled",
                        value: "mms_enabled"
                    },
                    {
                        name: "Next Billing On",
                        value: "next_billing_on"
                    },
                    {
                        name: "Number",
                        value: "number"
                    },
                    {
                        name: "Number Formatted",
                        value: "number_formatted"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Participants",
                        value: "participants"
                    },
                    {
                        name: "Phone Numbers",
                        value: "phone_numbers"
                    },
                    {
                        name: "Phone Numbers Formatted",
                        value: "phone_numbers_formatted"
                    },
                    {
                        name: "Press 1 To Accept",
                        value: "press_1_to_accept"
                    },
                    {
                        name: "SMS Enabled",
                        value: "sms_enabled"
                    },
                    {
                        name: "Supports Mms To Countries",
                        value: "supports_mms_to_countries"
                    },
                    {
                        name: "Supports SMS To Countries",
                        value: "supports_sms_to_countries"
                    },
                    {
                        name: "Type",
                        value: "type"
                    },
                    {
                        name: "User ID",
                        value: "user_id"
                    },
                    {
                        name: "Voicemail Greeting URL",
                        value: "voicemail_greeting_url"
                    },
                    {
                        name: "Was Ported",
                        value: "was_ported"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "reporting"
                        ]
                    }
                },
                default: "reporting_get_activity",
                options: [
                    {
                        name: "Run Activity Report",
                        value: "reporting_get_activity",
                        action: "Run activity report reporting",
                        description: "Generates an activity overview or comparison report for the selected metrics and date range. reporting."
                    },
                    {
                        name: "Run Lead Status Change Report",
                        value: "reporting_get_lead_statuses",
                        action: "Run lead status change report reporting",
                        description: "Returns lead status counts and transitions for the selected filters. reporting."
                    },
                    {
                        name: "Run Opportunity Funnel Report By Stage",
                        value: "reporting_get_funnel_stages",
                        action: "Run opportunity funnel report by stage reporting",
                        description: "Returns opportunity funnel metrics grouped by stage. reporting."
                    },
                    {
                        name: "Run Opportunity Funnel Totals Report",
                        value: "reporting_get_funnel_totals",
                        action: "Run opportunity funnel totals report reporting",
                        description: "Returns totals for the selected opportunity funnel and date range. reporting."
                    },
                    {
                        name: "Run Opportunity Report",
                        value: "reporting_get_custom",
                        action: "Run opportunity report reporting",
                        description: "Builds a custom report from the selected query, metric, breakdown, and date interval. reporting."
                    },
                    {
                        name: "Run Opportunity Status Change Report",
                        value: "reporting_get_opportunity_statuses",
                        action: "Run opportunity status change report reporting",
                        description: "Returns opportunity status counts and transitions for the selected filters. reporting."
                    },
                    {
                        name: "Run Sent Email Report",
                        value: "reporting_get_sent_emails",
                        action: "Run sent email report reporting",
                        description: "Returns sent email metrics for the selected date range and user. reporting."
                    }
                ]
            },
            {
                displayName: "Org ID",
                name: "org_id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "reporting"
                        ],
                        operation: [
                            "reporting_get_custom"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "reporting"
                        ],
                        operation: [
                            "reporting_get_custom"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "End",
                        name: "end",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Group By",
                        name: "group_by",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Interval",
                        name: "interval",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Query",
                        name: "query",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Start",
                        name: "start",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Transform Y",
                        name: "transform_y",
                        type: "options",
                        default: "sum",
                        options: [
                            {
                                name: "Avg",
                                value: "avg"
                            },
                            {
                                name: "Max",
                                value: "max"
                            },
                            {
                                name: "Min",
                                value: "min"
                            },
                            {
                                name: "Sum",
                                value: "sum"
                            }
                        ]
                    },
                    {
                        displayName: "X",
                        name: "x",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Y",
                        name: "y",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "Org ID",
                name: "org_id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "reporting"
                        ],
                        operation: [
                            "reporting_get_lead_statuses"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "reporting"
                        ],
                        operation: [
                            "reporting_get_lead_statuses"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Date End",
                        name: "date_end",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Start",
                        name: "date_start",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Query",
                        name: "query",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Smart View ID",
                        name: "smart_view_id",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "Org ID",
                name: "org_id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "reporting"
                        ],
                        operation: [
                            "reporting_get_opportunity_statuses"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "reporting"
                        ],
                        operation: [
                            "reporting_get_opportunity_statuses"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Date End",
                        name: "date_end",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Start",
                        name: "date_start",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Query",
                        name: "query",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Smart View ID",
                        name: "smart_view_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "Org ID",
                name: "org_id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "reporting"
                        ],
                        operation: [
                            "reporting_get_sent_emails"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "reporting"
                        ],
                        operation: [
                            "reporting_get_sent_emails"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Date End",
                        name: "date_end",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Start",
                        name: "date_start",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "User ID",
                        name: "user_id",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "sequences"
                        ]
                    }
                },
                default: "sequences_create_subscription",
                options: [
                    {
                        name: "Find Workflow Subscriptions",
                        value: "sequences_list_subscriptions",
                        action: "Find workflow subscriptions sequences",
                        description: "Finds workflow subscriptions that match the supplied filters. sequences."
                    },
                    {
                        name: "Get Workflow Subscription",
                        value: "sequences_get_subscription",
                        action: "Get workflow subscription sequences",
                        description: "Returns a workflow subscription by ID. sequences."
                    },
                    {
                        name: "Subscribe Contact To Workflow",
                        value: "sequences_create_subscription",
                        action: "Subscribe contact to workflow sequences",
                        description: "Creates a workflow subscription for a contact. sequences."
                    },
                    {
                        name: "Update Workflow Subscription",
                        value: "sequences_update_subscription",
                        action: "Update workflow subscription sequences",
                        description: "Updates an existing workflow subscription. sequences."
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "sequences"
                        ],
                        operation: [
                            "sequences_get_subscription"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "sequences"
                        ],
                        operation: [
                            "sequences_list_subscriptions"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Contact ID",
                        name: "contact_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Lead ID",
                        name: "lead_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Limit",
                        name: "_limit",
                        type: "number",
                        default: 100,
                        description: "Number of results to return"
                    },
                    {
                        displayName: "Sequence ID",
                        name: "sequence_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Skip",
                        name: "_skip",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip before returning, for pagination"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "sequences"
                        ],
                        operation: [
                            "sequences_update_subscription"
                        ]
                    }
                }
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "smartViews"
                        ]
                    }
                },
                default: "smart_views_create",
                options: [
                    {
                        name: "Create Lead",
                        value: "smart_views_create",
                        action: "Create lead smart view",
                        description: "Creates a smart view for leads or contacts"
                    },
                    {
                        name: "Update Lead",
                        value: "smart_views_update",
                        action: "Update lead smart view",
                        description: "Updates an existing smart view"
                    }
                ]
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "smartViews"
                        ],
                        operation: [
                            "smart_views_create"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "name",
                    "type",
                    "description",
                    "date_created",
                    "date_updated",
                    "is_shared",
                    "is_user_dependent",
                    "organization_id",
                    "query"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "smartViews"
                        ],
                        operation: [
                            "smart_views_create"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "Description",
                        value: "description"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Is Shared",
                        value: "is_shared"
                    },
                    {
                        name: "Is User Dependent",
                        value: "is_user_dependent"
                    },
                    {
                        name: "Name",
                        value: "name"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Query",
                        value: "query"
                    },
                    {
                        name: "S Query",
                        value: "s_query"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected_fields"
                    },
                    {
                        name: "Shared With",
                        value: "shared_with"
                    },
                    {
                        name: "Sharing Settings",
                        value: "sharing_settings"
                    },
                    {
                        name: "Type",
                        value: "type"
                    },
                    {
                        name: "User ID",
                        value: "user_id"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "smartViews"
                        ],
                        operation: [
                            "smart_views_update"
                        ]
                    }
                }
            },
            {
                displayName: "Output",
                name: "outputMode",
                type: "options",
                default: "simplified",
                description: "Choose whether to return useful fields, the raw response, or selected fields",
                displayOptions: {
                    show: {
                        resource: [
                            "smartViews"
                        ],
                        operation: [
                            "smart_views_update"
                        ]
                    }
                },
                options: [
                    {
                        name: "Raw",
                        value: "raw",
                        description: "Return the complete API response"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected",
                        description: "Return only selected fields"
                    },
                    {
                        name: "Simplified",
                        value: "simplified",
                        description: "Return up to 10 useful fields"
                    }
                ]
            },
            {
                displayName: "Fields to Include",
                name: "selectedFields",
                type: "multiOptions",
                default: [
                    "id",
                    "name",
                    "type",
                    "description",
                    "date_created",
                    "date_updated",
                    "is_shared",
                    "is_user_dependent",
                    "organization_id",
                    "query"
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "smartViews"
                        ],
                        operation: [
                            "smart_views_update"
                        ],
                        outputMode: [
                            "selected"
                        ]
                    }
                },
                options: [
                    {
                        name: "Date Created",
                        value: "date_created"
                    },
                    {
                        name: "Date Updated",
                        value: "date_updated"
                    },
                    {
                        name: "Description",
                        value: "description"
                    },
                    {
                        name: "ID",
                        value: "id"
                    },
                    {
                        name: "Is Shared",
                        value: "is_shared"
                    },
                    {
                        name: "Is User Dependent",
                        value: "is_user_dependent"
                    },
                    {
                        name: "Name",
                        value: "name"
                    },
                    {
                        name: "Organization ID",
                        value: "organization_id"
                    },
                    {
                        name: "Query",
                        value: "query"
                    },
                    {
                        name: "S Query",
                        value: "s_query"
                    },
                    {
                        name: "Selected Fields",
                        value: "selected_fields"
                    },
                    {
                        name: "Shared With",
                        value: "shared_with"
                    },
                    {
                        name: "Sharing Settings",
                        value: "sharing_settings"
                    },
                    {
                        name: "Type",
                        value: "type"
                    },
                    {
                        name: "User ID",
                        value: "user_id"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "tasks"
                        ]
                    }
                },
                default: "tasks_create",
                options: [
                    {
                        name: "Create",
                        value: "tasks_create",
                        action: "Create task",
                        description: "Creates a task for a lead or contact"
                    },
                    {
                        name: "Find",
                        value: "tasks_list",
                        action: "Find tasks",
                        description: "Finds tasks that match the supplied filters"
                    },
                    {
                        name: "Get",
                        value: "tasks_get",
                        action: "Get task",
                        description: "Returns a task by ID"
                    },
                    {
                        name: "Update",
                        value: "tasks_update",
                        action: "Update task",
                        description: "Updates an existing task"
                    }
                ]
            },
            {
                displayName: "Body JSON",
                name: "bodyJson",
                type: "json",
                default: {
                    schemaAlternative: "alternative1",
                    value: ""
                },
                required: true,
                description: "Raw request body",
                displayOptions: {
                    show: {
                        resource: [
                            "tasks"
                        ],
                        operation: [
                            "tasks_create"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "tasks"
                        ],
                        operation: [
                            "tasks_create"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "tasks"
                        ],
                        operation: [
                            "tasks_get"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "tasks"
                        ],
                        operation: [
                            "tasks_get"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "tasks"
                        ],
                        operation: [
                            "tasks_list"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Assigned To",
                        name: "assigned_to",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date",
                        name: "date",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Created Gt",
                        name: "date_created__gt",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Created Gte",
                        name: "date_created__gte",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Created Lt",
                        name: "date_created__lt",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Created Lte",
                        name: "date_created__lte",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Gt",
                        name: "date__gt",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Gte",
                        name: "date__gte",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Lt",
                        name: "date__lt",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Lte",
                        name: "date__lte",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Updated Gt",
                        name: "date_updated__gt",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Updated Gte",
                        name: "date_updated__gte",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Updated Lt",
                        name: "date_updated__lt",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date Updated Lte",
                        name: "date_updated__lte",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Due Date",
                        name: "due_date",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Due Date Gt",
                        name: "due_date__gt",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Due Date Gte",
                        name: "due_date__gte",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Due Date Lt",
                        name: "due_date__lt",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Due Date Lte",
                        name: "due_date__lte",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    },
                    {
                        displayName: "Format",
                        name: "format",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "ID",
                        name: "id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "ID In",
                        name: "id__in",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Is Complete",
                        name: "is_complete",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Lead ID",
                        name: "lead_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Limit",
                        name: "_limit",
                        type: "number",
                        default: 100,
                        description: "Number of results to return"
                    },
                    {
                        displayName: "Order By",
                        name: "_order_by",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Organization ID",
                        name: "organization_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Skip",
                        name: "_skip",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip before returning, for pagination"
                    },
                    {
                        displayName: "Type",
                        name: "_type",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Type In",
                        name: "_type__in",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "View",
                        name: "view",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "tasks"
                        ],
                        operation: [
                            "tasks_update"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "tasks"
                        ],
                        operation: [
                            "tasks_update"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Agent Config ID",
                        name: "agent_config_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Assigned To",
                        name: "assigned_to",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Contact ID",
                        name: "contact_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Created By",
                        name: "created_by",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Date",
                        name: "date",
                        type: "dateTime",
                        default: {
                            schemaAlternative: "alternative1",
                            value: ""
                        }
                    },
                    {
                        displayName: "Due Date",
                        name: "due_date",
                        type: "dateTime",
                        default: {
                            schemaAlternative: "alternative1",
                            value: ""
                        }
                    },
                    {
                        displayName: "Fields",
                        name: "_fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated list of fields to include in the response"
                    },
                    {
                        displayName: "Is Complete",
                        name: "is_complete",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable is complete"
                    },
                    {
                        displayName: "Is Dateless",
                        name: "is_dateless",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable is dateless"
                    },
                    {
                        displayName: "Lead ID",
                        name: "lead_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Organization ID",
                        name: "organization_id",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Priority",
                        name: "priority",
                        type: "options",
                        default: "high",
                        options: [
                            {
                                name: "High",
                                value: "high"
                            },
                            {
                                name: "Medium",
                                value: "medium"
                            }
                        ]
                    },
                    {
                        displayName: "Resolution",
                        name: "resolution",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Text",
                        name: "text",
                        type: "string",
                        default: ""
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "unsubscribedEmails"
                        ]
                    }
                },
                default: "unsubscribed_emails_create",
                options: [
                    {
                        name: "List",
                        value: "unsubscribed_emails_list",
                        action: "List unsubscribed emails",
                        description: "Lists email addresses that are unsubscribed from close. unsubscribed emails."
                    },
                    {
                        name: "Resubscribe Email",
                        value: "unsubscribed_emails_delete",
                        action: "Resubscribe email unsubscribed emails",
                        description: "Resubscribes an email address. unsubscribed emails."
                    },
                    {
                        name: "Unsubscribe Email",
                        value: "unsubscribed_emails_create",
                        action: "Unsubscribe email unsubscribed emails",
                        description: "Unsubscribes an email address. unsubscribed emails."
                    }
                ]
            },
            {
                displayName: "Email",
                name: "email",
                type: "string",
                default: "",
                required: true,
                placeholder: "name@email.com",
                hint: "Expected format: email",
                displayOptions: {
                    show: {
                        resource: [
                            "unsubscribedEmails"
                        ],
                        operation: [
                            "unsubscribed_emails_create"
                        ]
                    }
                }
            },
            {
                displayName: "Email Address",
                name: "email_address",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "unsubscribedEmails"
                        ],
                        operation: [
                            "unsubscribed_emails_delete"
                        ]
                    }
                }
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "users"
                        ]
                    }
                },
                default: "users_get",
                options: [
                    {
                        name: "Find",
                        value: "users_list",
                        action: "Find users",
                        description: "Finds users in your organization that match the supplied filters"
                    },
                    {
                        name: "Get",
                        value: "users_get",
                        action: "Get user",
                        description: "Returns a user by ID"
                    },
                    {
                        name: "List User Availability",
                        value: "users_list_availabilities",
                        action: "List user availability",
                        description: "Lists user availability statuses for user selection"
                    }
                ]
            },
            {
                displayName: "ID",
                name: "id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "users"
                        ],
                        operation: [
                            "users_get"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "users"
                        ],
                        operation: [
                            "users_get"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Limit",
                        name: "_limit",
                        type: "number",
                        default: 100,
                        description: "Number of results to return"
                    },
                    {
                        displayName: "Order By",
                        name: "_order_by",
                        type: "options",
                        default: "last_name,first_name",
                        options: [
                            {
                                name: "First Name,Last Name",
                                value: "first_name,last_name"
                            },
                            {
                                name: "Last Name,First Name",
                                value: "last_name,first_name"
                            }
                        ]
                    },
                    {
                        displayName: "Skip",
                        name: "_skip",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip before returning, for pagination"
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "users"
                        ],
                        operation: [
                            "users_list"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Limit",
                        name: "_limit",
                        type: "number",
                        default: 100,
                        description: "Number of results to return"
                    },
                    {
                        displayName: "Order By",
                        name: "_order_by",
                        type: "options",
                        default: "last_name,first_name",
                        options: [
                            {
                                name: "First Name,Last Name",
                                value: "first_name,last_name"
                            },
                            {
                                name: "Last Name,First Name",
                                value: "last_name,first_name"
                            }
                        ]
                    },
                    {
                        displayName: "Skip",
                        name: "_skip",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip before returning, for pagination"
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "users"
                        ],
                        operation: [
                            "users_list_availabilities"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Organization ID",
                        name: "organization_id",
                        type: "string",
                        default: ""
                    }
                ]
            }
        ]
    };

  public async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const inputItems = this.getInputData();
    const output: INodeExecutionData[] = [];
    for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex += 1) {
      const outputStart = output.length;
      let errorPlan: Record<string, { title: string; recovery?: string; parameter?: string }> = {};
      try {
        const operation = this.getNodeParameter('operation', itemIndex) as string;
        const nodeVersion = this.getNode().typeVersion;
        let additionalFields: IDataObject = {};
        const nodeOptions = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
        const authenticationChoice = this.getNodeParameter('authentication', itemIndex, '') as string;
        let retryContract: RetryContract = { mode: 'none', maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0 };
        let credentialApplications: CredentialApplication[] | undefined;
        let options: IHttpRequestOptions;
        let pagination: PaginationContract = { style: 'none', advancement: '', maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10 * 1024 * 1024, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        let responsePlan: { binary: boolean; full: boolean; envelopePath: string; itemPath: string; fields: string[]; simplified: string[] } = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        switch (operation) {
          case "activities_list": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/activity/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["_limit"] !== undefined) qs["_limit"] = additionalFields["_limit"];
    if (additionalFields["_skip"] !== undefined) qs["_skip"] = additionalFields["_skip"];
    if (additionalFields["id__in"] !== undefined) qs["id__in"] = additionalFields["id__in"];
    if (additionalFields["lead_id"] !== undefined) qs["lead_id"] = additionalFields["lead_id"];
    if (additionalFields["contact_id"] !== undefined) qs["contact_id"] = additionalFields["contact_id"];
    if (additionalFields["user_id"] !== undefined) qs["user_id"] = additionalFields["user_id"];
    if (additionalFields["organization_id"] !== undefined) qs["organization_id"] = additionalFields["organization_id"];
    if (additionalFields["_type"] !== undefined) qs["_type"] = additionalFields["_type"];
    if (additionalFields["date_created__gte"] !== undefined) qs["date_created__gte"] = additionalFields["date_created__gte"];
    if (additionalFields["date_created__lte"] !== undefined) qs["date_created__lte"] = additionalFields["date_created__lte"];
    if (additionalFields["date_created__gt"] !== undefined) qs["date_created__gt"] = additionalFields["date_created__gt"];
    if (additionalFields["date_created__lt"] !== undefined) qs["date_created__lt"] = additionalFields["date_created__lt"];
    if (additionalFields["activity_at__gte"] !== undefined) qs["activity_at__gte"] = additionalFields["activity_at__gte"];
    if (additionalFields["activity_at__lte"] !== undefined) qs["activity_at__lte"] = additionalFields["activity_at__lte"];
    if (additionalFields["activity_at__gt"] !== undefined) qs["activity_at__gt"] = additionalFields["activity_at__gt"];
    if (additionalFields["activity_at__lt"] !== undefined) qs["activity_at__lt"] = additionalFields["activity_at__lt"];
    if (additionalFields["lead_id__in"] !== undefined) qs["lead_id__in"] = additionalFields["lead_id__in"];
    if (additionalFields["user_id__in"] !== undefined) qs["user_id__in"] = additionalFields["user_id__in"];
    if (additionalFields["contact_id__in"] !== undefined) qs["contact_id__in"] = additionalFields["contact_id__in"];
    if (additionalFields["_type__in"] !== undefined) qs["_type__in"] = additionalFields["_type__in"];
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
    if (additionalFields["_order_by"] !== undefined) qs["_order_by"] = additionalFields["_order_by"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "List Activity")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.calls_create": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/activity/call/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        if (additionalFields["activity_at"] !== undefined) setBodyField(body as IDataObject, {"name":"activity_at","displayName":"Activity at","type":"string","format":"date-time","nullable":true}, additionalFields["activity_at"], this, itemIndex);
    if (additionalFields["contact_id"] !== undefined) setBodyField(body as IDataObject, {"name":"contact_id","displayName":"Contact id","type":"string","nullable":true}, additionalFields["contact_id"], this, itemIndex);
    if (additionalFields["conversation_type_id"] !== undefined) setBodyField(body as IDataObject, {"name":"conversation_type_id","displayName":"Conversation type id","type":"string","nullable":true}, additionalFields["conversation_type_id"], this, itemIndex);
    if (additionalFields["created_by"] !== undefined) setBodyField(body as IDataObject, {"name":"created_by","displayName":"Created by","type":"string","nullable":true}, additionalFields["created_by"], this, itemIndex);
    if (additionalFields["date_created"] !== undefined) setBodyField(body as IDataObject, {"name":"date_created","displayName":"Date created","type":"string","format":"date-time","nullable":true}, additionalFields["date_created"], this, itemIndex);
    if (additionalFields["direction"] !== undefined) setBodyField(body as IDataObject, {"name":"direction","displayName":"Direction","type":"string","enum":["inbound","outbound",null],"nullable":true}, additionalFields["direction"], this, itemIndex);
    if (additionalFields["duration"] !== undefined) setBodyField(body as IDataObject, {"name":"duration","displayName":"Duration","type":"integer","maxValue":604800,"nullable":true}, additionalFields["duration"], this, itemIndex);
    if (additionalFields["lead_id"] !== undefined) setBodyField(body as IDataObject, {"name":"lead_id","displayName":"Lead id","type":"string","nullable":true}, additionalFields["lead_id"], this, itemIndex);
    if (additionalFields["note"] !== undefined) setBodyField(body as IDataObject, {"name":"note","displayName":"Note","type":"string","nullable":true}, additionalFields["note"], this, itemIndex);
    if (additionalFields["note_html"] !== undefined) setBodyField(body as IDataObject, {"name":"note_html","displayName":"Note html","type":"string","nullable":true}, additionalFields["note_html"], this, itemIndex);
    if (additionalFields["organization_id"] !== undefined) setBodyField(body as IDataObject, {"name":"organization_id","displayName":"Organization id","type":"string","nullable":true}, additionalFields["organization_id"], this, itemIndex);
    if (additionalFields["outcome_id"] !== undefined) setBodyField(body as IDataObject, {"name":"outcome_id","displayName":"Outcome id","type":"string","nullable":true}, additionalFields["outcome_id"], this, itemIndex);
    if (additionalFields["phone"] !== undefined) setBodyField(body as IDataObject, {"name":"phone","displayName":"Phone","description":"Phone number in E.164 format","type":"string","nullable":true}, additionalFields["phone"], this, itemIndex);
    if (additionalFields["playbook_id"] !== undefined) setBodyField(body as IDataObject, {"name":"playbook_id","displayName":"Playbook id","type":"string","nullable":true}, additionalFields["playbook_id"], this, itemIndex);
    if (additionalFields["quality_info"] !== undefined) setBodyField(body as IDataObject, {"name":"quality_info","displayName":"Quality info","type":"string","nullable":true}, additionalFields["quality_info"], this, itemIndex);
    if (additionalFields["recording_url"] !== undefined) setBodyField(body as IDataObject, {"name":"recording_url","displayName":"Recording url","type":"string","format":"uri","nullable":true}, additionalFields["recording_url"], this, itemIndex);
    if (additionalFields["source"] !== undefined) setBodyField(body as IDataObject, {"name":"source","displayName":"Source","type":"string","enum":["Close.io","External",null],"nullable":true}, additionalFields["source"], this, itemIndex);
    if (additionalFields["status"] !== undefined) setBodyField(body as IDataObject, {"name":"status","displayName":"Status","type":"string","enum":["created","in-progress","completed","cancel","no-answer","busy","failed","timeout",null],"nullable":true}, additionalFields["status"], this, itemIndex);
    if (additionalFields["user_id"] !== undefined) setBodyField(body as IDataObject, {"name":"user_id","displayName":"User id","type":"string","nullable":true}, additionalFields["user_id"], this, itemIndex);
    if (additionalFields["voicemail_url"] !== undefined) setBodyField(body as IDataObject, {"name":"voicemail_url","displayName":"Voicemail url","type":"string","format":"uri","nullable":true}, additionalFields["voicemail_url"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Create Call")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_type","activity_at","contact_id","created_by","created_by_name","date_created","date_updated","id","lead_id","organization_id","outcome_id","sequence_id","sequence_name","sequence_subscription_id","source","status","updated_by","updated_by_name","user_id","user_name","users"], simplified: ["id","status","_type","activity_at","contact_id","created_by","created_by_name","date_created","date_updated","lead_id"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.calls_delete": {
        
        
        let path = "/activity/call/{id}/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Delete Logged Call")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.calls_get": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/activity/call/{id}/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Get Call")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_type","activity_at","contact_id","created_by","created_by_name","date_created","date_updated","id","lead_id","organization_id","outcome_id","sequence_id","sequence_name","sequence_subscription_id","source","status","updated_by","updated_by_name","user_id","user_name","users"], simplified: ["id","status","_type","activity_at","contact_id","created_by","created_by_name","date_created","date_updated","lead_id"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.calls_list": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/activity/call/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["_limit"] !== undefined) qs["_limit"] = additionalFields["_limit"];
    if (additionalFields["_skip"] !== undefined) qs["_skip"] = additionalFields["_skip"];
    if (additionalFields["id__in"] !== undefined) qs["id__in"] = additionalFields["id__in"];
    if (additionalFields["lead_id"] !== undefined) qs["lead_id"] = additionalFields["lead_id"];
    if (additionalFields["contact_id"] !== undefined) qs["contact_id"] = additionalFields["contact_id"];
    if (additionalFields["user_id"] !== undefined) qs["user_id"] = additionalFields["user_id"];
    if (additionalFields["organization_id"] !== undefined) qs["organization_id"] = additionalFields["organization_id"];
    if (additionalFields["_type"] !== undefined) qs["_type"] = additionalFields["_type"];
    if (additionalFields["date_created__gte"] !== undefined) qs["date_created__gte"] = additionalFields["date_created__gte"];
    if (additionalFields["date_created__lte"] !== undefined) qs["date_created__lte"] = additionalFields["date_created__lte"];
    if (additionalFields["date_created__gt"] !== undefined) qs["date_created__gt"] = additionalFields["date_created__gt"];
    if (additionalFields["date_created__lt"] !== undefined) qs["date_created__lt"] = additionalFields["date_created__lt"];
    if (additionalFields["activity_at__gte"] !== undefined) qs["activity_at__gte"] = additionalFields["activity_at__gte"];
    if (additionalFields["activity_at__lte"] !== undefined) qs["activity_at__lte"] = additionalFields["activity_at__lte"];
    if (additionalFields["activity_at__gt"] !== undefined) qs["activity_at__gt"] = additionalFields["activity_at__gt"];
    if (additionalFields["activity_at__lt"] !== undefined) qs["activity_at__lt"] = additionalFields["activity_at__lt"];
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Find Calls")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","has_more"], simplified: ["data","has_more"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.calls_update": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/activity/call/{id}/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        if (additionalFields["activity_at"] !== undefined) setBodyField(body as IDataObject, {"name":"activity_at","displayName":"Activity at","type":"string","format":"date-time","nullable":true}, additionalFields["activity_at"], this, itemIndex);
    if (additionalFields["contact_id"] !== undefined) setBodyField(body as IDataObject, {"name":"contact_id","displayName":"Contact id","type":"string","nullable":true}, additionalFields["contact_id"], this, itemIndex);
    if (additionalFields["conversation_type_id"] !== undefined) setBodyField(body as IDataObject, {"name":"conversation_type_id","displayName":"Conversation type id","type":"string","nullable":true}, additionalFields["conversation_type_id"], this, itemIndex);
    if (additionalFields["duration"] !== undefined) setBodyField(body as IDataObject, {"name":"duration","displayName":"Duration","type":"integer","maxValue":604800,"nullable":true}, additionalFields["duration"], this, itemIndex);
    if (additionalFields["lead_id"] !== undefined) setBodyField(body as IDataObject, {"name":"lead_id","displayName":"Lead id","type":"string","nullable":true}, additionalFields["lead_id"], this, itemIndex);
    if (additionalFields["note"] !== undefined) setBodyField(body as IDataObject, {"name":"note","displayName":"Note","type":"string","nullable":true}, additionalFields["note"], this, itemIndex);
    if (additionalFields["note_html"] !== undefined) setBodyField(body as IDataObject, {"name":"note_html","displayName":"Note html","type":"string","nullable":true}, additionalFields["note_html"], this, itemIndex);
    if (additionalFields["outcome_id"] !== undefined) setBodyField(body as IDataObject, {"name":"outcome_id","displayName":"Outcome id","type":"string","nullable":true}, additionalFields["outcome_id"], this, itemIndex);
    if (additionalFields["phone"] !== undefined) setBodyField(body as IDataObject, {"name":"phone","displayName":"Phone","description":"Phone number in E.164 format","type":"string","nullable":true}, additionalFields["phone"], this, itemIndex);
    if (additionalFields["playbook_id"] !== undefined) setBodyField(body as IDataObject, {"name":"playbook_id","displayName":"Playbook id","type":"string","nullable":true}, additionalFields["playbook_id"], this, itemIndex);
    if (additionalFields["quality_info"] !== undefined) setBodyField(body as IDataObject, {"name":"quality_info","displayName":"Quality info","type":"string","nullable":true}, additionalFields["quality_info"], this, itemIndex);
    if (additionalFields["recording_url"] !== undefined) setBodyField(body as IDataObject, {"name":"recording_url","displayName":"Recording url","type":"string","format":"uri","nullable":true}, additionalFields["recording_url"], this, itemIndex);
    if (additionalFields["status"] !== undefined) setBodyField(body as IDataObject, {"name":"status","displayName":"Status","type":"string","enum":["created","in-progress","completed","cancel","no-answer","busy","failed","timeout",null],"nullable":true}, additionalFields["status"], this, itemIndex);
    if (additionalFields["user_id"] !== undefined) setBodyField(body as IDataObject, {"name":"user_id","displayName":"User id","type":"string","nullable":true}, additionalFields["user_id"], this, itemIndex);
    if (additionalFields["voicemail_url"] !== undefined) setBodyField(body as IDataObject, {"name":"voicemail_url","displayName":"Voicemail url","type":"string","format":"uri","nullable":true}, additionalFields["voicemail_url"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Update Call")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_type","activity_at","contact_id","created_by","created_by_name","date_created","date_updated","id","lead_id","organization_id","outcome_id","sequence_id","sequence_name","sequence_subscription_id","source","status","updated_by","updated_by_name","user_id","user_name","users"], simplified: ["id","status","_type","activity_at","contact_id","created_by","created_by_name","date_created","date_updated","lead_id"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.custom_activities_create": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/activity/custom/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        if (additionalFields["activity_at"] !== undefined) setBodyField(body as IDataObject, {"name":"activity_at","displayName":"Activity at","type":"string","format":"date-time","nullable":true}, additionalFields["activity_at"], this, itemIndex);
    if (additionalFields["contact_id"] !== undefined) setBodyField(body as IDataObject, {"name":"contact_id","displayName":"Contact id","type":"string","nullable":true}, additionalFields["contact_id"], this, itemIndex);
    if (additionalFields["created_by"] !== undefined) setBodyField(body as IDataObject, {"name":"created_by","displayName":"Created by","type":"string","nullable":true}, additionalFields["created_by"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"custom_activity_type_id","displayName":"Custom activity type id","type":"string","required":true}, this.getNodeParameter("custom_activity_type_id", itemIndex), this, itemIndex);
    if (additionalFields["date_created"] !== undefined) setBodyField(body as IDataObject, {"name":"date_created","displayName":"Date created","type":"string","format":"date-time","nullable":true}, additionalFields["date_created"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"lead_id","displayName":"Lead id","type":"string","required":true}, this.getNodeParameter("lead_id", itemIndex), this, itemIndex);
    if (additionalFields["organization_id"] !== undefined) setBodyField(body as IDataObject, {"name":"organization_id","displayName":"Organization id","type":"string","nullable":true}, additionalFields["organization_id"], this, itemIndex);
    if (additionalFields["pinned"] !== undefined) setBodyField(body as IDataObject, {"name":"pinned","displayName":"Pinned","type":"boolean","nullable":true}, additionalFields["pinned"], this, itemIndex);
    if (additionalFields["status"] !== undefined) setBodyField(body as IDataObject, {"name":"status","displayName":"Status","type":"string","enum":["draft","published"]}, additionalFields["status"], this, itemIndex);
    if (additionalFields["user_id"] !== undefined) setBodyField(body as IDataObject, {"name":"user_id","displayName":"User id","type":"string","nullable":true}, additionalFields["user_id"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Create Custom Activity")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_type","activity_at","comment_summary","contact_id","created_by","created_by_name","custom_activity_type_id","date_created","date_updated","id","last_published_at","lead_id","mentions","mentions_updated_at","organization_id","pinned","pinned_at","source","status","updated_by","updated_by_name","user_id","user_name","users"], simplified: ["id","status","_type","activity_at","contact_id","created_by","created_by_name","custom_activity_type_id","date_created","date_updated"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.custom_activities_get": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/activity/custom/{id}/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Get Custom Activity")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_type","activity_at","comment_summary","contact_id","created_by","created_by_name","custom_activity_type_id","date_created","date_updated","id","last_published_at","lead_id","mentions","mentions_updated_at","organization_id","pinned","pinned_at","source","status","updated_by","updated_by_name","user_id","user_name","users"], simplified: ["id","status","_type","activity_at","contact_id","created_by","created_by_name","custom_activity_type_id","date_created","date_updated"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.custom_activities_list": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/activity/custom/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["_limit"] !== undefined) qs["_limit"] = additionalFields["_limit"];
    if (additionalFields["_skip"] !== undefined) qs["_skip"] = additionalFields["_skip"];
    if (additionalFields["id__in"] !== undefined) qs["id__in"] = additionalFields["id__in"];
    if (additionalFields["lead_id"] !== undefined) qs["lead_id"] = additionalFields["lead_id"];
    if (additionalFields["contact_id"] !== undefined) qs["contact_id"] = additionalFields["contact_id"];
    if (additionalFields["user_id"] !== undefined) qs["user_id"] = additionalFields["user_id"];
    if (additionalFields["organization_id"] !== undefined) qs["organization_id"] = additionalFields["organization_id"];
    if (additionalFields["_type"] !== undefined) qs["_type"] = additionalFields["_type"];
    if (additionalFields["date_created__gte"] !== undefined) qs["date_created__gte"] = additionalFields["date_created__gte"];
    if (additionalFields["date_created__lte"] !== undefined) qs["date_created__lte"] = additionalFields["date_created__lte"];
    if (additionalFields["date_created__gt"] !== undefined) qs["date_created__gt"] = additionalFields["date_created__gt"];
    if (additionalFields["date_created__lt"] !== undefined) qs["date_created__lt"] = additionalFields["date_created__lt"];
    if (additionalFields["activity_at__gte"] !== undefined) qs["activity_at__gte"] = additionalFields["activity_at__gte"];
    if (additionalFields["activity_at__lte"] !== undefined) qs["activity_at__lte"] = additionalFields["activity_at__lte"];
    if (additionalFields["activity_at__gt"] !== undefined) qs["activity_at__gt"] = additionalFields["activity_at__gt"];
    if (additionalFields["activity_at__lt"] !== undefined) qs["activity_at__lt"] = additionalFields["activity_at__lt"];
    if (additionalFields["custom_activity_type_id"] !== undefined) qs["custom_activity_type_id"] = additionalFields["custom_activity_type_id"];
    if (additionalFields["custom_activity_type_id__in"] !== undefined) qs["custom_activity_type_id__in"] = additionalFields["custom_activity_type_id__in"];
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Find Custom Activities")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","has_more"], simplified: ["data","has_more"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.custom_activities_update": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/activity/custom/{id}/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        if (additionalFields["activity_at"] !== undefined) setBodyField(body as IDataObject, {"name":"activity_at","displayName":"Activity at","type":"string","format":"date-time","nullable":true}, additionalFields["activity_at"], this, itemIndex);
    if (additionalFields["contact_id"] !== undefined) setBodyField(body as IDataObject, {"name":"contact_id","displayName":"Contact id","type":"string","nullable":true}, additionalFields["contact_id"], this, itemIndex);
    if (additionalFields["pinned"] !== undefined) setBodyField(body as IDataObject, {"name":"pinned","displayName":"Pinned","type":"boolean","nullable":true}, additionalFields["pinned"], this, itemIndex);
    if (additionalFields["status"] !== undefined) setBodyField(body as IDataObject, {"name":"status","displayName":"Status","type":"string","enum":["draft","published"]}, additionalFields["status"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Update Custom Activity")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_type","activity_at","comment_summary","contact_id","created_by","created_by_name","custom_activity_type_id","date_created","date_updated","id","last_published_at","lead_id","mentions","mentions_updated_at","organization_id","pinned","pinned_at","source","status","updated_by","updated_by_name","user_id","user_name","users"], simplified: ["id","status","_type","activity_at","contact_id","created_by","created_by_name","custom_activity_type_id","date_created","date_updated"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.emails_create": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/activity/email/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        if (additionalFields["activity_at"] !== undefined) setBodyField(body as IDataObject, {"name":"activity_at","displayName":"Activity at","type":"string","format":"date-time","nullable":true}, additionalFields["activity_at"], this, itemIndex);
    if (additionalFields["attachments"] !== undefined) setBodyField(body as IDataObject, {"name":"attachments","displayName":"Attachments","type":"array","representation":"raw","nullable":true,"items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"content_id","displayName":"Content id","type":"string","nullable":true},{"name":"content_type","displayName":"Content type","type":"string","nullable":true},{"name":"filename","displayName":"Filename","type":"string","required":true},{"name":"inline_only","displayName":"Inline only","type":"boolean"},{"name":"size","displayName":"Size","type":"integer","required":true},{"name":"url","displayName":"Url","type":"string","format":"uri","required":true}]}}, additionalFields["attachments"], this, itemIndex);
    if (additionalFields["bcc"] !== undefined) setBodyField(body as IDataObject, {"name":"bcc","displayName":"Bcc","type":"array","representation":"raw","nullable":true,"items":{"name":"item","displayName":"Item","type":"string"}}, additionalFields["bcc"], this, itemIndex);
    if (additionalFields["body_html"] !== undefined) setBodyField(body as IDataObject, {"name":"body_html","displayName":"Body html","type":"string","nullable":true}, additionalFields["body_html"], this, itemIndex);
    if (additionalFields["body_text"] !== undefined) setBodyField(body as IDataObject, {"name":"body_text","displayName":"Body text","type":"string","nullable":true}, additionalFields["body_text"], this, itemIndex);
    if (additionalFields["cc"] !== undefined) setBodyField(body as IDataObject, {"name":"cc","displayName":"Cc","type":"array","representation":"raw","nullable":true,"items":{"name":"item","displayName":"Item","type":"string"}}, additionalFields["cc"], this, itemIndex);
    if (additionalFields["contact_id"] !== undefined) setBodyField(body as IDataObject, {"name":"contact_id","displayName":"Contact id","type":"string","nullable":true}, additionalFields["contact_id"], this, itemIndex);
    if (additionalFields["created_by"] !== undefined) setBodyField(body as IDataObject, {"name":"created_by","displayName":"Created by","type":"string","nullable":true}, additionalFields["created_by"], this, itemIndex);
    if (additionalFields["date_created"] !== undefined) setBodyField(body as IDataObject, {"name":"date_created","displayName":"Date created","type":"string","format":"date-time","nullable":true}, additionalFields["date_created"], this, itemIndex);
    if (additionalFields["email_account_id"] !== undefined) setBodyField(body as IDataObject, {"name":"email_account_id","displayName":"Email account id","type":"string","nullable":true}, additionalFields["email_account_id"], this, itemIndex);
    if (additionalFields["followup_date"] !== undefined) setBodyField(body as IDataObject, {"name":"followup_date","displayName":"Followup date","type":"string","format":"date-time","nullable":true}, additionalFields["followup_date"], this, itemIndex);
    if (additionalFields["followup_sequence_add_cc_bcc"] !== undefined) setBodyField(body as IDataObject, {"name":"followup_sequence_add_cc_bcc","displayName":"Followup sequence add cc bcc","type":"boolean","nullable":true}, additionalFields["followup_sequence_add_cc_bcc"], this, itemIndex);
    if (additionalFields["followup_sequence_delay"] !== undefined) setBodyField(body as IDataObject, {"name":"followup_sequence_delay","displayName":"Followup sequence delay","type":"integer","minValue":86400,"nullable":true}, additionalFields["followup_sequence_delay"], this, itemIndex);
    if (additionalFields["followup_sequence_id"] !== undefined) setBodyField(body as IDataObject, {"name":"followup_sequence_id","displayName":"Followup sequence id","type":"string","nullable":true}, additionalFields["followup_sequence_id"], this, itemIndex);
    if (additionalFields["in_reply_to_id"] !== undefined) setBodyField(body as IDataObject, {"name":"in_reply_to_id","displayName":"In reply to id","type":"string","nullable":true}, additionalFields["in_reply_to_id"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"lead_id","displayName":"Lead id","type":"string","required":true}, this.getNodeParameter("lead_id", itemIndex), this, itemIndex);
    if (additionalFields["opens"] !== undefined) setBodyField(body as IDataObject, {"name":"opens","displayName":"Opens","type":"array","representation":"raw","nullable":true,"items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"opened_at","displayName":"Opened at","type":"string","format":"date-time","required":true}]}}, additionalFields["opens"], this, itemIndex);
    if (additionalFields["organization_id"] !== undefined) setBodyField(body as IDataObject, {"name":"organization_id","displayName":"Organization id","type":"string","nullable":true}, additionalFields["organization_id"], this, itemIndex);
    if (additionalFields["sender"] !== undefined) setBodyField(body as IDataObject, {"name":"sender","displayName":"Sender","type":"string","format":"email","nullable":true}, additionalFields["sender"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"status","displayName":"Status","type":"string","required":true,"enum":["inbox","draft","scheduled","outbox","sent","error"]}, this.getNodeParameter("status", itemIndex), this, itemIndex);
    if (additionalFields["subject"] !== undefined) setBodyField(body as IDataObject, {"name":"subject","displayName":"Subject","type":"string","nullable":true}, additionalFields["subject"], this, itemIndex);
    if (additionalFields["template_id"] !== undefined) setBodyField(body as IDataObject, {"name":"template_id","displayName":"Template id","type":"string","nullable":true}, additionalFields["template_id"], this, itemIndex);
    if (additionalFields["to"] !== undefined) setBodyField(body as IDataObject, {"name":"to","displayName":"To","type":"array","representation":"raw","nullable":true,"items":{"name":"item","displayName":"Item","type":"string"}}, additionalFields["to"], this, itemIndex);
    if (additionalFields["user_id"] !== undefined) setBodyField(body as IDataObject, {"name":"user_id","displayName":"User id","type":"string","nullable":true}, additionalFields["user_id"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Create Email")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_type","activity_at","agent_action_reason","agent_config_id","attachments","bcc","body_html","body_preview","body_text","bulk_email_action_id","cc","contact_id","created_by","created_by_name","date_created","date_scheduled","date_sent","date_updated","direction","email_account_id","envelope","followup_sequence_add_cc_bcc","followup_sequence_delay","followup_sequence_id","has_reply","id","in_reply_to_id","lead_id","message_ids","need_smtp_credentials","opens","opens_summary","organization_id","references","send_as_id","send_attempts","sender","sequence_id","sequence_name","sequence_subscription_id","status","subject","template_id","template_name","thread_id","to","updated_by","updated_by_name","user_id","user_name","users"], simplified: ["id","status","_type","activity_at","agent_action_reason","agent_config_id","body_html","body_preview","body_text","bulk_email_action_id"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.emails_delete": {
        
        
        let path = "/activity/email/{id}/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Delete Email")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.emails_list": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/activity/email/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["_limit"] !== undefined) qs["_limit"] = additionalFields["_limit"];
    if (additionalFields["_skip"] !== undefined) qs["_skip"] = additionalFields["_skip"];
    if (additionalFields["id__in"] !== undefined) qs["id__in"] = additionalFields["id__in"];
    if (additionalFields["lead_id"] !== undefined) qs["lead_id"] = additionalFields["lead_id"];
    if (additionalFields["contact_id"] !== undefined) qs["contact_id"] = additionalFields["contact_id"];
    if (additionalFields["user_id"] !== undefined) qs["user_id"] = additionalFields["user_id"];
    if (additionalFields["organization_id"] !== undefined) qs["organization_id"] = additionalFields["organization_id"];
    if (additionalFields["_type"] !== undefined) qs["_type"] = additionalFields["_type"];
    if (additionalFields["date_created__gte"] !== undefined) qs["date_created__gte"] = additionalFields["date_created__gte"];
    if (additionalFields["date_created__lte"] !== undefined) qs["date_created__lte"] = additionalFields["date_created__lte"];
    if (additionalFields["date_created__gt"] !== undefined) qs["date_created__gt"] = additionalFields["date_created__gt"];
    if (additionalFields["date_created__lt"] !== undefined) qs["date_created__lt"] = additionalFields["date_created__lt"];
    if (additionalFields["activity_at__gte"] !== undefined) qs["activity_at__gte"] = additionalFields["activity_at__gte"];
    if (additionalFields["activity_at__lte"] !== undefined) qs["activity_at__lte"] = additionalFields["activity_at__lte"];
    if (additionalFields["activity_at__gt"] !== undefined) qs["activity_at__gt"] = additionalFields["activity_at__gt"];
    if (additionalFields["activity_at__lt"] !== undefined) qs["activity_at__lt"] = additionalFields["activity_at__lt"];
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "List Emails")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","has_more"], simplified: ["data","has_more"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.form_submissions_list": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/activity/form_submission/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["_limit"] !== undefined) qs["_limit"] = additionalFields["_limit"];
    if (additionalFields["_skip"] !== undefined) qs["_skip"] = additionalFields["_skip"];
    if (additionalFields["id__in"] !== undefined) qs["id__in"] = additionalFields["id__in"];
    if (additionalFields["lead_id"] !== undefined) qs["lead_id"] = additionalFields["lead_id"];
    if (additionalFields["contact_id"] !== undefined) qs["contact_id"] = additionalFields["contact_id"];
    if (additionalFields["user_id"] !== undefined) qs["user_id"] = additionalFields["user_id"];
    if (additionalFields["organization_id"] !== undefined) qs["organization_id"] = additionalFields["organization_id"];
    if (additionalFields["_type"] !== undefined) qs["_type"] = additionalFields["_type"];
    if (additionalFields["date_created__gte"] !== undefined) qs["date_created__gte"] = additionalFields["date_created__gte"];
    if (additionalFields["date_created__lte"] !== undefined) qs["date_created__lte"] = additionalFields["date_created__lte"];
    if (additionalFields["date_created__gt"] !== undefined) qs["date_created__gt"] = additionalFields["date_created__gt"];
    if (additionalFields["date_created__lt"] !== undefined) qs["date_created__lt"] = additionalFields["date_created__lt"];
    if (additionalFields["activity_at__gte"] !== undefined) qs["activity_at__gte"] = additionalFields["activity_at__gte"];
    if (additionalFields["activity_at__lte"] !== undefined) qs["activity_at__lte"] = additionalFields["activity_at__lte"];
    if (additionalFields["activity_at__gt"] !== undefined) qs["activity_at__gt"] = additionalFields["activity_at__gt"];
    if (additionalFields["activity_at__lt"] !== undefined) qs["activity_at__lt"] = additionalFields["activity_at__lt"];
    if (additionalFields["lead_id__in"] !== undefined) qs["lead_id__in"] = additionalFields["lead_id__in"];
    if (additionalFields["user_id__in"] !== undefined) qs["user_id__in"] = additionalFields["user_id__in"];
    if (additionalFields["contact_id__in"] !== undefined) qs["contact_id__in"] = additionalFields["contact_id__in"];
    if (additionalFields["_type__in"] !== undefined) qs["_type__in"] = additionalFields["_type__in"];
    if (additionalFields["form_id"] !== undefined) qs["form_id"] = additionalFields["form_id"];
    if (additionalFields["form_id__in"] !== undefined) qs["form_id__in"] = additionalFields["form_id__in"];
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "List Form Submissions")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","has_more"], simplified: ["data","has_more"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.lead_status_changes_list": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/activity/status_change/lead/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["_limit"] !== undefined) qs["_limit"] = additionalFields["_limit"];
    if (additionalFields["_skip"] !== undefined) qs["_skip"] = additionalFields["_skip"];
    if (additionalFields["id__in"] !== undefined) qs["id__in"] = additionalFields["id__in"];
    if (additionalFields["lead_id"] !== undefined) qs["lead_id"] = additionalFields["lead_id"];
    if (additionalFields["contact_id"] !== undefined) qs["contact_id"] = additionalFields["contact_id"];
    if (additionalFields["user_id"] !== undefined) qs["user_id"] = additionalFields["user_id"];
    if (additionalFields["organization_id"] !== undefined) qs["organization_id"] = additionalFields["organization_id"];
    if (additionalFields["_type"] !== undefined) qs["_type"] = additionalFields["_type"];
    if (additionalFields["date_created__gte"] !== undefined) qs["date_created__gte"] = additionalFields["date_created__gte"];
    if (additionalFields["date_created__lte"] !== undefined) qs["date_created__lte"] = additionalFields["date_created__lte"];
    if (additionalFields["date_created__gt"] !== undefined) qs["date_created__gt"] = additionalFields["date_created__gt"];
    if (additionalFields["date_created__lt"] !== undefined) qs["date_created__lt"] = additionalFields["date_created__lt"];
    if (additionalFields["activity_at__gte"] !== undefined) qs["activity_at__gte"] = additionalFields["activity_at__gte"];
    if (additionalFields["activity_at__lte"] !== undefined) qs["activity_at__lte"] = additionalFields["activity_at__lte"];
    if (additionalFields["activity_at__gt"] !== undefined) qs["activity_at__gt"] = additionalFields["activity_at__gt"];
    if (additionalFields["activity_at__lt"] !== undefined) qs["activity_at__lt"] = additionalFields["activity_at__lt"];
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "List Lead Status Changes")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","has_more"], simplified: ["data","has_more"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.meetings_get": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/activity/meeting/{id}/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Get Meeting")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_paused_subscriptions","_type","activity_at","actual_duration","attached_call_ids","attendees","calendar_event_link","calendar_event_uids","comment_summary","conference_links","connected_account_id","contact_id","conversation_type_id","conversation_type_reason","created_by","created_by_name","date_created","date_updated","duration","ends_at","id","integrations","is_recurring","lead_id","location","note","notetaker_id","organization_id","outcome_autofill_confidence","outcome_autofill_reasoning","outcome_id","outcome_reason","playbook_id","playbook_reason","provider_calendar_event_id","provider_calendar_ids","provider_calendar_type","source","starts_at","status","summary","title","transcripts","updated_by","updated_by_name","user_id","user_name","user_note","user_note_date_updated","user_note_html","user_note_mentions","users"], simplified: ["id","title","status","_type","activity_at","actual_duration","calendar_event_link","connected_account_id","contact_id","conversation_type_id"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.meetings_list": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/activity/meeting/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["_limit"] !== undefined) qs["_limit"] = additionalFields["_limit"];
    if (additionalFields["_skip"] !== undefined) qs["_skip"] = additionalFields["_skip"];
    if (additionalFields["id__in"] !== undefined) qs["id__in"] = additionalFields["id__in"];
    if (additionalFields["lead_id"] !== undefined) qs["lead_id"] = additionalFields["lead_id"];
    if (additionalFields["contact_id"] !== undefined) qs["contact_id"] = additionalFields["contact_id"];
    if (additionalFields["user_id"] !== undefined) qs["user_id"] = additionalFields["user_id"];
    if (additionalFields["organization_id"] !== undefined) qs["organization_id"] = additionalFields["organization_id"];
    if (additionalFields["_type"] !== undefined) qs["_type"] = additionalFields["_type"];
    if (additionalFields["date_created__gte"] !== undefined) qs["date_created__gte"] = additionalFields["date_created__gte"];
    if (additionalFields["date_created__lte"] !== undefined) qs["date_created__lte"] = additionalFields["date_created__lte"];
    if (additionalFields["date_created__gt"] !== undefined) qs["date_created__gt"] = additionalFields["date_created__gt"];
    if (additionalFields["date_created__lt"] !== undefined) qs["date_created__lt"] = additionalFields["date_created__lt"];
    if (additionalFields["activity_at__gte"] !== undefined) qs["activity_at__gte"] = additionalFields["activity_at__gte"];
    if (additionalFields["activity_at__lte"] !== undefined) qs["activity_at__lte"] = additionalFields["activity_at__lte"];
    if (additionalFields["activity_at__gt"] !== undefined) qs["activity_at__gt"] = additionalFields["activity_at__gt"];
    if (additionalFields["activity_at__lt"] !== undefined) qs["activity_at__lt"] = additionalFields["activity_at__lt"];
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Find Meetings")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","has_more"], simplified: ["data","has_more"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.notes_create": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/activity/note/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        if (additionalFields["activity_at"] !== undefined) setBodyField(body as IDataObject, {"name":"activity_at","displayName":"Activity at","type":"string","format":"date-time","nullable":true}, additionalFields["activity_at"], this, itemIndex);
    if (additionalFields["attachments"] !== undefined) setBodyField(body as IDataObject, {"name":"attachments","displayName":"Attachments","type":"array","representation":"raw","nullable":true,"items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"content_type","displayName":"Content type","type":"string","nullable":true},{"name":"filename","displayName":"Filename","type":"string","required":true},{"name":"url","displayName":"Url","type":"string","format":"uri","required":true}]}}, additionalFields["attachments"], this, itemIndex);
    if (additionalFields["contact_id"] !== undefined) setBodyField(body as IDataObject, {"name":"contact_id","displayName":"Contact id","type":"string","nullable":true}, additionalFields["contact_id"], this, itemIndex);
    if (additionalFields["created_by"] !== undefined) setBodyField(body as IDataObject, {"name":"created_by","displayName":"Created by","type":"string","nullable":true}, additionalFields["created_by"], this, itemIndex);
    if (additionalFields["date_created"] !== undefined) setBodyField(body as IDataObject, {"name":"date_created","displayName":"Date created","type":"string","format":"date-time","nullable":true}, additionalFields["date_created"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"lead_id","displayName":"Lead id","type":"string","required":true}, this.getNodeParameter("lead_id", itemIndex), this, itemIndex);
    if (additionalFields["note"] !== undefined) setBodyField(body as IDataObject, {"name":"note","displayName":"Note","type":"string","nullable":true}, additionalFields["note"], this, itemIndex);
    if (additionalFields["note_html"] !== undefined) setBodyField(body as IDataObject, {"name":"note_html","displayName":"Note html","type":"string","nullable":true}, additionalFields["note_html"], this, itemIndex);
    if (additionalFields["organization_id"] !== undefined) setBodyField(body as IDataObject, {"name":"organization_id","displayName":"Organization id","type":"string","nullable":true}, additionalFields["organization_id"], this, itemIndex);
    if (additionalFields["pinned"] !== undefined) setBodyField(body as IDataObject, {"name":"pinned","displayName":"Pinned","type":"boolean","nullable":true}, additionalFields["pinned"], this, itemIndex);
    if (additionalFields["title"] !== undefined) setBodyField(body as IDataObject, {"name":"title","displayName":"Title","type":"string","nullable":true}, additionalFields["title"], this, itemIndex);
    if (additionalFields["user_id"] !== undefined) setBodyField(body as IDataObject, {"name":"user_id","displayName":"User id","type":"string","nullable":true}, additionalFields["user_id"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Create Note")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_type","activity_at","agent_action_reason","agent_config_id","attachments","comment_summary","contact_id","created_by","created_by_name","date_created","date_updated","id","lead_id","note","note_html","note_mentions","organization_id","pinned","pinned_at","source","title","updated_by","updated_by_name","user_id","user_name","users"], simplified: ["id","title","_type","activity_at","agent_action_reason","agent_config_id","contact_id","created_by","created_by_name","date_created"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.notes_get": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/activity/note/{id}/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Get Note")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_type","activity_at","agent_action_reason","agent_config_id","attachments","comment_summary","contact_id","created_by","created_by_name","date_created","date_updated","id","lead_id","note","note_html","note_mentions","organization_id","pinned","pinned_at","source","title","updated_by","updated_by_name","user_id","user_name","users"], simplified: ["id","title","_type","activity_at","agent_action_reason","agent_config_id","contact_id","created_by","created_by_name","date_created"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.notes_list": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/activity/note/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["_limit"] !== undefined) qs["_limit"] = additionalFields["_limit"];
    if (additionalFields["_skip"] !== undefined) qs["_skip"] = additionalFields["_skip"];
    if (additionalFields["id__in"] !== undefined) qs["id__in"] = additionalFields["id__in"];
    if (additionalFields["lead_id"] !== undefined) qs["lead_id"] = additionalFields["lead_id"];
    if (additionalFields["contact_id"] !== undefined) qs["contact_id"] = additionalFields["contact_id"];
    if (additionalFields["user_id"] !== undefined) qs["user_id"] = additionalFields["user_id"];
    if (additionalFields["organization_id"] !== undefined) qs["organization_id"] = additionalFields["organization_id"];
    if (additionalFields["_type"] !== undefined) qs["_type"] = additionalFields["_type"];
    if (additionalFields["date_created__gte"] !== undefined) qs["date_created__gte"] = additionalFields["date_created__gte"];
    if (additionalFields["date_created__lte"] !== undefined) qs["date_created__lte"] = additionalFields["date_created__lte"];
    if (additionalFields["date_created__gt"] !== undefined) qs["date_created__gt"] = additionalFields["date_created__gt"];
    if (additionalFields["date_created__lt"] !== undefined) qs["date_created__lt"] = additionalFields["date_created__lt"];
    if (additionalFields["activity_at__gte"] !== undefined) qs["activity_at__gte"] = additionalFields["activity_at__gte"];
    if (additionalFields["activity_at__lte"] !== undefined) qs["activity_at__lte"] = additionalFields["activity_at__lte"];
    if (additionalFields["activity_at__gt"] !== undefined) qs["activity_at__gt"] = additionalFields["activity_at__gt"];
    if (additionalFields["activity_at__lt"] !== undefined) qs["activity_at__lt"] = additionalFields["activity_at__lt"];
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Find Notes")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","has_more"], simplified: ["data","has_more"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.notes_update": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/activity/note/{id}/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        if (additionalFields["activity_at"] !== undefined) setBodyField(body as IDataObject, {"name":"activity_at","displayName":"Activity at","type":"string","format":"date-time","nullable":true}, additionalFields["activity_at"], this, itemIndex);
    if (additionalFields["attachments"] !== undefined) setBodyField(body as IDataObject, {"name":"attachments","displayName":"Attachments","type":"array","representation":"raw","nullable":true,"items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"content_type","displayName":"Content type","type":"string","nullable":true},{"name":"filename","displayName":"Filename","type":"string","required":true},{"name":"url","displayName":"Url","type":"string","format":"uri","required":true}]}}, additionalFields["attachments"], this, itemIndex);
    if (additionalFields["contact_id"] !== undefined) setBodyField(body as IDataObject, {"name":"contact_id","displayName":"Contact id","type":"string","nullable":true}, additionalFields["contact_id"], this, itemIndex);
    if (additionalFields["note"] !== undefined) setBodyField(body as IDataObject, {"name":"note","displayName":"Note","type":"string","nullable":true}, additionalFields["note"], this, itemIndex);
    if (additionalFields["note_html"] !== undefined) setBodyField(body as IDataObject, {"name":"note_html","displayName":"Note html","type":"string","nullable":true}, additionalFields["note_html"], this, itemIndex);
    if (additionalFields["pinned"] !== undefined) setBodyField(body as IDataObject, {"name":"pinned","displayName":"Pinned","type":"boolean","nullable":true}, additionalFields["pinned"], this, itemIndex);
    if (additionalFields["title"] !== undefined) setBodyField(body as IDataObject, {"name":"title","displayName":"Title","type":"string","nullable":true}, additionalFields["title"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Update Note")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_type","activity_at","agent_action_reason","agent_config_id","attachments","comment_summary","contact_id","created_by","created_by_name","date_created","date_updated","id","lead_id","note","note_html","note_mentions","organization_id","pinned","pinned_at","source","title","updated_by","updated_by_name","user_id","user_name","users"], simplified: ["id","title","_type","activity_at","agent_action_reason","agent_config_id","contact_id","created_by","created_by_name","date_created"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.opportunity_status_changes_list": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/activity/status_change/opportunity/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["_limit"] !== undefined) qs["_limit"] = additionalFields["_limit"];
    if (additionalFields["_skip"] !== undefined) qs["_skip"] = additionalFields["_skip"];
    if (additionalFields["id__in"] !== undefined) qs["id__in"] = additionalFields["id__in"];
    if (additionalFields["lead_id"] !== undefined) qs["lead_id"] = additionalFields["lead_id"];
    if (additionalFields["contact_id"] !== undefined) qs["contact_id"] = additionalFields["contact_id"];
    if (additionalFields["user_id"] !== undefined) qs["user_id"] = additionalFields["user_id"];
    if (additionalFields["organization_id"] !== undefined) qs["organization_id"] = additionalFields["organization_id"];
    if (additionalFields["_type"] !== undefined) qs["_type"] = additionalFields["_type"];
    if (additionalFields["date_created__gte"] !== undefined) qs["date_created__gte"] = additionalFields["date_created__gte"];
    if (additionalFields["date_created__lte"] !== undefined) qs["date_created__lte"] = additionalFields["date_created__lte"];
    if (additionalFields["date_created__gt"] !== undefined) qs["date_created__gt"] = additionalFields["date_created__gt"];
    if (additionalFields["date_created__lt"] !== undefined) qs["date_created__lt"] = additionalFields["date_created__lt"];
    if (additionalFields["activity_at__gte"] !== undefined) qs["activity_at__gte"] = additionalFields["activity_at__gte"];
    if (additionalFields["activity_at__lte"] !== undefined) qs["activity_at__lte"] = additionalFields["activity_at__lte"];
    if (additionalFields["activity_at__gt"] !== undefined) qs["activity_at__gt"] = additionalFields["activity_at__gt"];
    if (additionalFields["activity_at__lt"] !== undefined) qs["activity_at__lt"] = additionalFields["activity_at__lt"];
    if (additionalFields["opportunity_id"] !== undefined) qs["opportunity_id"] = additionalFields["opportunity_id"];
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "List Opportunity Status Changes")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","has_more"], simplified: ["data","has_more"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.sms_create": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/activity/sms/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["send_to_inbox"] !== undefined) qs["send_to_inbox"] = additionalFields["send_to_inbox"];
        if (additionalFields["activity_at"] !== undefined) setBodyField(body as IDataObject, {"name":"activity_at","displayName":"Activity at","type":"string","format":"date-time","nullable":true}, additionalFields["activity_at"], this, itemIndex);
    if (additionalFields["attachments"] !== undefined) setBodyField(body as IDataObject, {"name":"attachments","displayName":"Attachments","type":"array","representation":"raw","nullable":true,"items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"content_type","displayName":"Content type","type":"string","required":true,"enum":["application/pdf","application/vcard","audio/3gpp","audio/3gpp2","audio/L24","audio/ac3","audio/amr","audio/amr-nb","audio/basic","audio/mp4","audio/mpeg","audio/ogg","audio/vnd.rn-realaudio","audio/vnd.wave","audio/webm","image/bmp","image/gif","image/jpeg","image/jpg","image/png","image/tiff","text/calendar","text/csv","text/directory","text/richtext","text/rtf","text/vcard","text/x-vcard","video/3gpp","video/3gpp-tt","video/3gpp2","video/H261","video/H263","video/H263-1998","video/H263-2000","video/H264","video/mp4","video/mpeg","video/quicktime","video/webm"]},{"name":"filename","displayName":"Filename","type":"string","required":true},{"name":"url","displayName":"Url","type":"string","required":true}]}}, additionalFields["attachments"], this, itemIndex);
    if (additionalFields["caller_id_mode"] !== undefined) setBodyField(body as IDataObject, {"name":"caller_id_mode","displayName":"Caller id mode","type":"string","enum":["fixed","auto",null],"nullable":true}, additionalFields["caller_id_mode"], this, itemIndex);
    if (additionalFields["contact_id"] !== undefined) setBodyField(body as IDataObject, {"name":"contact_id","displayName":"Contact id","type":"string","nullable":true}, additionalFields["contact_id"], this, itemIndex);
    if (additionalFields["created_by"] !== undefined) setBodyField(body as IDataObject, {"name":"created_by","displayName":"Created by","type":"string","nullable":true}, additionalFields["created_by"], this, itemIndex);
    if (additionalFields["date_created"] !== undefined) setBodyField(body as IDataObject, {"name":"date_created","displayName":"Date created","type":"string","format":"date-time","nullable":true}, additionalFields["date_created"], this, itemIndex);
    if (additionalFields["direction"] !== undefined) setBodyField(body as IDataObject, {"name":"direction","displayName":"Direction","type":"string","enum":["inbound","outbound",null],"nullable":true}, additionalFields["direction"], this, itemIndex);
    if (additionalFields["lead_id"] !== undefined) setBodyField(body as IDataObject, {"name":"lead_id","displayName":"Lead id","type":"string","nullable":true}, additionalFields["lead_id"], this, itemIndex);
    if (additionalFields["local_phone"] !== undefined) setBodyField(body as IDataObject, {"name":"local_phone","displayName":"Local phone","description":"Phone number in E.164 format","type":"string","nullable":true}, additionalFields["local_phone"], this, itemIndex);
    if (additionalFields["organization_id"] !== undefined) setBodyField(body as IDataObject, {"name":"organization_id","displayName":"Organization id","type":"string","nullable":true}, additionalFields["organization_id"], this, itemIndex);
    if (additionalFields["remote_phone"] !== undefined) setBodyField(body as IDataObject, {"name":"remote_phone","displayName":"Remote phone","description":"Phone number in E.164 format","type":"string","nullable":true}, additionalFields["remote_phone"], this, itemIndex);
    if (additionalFields["source"] !== undefined) setBodyField(body as IDataObject, {"name":"source","displayName":"Source","type":"string","enum":["Close.io","External",null],"nullable":true}, additionalFields["source"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"status","displayName":"Status","type":"string","required":true,"enum":["inbox","draft","scheduled","outbox","sent","error"]}, this.getNodeParameter("status", itemIndex), this, itemIndex);
    if (additionalFields["template_id"] !== undefined) setBodyField(body as IDataObject, {"name":"template_id","displayName":"Template id","type":"string","nullable":true}, additionalFields["template_id"], this, itemIndex);
    if (additionalFields["text"] !== undefined) setBodyField(body as IDataObject, {"name":"text","displayName":"Text","type":"string","nullable":true}, additionalFields["text"], this, itemIndex);
    if (additionalFields["user_id"] !== undefined) setBodyField(body as IDataObject, {"name":"user_id","displayName":"User id","type":"string","nullable":true}, additionalFields["user_id"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Create SMS")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_type","activity_at","agent_action_reason","agent_config_id","caller_id_mode","caller_id_reason","contact_id","cost","created_by","created_by_name","date_created","date_scheduled","date_sent","date_updated","direction","error_message","id","lead_id","local_country_iso","local_phone","local_phone_formatted","organization_id","remote_country_iso","remote_phone","remote_phone_formatted","sequence_id","sequence_name","sequence_subscription_id","source","status","template_id","text","updated_by","updated_by_name","user_id","user_name","users"], simplified: ["id","status","_type","activity_at","agent_action_reason","agent_config_id","caller_id_mode","caller_id_reason","contact_id","cost"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.sms_list": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/activity/sms/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["_limit"] !== undefined) qs["_limit"] = additionalFields["_limit"];
    if (additionalFields["_skip"] !== undefined) qs["_skip"] = additionalFields["_skip"];
    if (additionalFields["id__in"] !== undefined) qs["id__in"] = additionalFields["id__in"];
    if (additionalFields["lead_id"] !== undefined) qs["lead_id"] = additionalFields["lead_id"];
    if (additionalFields["contact_id"] !== undefined) qs["contact_id"] = additionalFields["contact_id"];
    if (additionalFields["user_id"] !== undefined) qs["user_id"] = additionalFields["user_id"];
    if (additionalFields["organization_id"] !== undefined) qs["organization_id"] = additionalFields["organization_id"];
    if (additionalFields["_type"] !== undefined) qs["_type"] = additionalFields["_type"];
    if (additionalFields["date_created__gte"] !== undefined) qs["date_created__gte"] = additionalFields["date_created__gte"];
    if (additionalFields["date_created__lte"] !== undefined) qs["date_created__lte"] = additionalFields["date_created__lte"];
    if (additionalFields["date_created__gt"] !== undefined) qs["date_created__gt"] = additionalFields["date_created__gt"];
    if (additionalFields["date_created__lt"] !== undefined) qs["date_created__lt"] = additionalFields["date_created__lt"];
    if (additionalFields["activity_at__gte"] !== undefined) qs["activity_at__gte"] = additionalFields["activity_at__gte"];
    if (additionalFields["activity_at__lte"] !== undefined) qs["activity_at__lte"] = additionalFields["activity_at__lte"];
    if (additionalFields["activity_at__gt"] !== undefined) qs["activity_at__gt"] = additionalFields["activity_at__gt"];
    if (additionalFields["activity_at__lt"] !== undefined) qs["activity_at__lt"] = additionalFields["activity_at__lt"];
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "List SMS Messages")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","has_more"], simplified: ["data","has_more"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.task_completions_list": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/activity/task_completed/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["_limit"] !== undefined) qs["_limit"] = additionalFields["_limit"];
    if (additionalFields["_skip"] !== undefined) qs["_skip"] = additionalFields["_skip"];
    if (additionalFields["id__in"] !== undefined) qs["id__in"] = additionalFields["id__in"];
    if (additionalFields["lead_id"] !== undefined) qs["lead_id"] = additionalFields["lead_id"];
    if (additionalFields["contact_id"] !== undefined) qs["contact_id"] = additionalFields["contact_id"];
    if (additionalFields["user_id"] !== undefined) qs["user_id"] = additionalFields["user_id"];
    if (additionalFields["organization_id"] !== undefined) qs["organization_id"] = additionalFields["organization_id"];
    if (additionalFields["_type"] !== undefined) qs["_type"] = additionalFields["_type"];
    if (additionalFields["date_created__gte"] !== undefined) qs["date_created__gte"] = additionalFields["date_created__gte"];
    if (additionalFields["date_created__lte"] !== undefined) qs["date_created__lte"] = additionalFields["date_created__lte"];
    if (additionalFields["date_created__gt"] !== undefined) qs["date_created__gt"] = additionalFields["date_created__gt"];
    if (additionalFields["date_created__lt"] !== undefined) qs["date_created__lt"] = additionalFields["date_created__lt"];
    if (additionalFields["activity_at__gte"] !== undefined) qs["activity_at__gte"] = additionalFields["activity_at__gte"];
    if (additionalFields["activity_at__lte"] !== undefined) qs["activity_at__lte"] = additionalFields["activity_at__lte"];
    if (additionalFields["activity_at__gt"] !== undefined) qs["activity_at__gt"] = additionalFields["activity_at__gt"];
    if (additionalFields["activity_at__lt"] !== undefined) qs["activity_at__lt"] = additionalFields["activity_at__lt"];
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "List Task Completions")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","has_more"], simplified: ["data","has_more"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.whatsapp_messages_create": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/activity/whatsapp_message/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["send_to_inbox"] !== undefined) qs["send_to_inbox"] = additionalFields["send_to_inbox"];
        setBodyField(body as IDataObject, {"name":"activity_at","displayName":"Activity at","type":"string","format":"date-time","required":true}, this.getNodeParameter("activity_at", itemIndex), this, itemIndex);
    if (additionalFields["attachments"] !== undefined) setBodyField(body as IDataObject, {"name":"attachments","displayName":"Attachments","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"content_type","displayName":"Content type","type":"string","required":true},{"name":"filename","displayName":"Filename","type":"string","required":true},{"name":"url","displayName":"Url","type":"string","required":true}]}}, additionalFields["attachments"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"contact_id","displayName":"Contact id","type":"string","required":true}, this.getNodeParameter("contact_id", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"direction","displayName":"Direction","description":"Direction of communication. Outgoing means the communication flowing from the user to the lead/contact. Inbound means the opposite.","type":"string","required":true,"enum":["incoming","outgoing"]}, this.getNodeParameter("direction", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"external_whatsapp_message_id","displayName":"External whatsapp message id","type":"string","required":true}, this.getNodeParameter("external_whatsapp_message_id", itemIndex), this, itemIndex);
    if (additionalFields["integration_link"] !== undefined) setBodyField(body as IDataObject, {"name":"integration_link","displayName":"Integration link","type":"string","format":"uri","nullable":true}, additionalFields["integration_link"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"lead_id","displayName":"Lead id","type":"string","required":true}, this.getNodeParameter("lead_id", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"local_phone","displayName":"Local phone","type":"string","required":true}, this.getNodeParameter("local_phone", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"message_markdown","displayName":"Message markdown","type":"string","required":true}, this.getNodeParameter("message_markdown", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"remote_phone","displayName":"Remote phone","type":"string","required":true}, this.getNodeParameter("remote_phone", itemIndex), this, itemIndex);
    if (additionalFields["response_to_id"] !== undefined) setBodyField(body as IDataObject, {"name":"response_to_id","displayName":"Response to id","type":"string","nullable":true}, additionalFields["response_to_id"], this, itemIndex);
    if (additionalFields["user_id"] !== undefined) setBodyField(body as IDataObject, {"name":"user_id","displayName":"User id","type":"string","nullable":true}, additionalFields["user_id"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Create WhatsApp Message")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_type","activity_at","attachments","contact_id","created_by","created_by_name","date_created","date_updated","direction","external_whatsapp_message_id","id","integration_link","integration_name","lead_id","local_phone","local_phone_formatted","message_html","message_markdown","organization_id","remote_phone","remote_phone_formatted","response_to_id","sequence_id","sequence_name","sequence_subscription_id","source","text","updated_by","updated_by_name","user_id","user_name","users"], simplified: ["id","_type","activity_at","contact_id","created_by","created_by_name","date_created","date_updated","direction","external_whatsapp_message_id"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.whatsapp_messages_get": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/activity/whatsapp_message/{id}/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Get WhatsApp Message")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["_type","activity_at","attachments","contact_id","created_by","created_by_name","date_created","date_updated","direction","external_whatsapp_message_id","id","integration_link","integration_name","lead_id","local_phone","local_phone_formatted","message_html","message_markdown","organization_id","remote_phone","remote_phone_formatted","response_to_id","sequence_id","sequence_name","sequence_subscription_id","source","text","updated_by","updated_by_name","user_id","user_name","users"], simplified: ["id","_type","activity_at","contact_id","created_by","created_by_name","date_created","date_updated","direction","external_whatsapp_message_id"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "activities.whatsapp_messages_list": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/activity/whatsapp_message/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["_limit"] !== undefined) qs["_limit"] = additionalFields["_limit"];
    if (additionalFields["_skip"] !== undefined) qs["_skip"] = additionalFields["_skip"];
    if (additionalFields["id__in"] !== undefined) qs["id__in"] = additionalFields["id__in"];
    if (additionalFields["lead_id"] !== undefined) qs["lead_id"] = additionalFields["lead_id"];
    if (additionalFields["contact_id"] !== undefined) qs["contact_id"] = additionalFields["contact_id"];
    if (additionalFields["user_id"] !== undefined) qs["user_id"] = additionalFields["user_id"];
    if (additionalFields["organization_id"] !== undefined) qs["organization_id"] = additionalFields["organization_id"];
    if (additionalFields["_type"] !== undefined) qs["_type"] = additionalFields["_type"];
    if (additionalFields["date_created__gte"] !== undefined) qs["date_created__gte"] = additionalFields["date_created__gte"];
    if (additionalFields["date_created__lte"] !== undefined) qs["date_created__lte"] = additionalFields["date_created__lte"];
    if (additionalFields["date_created__gt"] !== undefined) qs["date_created__gt"] = additionalFields["date_created__gt"];
    if (additionalFields["date_created__lt"] !== undefined) qs["date_created__lt"] = additionalFields["date_created__lt"];
    if (additionalFields["activity_at__gte"] !== undefined) qs["activity_at__gte"] = additionalFields["activity_at__gte"];
    if (additionalFields["activity_at__lte"] !== undefined) qs["activity_at__lte"] = additionalFields["activity_at__lte"];
    if (additionalFields["activity_at__gt"] !== undefined) qs["activity_at__gt"] = additionalFields["activity_at__gt"];
    if (additionalFields["activity_at__lt"] !== undefined) qs["activity_at__lt"] = additionalFields["activity_at__lt"];
    if (additionalFields["external_whatsapp_message_id"] !== undefined) qs["external_whatsapp_message_id"] = additionalFields["external_whatsapp_message_id"];
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Find WhatsApp Messages")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","has_more"], simplified: ["data","has_more"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "bulk_actions.edit_create": {
        
        
        const path = "/bulk_action/edit/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Create Bulk Action")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["created_by","custom_field_name","custom_field_value","date_created","date_updated","id","lead_status_id","n_leads","n_leads_processed","n_objects","n_objects_processed","organization_id","query","results_limit","s_query","send_done_email","sort","status","type","updated_by"], simplified: ["id","status","type","created_by","custom_field_name","custom_field_value","date_created","date_updated","lead_status_id","n_leads"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "bulk_actions.email_create": {
        
        
        const path = "/bulk_action/email/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Create Bulk Email")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["contact_preference","created_by","date_created","date_updated","email_account_id","id","n_leads","n_leads_processed","n_objects","n_objects_processed","organization_id","query","results_limit","s_query","send_done_email","sender","sort","status","template_id","updated_by"], simplified: ["id","status","contact_preference","created_by","date_created","date_updated","email_account_id","n_leads","n_leads_processed","n_objects"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "bulk_actions.sequence_subscriptions_create": {
        
        
        const path = "/bulk_action/sequence_subscription/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Create Bulk Workflow Subscription Action")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["action_type","caller_id_mode","calls_assigned_to","contact_preference","created_by","date_created","date_updated","from_phone_number_id","id","n_leads","n_leads_processed","n_objects","n_objects_processed","organization_id","query","results_limit","s_query","send_done_email","sender_account_id","sender_email","sender_name","sequence_id","sort","status","updated_by"], simplified: ["id","status","action_type","caller_id_mode","contact_preference","created_by","date_created","date_updated","from_phone_number_id","n_leads"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "connected_accounts_get": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/connected_account/{id}/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Get Connected Account")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "connected_accounts_list": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/connected_account/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
    if (additionalFields["user_id"] !== undefined) qs["user_id"] = additionalFields["user_id"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Find Connected Accounts")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "contacts_create": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/contact/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        if (additionalFields["created_by"] !== undefined) setBodyField(body as IDataObject, {"name":"created_by","displayName":"Created by","type":"string","nullable":true}, additionalFields["created_by"], this, itemIndex);
    if (additionalFields["date_created"] !== undefined) setBodyField(body as IDataObject, {"name":"date_created","displayName":"Date created","type":"string","format":"date-time","nullable":true}, additionalFields["date_created"], this, itemIndex);
    if (additionalFields["emails"] !== undefined) setBodyField(body as IDataObject, {"name":"emails","displayName":"Emails","type":"array","representation":"raw","nullable":true,"items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"email","displayName":"Email","type":"string","format":"email","required":true},{"name":"type","displayName":"Type","type":"string"}]}}, additionalFields["emails"], this, itemIndex);
    if (additionalFields["lead_id"] !== undefined) setBodyField(body as IDataObject, {"name":"lead_id","displayName":"Lead id","type":"string","nullable":true}, additionalFields["lead_id"], this, itemIndex);
    if (additionalFields["name"] !== undefined) setBodyField(body as IDataObject, {"name":"name","displayName":"Name","type":"string","nullable":true}, additionalFields["name"], this, itemIndex);
    if (additionalFields["phones"] !== undefined) setBodyField(body as IDataObject, {"name":"phones","displayName":"Phones","type":"array","representation":"raw","nullable":true,"items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"phone","displayName":"Phone","description":"Phone number in E.164 format","type":"string","nullable":true},{"name":"type","displayName":"Type","type":"string"}]}}, additionalFields["phones"], this, itemIndex);
    if (additionalFields["timezone"] !== undefined) setBodyField(body as IDataObject, {"name":"timezone","displayName":"Timezone","description":"IANA timezone identifier","type":"string","nullable":true}, additionalFields["timezone"], this, itemIndex);
    if (additionalFields["title"] !== undefined) setBodyField(body as IDataObject, {"name":"title","displayName":"Title","type":"string","nullable":true}, additionalFields["title"], this, itemIndex);
    if (additionalFields["urls"] !== undefined) setBodyField(body as IDataObject, {"name":"urls","displayName":"Urls","type":"array","representation":"raw","nullable":true,"items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"type","displayName":"Type","type":"string"},{"name":"url","displayName":"Url","type":"string","format":"uri","required":true}]}}, additionalFields["urls"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Create Contact")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["created_by","date_created","date_updated","display_name","emails","id","integration_links","lead_id","lead_suggestions_operation_id","name","organization_id","phones","recent_calls","subscriptions","timezone","timezone_source","title","updated_by","urls"], simplified: ["id","name","title","created_by","date_created","date_updated","display_name","lead_id","lead_suggestions_operation_id","organization_id"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "contacts_get": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/contact/{id}/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Get Contact")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["created_by","date_created","date_updated","display_name","emails","id","integration_links","lead_id","lead_suggestions_operation_id","name","organization_id","phones","recent_calls","subscriptions","timezone","timezone_source","title","updated_by","urls"], simplified: ["id","name","title","created_by","date_created","date_updated","display_name","lead_id","lead_suggestions_operation_id","organization_id"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "contacts_list": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/contact/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["_limit"] !== undefined) qs["_limit"] = additionalFields["_limit"];
    if (additionalFields["_skip"] !== undefined) qs["_skip"] = additionalFields["_skip"];
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
    if (additionalFields["lead_id"] !== undefined) qs["lead_id"] = additionalFields["lead_id"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Find Contacts")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","has_more"], simplified: ["data","has_more"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "contacts_update": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/contact/{id}/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        if (additionalFields["emails"] !== undefined) setBodyField(body as IDataObject, {"name":"emails","displayName":"Emails","type":"array","representation":"raw","nullable":true,"items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"email","displayName":"Email","type":"string","format":"email","required":true},{"name":"type","displayName":"Type","type":"string"}]}}, additionalFields["emails"], this, itemIndex);
    if (additionalFields["lead_id"] !== undefined) setBodyField(body as IDataObject, {"name":"lead_id","displayName":"Lead id","type":"string","nullable":true}, additionalFields["lead_id"], this, itemIndex);
    if (additionalFields["name"] !== undefined) setBodyField(body as IDataObject, {"name":"name","displayName":"Name","type":"string","nullable":true}, additionalFields["name"], this, itemIndex);
    if (additionalFields["phones"] !== undefined) setBodyField(body as IDataObject, {"name":"phones","displayName":"Phones","type":"array","representation":"raw","nullable":true,"items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"phone","displayName":"Phone","description":"Phone number in E.164 format","type":"string","nullable":true},{"name":"type","displayName":"Type","type":"string"}]}}, additionalFields["phones"], this, itemIndex);
    if (additionalFields["timezone"] !== undefined) setBodyField(body as IDataObject, {"name":"timezone","displayName":"Timezone","description":"IANA timezone identifier","type":"string","nullable":true}, additionalFields["timezone"], this, itemIndex);
    if (additionalFields["title"] !== undefined) setBodyField(body as IDataObject, {"name":"title","displayName":"Title","type":"string","nullable":true}, additionalFields["title"], this, itemIndex);
    if (additionalFields["urls"] !== undefined) setBodyField(body as IDataObject, {"name":"urls","displayName":"Urls","type":"array","representation":"raw","nullable":true,"items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"type","displayName":"Type","type":"string"},{"name":"url","displayName":"Url","type":"string","format":"uri","required":true}]}}, additionalFields["urls"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Update Contact")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["created_by","date_created","date_updated","display_name","emails","id","integration_links","lead_id","lead_suggestions_operation_id","name","organization_id","phones","recent_calls","subscriptions","timezone","timezone_source","title","updated_by","urls"], simplified: ["id","name","title","created_by","date_created","date_updated","display_name","lead_id","lead_suggestions_operation_id","organization_id"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "custom_objects_create": {
        
        
        const path = "/custom_object/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Create Custom Object")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "custom_objects_get": {
        
        
        let path = "/custom_object/{id}/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Get Custom Object")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "custom_objects_list": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/custom_object/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        qs["lead_id"] = this.getNodeParameter("lead_id", itemIndex);
    if (additionalFields["custom_object_type_id"] !== undefined) qs["custom_object_type_id"] = additionalFields["custom_object_type_id"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Find Custom Objects")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "custom_objects_update": {
        
        
        let path = "/custom_object/{id}/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Update Custom Object")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "events_list": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/event/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["_limit"] !== undefined) qs["_limit"] = additionalFields["_limit"];
    if (additionalFields["_skip"] !== undefined) qs["_skip"] = additionalFields["_skip"];
    if (additionalFields["object_type"] !== undefined) qs["object_type"] = additionalFields["object_type"];
    if (additionalFields["object_id"] !== undefined) qs["object_id"] = additionalFields["object_id"];
    if (additionalFields["lead_id"] !== undefined) qs["lead_id"] = additionalFields["lead_id"];
    if (additionalFields["action"] !== undefined) qs["action"] = additionalFields["action"];
    if (additionalFields["user_id"] !== undefined) qs["user_id"] = additionalFields["user_id"];
    if (additionalFields["date_updated__gt"] !== undefined) qs["date_updated__gt"] = additionalFields["date_updated__gt"];
    if (additionalFields["date_updated__gte"] !== undefined) qs["date_updated__gte"] = additionalFields["date_updated__gte"];
    if (additionalFields["date_updated__lt"] !== undefined) qs["date_updated__lt"] = additionalFields["date_updated__lt"];
    if (additionalFields["date_updated__lte"] !== undefined) qs["date_updated__lte"] = additionalFields["date_updated__lte"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "List Events")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "exports_create_lead": {
        
        
        const path = "/export/lead/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Create Lead Export")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["created_by","date_created","date_format","date_updated","download_url","fields","format","id","limit","n_docs","n_docs_processed","organization_id","params","query","results_limit","s_query","send_done_email","sort","status","type","updated_by"], simplified: ["id","status","type","created_by","date_created","date_format","date_updated","download_url","format","limit"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "exports_create_opportunity": {
        
        
        const path = "/export/opportunity/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Create Opportunity Export")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["created_by","date_created","date_format","date_updated","download_url","fields","format","id","limit","n_docs","n_docs_processed","organization_id","params","query","results_limit","s_query","send_done_email","sort","status","type","updated_by"], simplified: ["id","status","type","created_by","date_created","date_format","date_updated","download_url","format","limit"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "exports_list": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/export/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["_limit"] !== undefined) qs["_limit"] = additionalFields["_limit"];
    if (additionalFields["_skip"] !== undefined) qs["_skip"] = additionalFields["_skip"];
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "List Exports")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","has_more"], simplified: ["data","has_more"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "groups_get": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/group/{id}/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Get Group")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["id","members","name","organization_id"], simplified: ["id","members","name","organization_id"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "groups_list": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/group/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Find Groups")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","has_more"], simplified: ["data","has_more"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "leads_create": {
        
        
        const path = "/lead/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Create Lead")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["addresses","contact_ids","contacts","contacts_summary","created_by","created_by_name","date_created","date_updated","description","display_name","html_url","id","integration_links","localtime","name","opportunities","organization_id","primary_address_full","primary_address_summary","primary_email","primary_phone","recent_calls","source","status_id","status_label","summaries","tasks","updated_by","updated_by_name","url"], simplified: ["id","name","description","contacts_summary","created_by","created_by_name","date_created","date_updated","display_name","html_url"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "leads_get": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/lead/{id}/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Get Lead")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["addresses","contact_ids","contacts","contacts_summary","created_by","created_by_name","date_created","date_updated","description","display_name","html_url","id","integration_links","localtime","name","opportunities","organization_id","primary_address_full","primary_address_summary","primary_email","primary_phone","recent_calls","source","status_id","status_label","summaries","tasks","updated_by","updated_by_name","url"], simplified: ["id","name","description","contacts_summary","created_by","created_by_name","date_created","date_updated","display_name","html_url"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "leads_list": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/lead/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["_limit"] !== undefined) qs["_limit"] = additionalFields["_limit"];
    if (additionalFields["_skip"] !== undefined) qs["_skip"] = additionalFields["_skip"];
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Find Leads")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","has_more"], simplified: ["data","has_more"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "leads_merge": {
        
        
        const path = "/lead/merge/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Merge Two Leads")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "leads_update": {
        
        
        let path = "/lead/{id}/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Update Lead")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["addresses","contact_ids","contacts","contacts_summary","created_by","created_by_name","date_created","date_updated","description","display_name","html_url","id","integration_links","localtime","name","opportunities","organization_id","primary_address_full","primary_address_summary","primary_email","primary_phone","recent_calls","source","status_id","status_label","summaries","tasks","updated_by","updated_by_name","url"], simplified: ["id","name","description","contacts_summary","created_by","created_by_name","date_created","date_updated","display_name","html_url"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "opportunities_create": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/opportunity/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        if (additionalFields["attachments"] !== undefined) setBodyField(body as IDataObject, {"name":"attachments","displayName":"Attachments","type":"array","representation":"raw","nullable":true,"items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"content_type","displayName":"Content type","type":"string","default":""},{"name":"filename","displayName":"Filename","type":"string","required":true},{"name":"url","displayName":"Url","type":"string","required":true}]}}, additionalFields["attachments"], this, itemIndex);
    if (additionalFields["confidence"] !== undefined) setBodyField(body as IDataObject, {"name":"confidence","displayName":"Confidence","type":"integer","nullable":true}, additionalFields["confidence"], this, itemIndex);
    if (additionalFields["contact_id"] !== undefined) setBodyField(body as IDataObject, {"name":"contact_id","displayName":"Contact id","type":"string","nullable":true}, additionalFields["contact_id"], this, itemIndex);
    if (additionalFields["created_by"] !== undefined) setBodyField(body as IDataObject, {"name":"created_by","displayName":"Created by","type":"string","nullable":true}, additionalFields["created_by"], this, itemIndex);
    if (additionalFields["date_created"] !== undefined) setBodyField(body as IDataObject, {"name":"date_created","displayName":"Date created","type":"string","format":"date-time","nullable":true}, additionalFields["date_created"], this, itemIndex);
    if (additionalFields["date_won"] !== undefined) setBodyField(body as IDataObject, {"name":"date_won","displayName":"Date won","description":"If omitted when setting status_id to a won status, Close sets today's date using the UTC offset in x-tz-offset.","type":"string","format":"date-time","nullable":true}, additionalFields["date_won"], this, itemIndex);
    if (additionalFields["lead_id"] !== undefined) setBodyField(body as IDataObject, {"name":"lead_id","displayName":"Lead id","description":"Opportunities belong to exactly one Lead. If not provided, a new lead will be created (appearing as \"Untitled\" in the UI).","type":"string","nullable":true}, additionalFields["lead_id"], this, itemIndex);
    if (additionalFields["note"] !== undefined) setBodyField(body as IDataObject, {"name":"note","displayName":"Note","description":"Plaintext/markdown version of the note. If `note_html` is also provided in the same request, this value is ignored and `note` is derived from the HTML instead.","type":"string","nullable":true}, additionalFields["note"], this, itemIndex);
    if (additionalFields["note_html"] !== undefined) setBodyField(body as IDataObject, {"name":"note_html","displayName":"Note html","description":"Rich-text HTML version of the note. When set, `note` is automatically populated with the plaintext version (tags become markdown), overriding any `note` value passed in the same request.","type":"string","nullable":true}, additionalFields["note_html"], this, itemIndex);
    if (additionalFields["pipeline_id"] !== undefined) setBodyField(body as IDataObject, {"name":"pipeline_id","displayName":"Pipeline id","description":"ID of the opportunity pipeline. If status_id is also set, it must belong to this pipeline; otherwise the pipeline’s first status is used.","type":"string","nullable":true}, additionalFields["pipeline_id"], this, itemIndex);
    if (additionalFields["status_id"] !== undefined) setBodyField(body as IDataObject, {"name":"status_id","displayName":"Status id","description":"Choose an opportunity status. If omitted, Close uses the organization's default status or, when pipeline_id is set, that pipeline's first status. See the Opportunity Status API.","type":"string","nullable":true}, additionalFields["status_id"], this, itemIndex);
    if (additionalFields["user_id"] !== undefined) setBodyField(body as IDataObject, {"name":"user_id","displayName":"User id","type":"string","nullable":true}, additionalFields["user_id"], this, itemIndex);
    if (additionalFields["value"] !== undefined) setBodyField(body as IDataObject, {"name":"value","displayName":"Value","type":"integer","nullable":true}, additionalFields["value"], this, itemIndex);
    if (additionalFields["value_period"] !== undefined) setBodyField(body as IDataObject, {"name":"value_period","displayName":"Value period","type":"string","nullable":true}, additionalFields["value_period"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Create Opportunity")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["annualized_expected_value","annualized_value","attachments","comment_summary","confidence","contact_id","contact_name","created_by","created_by_name","date_created","date_lost","date_updated","date_won","expected_value","id","integration_links","is_stalled","lead_id","lead_name","lead_primary_email","lead_primary_phone","note","note_html","organization_id","pipeline_id","pipeline_name","stall_status","status_display_name","status_id","status_label","status_type","suggested_action","updated_by","updated_by_name","user_id","user_name","value","value_currency","value_formatted","value_period"], simplified: ["id","annualized_expected_value","annualized_value","confidence","contact_id","contact_name","created_by","created_by_name","date_created","date_lost"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "opportunities_get": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/opportunity/{id}/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Get Opportunity")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["annualized_expected_value","annualized_value","attachments","comment_summary","confidence","contact_id","contact_name","created_by","created_by_name","date_created","date_lost","date_updated","date_won","expected_value","id","integration_links","is_stalled","lead_id","lead_name","lead_primary_email","lead_primary_phone","note","note_html","organization_id","pipeline_id","pipeline_name","stall_status","status_display_name","status_id","status_label","status_type","suggested_action","updated_by","updated_by_name","user_id","user_name","value","value_currency","value_formatted","value_period"], simplified: ["id","annualized_expected_value","annualized_value","confidence","contact_id","contact_name","created_by","created_by_name","date_created","date_lost"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "opportunities_list": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/opportunity/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["_limit"] !== undefined) qs["_limit"] = additionalFields["_limit"];
    if (additionalFields["_skip"] !== undefined) qs["_skip"] = additionalFields["_skip"];
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
    if (additionalFields["lead_id"] !== undefined) qs["lead_id"] = additionalFields["lead_id"];
    if (additionalFields["organization_id"] !== undefined) qs["organization_id"] = additionalFields["organization_id"];
    if (additionalFields["user_id"] !== undefined) qs["user_id"] = additionalFields["user_id"];
    if (additionalFields["user_id__in"] !== undefined) qs["user_id__in"] = additionalFields["user_id__in"];
    if (additionalFields["status_id"] !== undefined) qs["status_id"] = additionalFields["status_id"];
    if (additionalFields["status_id__in"] !== undefined) qs["status_id__in"] = additionalFields["status_id__in"];
    if (additionalFields["status_type"] !== undefined) qs["status_type"] = additionalFields["status_type"];
    if (additionalFields["status_type__in"] !== undefined) qs["status_type__in"] = additionalFields["status_type__in"];
    if (additionalFields["status_label"] !== undefined) qs["status_label"] = additionalFields["status_label"];
    if (additionalFields["status_label__in"] !== undefined) qs["status_label__in"] = additionalFields["status_label__in"];
    if (additionalFields["status"] !== undefined) qs["status"] = additionalFields["status"];
    if (additionalFields["status__in"] !== undefined) qs["status__in"] = additionalFields["status__in"];
    if (additionalFields["date_won"] !== undefined) qs["date_won"] = additionalFields["date_won"];
    if (additionalFields["date_won__gte"] !== undefined) qs["date_won__gte"] = additionalFields["date_won__gte"];
    if (additionalFields["date_won__gt"] !== undefined) qs["date_won__gt"] = additionalFields["date_won__gt"];
    if (additionalFields["date_won__lte"] !== undefined) qs["date_won__lte"] = additionalFields["date_won__lte"];
    if (additionalFields["date_won__lt"] !== undefined) qs["date_won__lt"] = additionalFields["date_won__lt"];
    if (additionalFields["date_created"] !== undefined) qs["date_created"] = additionalFields["date_created"];
    if (additionalFields["date_created__gte"] !== undefined) qs["date_created__gte"] = additionalFields["date_created__gte"];
    if (additionalFields["date_created__gt"] !== undefined) qs["date_created__gt"] = additionalFields["date_created__gt"];
    if (additionalFields["date_created__lte"] !== undefined) qs["date_created__lte"] = additionalFields["date_created__lte"];
    if (additionalFields["date_created__lt"] !== undefined) qs["date_created__lt"] = additionalFields["date_created__lt"];
    if (additionalFields["date_updated"] !== undefined) qs["date_updated"] = additionalFields["date_updated"];
    if (additionalFields["date_updated__gte"] !== undefined) qs["date_updated__gte"] = additionalFields["date_updated__gte"];
    if (additionalFields["date_updated__gt"] !== undefined) qs["date_updated__gt"] = additionalFields["date_updated__gt"];
    if (additionalFields["date_updated__lte"] !== undefined) qs["date_updated__lte"] = additionalFields["date_updated__lte"];
    if (additionalFields["date_updated__lt"] !== undefined) qs["date_updated__lt"] = additionalFields["date_updated__lt"];
    if (additionalFields["value_period"] !== undefined) qs["value_period"] = additionalFields["value_period"];
    if (additionalFields["value_period__in"] !== undefined) qs["value_period__in"] = additionalFields["value_period__in"];
    if (additionalFields["query"] !== undefined) qs["query"] = additionalFields["query"];
    if (additionalFields["lead_query"] !== undefined) qs["lead_query"] = additionalFields["lead_query"];
    if (additionalFields["lead_saved_search_id"] !== undefined) qs["lead_saved_search_id"] = additionalFields["lead_saved_search_id"];
    if (additionalFields["is_stalled"] !== undefined) qs["is_stalled"] = additionalFields["is_stalled"];
    if (additionalFields["_order_by"] !== undefined) qs["_order_by"] = additionalFields["_order_by"];
    if (additionalFields["_group_by"] !== undefined) qs["_group_by"] = additionalFields["_group_by"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Find Opportunities")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","has_more"], simplified: ["data","has_more"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "opportunities_update": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/opportunity/{id}/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        if (additionalFields["attachments"] !== undefined) setBodyField(body as IDataObject, {"name":"attachments","displayName":"Attachments","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"object","representation":"raw","fields":[{"name":"content_type","displayName":"Content type","type":"string","default":""},{"name":"filename","displayName":"Filename","type":"string","required":true},{"name":"url","displayName":"Url","type":"string","required":true}]}}, additionalFields["attachments"], this, itemIndex);
    if (additionalFields["confidence"] !== undefined) setBodyField(body as IDataObject, {"name":"confidence","displayName":"Confidence","type":"integer"}, additionalFields["confidence"], this, itemIndex);
    if (additionalFields["contact_id"] !== undefined) setBodyField(body as IDataObject, {"name":"contact_id","displayName":"Contact id","type":"string","nullable":true}, additionalFields["contact_id"], this, itemIndex);
    if (additionalFields["date_won"] !== undefined) setBodyField(body as IDataObject, {"name":"date_won","displayName":"Date won","description":"If omitted when setting status_id to a won status, Close sets today's date using the UTC offset in x-tz-offset.","type":"string","format":"date-time","nullable":true}, additionalFields["date_won"], this, itemIndex);
    if (additionalFields["note"] !== undefined) setBodyField(body as IDataObject, {"name":"note","displayName":"Note","description":"Plaintext/markdown version of the note. If `note_html` is also provided in the same request, this value is ignored and `note` is derived from the HTML instead.","type":"string"}, additionalFields["note"], this, itemIndex);
    if (additionalFields["note_html"] !== undefined) setBodyField(body as IDataObject, {"name":"note_html","displayName":"Note html","description":"Rich-text HTML for the note. Setting it also generates the plaintext note, overriding any note sent in the same request. Pass null to clear note_html and note.","type":"string","nullable":true}, additionalFields["note_html"], this, itemIndex);
    if (additionalFields["status"] !== undefined) setBodyField(body as IDataObject, {"name":"status","displayName":"Status","type":"string"}, additionalFields["status"], this, itemIndex);
    if (additionalFields["status_id"] !== undefined) setBodyField(body as IDataObject, {"name":"status_id","displayName":"Status id","description":"Setting a won status automatically sets date_won if it is unset. Changing the status from won to active or lost does not update date_won.","type":"string"}, additionalFields["status_id"], this, itemIndex);
    if (additionalFields["user_id"] !== undefined) setBodyField(body as IDataObject, {"name":"user_id","displayName":"User id","type":"string","nullable":true}, additionalFields["user_id"], this, itemIndex);
    if (additionalFields["value"] !== undefined) setBodyField(body as IDataObject, {"name":"value","displayName":"Value","type":"integer"}, additionalFields["value"], this, itemIndex);
    if (additionalFields["value_period"] !== undefined) setBodyField(body as IDataObject, {"name":"value_period","displayName":"Value period","type":"string","enum":["one_time","monthly","annual"]}, additionalFields["value_period"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Update Opportunity")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["annualized_expected_value","annualized_value","attachments","comment_summary","confidence","contact_id","contact_name","created_by","created_by_name","date_created","date_lost","date_updated","date_won","expected_value","id","integration_links","is_stalled","lead_id","lead_name","lead_primary_email","lead_primary_phone","note","note_html","organization_id","pipeline_id","pipeline_name","stall_status","status_display_name","status_id","status_label","status_type","suggested_action","updated_by","updated_by_name","user_id","user_name","value","value_currency","value_formatted","value_period"], simplified: ["id","annualized_expected_value","annualized_value","confidence","contact_id","contact_name","created_by","created_by_name","date_created","date_lost"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "phone_numbers_update": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/phone_number/{id}/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        if (additionalFields["forward_to"] !== undefined) setBodyField(body as IDataObject, {"name":"forward_to","displayName":"Forward to","type":"string"}, additionalFields["forward_to"], this, itemIndex);
    if (additionalFields["forward_to_enabled"] !== undefined) setBodyField(body as IDataObject, {"name":"forward_to_enabled","displayName":"Forward to enabled","type":"boolean"}, additionalFields["forward_to_enabled"], this, itemIndex);
    if (additionalFields["inbound_ring_duration"] !== undefined) setBodyField(body as IDataObject, {"name":"inbound_ring_duration","displayName":"Inbound ring duration","description":"Number of seconds (15-90) to ring this number on inbound calls before moving on (e.g. to voicemail).","type":"integer","minValue":15,"maxValue":90}, additionalFields["inbound_ring_duration"], this, itemIndex);
    if (additionalFields["label"] !== undefined) setBodyField(body as IDataObject, {"name":"label","displayName":"Label","type":"string"}, additionalFields["label"], this, itemIndex);
    if (additionalFields["participants"] !== undefined) setBodyField(body as IDataObject, {"name":"participants","displayName":"Participants","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"string"}}, additionalFields["participants"], this, itemIndex);
    if (additionalFields["phone_numbers"] !== undefined) setBodyField(body as IDataObject, {"name":"phone_numbers","displayName":"Phone numbers","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"string"}}, additionalFields["phone_numbers"], this, itemIndex);
    if (additionalFields["press_1_to_accept"] !== undefined) setBodyField(body as IDataObject, {"name":"press_1_to_accept","displayName":"Press 1 to accept","type":"boolean"}, additionalFields["press_1_to_accept"], this, itemIndex);
    if (additionalFields["voicemail_greeting_url"] !== undefined) setBodyField(body as IDataObject, {"name":"voicemail_greeting_url","displayName":"Voicemail greeting url","type":"string","nullable":true}, additionalFields["voicemail_greeting_url"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Toggle Forwarding on Phone Number")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["address_id","bundle_id","carrier","carrier_type","country","date_created","date_updated","forward_to","forward_to_enabled","forward_to_formatted","id","inbound_ring_duration","is_group_number","is_premium","is_verified","label","last_billed_price","mms_enabled","next_billing_on","number","number_formatted","organization_id","participants","phone_numbers","phone_numbers_formatted","press_1_to_accept","sms_enabled","supports_mms_to_countries","supports_sms_to_countries","type","user_id","voicemail_greeting_url","was_ported"], simplified: ["id","type","address_id","bundle_id","carrier","carrier_type","country","date_created","date_updated","forward_to"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "reporting_get_activity": {
        
        
        const path = "/report/activity/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Run Activity Report")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "reporting_get_custom": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/report/custom/{org_id}/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{org_id}").join(encodeURIComponent(String(this.getNodeParameter("org_id", itemIndex))));
    if (additionalFields["query"] !== undefined) qs["query"] = additionalFields["query"];
    if (additionalFields["x"] !== undefined) qs["x"] = additionalFields["x"];
    if (additionalFields["y"] !== undefined) qs["y"] = additionalFields["y"];
    if (additionalFields["group_by"] !== undefined) qs["group_by"] = additionalFields["group_by"];
    if (additionalFields["transform_y"] !== undefined) qs["transform_y"] = additionalFields["transform_y"];
    if (additionalFields["interval"] !== undefined) qs["interval"] = additionalFields["interval"];
    if (additionalFields["start"] !== undefined) qs["start"] = additionalFields["start"];
    if (additionalFields["end"] !== undefined) qs["end"] = additionalFields["end"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Run Opportunity Report")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "reporting_get_funnel_stages": {
        
        
        const path = "/report/funnel/opportunity/stages/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Run Opportunity Funnel Report by Stage")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "reporting_get_funnel_totals": {
        
        
        const path = "/report/funnel/opportunity/totals/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Run Opportunity Funnel Totals Report")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "reporting_get_lead_statuses": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/report/statuses/lead/{org_id}/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{org_id}").join(encodeURIComponent(String(this.getNodeParameter("org_id", itemIndex))));
    if (additionalFields["date_start"] !== undefined) qs["date_start"] = additionalFields["date_start"];
    if (additionalFields["date_end"] !== undefined) qs["date_end"] = additionalFields["date_end"];
    if (additionalFields["query"] !== undefined) qs["query"] = additionalFields["query"];
    if (additionalFields["smart_view_id"] !== undefined) qs["smart_view_id"] = additionalFields["smart_view_id"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Run Lead Status Change Report")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "reporting_get_opportunity_statuses": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/report/statuses/opportunity/{org_id}/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{org_id}").join(encodeURIComponent(String(this.getNodeParameter("org_id", itemIndex))));
    if (additionalFields["date_start"] !== undefined) qs["date_start"] = additionalFields["date_start"];
    if (additionalFields["date_end"] !== undefined) qs["date_end"] = additionalFields["date_end"];
    if (additionalFields["query"] !== undefined) qs["query"] = additionalFields["query"];
    if (additionalFields["smart_view_id"] !== undefined) qs["smart_view_id"] = additionalFields["smart_view_id"];
    if (additionalFields["user_id"] !== undefined) qs["user_id"] = additionalFields["user_id"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Run Opportunity Status Change Report")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "reporting_get_sent_emails": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/report/sent_emails/{org_id}/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{org_id}").join(encodeURIComponent(String(this.getNodeParameter("org_id", itemIndex))));
    if (additionalFields["date_start"] !== undefined) qs["date_start"] = additionalFields["date_start"];
    if (additionalFields["date_end"] !== undefined) qs["date_end"] = additionalFields["date_end"];
    if (additionalFields["user_id"] !== undefined) qs["user_id"] = additionalFields["user_id"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Run Sent Email Report")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "sequences_create_subscription": {
        
        
        const path = "/sequence_subscription/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Subscribe Contact to Workflow")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "sequences_get_subscription": {
        
        
        let path = "/sequence_subscription/{id}/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Get Workflow Subscription")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "sequences_list_subscriptions": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/sequence_subscription/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["_limit"] !== undefined) qs["_limit"] = additionalFields["_limit"];
    if (additionalFields["_skip"] !== undefined) qs["_skip"] = additionalFields["_skip"];
    if (additionalFields["contact_id"] !== undefined) qs["contact_id"] = additionalFields["contact_id"];
    if (additionalFields["lead_id"] !== undefined) qs["lead_id"] = additionalFields["lead_id"];
    if (additionalFields["sequence_id"] !== undefined) qs["sequence_id"] = additionalFields["sequence_id"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Find Workflow Subscriptions")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "sequences_update_subscription": {
        
        
        let path = "/sequence_subscription/{id}/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Update Workflow Subscription")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "smart_views_create": {
        
        
        const path = "/saved_search/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Create Lead Smart View")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["date_created","date_updated","description","id","is_shared","is_user_dependent","name","organization_id","query","s_query","selected_fields","shared_with","sharing_settings","type","user_id"], simplified: ["id","name","type","description","date_created","date_updated","is_shared","is_user_dependent","organization_id","query"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "smart_views_update": {
        
        
        let path = "/saved_search/{id}/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Update Lead Smart View")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["date_created","date_updated","description","id","is_shared","is_user_dependent","name","organization_id","query","s_query","selected_fields","shared_with","sharing_settings","type","user_id"], simplified: ["id","name","type","description","date_created","date_updated","is_shared","is_user_dependent","organization_id","query"] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "tasks_create": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/task/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        let body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        body = normalizeJsonValue(this.getNodeParameter("bodyJson", itemIndex), "Body JSON", this, itemIndex) as typeof body; validateBodyValue(body, {"name":"bodyJson","displayName":"Body JSON","type":"any","required":true,"description":"Raw request body","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"string"},{"name":"alternative2","displayName":"Alternative2","type":"string"}],"composition":"oneOf","representation":"raw"}, "Body JSON", this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Create Task")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "tasks_get": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/task/{id}/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Get Task")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "tasks_list": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/task/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["_limit"] !== undefined) qs["_limit"] = additionalFields["_limit"];
    if (additionalFields["_skip"] !== undefined) qs["_skip"] = additionalFields["_skip"];
    if (additionalFields["assigned_to"] !== undefined) qs["assigned_to"] = additionalFields["assigned_to"];
    if (additionalFields["format"] !== undefined) qs["format"] = additionalFields["format"];
    if (additionalFields["id"] !== undefined) qs["id"] = additionalFields["id"];
    if (additionalFields["id__in"] !== undefined) qs["id__in"] = additionalFields["id__in"];
    if (additionalFields["is_complete"] !== undefined) qs["is_complete"] = additionalFields["is_complete"];
    if (additionalFields["lead_id"] !== undefined) qs["lead_id"] = additionalFields["lead_id"];
    if (additionalFields["_order_by"] !== undefined) qs["_order_by"] = additionalFields["_order_by"];
    if (additionalFields["organization_id"] !== undefined) qs["organization_id"] = additionalFields["organization_id"];
    if (additionalFields["_type"] !== undefined) qs["_type"] = additionalFields["_type"];
    if (additionalFields["_type__in"] !== undefined) qs["_type__in"] = additionalFields["_type__in"];
    if (additionalFields["view"] !== undefined) qs["view"] = additionalFields["view"];
    if (additionalFields["date"] !== undefined) qs["date"] = additionalFields["date"];
    if (additionalFields["date__lt"] !== undefined) qs["date__lt"] = additionalFields["date__lt"];
    if (additionalFields["date__lte"] !== undefined) qs["date__lte"] = additionalFields["date__lte"];
    if (additionalFields["date__gt"] !== undefined) qs["date__gt"] = additionalFields["date__gt"];
    if (additionalFields["date__gte"] !== undefined) qs["date__gte"] = additionalFields["date__gte"];
    if (additionalFields["due_date"] !== undefined) qs["due_date"] = additionalFields["due_date"];
    if (additionalFields["due_date__lt"] !== undefined) qs["due_date__lt"] = additionalFields["due_date__lt"];
    if (additionalFields["due_date__lte"] !== undefined) qs["due_date__lte"] = additionalFields["due_date__lte"];
    if (additionalFields["due_date__gt"] !== undefined) qs["due_date__gt"] = additionalFields["due_date__gt"];
    if (additionalFields["due_date__gte"] !== undefined) qs["due_date__gte"] = additionalFields["due_date__gte"];
    if (additionalFields["date_created__lt"] !== undefined) qs["date_created__lt"] = additionalFields["date_created__lt"];
    if (additionalFields["date_created__lte"] !== undefined) qs["date_created__lte"] = additionalFields["date_created__lte"];
    if (additionalFields["date_created__gt"] !== undefined) qs["date_created__gt"] = additionalFields["date_created__gt"];
    if (additionalFields["date_created__gte"] !== undefined) qs["date_created__gte"] = additionalFields["date_created__gte"];
    if (additionalFields["date_updated__lt"] !== undefined) qs["date_updated__lt"] = additionalFields["date_updated__lt"];
    if (additionalFields["date_updated__lte"] !== undefined) qs["date_updated__lte"] = additionalFields["date_updated__lte"];
    if (additionalFields["date_updated__gt"] !== undefined) qs["date_updated__gt"] = additionalFields["date_updated__gt"];
    if (additionalFields["date_updated__gte"] !== undefined) qs["date_updated__gte"] = additionalFields["date_updated__gte"];
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Find Tasks")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "tasks_update": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/task/{id}/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
    if (additionalFields["_fields"] !== undefined) qs["_fields"] = additionalFields["_fields"];
        if (additionalFields["agent_config_id"] !== undefined) setBodyField(body as IDataObject, {"name":"agent_config_id","displayName":"Agent config id","type":"string","nullable":true}, additionalFields["agent_config_id"], this, itemIndex);
    if (additionalFields["assigned_to"] !== undefined) setBodyField(body as IDataObject, {"name":"assigned_to","displayName":"Assigned to","type":"string"}, additionalFields["assigned_to"], this, itemIndex);
    if (additionalFields["contact_id"] !== undefined) setBodyField(body as IDataObject, {"name":"contact_id","displayName":"Contact id","type":"string","nullable":true}, additionalFields["contact_id"], this, itemIndex);
    if (additionalFields["created_by"] !== undefined) setBodyField(body as IDataObject, {"name":"created_by","displayName":"Created by","type":"string"}, additionalFields["created_by"], this, itemIndex);
    if (additionalFields["date"] !== undefined) setBodyField(body as IDataObject, {"name":"date","displayName":"Date","type":"alternative","format":"date-time","composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"string","format":"date-time"},{"name":"alternative2","displayName":"Alternative2","type":"string","format":"date"}]}, additionalFields["date"], this, itemIndex);
    if (additionalFields["due_date"] !== undefined) setBodyField(body as IDataObject, {"name":"due_date","displayName":"Due date","type":"alternative","format":"date-time","composition":"anyOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"string","format":"date-time"},{"name":"alternative2","displayName":"Alternative2","type":"string","format":"date"}]}, additionalFields["due_date"], this, itemIndex);
    if (additionalFields["is_complete"] !== undefined) setBodyField(body as IDataObject, {"name":"is_complete","displayName":"Is complete","type":"boolean"}, additionalFields["is_complete"], this, itemIndex);
    if (additionalFields["is_dateless"] !== undefined) setBodyField(body as IDataObject, {"name":"is_dateless","displayName":"Is dateless","type":"boolean"}, additionalFields["is_dateless"], this, itemIndex);
    if (additionalFields["lead_id"] !== undefined) setBodyField(body as IDataObject, {"name":"lead_id","displayName":"Lead id","type":"string"}, additionalFields["lead_id"], this, itemIndex);
    if (additionalFields["organization_id"] !== undefined) setBodyField(body as IDataObject, {"name":"organization_id","displayName":"Organization id","type":"string"}, additionalFields["organization_id"], this, itemIndex);
    if (additionalFields["priority"] !== undefined) setBodyField(body as IDataObject, {"name":"priority","displayName":"Priority","type":"string","enum":["high","medium"]}, additionalFields["priority"], this, itemIndex);
    if (additionalFields["resolution"] !== undefined) setBodyField(body as IDataObject, {"name":"resolution","displayName":"Resolution","type":"string","nullable":true}, additionalFields["resolution"], this, itemIndex);
    if (additionalFields["text"] !== undefined) setBodyField(body as IDataObject, {"name":"text","displayName":"Text","type":"string"}, additionalFields["text"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Update Task")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "unsubscribed_emails_create": {
        
        
        const path = "/unsubscribe/email/";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        setBodyField(body as IDataObject, {"name":"email","displayName":"Email","type":"string","format":"email","required":true}, this.getNodeParameter("email", itemIndex), this, itemIndex);
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Unsubscribe Email")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "unsubscribed_emails_delete": {
        
        
        let path = "/unsubscribe/email/{email_address}/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{email_address}").join(encodeURIComponent(String(this.getNodeParameter("email_address", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Resubscribe Email")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "unsubscribed_emails_list": {
        
        
        const path = "/unsubscribe/email/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "List Unsubscribed Emails")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "users_get": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/user/{id}/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{id}").join(encodeURIComponent(String(this.getNodeParameter("id", itemIndex))));
    if (additionalFields["_order_by"] !== undefined) qs["_order_by"] = additionalFields["_order_by"];
    if (additionalFields["_limit"] !== undefined) qs["_limit"] = additionalFields["_limit"];
    if (additionalFields["_skip"] !== undefined) qs["_skip"] = additionalFields["_skip"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Get User")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "users_list": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/user/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["_order_by"] !== undefined) qs["_order_by"] = additionalFields["_order_by"];
    if (additionalFields["_limit"] !== undefined) qs["_limit"] = additionalFields["_limit"];
    if (additionalFields["_skip"] !== undefined) qs["_skip"] = additionalFields["_skip"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "Find Users")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
    case "users_list_availabilities": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/user/availability/";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["organization_id"] !== undefined) qs["organization_id"] = additionalFields["organization_id"];
        
        
        const serverBaseUrl = { url: "https://api.close.com/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = (selectCredentialApplications(this as never, [{"name":"ApiKeyAuth","displayName":"API Key Auth","applications":[{"credentialType":"closeApi","type":"basic"}]},{"name":"OAuth2","displayName":"OAuth2","applications":[{"credentialType":"closeOAuth2Api","type":"oauth2"}]}], authenticationChoice, "List User Availability")) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"400":{"title":"Bad request"},"401":{"title":"Unauthorized"},"404":{"title":"Not found"}};
        break;
      }
          default: throw new NodeOperationError(this.getNode(), `Unsupported operation ${operation} for node version ${nodeVersion}`, { itemIndex });
        }
        const returnAll = pagination.style !== 'none' ? Boolean(nodeOptions.returnAll ?? false) : false;
    const resultLimit = pagination.style !== 'none' && !returnAll ? Number(nodeOptions.resultLimit ?? 50) : Math.min(pagination.maxItems, Number.POSITIVE_INFINITY);
    const pageStartTime = Date.now();
    const seenCursors = new Map<string, number>(); const seenPages = new Map<string, number>();
    let page = 1; let offset = 0; let cursor: unknown; let pagesFetched = 0; let estimatedBytes = 0; let finished = false;
    while (!finished && output.length - outputStart < resultLimit && pagesFetched < pagination.maxPages) {
      if (Date.now() - pageStartTime > pagination.maxElapsedMs) throw new NodeOperationError(this.getNode(), 'Pagination elapsed-time budget was exceeded', { itemIndex });
      const qs = options.qs as IDataObject;
      // Only the paginator's own page size is written here. It used to overwrite a
      // limit parameter the operation itself declared and the user had just set.
      if (pagination.limit && (pagesFetched > 0 || qs[pagination.limit] === undefined)) qs[pagination.limit] = Math.min(pagination.pageSize, resultLimit - (output.length - outputStart));
      if (pagination.style === 'offset' && pagination.page) qs[pagination.page] = offset;
      if (pagination.style === 'pageNumber' && pagination.page) qs[pagination.page] = page;
      if (pagination.style === 'cursor' && pagination.cursor && cursor) qs[pagination.cursor] = cursor as string;
      const response = await requestWithRetry(this as never, options, credentialApplications, retryContract, itemIndex);
      pagesFetched += 1;
      const pageFingerprint = JSON.stringify(response);
      const pageRepeats = (seenPages.get(pageFingerprint) ?? 0) + 1;
      seenPages.set(pageFingerprint, pageRepeats);
      if (pageRepeats > pagination.repeatedPageLimit) throw new NodeOperationError(this.getNode(), 'Pagination repeated-page budget was exceeded', { itemIndex });
      estimatedBytes += pageFingerprint.length;
      if (estimatedBytes > pagination.maxMemoryBytes) throw new NodeOperationError(this.getNode(), 'Pagination memory budget was exceeded', { itemIndex });
      if (responsePlan.binary) {
        const binaryPayload = responsePlan.full ? ((response as IDataObject).body ?? response) : response;
        const responseHeaders = (responsePlan.full ? ((response as IDataObject).headers as IDataObject | undefined) : undefined) ?? {};
        const contentType = String(responseHeaders['content-type'] ?? '').split(';')[0].trim() || 'application/octet-stream';
        // prepareBinaryData is what fills in fileName, fileSize and fileExtension.
        // Hand-building the binary entry produced items that downstream nodes could
        // not name or type, and discarded the response's own content type.
        const binaryData = await this.helpers.prepareBinaryData(Buffer.from(binaryPayload as ArrayBuffer), undefined, contentType);
        output.push({ json: {}, binary: { data: binaryData }, pairedItem: { item: itemIndex } });
        finished = true;
        continue;
      }
      const normalizedResponse = responsePlan.full ? ((response as IDataObject).body ?? response) : response;
      const envelopeValue = valueAtPath(normalizedResponse, responsePlan.envelopePath);
      if (responsePlan.envelopePath && envelopeValue === undefined) throw new NodeOperationError(this.getNode(), `Response envelope path "${responsePlan.envelopePath}" was not found`, { itemIndex });
      const envelope = (envelopeValue ?? normalizedResponse) as IDataObject;
      const itemPath = pagination.itemPath || responsePlan.itemPath;
      const extractedItems = valueAtPath(envelope, itemPath);
      if (itemPath && extractedItems === undefined) throw new NodeOperationError(this.getNode(), `Response item path "${itemPath}" was not found`, { itemIndex });
      // A DELETE used to be reported as a fixed { deleted: true } with its body
      // thrown away, which lost the deleted representation and the job handle that
      // asynchronous deletes return. The body is used when there is one.
      const deletedFallback = options.method === 'DELETE' && (normalizedResponse === undefined || normalizedResponse === null || normalizedResponse === '' ||
        (typeof normalizedResponse === 'object' && !Array.isArray(normalizedResponse) && Object.keys(normalizedResponse as IDataObject).length === 0));
      const values = deletedFallback
        ? [{ deleted: true }]
        : Array.isArray(extractedItems) ? extractedItems : Array.isArray(normalizedResponse) ? normalizedResponse : [extractedItems ?? envelope];
      const outputMode = responsePlan.fields.length > 10 ? this.getNodeParameter('outputMode', itemIndex, 'simplified') as string : 'raw';
      const selectedFields = outputMode === 'selected' ? this.getNodeParameter('selectedFields', itemIndex, []) as string[] : [];
      for (const value of values) {
        if (output.length - outputStart >= resultLimit) break;
        const fields = outputMode === 'simplified' ? responsePlan.simplified : outputMode === 'selected' ? selectedFields : [];
        output.push({ json: selectResponseFields(value as IDataObject, fields), pairedItem: { item: itemIndex } });
      }
      if (!returnAll || pagination.style === 'none' || values.length === 0) { finished = true; continue; }
      if (pagination.hasMore && envelope[pagination.hasMore] === false) { finished = true; continue; }
      if (pagination.style === 'cursor') {
        cursor = pagination.responseCursor ? valueAtPath(envelope, pagination.responseCursor) : undefined;
        finished = !cursor;
        if (cursor) {
          const key = String(cursor);
          const repeats = (seenCursors.get(key) ?? 0) + 1;
          seenCursors.set(key, repeats);
          if (repeats > pagination.repeatedCursorLimit) throw new NodeOperationError(this.getNode(), 'Pagination repeated-cursor budget was exceeded', { itemIndex });
        }
      }
      if (pagination.advancement === 'offsetByItems') offset += values.length;
      if (pagination.advancement === 'incrementPage') page += 1;
    }
      } catch (error) {
        if (this.continueOnFail()) {
          output.push({ json: { error: (error as Error).message }, pairedItem: { item: itemIndex } });
          continue;
        }
        if (error instanceof NodeApiError) {
          const status = String((error as unknown as { httpCode?: string; cause?: { statusCode?: number } }).httpCode ?? (error as unknown as { cause?: { statusCode?: number } }).cause?.statusCode ?? 'default');
          const planned = errorPlan[status] ?? errorPlan.default;
          if (planned) {
            const parameterHelp = planned.parameter ? `Check the '${planned.parameter}' parameter.` : undefined;
            const description = [planned.recovery, parameterHelp].filter(Boolean).join(' ');
            throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex, message: planned.title, description });
          }
        }
        if (error instanceof NodeApiError) throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex });
        throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
      }
    }
    return [output];
  }
}
