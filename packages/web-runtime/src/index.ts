import {
  DesignSystem as designSystem,
  pages,
  translations,
  supportedLanguages,
  store,
  Vue
} from './defaults'

import { router } from './router'
import { configurationManager } from 'web-pkg/src/configuration'

import {
  announceConfiguration,
  initializeApplications,
  announceApplicationsReady,
  announceClient,
  announceDefaults,
  announceClientService,
  announceStore,
  announceTheme,
  announceTranslations,
  announceVersions,
  applicationStore,
  announceUppyService,
  announceAuthService,
  announcePermissionManager,
  startSentry,
  announceTours
} from './container'

export const bootstrap = async (configurationPath: string): Promise<void> => {
  const runtimeConfiguration = await announceConfiguration(configurationPath)
  startSentry(runtimeConfiguration, Vue)
  await announceStore({ vue: Vue, store, runtimeConfiguration })
  await initializeApplications({
    runtimeConfiguration,
    store,
    supportedLanguages,
    router,
    translations
  })
  announceClientService({ vue: Vue, runtimeConfiguration })
  announceUppyService({ vue: Vue })
  announcePermissionManager({ vue: Vue, store })
  await announceClient(runtimeConfiguration)
  await announceAuthService({ vue: Vue, configurationManager, store, router })
  announceTranslations({ vue: Vue, supportedLanguages, translations })
  await announceTheme({ store, vue: Vue, designSystem, runtimeConfiguration })
  announceDefaults({ store, router })
  await announceTours({ store, runtimeConfiguration })
}

export const renderSuccess = (): void => {
  const applications = Array.from(applicationStore.values())
  Vue.config.devtools = process.env.NODE_ENV === 'development'
  const instance = new Vue({
    el: '#owncloud',
    store,
    router,
    render: (h) => h(pages.success)
  })

  instance.$once('mounted', () => {
    applications.forEach((application) => application.mounted(instance))
  })

  store.watch(
    (state, getters) =>
      getters['runtime/auth/isUserContextReady'] ||
      getters['runtime/auth/isPublicLinkContextReady'],
    async (newValue, oldValue) => {
      if (!newValue || newValue === oldValue) {
        return
      }
      announceVersions({ store })
      await announceApplicationsReady({ applications })
    },
    {
      immediate: true
    }
  )
}

export const renderFailure = async (err: Error): Promise<void> => {
  announceVersions({ store })
  await announceTranslations({ vue: Vue, supportedLanguages, translations })
  await announceTheme({ store, vue: Vue, designSystem })
  console.error(err)
  new Vue({
    el: '#owncloud',
    store,
    render: (h) => h(pages.failure)
  })
}
