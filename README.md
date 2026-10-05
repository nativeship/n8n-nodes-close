# Close n8n community node

Close is a sales CRM that brings calling, email, SMS, pipelines, tasks, and reporting into one platform.

Generated from OpenAPI 1.0.0 with template 1.1.0. Generated files are platform-managed and will be overwritten during regeneration.

## Authentication

Configure the generated username and password credential in n8n before using the node.

## Supported operations

- `GET /activity/` - List Activity
  - Retry Contract: none
  - Pagination Contract: none
- `POST /activity/call/` - Create Call
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /activity/call/{id}/` - Delete Logged Call
  - Retry Contract: none
  - Pagination Contract: none
- `GET /activity/call/{id}/` - Get Call
  - Retry Contract: none
  - Pagination Contract: none
- `GET /activity/call/` - Find Calls
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /activity/call/{id}/` - Update Call
  - Retry Contract: none
  - Pagination Contract: none
- `POST /activity/custom/` - Create Custom Activity
  - Retry Contract: none
  - Pagination Contract: none
- `GET /activity/custom/{id}/` - Get Custom Activity
  - Retry Contract: none
  - Pagination Contract: none
- `GET /activity/custom/` - Find Custom Activities
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /activity/custom/{id}/` - Update Custom Activity
  - Retry Contract: none
  - Pagination Contract: none
- `POST /activity/email/` - Create Email
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /activity/email/{id}/` - Delete Email
  - Retry Contract: none
  - Pagination Contract: none
- `GET /activity/email/` - List Emails
  - Retry Contract: none
  - Pagination Contract: none
- `GET /activity/form_submission/` - List Form Submissions
  - Retry Contract: none
  - Pagination Contract: none
- `GET /activity/status_change/lead/` - List Lead Status Changes
  - Retry Contract: none
  - Pagination Contract: none
- `GET /activity/meeting/{id}/` - Get Meeting
  - Retry Contract: none
  - Pagination Contract: none
- `GET /activity/meeting/` - Find Meetings
  - Retry Contract: none
  - Pagination Contract: none
- `POST /activity/note/` - Create Note
  - Retry Contract: none
  - Pagination Contract: none
- `GET /activity/note/{id}/` - Get Note
  - Retry Contract: none
  - Pagination Contract: none
- `GET /activity/note/` - Find Notes
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /activity/note/{id}/` - Update Note
  - Retry Contract: none
  - Pagination Contract: none
- `GET /activity/status_change/opportunity/` - List Opportunity Status Changes
  - Retry Contract: none
  - Pagination Contract: none
- `POST /activity/sms/` - Create SMS
  - Retry Contract: none
  - Pagination Contract: none
- `GET /activity/sms/` - List SMS Messages
  - Retry Contract: none
  - Pagination Contract: none
- `GET /activity/task_completed/` - List Task Completions
  - Retry Contract: none
  - Pagination Contract: none
- `POST /activity/whatsapp_message/` - Create WhatsApp Message
  - Retry Contract: none
  - Pagination Contract: none
- `GET /activity/whatsapp_message/{id}/` - Get WhatsApp Message
  - Retry Contract: none
  - Pagination Contract: none
- `GET /activity/whatsapp_message/` - Find WhatsApp Messages
  - Retry Contract: none
  - Pagination Contract: none
- `POST /bulk_action/edit/` - Create Bulk Action
  - Retry Contract: none
  - Pagination Contract: none
- `POST /bulk_action/email/` - Create Bulk Email
  - Retry Contract: none
  - Pagination Contract: none
- `POST /bulk_action/sequence_subscription/` - Create Bulk Workflow Subscription Action
  - Retry Contract: none
  - Pagination Contract: none
- `GET /connected_account/{id}/` - Get Connected Account
  - Retry Contract: none
  - Pagination Contract: none
- `GET /connected_account/` - Find Connected Accounts
  - Retry Contract: none
  - Pagination Contract: none
- `POST /contact/` - Create Contact
  - Retry Contract: none
  - Pagination Contract: none
- `GET /contact/{id}/` - Get Contact
  - Retry Contract: none
  - Pagination Contract: none
- `GET /contact/` - Find Contacts
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /contact/{id}/` - Update Contact
  - Retry Contract: none
  - Pagination Contract: none
- `POST /custom_object/` - Create Custom Object
  - Retry Contract: none
  - Pagination Contract: none
- `GET /custom_object/{id}/` - Get Custom Object
  - Retry Contract: none
  - Pagination Contract: none
