import SideBar from '../../../../src/components/SideBar/SideBar.vue'
import { SideBarPanel } from '../../../../src/components/SideBar/types'
import { Resource, SpaceResource } from '@ownclouders/web-client'
import { defaultPlugins, shallowMount } from '@ownclouders/web-test-helpers'
import { defineComponent } from 'vue'

const DummyPanel = defineComponent({ name: 'DummyPanel', template: '<div />' })

const mockRootPanel: SideBarPanel<SpaceResource, Resource, Resource> = {
  name: 'Details',
  icon: 'information',
  title: () => 'Details',
  isVisible: () => true,
  isRoot: () => true,
  component: DummyPanel
}

describe('SideBar', () => {
  it('renders app-sidebar landmark', () => {
    const wrapper = shallowMount(SideBar, {
      props: {
        isOpen: true,
        loading: false,
        availablePanels: [mockRootPanel],
        panelContext: { items: [] },
        activePanel: ''
      },
      global: {
        plugins: [...defaultPlugins()],
        stubs: { OcSpinner: true, OcButton: true, OcIcon: true }
      }
    })
    expect(wrapper.find('[data-testid="app-sidebar"]').exists()).toBe(true)
  })

  it('adds full-width class when viewport width is at most 960px', () => {
    const original = window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 800
    })
    try {
      const wrapper = shallowMount(SideBar, {
        props: {
          isOpen: true,
          loading: false,
          availablePanels: [mockRootPanel],
          panelContext: { items: [] },
          activePanel: ''
        },
        global: {
          plugins: [...defaultPlugins()],
          stubs: { OcSpinner: true, OcButton: true, OcIcon: true }
        }
      })
      expect(wrapper.find('[data-testid="app-sidebar"]').classes()).toContain('app-sidebar-full-width')
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: original
      })
    }
  })

  it('does not add full-width class when viewport is wider than 960px', () => {
    const original = window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1400
    })
    try {
      const wrapper = shallowMount(SideBar, {
        props: {
          isOpen: true,
          loading: false,
          availablePanels: [mockRootPanel],
          panelContext: { items: [] },
          activePanel: ''
        },
        global: {
          plugins: [...defaultPlugins()],
          stubs: { OcSpinner: true, OcButton: true, OcIcon: true }
        }
      })
      expect(wrapper.find('[data-testid="app-sidebar"]').classes()).not.toContain(
        'app-sidebar-full-width'
      )
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: original
      })
    }
  })
})
