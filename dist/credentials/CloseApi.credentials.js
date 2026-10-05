"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloseApi = void 0;
class CloseApi {
    constructor() {
        this.name = "closeApi";
        this.displayName = "Close API";
        this.documentationUrl = "https://api.close.com/api/v1";
        this.icon = {
            light: "file:../nodes/Close/close.svg",
            dark: "file:../nodes/Close/close.dark.svg"
        };
        this.properties = [
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
        this.authenticate = {
            type: "generic",
            properties: {
                auth: {
                    username: "={{$credentials.username}}",
                    password: "={{$credentials.password}}"
                }
            }
        };
        this.test = {
            request: {
                baseURL: "https://api.close.com/api/v1",
                url: "/activity/"
            }
        };
    }
}
exports.CloseApi = CloseApi;
//# sourceMappingURL=CloseApi.credentials.js.map