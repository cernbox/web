import { defaultComponentMocks, getComposableWrapper } from '@ownclouders/web-test-helpers'
import { OCM_PROVIDER_ID, Resource, SpaceResource } from '@ownclouders/web-client'
import {
  ActionExtension,
  ApplicationInformation,
  FileAction,
  FileActionOptions
} from '@ownclouders/web-pkg'
import { mock } from 'vitest-mock-extended'
import { unref } from 'vue'
import { extensions } from '../../src/extensions'
import resourceExpectations from '../../../web-client/tests/unit/helpers/share/fixtures/received-webapp/resource-expectations.json'

const remoteActionId = 'com.github.owncloud.web.open-file-remote'

const appInfo: ApplicationInformation = {
  id: 'open-cloud-mesh',
  name: 'ScienceMesh',
  icon: 'contacts-book',
  color: '#AE291D'
}

const expectationFor = (response: string) => {
  const entry = resourceExpectations.cases.find((item) => item.response === response)
  if (!entry) {
    throw new Error(`missing fixture case ${response}`)
  }
  return entry
}

const asResource = (value: object): Resource => {
  return value as Resource
}

const optionsFor = (resources?: Resource[]): FileActionOptions => {
  return {
    resources,
    space: mock<SpaceResource>()
  }
}

const findRemoteAction = (items: ReturnType<typeof extensions>['value']): FileAction => {
  const extension = items.find((item): item is ActionExtension => {
    return item.id === remoteActionId && item.type === 'action'
  })
  if (!extension) {
    throw new Error('missing remote open action')
  }
  return extension.action as FileAction
}

const mountAction = ({ openRemotely = true } = {}) => {
  const mocks = defaultComponentMocks()
  let action: FileAction | undefined
  let items: ReturnType<typeof extensions>['value'] | undefined

  getComposableWrapper(
    () => {
      items = unref(extensions(appInfo))
      action = findRemoteAction(items)
    },
    {
      mocks,
      provide: mocks,
      pluginOptions: {
        piniaOptions: {
          configState: {
            options: {
              cernFeatures: true,
              ocm: { openRemotely }
            }
          }
        }
      }
    }
  )

  if (!action || !items) {
    throw new Error('remote action did not mount')
  }

  return { action, items }
}

describe('remote webapp action gate', () => {
  it('uses the locked received-webapp fixture revision', () => {
    expect(resourceExpectations.revision).toBe('received-webapp-v1-2026-09-28')
  })

  it('keeps the remote action identity and the app menu item', () => {
    const { action, items } = mountAction()
    const actionExtension = items.find((item) => item.id === remoteActionId)
    const menuItem = items.find((item) => item.type === 'appMenuItem')

    expect(actionExtension).toMatchObject({
      id: remoteActionId,
      type: 'action',
      extensionPointIds: ['global.files.context-actions']
    })
    expect(action).toMatchObject({
      name: 'open-file-remote',
      icon: 'remote-control',
      class: 'oc-files-actions-open-file-remote'
    })
    expect(menuItem).toMatchObject({
      id: 'app.open-cloud-mesh.menuItem',
      type: 'appMenuItem'
    })
  })

  it.each(resourceExpectations.cases)(
    'gates every $response projection from the fixture',
    (fixtureCase) => {
      const { action } = mountAction({ openRemotely: fixtureCase.action.featureEnabled })
      const projections = [
        fixtureCase.mappedResource,
        fixtureCase.shareSpaceProjection,
        fixtureCase.currentFolder,
        ...fixtureCase.children
      ]

      for (const projection of projections) {
        const resource = asResource(projection)
        expect(action.isVisible(optionsFor([resource]))).toBe(fixtureCase.action.visible)
        expect(action.label(optionsFor([resource]))).toBe(fixtureCase.action.label)
      }
    }
  )

  it('hides a WebDAV-only share that still looks like a remote OCM resource', () => {
    const webdav = expectationFor('webdav-only.sharedWithMe.json')
    const { action } = mountAction()
    const resource = asResource({
      ...webdav.mappedResource,
      storageId: `${OCM_PROVIDER_ID}$ocm-received`
    })

    expect(webdav.mappedResource.storageId).toBe('')
    expect(webdav.mappedResource).not.toHaveProperty('ocmWebApp')
    expect(action.isVisible(optionsFor([resource]))).toBe(false)
    expect(action.label(optionsFor([resource]))).toBe('')
    expect(action.label(optionsFor([resource]))).not.toBe('Open remotely')
  })

  it.each(resourceExpectations.additionalNames)(
    'labels the recorded app name $appName exactly',
    (entry) => {
      const positive = expectationFor('positive.sharedWithMe.json')
      const { action } = mountAction()
      const resource = asResource({
        ...positive.mappedResource,
        ocmWebApp: { appName: entry.appName }
      })

      expect(action.isVisible(optionsFor([resource]))).toBe(entry.visible)
      expect(action.label(optionsFor([resource]))).toBe(entry.label)
    }
  )

  it('preserves punctuation and HTML-like characters without rewriting them', () => {
    const positive = expectationFor('positive.sharedWithMe.json')
    const appName = 'CodiMD <note> & "pads"'
    const { action } = mountAction()
    const resource = asResource({
      ...positive.mappedResource,
      ocmWebApp: { appName }
    })

    expect(action.isVisible(optionsFor([resource]))).toBe(true)
    expect(action.label(optionsFor([resource]))).toBe(`Open remotely with ${appName}`)
    expect(action.label(optionsFor([resource]))).not.toContain('&lt;')
    expect(action.label(optionsFor([resource]))).not.toContain('&amp;')
    expect(action.label(optionsFor([resource]))).not.toContain('&quot;')
    expect(action.label(optionsFor([resource]))).not.toBe('Open remotely with %{appName}')
  })

  it.each([
    ['null metadata', null],
    ['array metadata', [{ appName: 'CodiMD' }]],
    ['string metadata', 'CodiMD'],
    ['missing app name', {}],
    ['numeric app name', { appName: 4 }],
    ['null app name', { appName: null }],
    ['array app name', { appName: ['CodiMD'] }]
  ] as const)('hides %s and returns an empty label', (name, metadata) => {
    const webdav = expectationFor('webdav-only.sharedWithMe.json')
    const { action } = mountAction()
    const resource = asResource({
      ...webdav.mappedResource,
      ocmWebApp: metadata
    })

    expect(name).not.toHaveLength(0)
    expect(action.isVisible(optionsFor([resource]))).toBe(false)
    expect(action.label(optionsFor([resource]))).toBe('')
  })

  it('hides valid metadata when remote opening is disabled', () => {
    const positive = expectationFor('positive.sharedWithMe.json')
    const { action } = mountAction({ openRemotely: false })
    const resource = asResource(positive.mappedResource)

    expect(positive.action.label).toBe('Open remotely with CodiMD')
    expect(action.isVisible(optionsFor([resource]))).toBe(false)
    expect(action.label(optionsFor([resource]))).toBe(positive.action.label)
  })

  it('hides the action and returns an empty label when nothing is selected', () => {
    const { action } = mountAction()

    expect(action.isVisible()).toBe(false)
    expect(action.label()).toBe('')
    expect(action.isVisible(optionsFor([]))).toBe(false)
    expect(action.label(optionsFor([]))).toBe('')
    expect(action.isVisible(optionsFor(undefined))).toBe(false)
    expect(action.label(optionsFor(undefined))).toBe('')
    expect(action.label()).not.toBe('Open remotely')
    expect(action.label()).not.toBe('Open remotely with ')
    expect(action.label()).not.toBe('Open remotely with %{appName}')
  })
})
