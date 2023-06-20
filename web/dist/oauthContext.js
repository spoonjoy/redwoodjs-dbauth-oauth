import React from 'react';
import OAuthClient from './oauth';
function createOAuthContext() {
    return React.createContext(undefined);
}
function createUseOAuth(OAuthContext) {
    const useOAuth = () => {
        const context = React.useContext(OAuthContext);
        if (!context) {
            throw new Error('useOAuth must be used within an OAuthProvider');
        }
        return context;
    };
    return useOAuth;
}
function createOAuthProvider(OAuthContext) {
    const OAuthProvider = ({ children }) => {
        const oAuthclient = new OAuthClient();
        return (React.createElement(OAuthContext.Provider, { value: {
                getOAuthUrls: oAuthclient.getOAuthUrls,
            } }, children));
    };
    return OAuthProvider;
}
export function createOAuth() {
    const OAuthContext = createOAuthContext();
    const useOAuth = createUseOAuth(OAuthContext);
    const OAuthProvider = createOAuthProvider(OAuthContext);
    return { OAuthContext, OAuthProvider, useOAuth };
}
//# sourceMappingURL=oauthContext.js.map