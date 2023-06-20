export default class OAuthClient {
    constructor();
    getOAuthUrls(): {
        apple: string | undefined;
        google: string | undefined;
    };
    private getGoogleAuthUrl;
    private getAppleAuthUrl;
}
export type OAuthInstanceType = Pick<InstanceType<typeof OAuthClient>, PublicMembers<InstanceType<typeof OAuthClient>>>;
//# sourceMappingURL=oauth.d.ts.map