- `GET /custom_object/` - Find Custom Objects
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /custom_object/{id}/` - Update Custom Object
  - Retry Contract: none
  - Pagination Contract: none
- `GET /event/` - List Events
  - Retry Contract: none
  - Pagination Contract: none
- `POST /export/lead/` - Create Lead Export
  - Retry Contract: none
  - Pagination Contract: none
- `POST /export/opportunity/` - Create Opportunity Export
  - Retry Contract: none
  - Pagination Contract: none
- `GET /export/` - List Exports
  - Retry Contract: none
  - Pagination Contract: none
- `GET /group/{id}/` - Get Group
  - Retry Contract: none
  - Pagination Contract: none
- `GET /group/` - Find Groups
  - Retry Contract: none
  - Pagination Contract: none
- `POST /lead/` - Create Lead
  - Retry Contract: none
  - Pagination Contract: none
- `GET /lead/{id}/` - Get Lead
  - Retry Contract: none
  - Pagination Contract: none
- `GET /lead/` - Find Leads
  - Retry Contract: none
  - Pagination Contract: none
- `POST /lead/merge/` - Merge Two Leads
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /lead/{id}/` - Update Lead
  - Retry Contract: none
  - Pagination Contract: none
- `POST /opportunity/` - Create Opportunity
  - Retry Contract: none
  - Pagination Contract: none
- `GET /opportunity/{id}/` - Get Opportunity
  - Retry Contract: none
  - Pagination Contract: none
- `GET /opportunity/` - Find Opportunities
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /opportunity/{id}/` - Update Opportunity
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /phone_number/{id}/` - Toggle Forwarding on Phone Number
  - Retry Contract: none
  - Pagination Contract: none
- `POST /report/activity/` - Run Activity Report
  - Retry Contract: none
  - Pagination Contract: none
- `GET /report/custom/{org_id}/` - Run Opportunity Report
  - Retry Contract: none
  - Pagination Contract: none
- `POST /report/funnel/opportunity/stages/` - Run Opportunity Funnel Report by Stage
  - Retry Contract: none
  - Pagination Contract: none
- `POST /report/funnel/opportunity/totals/` - Run Opportunity Funnel Totals Report
  - Retry Contract: none
  - Pagination Contract: none
- `GET /report/statuses/lead/{org_id}/` - Run Lead Status Change Report
  - Retry Contract: none
  - Pagination Contract: none
- `GET /report/statuses/opportunity/{org_id}/` - Run Opportunity Status Change Report
  - Retry Contract: none
  - Pagination Contract: none
- `GET /report/sent_emails/{org_id}/` - Run Sent Email Report
  - Retry Contract: none
  - Pagination Contract: none
- `POST /sequence_subscription/` - Subscribe Contact to Workflow
  - Retry Contract: none
  - Pagination Contract: none
- `GET /sequence_subscription/{id}/` - Get Workflow Subscription
  - Retry Contract: none
  - Pagination Contract: none
- `GET /sequence_subscription/` - Find Workflow Subscriptions
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /sequence_subscription/{id}/` - Update Workflow Subscription
  - Retry Contract: none
  - Pagination Contract: none
- `POST /saved_search/` - Create Lead Smart View
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /saved_search/{id}/` - Update Lead Smart View
  - Retry Contract: none
  - Pagination Contract: none
- `POST /task/` - Create Task
  - Retry Contract: none
  - Pagination Contract: none
- `GET /task/{id}/` - Get Task
  - Retry Contract: none
  - Pagination Contract: none
- `GET /task/` - Find Tasks
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /task/{id}/` - Update Task
  - Retry Contract: none
  - Pagination Contract: none
- `POST /unsubscribe/email/` - Unsubscribe Email
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /unsubscribe/email/{email_address}/` - Resubscribe Email
  - Retry Contract: none
  - Pagination Contract: none
- `GET /unsubscribe/email/` - List Unsubscribed Emails
  - Retry Contract: none
  - Pagination Contract: none
- `GET /user/{id}/` - Get User
  - Retry Contract: none
  - Pagination Contract: none
- `GET /user/` - Find Users
  - Retry Contract: none
  - Pagination Contract: none
- `GET /user/availability/` - List User Availability
  - Retry Contract: none
  - Pagination Contract: none

## Usage

1. Install this community-node package in n8n.
2. Add the **Close** node to a workflow.
3. Select a resource and operation, configure its parameters, and execute the workflow.

## Example workflow

Connect **Manual Trigger** -> **Close** -> a destination node, select an operation, then run the workflow and inspect the returned items.

## Development

```sh
npm install
npm run build
npm run lint
npm run dev
```

`npm run dev` starts a local n8n development instance. Find the integration by its **Close** display name.
