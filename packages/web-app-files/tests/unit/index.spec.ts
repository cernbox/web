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

      it('does not claim every eos route via the catch-all fallback space', () => {
        // the fallback's driveAlias ('eos') is a url-prefix of every real eos driveAlias. Listing
        // it in activeFor made the href check in Application.vue match any eos route - so browsing
        // a share lit up both "Shares" and "Spaces" at once.
        const spacesStore = useSpacesStore()
        spacesStore.spaces = [
          mock<SpaceResource>({ id: 'fallback', driveType: 'explorer', driveAlias: 'eos' }),
          mock<SpaceResource>({
            id: 'p',
            driveType: 'project',
            driveAlias: 'eos/project/c/cernbox'
          })
        ]

        const paths = navItems(undefined)[4]
          .activeFor()
          .map(({ path }) => path)

        expect(paths).not.toContain('/files/spaces/eos')
        expect(paths).toContain('/files/spaces/eos/project/c/cernbox')
        // a share's owner path must not be claimed by any of them
        expect(paths.some((p) => '/files/spaces/eos/user/p/pmedinar/sub'.startsWith(p))).toBeFalsy()
      })
    })
  })
})
