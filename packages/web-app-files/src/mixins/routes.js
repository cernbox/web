import {
  isAnySharedWithRoute,
  isFavoritesRoute,
  isPersonalRoute,
  isPublicFilesRoute,
  isPublicPage,
  isProjectsRoute,
  isSharedWithMeRoute,
  isSharedWithOthersRoute,
  isTrashbinRoute
} from '../helpers/route'

export default {
  computed: {
    isPersonalRoute() {
      return isPersonalRoute(this.$route)
    },
    isFavoritesRoute() {
      return isFavoritesRoute(this.$route)
    },
    isTrashbinRoute() {
      return isTrashbinRoute(this.$route)
    },
    isSharedWithMeRoute() {
      return isSharedWithMeRoute(this.$route)
    },
    isSharedWithOthersRoute() {
      return isSharedWithOthersRoute(this.$route)
    },
    isAnySharedWithRoute() {
      return isAnySharedWithRoute(this.$route)
    },
    isPublicFilesRoute() {
      return isPublicFilesRoute(this.$route)
    },
    isProjectsRoute() {
      return isProjectsRoute(this.$route)
    },
    isPublicPage() {
      return isPublicPage(this.$route)
    }
  }
}
