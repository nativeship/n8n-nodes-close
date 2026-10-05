import { type Icon, type ICredentialType, type INodeProperties } from "n8n-workflow";
export declare class CloseOAuth2Api implements ICredentialType {
    name: string;
    extends: string[];
    displayName: string;
    icon: Icon;
    documentationUrl: string;
    properties: INodeProperties[];
}
