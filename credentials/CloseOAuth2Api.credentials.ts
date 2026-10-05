import { type Icon, type ICredentialType, type INodeProperties } from "n8n-workflow";

// Generated with ts-morph
export class CloseOAuth2Api implements ICredentialType {
  name = "closeOAuth2Api";
  extends = [
        "oAuth2Api"
    ];
  displayName = "Close OAuth2 API";
  icon: Icon = {
        light: "file:../nodes/Close/close.svg",
        dark: "file:../nodes/Close/close.dark.svg"
    };
  documentationUrl = "https://api.close.com/api/v1";
  properties: INodeProperties[] = [
        {
            displayName: "Grant Type",
            name: "grantType",
            type: "hidden",
            default: "authorizationCode"
        },
        {
            displayName: "Authorization URL",
            name: "authUrl",
            type: "hidden",
            default: "https://app.close.com/oauth2/authorize/"
        },
        {
            displayName: "Access Token URL",
            name: "accessTokenUrl",
            type: "hidden",
            default: "https://api.close.com/oauth2/token/"
        },
        {
            displayName: "Scope",
            name: "scope",
            type: "hidden",
            default: "all.full_access offline_access"
        }
    ];
}
