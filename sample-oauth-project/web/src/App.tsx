import { FatalErrorBoundary, RedwoodProvider } from '@redwoodjs/web'
import { RedwoodApolloProvider } from '@redwoodjs/web/apollo'

import '@spoonjoy/redwoodjs-dbauth-oauth-web/dist/style.css'
import { Toaster } from '@redwoodjs/web/toast'

import FatalErrorPage from 'src/pages/FatalErrorPage'
import Routes from 'src/Routes'

import { AuthProvider, useAuth, OAuthProvider } from './auth'

import './scaffold.css'
import './index.css'

const App = () => (
  <FatalErrorBoundary page={FatalErrorPage}>
    <RedwoodProvider titleTemplate="%PageTitle | %AppTitle">
      <AuthProvider>
        <OAuthProvider>
          <RedwoodApolloProvider useAuth={useAuth}>
            <Toaster toastOptions={{ className: 'rw-toast', duration: 6000 }} />
            <Routes />
          </RedwoodApolloProvider>
        </OAuthProvider>
      </AuthProvider>
    </RedwoodProvider>
  </FatalErrorBoundary>
)

export default App
