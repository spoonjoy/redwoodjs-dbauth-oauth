import React, { ReactNode } from 'react'

import OAuthClient, { OAuthInstanceType } from './oauth'

function createOAuthContext() {
  return React.createContext<OAuthInstanceType | undefined>(undefined)
}

function createUseOAuth(
  OAuthContext: React.Context<OAuthInstanceType | undefined>
) {
  const useOAuth = () => {
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
  OAuthContext: React.Context<OAuthInstanceType | undefined>
) {
  const OAuthProvider = ({ children }: OAuthProviderProps) => {
    const oAuthclient = new OAuthClient()

    return (
      <OAuthContext.Provider
        value={{
          getOAuthUrls: oAuthclient.getOAuthUrls,
        }}
      >
        {children}
      </OAuthContext.Provider>
    )
  }

  return OAuthProvider
}

export function createOAuth() {
  const OAuthContext = createOAuthContext()
  const useOAuth = createUseOAuth(OAuthContext)
  const OAuthProvider = createOAuthProvider(OAuthContext)

  return { OAuthContext, OAuthProvider, useOAuth }
}
