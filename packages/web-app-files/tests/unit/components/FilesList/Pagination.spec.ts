import _ from 'lodash'
import Pagination from 'web-app-files/src/components/FilesList/Pagination.vue'
import { defaultPlugins, mount, shallowMount, RouterLinkStub } from 'web-test-helpers'

const filesPersonalRoute = { name: 'files-personal', path: '/files/home' }

const selectors = {
  filesPagination: '.files-pagination'
}

describe('Pagination', () => {
  describe('when amount of pages is', () => {
    describe('less than or equals one', () => {
      it.each([-1, 0, 1])('should not show wrapper', (pages) => {
        const { wrapper } = getWrapper({ currentPage: 0, pages })

        expect(wrapper.find(selectors.filesPagination).exists()).toBeFalsy()
      })
    })

    describe('greater than one', () => {
      const { wrapper } = getWrapper({ currentPage: 1, pages: 2 })

      it('should show wrapper', () => {
        const paginationEl = wrapper.find('.files-pagination')

        expect(paginationEl.exists()).toBeTruthy()
        expect(paginationEl.attributes().pages).toBe('2')
      })

      it('should set provided current page', () => {
        const paginationEl = wrapper.find(selectors.filesPagination)
        expect(paginationEl.attributes().currentpage).toBe('1')
      })
    })
  })

  describe('current route', () => {
    it('should use provided route to render pages', () => {
      const { wrapper } = getWrapper({}, mount)
      const currentRoute = wrapper.vm.$route
      const links = wrapper.findAllComponents(RouterLinkStub)

      // three links (route to prev, next and last page)
      expect(links.length).toBe(3)
      expect(links.at(0).props().to.name).toBe(currentRoute.name)
      expect(links.at(1).props().to.name).toBe(currentRoute.name)
      expect(links.at(2).props().to.name).toBe(currentRoute.name)
    })
  })
})

function getWrapper(propsData = {}, mountType = shallowMount) {
  return {
    wrapper: mountType(Pagination, {
      props: _.merge({ currentPage: 1, pages: 10 }, propsData),
      global: {
        stubs: {
          RouterLink: RouterLinkStub
        },
        mocks: {
          $route: filesPersonalRoute
        },
        plugins: [...defaultPlugins()]
      }
    })
  }
}
