import {
  DesignSystem as designSystem,
  pages,
  translations,
  supportedLanguages,
  store,
  Router as router,
  Vue
} from './defaults'
import {
  requestConfiguration,
  announceApplications,
  announceClient,
  announceDefaults,
  announceOwncloudSDK,
  announceStore,
  announceTheme,
  announceTranslations,
  applicationStore
} from './container'

export const bootstrap = async (configurationPath: string): Promise<void> => {
  const runtimeConfiguration = await requestConfiguration(configurationPath)
  const promiseOcSDK = announceOwncloudSDK({ vue: Vue, runtimeConfiguration }) // vue.$client
  const promiseClient = announceClient(runtimeConfiguration) // oidc client
  const promiseTheme = announceTheme({ store, vue: Vue, designSystem, runtimeConfiguration })
  const promiseApplications = announceApplications({
    runtimeConfiguration,
    store,
    supportedLanguages,
    router,
    translations
  })
  await promiseOcSDK
  await promiseClient
  try {
    await announceStore({ vue: Vue, store, runtimeConfiguration }) // REQUIRES $client and oidc
  } catch (e) {
    // Bail early (without wayting for other pending processes)
    // to allow faster redirection to idp
    return 
  }
  await promiseTheme
  await promiseApplications
  announceTranslations({ vue: Vue, supportedLanguages, translations })
  announceDefaults({ store, router })
}

export const renderSuccess = (): void => {
  new Vue({
    el: '#owncloud',
    store,
    router,
    render: (h) => h(pages.success),
    mounted() {
      Array.from(applicationStore.values()).forEach((application) => application.mounted(this))
    }
  })
}

export const renderFailure = async (err: Error): Promise<void> => {
  await announceTranslations({ vue: Vue, supportedLanguages, translations })
  await announceTheme({ store, vue: Vue, designSystem })
  console.error(err)
  new Vue({
    el: '#owncloud',
    store,
    render: (h) => h(pages.failure)
  })
}
