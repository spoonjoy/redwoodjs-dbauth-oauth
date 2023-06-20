export default class OAuthClient {
    constructor() { }
    getOAuthUrls() {
        const authUrls = {
            apple: this.getAppleAuthUrl(),
            google: this.getGoogleAuthUrl(),
        };
        return authUrls;
    }
    getGoogleAuthUrl() {
        if (!process.env.FE_URL || !process.env.GOOGLE_CLIENT_ID) {
            return undefined;
        }
        const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
        const options = {
            redirect_uri: `${process.env.FE_URL}/auth?provider=google`,
            client_id: process.env.GOOGLE_CLIENT_ID,
            access_type: 'offline',
            response_type: 'code',
            prompt: 'consent',
            scope: [
                'https://www.googleapis.com/auth/userinfo.profile',
                'https://www.googleapis.com/auth/userinfo.email',
            ].join(' '),
        };
        const queryString = new URLSearchParams(options).toString();
        const googleAuthUrl = `${rootUrl}?${queryString}`;
        console.log('getGoogleAuthUrl res:', googleAuthUrl);
        return googleAuthUrl;
    }
    // based on https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_js/incorporating_sign_in_with_apple_into_other_platforms#3332113
    getAppleAuthUrl() {
        if (!process.env.FE_URL || !process.env.APPLE_CLIENT_ID) {
            return undefined;
        }
        const rootUrl = 'https://appleid.apple.com/auth/authorize';
        const options = {
            redirect_uri: `${process.env.FE_URL}/auth?provider=apple`,
            client_id: process.env.APPLE_CLIENT_ID,
            response_type: 'code',
            response_mode: 'query',
            // response_mode: 'form_post',
            // scope: 'name email',
        };
        const queryString = new URLSearchParams(options).toString();
        return `${rootUrl}?${queryString}`;
    }
}
//# sourceMappingURL=oauth.js.map