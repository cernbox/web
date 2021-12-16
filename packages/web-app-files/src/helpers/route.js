/**
 * Checks whether the user is currently in a given route
 * @param {Array} routes The array of routes which should be checked
 * @param {String} currentRoute The route that the user is currently in
 * @returns {Boolean}
 */
export function checkRoute(routes, currentRoute) {
  return routes ? routes.indexOf(currentRoute) > -1 : true
}

export function isPersonalRoute(route) {
  return route.name === 'files-personal'
}

export function isFavoritesRoute(route) {
  return route.name === 'files-favorites'
}

export function isTrashbinRoute(route) {
  return route.name === 'files-trashbin'
}

export function isSharedWithMeRoute(route) {
  return route.name === 'files-shared-with-me'
}

export function isSharedWithOthersRoute(route) {
  return route.name === 'files-shared-with-others'
}

export function isSharedViaLink(route) {
  return route.name === 'files-shared-via-link'
}

export function isAnySharedWithRoute(route) {
  return isSharedWithMeRoute(route) || isSharedWithOthersRoute(route)
}

export function isProjectsRoute(route) {
  return route.name === 'files-projects'
}

export function isProjectTrashbinRoute(route) {
  return route.name === 'files-trashbin-project'
}

export function isPublicFilesRoute(route) {
  return route.name === 'files-public-list'
}

export function isPublicPage(route) {
  if (route.meta) {
    return route.meta.auth === false
  }
  return false
}
