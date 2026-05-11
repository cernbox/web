import linkedAccountBlocked from '../../../src/pages/linkedAccountBlocked.vue'
import { defaultComponentMocks, defaultPlugins, mount } from '@ownclouders/web-test-helpers'

describe('linked account blocked page', () => {
  it('renders component', () => {
    const { wrapper } = getWrapper()
    expect(wrapper.html()).toMatchSnapshot()
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
