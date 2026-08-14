import { mock } from 'vitest-mock-extended'
import { unref } from 'vue'
import { Resource, SpaceResource } from '@ownclouders/web-client'
import {
  defaultComponentMocks,
  RouteLocation,
  getComposableWrapper
} from '@ownclouders/web-test-helpers'
import { useFileActionsPaste } from '../../../../../src/composables/actions/files'
import { useClipboardStore } from '../../../../../src/composables/piniaStores'

// a webdav COPY/MOVE carries either the public link token or the user's bearer token, never both,
// so a transfer across that boundary is built for one context and rejected by the other
describe('paste', () => {
  describe('across the public link / authenticated boundary', () => {
    it('is hidden when the clipboard came from a public link and the target is a real space', () => {
      getWrapper({
        isPublicLinkSource: true,
        setup: ({ actions }) => {
          expect(
            unref(actions)[0].isVisible({
              space: mock<SpaceResource>({ driveType: 'personal' }),
              resources: [mock<Resource>({ id: 'target' })]
            })
          ).toBeFalsy()
        }
      })
    })

    it('is hidden when the clipboard came from a real space and the target is a public link', () => {
      getWrapper({
        isPublicLinkSource: false,
        setup: ({ actions }) => {
          expect(
            unref(actions)[0].isVisible({
              space: mock<SpaceResource>({ driveType: 'public' }),
              resources: [mock<Resource>({ id: 'target' })]
            })
          ).toBeFalsy()
        }
      })
    })

    it('is shown when both sides are authenticated spaces', () => {
      getWrapper({
        isPublicLinkSource: false,
        setup: ({ actions }) => {
          expect(
            unref(actions)[0].isVisible({
              space: mock<SpaceResource>({ driveType: 'personal' }),
              resources: [mock<Resource>({ id: 'target' })]
            })
          ).toBeTruthy()
        }
      })
    })

    it('does nothing when the handler is invoked across the boundary', async () => {
      await getWrapper({
        isPublicLinkSource: true,
        setup: async ({ handler }) => {
          // the keyboard shortcut calls the handler directly, bypassing isVisible
          await handler({
            space: mock<SpaceResource>({ driveType: 'personal' }),
            resources: []
          })

          const clipboardStore = useClipboardStore()
          expect(clipboardStore.clearClipboard).not.toHaveBeenCalled()
        }
      })
    })
  })
})

function getWrapper({
  isPublicLinkSource,
  setup
}: {
  isPublicLinkSource: boolean
  setup: (instance: ReturnType<typeof useFileActionsPaste>) => void | Promise<void>
}) {
  const mocks = {
    ...defaultComponentMocks({
      currentRoute: mock<RouteLocation>({ name: 'files-spaces-generic' })
    })
  }

  let result: void | Promise<void>
  const wrapper = getComposableWrapper(
    () => {
      const instance = useFileActionsPaste()
      result = setup(instance)
    },
    {
      mocks,
      provide: mocks,
      pluginOptions: {
        piniaOptions: {
          clipboardState: {
            resources: [mock<Resource>({ id: 'clipboard-item' })],
            isPublicLinkSource
          }
        }
      }
    }
  )

  return Promise.resolve(result).then(() => ({ mocks, wrapper }))
}
