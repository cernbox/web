import { createPinia, setActivePinia } from 'pinia'
import { navItems } from '../../src/index'
import { useSpacesStore } from '@ownclouders/web-pkg'
import { SpaceResource } from '@ownclouders/web-client'
import { mock } from 'vitest-mock-extended'

describe('Web app files', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const spacesStore = useSpacesStore()
    spacesStore.spacesInitialized = true
  })

  describe('navItems', () => {
    describe('Personal', () => {
      it('should be enabled if user has a personal space', () => {
        const spacesStore = useSpacesStore()
        spacesStore.spaces = [
          mock<SpaceResource>({ id: '1', driveType: 'personal', isOwner: () => true })
        ]
        const items = navItems(undefined)
        expect(items[0].isVisible()).toBeTruthy()
      })
      it('should be disabled if user has no a personal space', () => {
        const spacesStore = useSpacesStore()
        spacesStore.spaces = [
          mock<SpaceResource>({ id: '1', driveType: 'project', isOwner: () => false })
        ]
        // only once personal spaces have actually been fetched does "none present" mean the user
        // has none
        spacesStore.setTypeInitialized('personal', true)
        const items = navItems(undefined)
        expect(items[0].isVisible()).toBeFalsy()
      })
      it('stays visible while personal spaces have not been loaded yet', () => {
        const spacesStore = useSpacesStore()
        spacesStore.spaces = []
        const items = navItems(undefined)
        expect(items[0].isVisible()).toBeTruthy()
      })
    })
    describe('Spaces', () => {
      it.each([
        { currentSpace: undefined, expectedResult: true },
        { currentSpace: mock<SpaceResource>({ driveType: 'project' }), expectedResult: true },
        { currentSpace: mock<SpaceResource>({ driveType: 'explorer' }), expectedResult: true },
        { currentSpace: mock<SpaceResource>({ driveType: 'personal' }), expectedResult: false }
      ])(
        'is active only for project/explorer spaces, not for other eos-backed spaces like personal',
        ({ currentSpace, expectedResult }) => {
          const spacesStore = useSpacesStore()
          spacesStore.currentSpace = currentSpace
          const items = navItems(undefined)
          expect(items[4].isActive()).toBe(expectedResult)
        }
      )
    })
  })
})
