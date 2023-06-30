import { Provider } from '@spoonjoy/redwoodjs-dbauth-oauth-web'

export interface IOAuthBtnsProps {
  oAuthUrls: Partial<Record<Provider, string>>
}
