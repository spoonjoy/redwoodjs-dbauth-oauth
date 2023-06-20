import React, { ReactNode } from 'react'

import OAuthClient, { OAuthInstanceType } from './oauth'

function createOAuthContext() {
  return React.createContext<OAuthInstanceType | undefined>(undefined)
}

export function createOAuthClient(): OAuthInstanceType {
  const oAuthClient = new OAuthClient()
  return {
    getOAuthUrls: oAuthClient.getOAuthUrls,
  }
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

export function createOAuth(oAuthClient: OAuthInstanceType) {
  const OAuthContext = createOAuthContext()
  const useOAuth = createUseOAuth(OAuthContext)
  const OAuthProvider = createOAuthProvider(OAuthContext, oAuthClient)

  return { OAuthContext, OAuthProvider, useOAuth }
}
