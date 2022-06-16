import { computed, unref, Ref } from '@vue/composition-api'
import { useRouter, useRoute } from '../router'
import { useStore } from '../store'
import { ClientService } from '../../services'
import { basename } from 'path'

import { FileContext } from './types'
import {
  useAppNavigation,
  AppNavigationResult,
  contextQueryToFileContextProps,
  contextRouteNameKey
} from './useAppNavigation'
import { useAppConfig, AppConfigResult } from './useAppConfig'
import { useAppFileHandling, AppFileHandlingResult } from './useAppFileHandling'
import { useAppFolderHandling, AppFolderHandlingResult } from './useAppFolderHandling'
import { useAppDocumentTitle } from './useAppDocumentTitle'
import { usePublicLinkPassword, usePublicLinkContext } from '../authContext'
import { useClientService } from '../clientService'

// TODO: this file/folder contains file/folder loading logic extracted from preview and drawio extensions
// Discussion how to progress from here can be found in this issue:
// https://github.com/owncloud/web/issues/3301

interface AppDefaultsOptions {
  applicationId: string
  clientService?: ClientService
}

type AppDefaultsResult = AppConfigResult &
  AppNavigationResult &
  AppFileHandlingResult &
  AppFolderHandlingResult & {
    isPublicLinkContext: Ref<boolean>
    currentFileContext: Ref<FileContext>
  }

export function useAppDefaults(options: AppDefaultsOptions): AppDefaultsResult {
  const router = useRouter()
  const store = useStore()
  const currentRoute = useRoute()
  const clientService = options.clientService ?? useClientService()
  const applicationId = options.applicationId

  const isPublicLinkContext = usePublicLinkContext({ currentRoute })
  const publicLinkPassword = usePublicLinkPassword({ store })

  const userId = computed(() => {
    return store.getters.user.id
  })

  const currentFileContext = computed((): FileContext => {
    const queryItemAsString = (queryItem: string | string[]) => {
      if (Array.isArray(queryItem)) {
        return queryItem[0]
      }

      return queryItem
    }

    const path = `/files/${unref(userId)}/${unref(currentRoute)
      .params.filePath.split('/')
      .slice(1)
      .filter(Boolean)
      .join('/')}`

    return {
      path,
      fileName: basename(path),
      routeName: queryItemAsString(unref(currentRoute).query[contextRouteNameKey]),
      ...contextQueryToFileContextProps(unref(currentRoute).query)
    }
  })

  useAppDocumentTitle({ store, document, applicationId, currentFileContext })

  return {
    isPublicLinkContext,
    currentFileContext,
    ...useAppConfig({ store, ...options }),
    ...useAppNavigation({ router, currentFileContext }),
    ...useAppFileHandling({
      clientService,
      isPublicLinkContext,
      publicLinkPassword
    }),
    ...useAppFolderHandling({ clientService, store, isPublicLinkContext, publicLinkPassword })
  }
}
