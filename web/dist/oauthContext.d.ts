import { ReactNode } from 'react';
interface OAuthProviderProps {
    children: ReactNode;
}
export declare function createOAuth(): {
    OAuthContext: any;
    OAuthProvider: ({ children }: OAuthProviderProps) => any;
    useOAuth: () => any;
};
export {};
//# sourceMappingURL=oauthContext.d.ts.map