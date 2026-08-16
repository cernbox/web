import { mock } from 'vitest-mock-extended'
import { unref } from 'vue'
import { useFileActionsDownloadFile } from '../../../../../src/composables/actions'
import { Resource, SpaceResource } from '@ownclouders/web-client'
import {
  defaultComponentMocks,
  RouteLocation,
  getComposableWrapper
} from '@ownclouders/web-test-helpers'

describe('useFileActionsDownloadFile', () => {
  describe('isVisible property of returned element within actions', () => {
    it('is true for a single downloadable file', () => {
      getWrapper({
        setup: ({ actions }) => {
          const resource = mock<Resource>({ isFolder: false, canDownload: () => true })
          expect(unref(actions)[0].isVisible({ space: null, resources: [resource] })).toBe(true)
        }
      })
    })

    it('is false for a folder', () => {
      getWrapper({
        setup: ({ actions }) => {
          const resource = mock<Resource>({ isFolder: true, canDownload: () => true })
          expect(unref(actions)[0].isVisible({ space: null, resources: [resource] })).toBe(false)
        }
      })
    })
  })

  describe('handler', () => {
    it('downloads the first resource', () => {
      getWrapper({
        setup: ({ actions }) => {
          const resource = mock<Resource>({ isFolder: false })
          const space = mock<SpaceResource>()
          unref(actions)[0].handler({ space, resources: [resource] })
        }
      })
    })
  })
})

function getWrapper({
  setup
}: {
  setup: (instance: ReturnType<typeof useFileActionsDownloadFile>) => void
}) {
  const mocks = defaultComponentMocks({
    currentRoute: mock<RouteLocation>({ path: '/some-other-app/personal' })
  })

  return {
    wrapper: getComposableWrapper(
      () => {
        setup(useFileActionsDownloadFile())
      },
      {
        mocks,
        provide: mocks
      }
    )
  }
}
