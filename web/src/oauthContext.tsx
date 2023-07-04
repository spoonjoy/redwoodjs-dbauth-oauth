import React, { ReactNode } from 'react'

import OAuthClient, { EnabledProviders, OAuthInstanceType } from './oauth'
import { useErrorFromRedirectHandler } from './useErrorFromRedirectHandler'

function createOAuthContext() {
  return React.createContext<OAuthInstanceType | undefined>(undefined)
}

export function createOAuthClient(config: {
  enabledProviders: EnabledProviders
}): OAuthInstanceType {
  const oAuthClient = new OAuthClient({
    enabledProviders: config.enabledProviders,
  })
  return {
    getOAuthUrls: oAuthClient.getOAuthUrls,
    unlinkAccount: oAuthClient.unlinkAccount,
    getConnectedAccounts: oAuthClient.getConnectedAccounts,
  }
}

function createUseOAuth(
  OAuthContext: React.Context<OAuthInstanceType | undefined>,
  onErrorFromRedirect: (error: string) => void
) {
  const useOAuth = () => {
    useErrorFromRedirectHandler(onErrorFromRedirect)
    const context = React.useContext(OAuthContext)

    if (!context) {
      throw new Error('useOAuth must be used within an OAuthProvider')
    }

    return context
  }

  return useOAuth
}

interface OAuthProviderProps {
  children: ReactNode
}

function createOAuthProvider(
  OAuthContext: React.Context<OAuthInstanceType | undefined>,
  oAuthClient: OAuthInstanceType
) {
  const OAuthProvider = ({ children }: OAuthProviderProps) => {
    return (
      <OAuthContext.Provider value={oAuthClient}>
        {children}
      </OAuthContext.Provider>
    )
  }

  return OAuthProvider
}

export function createOAuth(
  /**
   * @param {OAuthInstanceType} oAuthClient - An instance of the OAuthClient, created with createOAuthClient
   * @param {(error: string) => void} onErrorFromRedirect - A callback function that will be called with the error message if the user is redirected back to the app with an error
   */
  oAuthClient: OAuthInstanceType,
  onErrorFromRedirect: (error: string) => void
): {
  OAuthContext: React.Context<OAuthInstanceType | undefined>
  OAuthProvider: React.FC<OAuthProviderProps>
  useOAuth: () => OAuthInstanceType
} {
  const OAuthContext = createOAuthContext()
  const useOAuth = createUseOAuth(OAuthContext, onErrorFromRedirect)
  const OAuthProvider = createOAuthProvider(OAuthContext, oAuthClient)

  return { OAuthContext, OAuthProvider, useOAuth }
}
