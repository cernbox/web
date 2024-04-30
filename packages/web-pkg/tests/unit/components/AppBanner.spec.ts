import { defaultComponentMocks, defaultPlugins, shallowMount } from 'web-test-helpers'
import AppBanner from '../../../src/components/AppBanner.vue'
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { useSessionStorage } from '@vueuse/core'
import { ref } from 'vue'

vi.mock('@vueuse/core')

// @vitest-environment jsdom
describe('AppBanner', () => {
  it('generates app url with correct app scheme', () => {
    const baseElement = document.createElement('base')
    baseElement.href = '/'
    document.getElementsByTagName('head')[0].appendChild(baseElement)
    delete window.location
    window.location = new URL('https://localhost') as any

    const { wrapper } = getWrapper({
      fileId: '1337',
      sessionStorageReturnValue: null
    })
    expect(wrapper.find('.app-banner-cta').attributes().href).toBe('owncloud://localhost/f/1337')
  })
  it('does not show when banner was closed', () => {
    const { wrapper } = getWrapper({
      fileId: '1337',
      sessionStorageReturnValue: '1'
    })
    expect(wrapper.find('.app-banner').attributes().hidden).toBe('')
  })

  it('shows when banner was not yet closed', () => {
    const { wrapper } = getWrapper({
      fileId: '1337',
      sessionStorageReturnValue: null
    })
    expect(wrapper.find('.app-banner').attributes().hidden).toBe(undefined)
  })
})

function getWrapper({
  fileId,
  sessionStorageReturnValue
}: {
  fileId: string
  sessionStorageReturnValue: string
}) {
  const router = createRouter({
    routes: [
      {
        path: '/f',
        component: {}
      }
    ],
    history: ('/' && createWebHistory('/')) || createWebHashHistory()
  })

  vi.mocked(useSessionStorage).mockImplementation(() => {
    return ref<string>(sessionStorageReturnValue)
  })

  const mocks = { ...defaultComponentMocks(), $router: router }

  return {
    wrapper: shallowMount(AppBanner, {
      props: {
        fileId
      },
      global: {
        plugins: [
          ...defaultPlugins({
            piniaOptions: {
              themeState: {
                currentTheme: {
                  appBanner: {
                    title: 'ownCloud',
                    publisher: 'ownCloud GmbH',
                    additionalInformation: '',
                    ctaText: 'OPEN',
                    icon: 'themes/owncloud/assets/owncloud-app-icon.png',
                    appScheme: 'owncloud'
                  }
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
