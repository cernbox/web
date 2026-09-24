import { mock } from 'vitest-mock-extended'
import { useFileActions } from '../../../../../src/composables/actions'
import {
  defaultComponentMocks,
  RouteLocation,
  getComposableWrapper
} from '@ownclouders/web-test-helpers'
import { computed, unref } from 'vue'
import { describe } from 'vitest'
import { Resource, SpaceResource } from '@ownclouders/web-client'
import { Action, FileActionOptions } from '../../../../../src/composables/actions'
import { ApplicationFileExtension } from '../../../../../src/apps'

const mockUseEmbedMode = vi.fn().mockReturnValue({ isEnabled: computed(() => false) })
vi.mock('../../../../../src/composables/embedMode', () => ({
  useEmbedMode: vi.fn().mockImplementation(() => mockUseEmbedMode())
}))

describe('fileActions', () => {
  describe('computed property "editorActions"', () => {
    it('should provide a list of editors', () => {
      getWrapper({
        setup: ({ editorActions }) => {
          expect(unref(editorActions).length).toEqual(2)
        }
      })
    })
    it('should provide an empty list if embed mode is enabled', () => {
      mockUseEmbedMode.mockReturnValueOnce({
        isEnabled: computed(() => true)
      })
      getWrapper({
        setup: ({ editorActions }) => {
          expect(unref(editorActions).length).toBeFalsy()
        }
      })
    })
  })
  describe('matching', () => {
    const fileExtensions: ApplicationFileExtension[] = [
      { app: 'text-editor', extension: 'txt', label: 'Open as text' },
      { app: 'text-editor', mimeType: 'text' },
      { app: 'external', mimeType: 'text' },
      { app: 'external', mimeType: 'text/plain', label: 'Open plain text' }
    ]
    const visibleFor = (actions: Action<FileActionOptions>[], resource: Partial<Resource>) =>
      actions
        .filter((action) =>
          action.isVisible({
            space: mock<SpaceResource>(),
            resources: [mock<Resource>({ canDownload: () => true, ...resource })]
          })
        )
        .map((action) => action.label({ space: null, resources: [] }))

    it.each([
      {
        resource: { extension: 'txt', mimeType: 'text/plain' },
        labels: ['Open as text', 'Open plain text']
      },
      {
        resource: { extension: '', mimeType: 'text/plain' },
        labels: ['Open in Text Editor', 'Open plain text']
      },
      {
        resource: { extension: 'log', mimeType: 'text/x-log' },
        labels: ['Open in Text Editor', 'Open in External']
      },
      { resource: { extension: 'png', mimeType: 'image/png' }, labels: [] }
    ])('offers each app once, by its best match: $resource', ({ resource, labels }) => {
      getWrapper({
        fileExtensions,
        setup: ({ editorActions }) => {
          expect(visibleFor(unref(editorActions), resource)).toEqual(labels)
        }
      })
    })
  })
  describe('secure view context', () => {
    describe('computed property "editorActions"', () => {
      it('only displays editors that support secure view', () => {
        getWrapper({
          setup: ({ editorActions }) => {
            const secureViewResource = mock<Resource>({
              id: '1',
              canDownload: () => false,
              mimeType: 'text/txt',
              extension: 'txt'
            })
            const actions = unref(editorActions)
            expect(actions.length).toEqual(2)
            expect(
              actions[0].isVisible({ resources: [secureViewResource], space: null })
            ).toBeFalsy()
            expect(
              actions[1].isVisible({ resources: [secureViewResource], space: null })
            ).toBeTruthy()
          }
        })
      })
    })
  })
})

function getWrapper({
  setup,
  fileExtensions = [
    {
      app: 'text-editor',
      extension: 'txt',
      hasPriority: false
    },
    {
      app: 'external',
      label: 'Open in Collabora',
      mimeType: 'text/txt',
      routeName: 'external-apps',
      icon: 'https://host.docker.internal:9980/favicon.ico',
      name: 'Collabora',
      hasPriority: false,
      secureView: true
    }
  ]
}: {
  setup: (instance: ReturnType<typeof useFileActions>) => void
  fileExtensions?: ApplicationFileExtension[]
}) {
  const mocks = {
    ...defaultComponentMocks({
      currentRoute: mock<RouteLocation>({ name: 'files-spaces-generic' })
    })
  }
  return {
    mocks,
    wrapper: getComposableWrapper(
      () => {
        const instance = useFileActions()
        setup(instance)
      },
      {
        mocks,
        provide: mocks,
        pluginOptions: {
          piniaOptions: {
            appsState: {
              apps: {
                'text-editor': {
                  defaultExtension: 'txt',
                  icon: 'file-text',
                  name: 'Text Editor',
                  id: 'text-editor',
                  color: '#0D856F',
                  extensions: [
                    {
                      extension: 'txt'
                    }
                  ],
                  hasEditor: true
                },
                external: {
                  defaultExtension: '',
                  icon: 'check_box_outline_blank',
                  name: 'External',
                  id: 'external',
                  hasEditor: true
                },
                'editor-less': {
                  defaultExtension: '',
                  icon: 'check_box_outline_blank',
                  name: 'Editor Less',
                  id: 'editor-less',
                  hasEditor: false
                }
              },
              fileExtensions
            }
          }
        }
      }
    )
  }
}
