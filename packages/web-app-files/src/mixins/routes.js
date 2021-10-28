import {
  isAnySharedWithRoute,
  isFavoritesRoute,
  isPersonalRoute,
  isLightweightRoute,
  isPublicFilesRoute,
  isPublicPage,
  isSharedWithMeRoute,
  isSharedWithOthersRoute,
  isTrashbinRoute
} from '../helpers/route'

export default {
  computed: {
    isPersonalRoute() {
      return isPersonalRoute(this.$route)
    },
    isLightweightRoute() {
      return isLightweightRoute(this.$route)
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
    isPublicPage() {
      return isPublicPage(this.$route)
    }
  }
}
