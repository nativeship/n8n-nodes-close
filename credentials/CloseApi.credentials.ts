import { type IAuthenticateGeneric, type Icon, type ICredentialTestRequest, type ICredentialType, type INodeProperties } from "n8n-workflow";

// Generated with ts-morph
export class CloseApi implements ICredentialType {
  name = "closeApi";
  displayName = "Close API";
  documentationUrl = "https://api.close.com/api/v1";
  icon: Icon = {
        light: "file:../nodes/Close/close.svg",
        dark: "file:../nodes/Close/close.dark.svg"
    };
  properties: INodeProperties[] = [
        {
            displayName: "Username",
            name: "username",
            type: "string",
            default: "",
            required: true
        },
        {
            displayName: "Password",
            name: "password",
            type: "string",
            typeOptions: {
                password: true
            },
            default: "",
            required: true
        }
    ];
  authenticate: IAuthenticateGeneric = {
        type: "generic",
        properties: {
            auth: {
                username: "={{$credentials.username}}",
                password: "={{$credentials.password}}"
            }
        }
    };
  test: ICredentialTestRequest = {
        request: {
            baseURL: "https://api.close.com/api/v1",
            url: "/activity/"
        }
    };
}
