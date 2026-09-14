import SharingHierarchyConflictModal from '../../../../src/components/Modals/SharingHierarchyConflictModal.vue'
import { defaultComponentMocks, defaultPlugins, shallowMount } from '@ownclouders/web-test-helpers'
import { mock } from 'vitest-mock-extended'
import { Modal } from '../../../../src/composables/piniaStores'

describe('SharingHierarchyConflictModal', () => {
  it('renders grouped conflict list', () => {
    const { wrapper } = getWrapper({
      props: {
        conflicts: [
          {
            kind: 'hierarchy_conflict',
            errorType: 'child_conflict',
            message: 'Child shares will be removed',
            canForce: true,
            conflictingShares: [
              {
                sharee: 'userA',
                path: 'myfolder',
                permissionType: 'Read'
              }
            ],
            raw: {}
          }
        ]
      }
    })

    expect(wrapper.find('[data-testid="sharing-hierarchy-conflict-list"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Shared with userA:')
    expect(wrapper.text()).toContain('(Read) myfolder')
  })

  it('shows Proceed anyway for a single confirm conflict', () => {
    const { wrapper } = getWrapper()
    expect(wrapper.vm.confirmLabel).toBe('Proceed anyway')
  })

  it('shows Proceed with all for multiple confirm conflicts', () => {
    const { wrapper } = getWrapper({
      props: {
        conflicts: [
          {
            kind: 'hierarchy_conflict',
            errorType: 'child_conflict',
            message: 'A',
            canForce: true,
            raw: {}
          },
          {
            kind: 'hierarchy_conflict',
            errorType: 'child_conflict',
            message: 'B',
            canForce: true,
            raw: {}
          }
        ]
      }
    })

    expect(wrapper.vm.confirmLabel).toBe('Proceed with all')
  })

  it('shows OK only in inform mode', () => {
    const { wrapper } = getWrapper({ props: { mode: 'inform' } })
    expect(wrapper.vm.cancelLabel).toBe('OK')
    expect(wrapper.find('.oc-modal-body-actions-confirm').exists()).toBe(false)
  })

  it('shows remove action in inform-remove mode', () => {
    const { wrapper } = getWrapper({
      props: {
        mode: 'inform-remove',
        introVariant: 'redundant-direct-share',
        conflicts: [
          {
            kind: 'hierarchy_conflict',
            errorType: 'parent_conflict',
            message: 'Already shared through parent',
            canForce: false,
            raw: {}
          }
        ]
      }
    })

    expect(wrapper.vm.cancelLabel).toBe('OK')
    expect(wrapper.vm.confirmLabel).toBe('Remove this share')
    expect(wrapper.vm.intro).toContain('Remove this direct share')
  })

  it('calls callback on confirm', async () => {
    const callbackFn = vi.fn()
    const { wrapper } = getWrapper({ props: { callbackFn } })
    await wrapper.vm.onConfirm()
    expect(callbackFn).toHaveBeenCalledWith(true)
  })

  it('calls callback with remove in inform-remove mode', async () => {
    const callbackFn = vi.fn()
    const { wrapper } = getWrapper({ props: { mode: 'inform-remove', callbackFn } })
    await wrapper.vm.onConfirm()
    expect(callbackFn).toHaveBeenCalledWith('remove')
  })

  it('calls callback on cancel', async () => {
    const callbackFn = vi.fn()
    const { wrapper } = getWrapper({ props: { callbackFn } })
    await wrapper.vm.onCancel()
    expect(callbackFn).toHaveBeenCalledWith(false)
  })
})

function getWrapper({ props = {} } = {}) {
  const mocks = defaultComponentMocks()

  return {
    mocks,
    wrapper: shallowMount(SharingHierarchyConflictModal, {
      props: {
        modal: mock<Modal>({ id: 'modal-1' }),
        mode: 'confirm',
        graphRoles: {},
        callbackFn: vi.fn(),
        conflicts: [
          {
            kind: 'hierarchy_conflict',
            errorType: 'child_conflict',
            message: 'Child shares will be removed',
            canForce: true,
            conflictingShares: [
              {
                sharee: 'userA',
                path: 'myfolder',
                permissionType: 'Read'
              }
            ],
            raw: {}
          }
        ],
        ...props
      },
      global: {
        plugins: [...defaultPlugins()],
        mocks,
        provide: mocks
      }
    })
  }
}
