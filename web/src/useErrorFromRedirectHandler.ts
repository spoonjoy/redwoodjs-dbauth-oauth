import { useParams } from '@redwoodjs/router'

/**
 * In the situations where we're returning to the app via redirect (ie all flows that begin by
 * directing a user to an OAuth provider), any error messages that occur during the OAuth flow will
 * be appended to the redirect URL as a parameters. This hook parses, then clears, that query parameter.
 *
 * @param onError - a function that takes a string and does something with it. At minimum, you probably want to toast the error.
 */
export const useErrorFromRedirectHandler = (
  onError: (error: string) => void
) => {
  const { oAuthError } = useParams()
  // if this is here, it means we're returning from an OAuth flow redirect and there was an error
  if (oAuthError) {
    const currentUrl = window.location.href
    const newUrl = new URL(currentUrl)
    newUrl.searchParams.delete('oAuthError')

    const decodedError = decodeURIComponent(oAuthError.replace(/\+/g, ' '))
    onError(decodedError)
    window.history.replaceState(null, '', newUrl.toString())
  }
}
