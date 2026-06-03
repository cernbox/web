import linkedAccountBlocked from '../../../src/pages/linkedAccountBlocked.vue'
import { defaultComponentMocks, defaultPlugins, mount } from '@ownclouders/web-test-helpers'

describe('linked account blocked page', () => {
  it('renders component', () => {
    const { wrapper } = getWrapper()
    expect(wrapper.html()).toMatchSnapshot()
  })

  it('renders default documentation and unlink portal links', () => {
    const { wrapper } = getWrapper()

    expect(wrapper.find('[data-testid="linked-account-doc-link"]').attributes('href')).toBe(
      'https://auth.docs.cern.ch/user-documentation/verified-guest/'
    )
    expect(wrapper.find('[data-testid="linked-account-portal-link"]').attributes('href')).toBe(
      'https://account.cern.ch/account/'
    )
  })

  it('renders configured documentation and unlink portal links', () => {
    const { wrapper } = getWrapper({
      linkedAccount: {
        docUrl: 'https://docs.example.test/linked-account',
        userPortalUrl: 'https://portal.example.test/linked-accounts'
      }
    })

    const docLink = wrapper.find('[data-testid="linked-account-doc-link"]')
    const portalLink = wrapper.find('[data-testid="linked-account-portal-link"]')

    expect(docLink.attributes('href')).toBe('https://docs.example.test/linked-account')
    expect(docLink.attributes('target')).toBe('_blank')
    expect(docLink.attributes('rel')).toBe('noopener noreferrer')
    expect(portalLink.attributes('href')).toBe('https://portal.example.test/linked-accounts')
    expect(portalLink.attributes('target')).toBe('_blank')
    expect(portalLink.attributes('rel')).toBe('noopener noreferrer')
  })

  it('uses accountEditLink as unlink portal fallback', () => {
    const { wrapper } = getWrapper({
      accountEditLink: { href: 'https://account.example.test/edit' },
      linkedAccount: {
        docUrl: 'https://docs.example.test/linked-account'
      }
    })

    expect(wrapper.find('[data-testid="linked-account-portal-link"]').attributes('href')).toBe(
      'https://account.example.test/edit'
    )
  })

  describe('"Log in again" button', () => {
    it('navigates to "loginUrl" if set in config', () => {
      const loginUrl = 'https://myidp.int/login'
      const { wrapper } = getWrapper({ loginUrl })

      const logInAgainButton = wrapper.find('#exitAnchor')
      const loginAgainUrl = new URL(logInAgainButton.attributes().href)
      loginAgainUrl.search = ''

      expect(logInAgainButton.exists()).toBeTruthy()
      expect(loginAgainUrl.toString()).toEqual(loginUrl)
    })
  })
})

function getWrapper({
  loginUrl = '',
  accountEditLink = undefined as { href?: string } | undefined,
  linkedAccount = undefined as { docUrl?: string; userPortalUrl?: string } | undefined
} = {}) {
  const mocks = {
    ...defaultComponentMocks()
  }

  return {
    mocks,
    wrapper: mount(linkedAccountBlocked, {
      global: {
        plugins: [
          ...defaultPlugins({
            piniaOptions: {
              configState: {
                options: {
                  loginUrl,
                  ...(accountEditLink !== undefined && { accountEditLink }),
                  ...(linkedAccount !== undefined && { linkedAccount })
                }
              }
            }
          })
        ],
        mocks,
        provide: mocks
      }
    })
  }
}
