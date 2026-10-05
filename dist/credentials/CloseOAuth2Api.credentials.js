"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloseOAuth2Api = void 0;
class CloseOAuth2Api {
    constructor() {
        this.name = "closeOAuth2Api";
        this.extends = [
            "oAuth2Api"
        ];
        this.displayName = "Close OAuth2 API";
        this.icon = {
            light: "file:../nodes/Close/close.svg",
            dark: "file:../nodes/Close/close.dark.svg"
        };
        this.documentationUrl = "https://api.close.com/api/v1";
        this.properties = [
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
}
exports.CloseOAuth2Api = CloseOAuth2Api;
//# sourceMappingURL=CloseOAuth2Api.credentials.js.map