import { Resource } from 'web-client/src'
import { ResourceFilterConstants } from './constants'

export function useFilter(files: any[], filter: string) {
  let filteredItems = files as Resource[]
  const filters = ResourceFilterConstants.resourceOptions

  switch (filter) {
    case filters[1]:
      filteredItems = filteredItems.filter((item) =>
        ResourceFilterConstants.mediaFileTypes.includes(item.extension)
      )
      break
    case filters[2]:
      filteredItems = filteredItems.filter((item) =>
        ResourceFilterConstants.textfileTypes.includes(item.extension)
      )
      break
    case filters[3]:
      filteredItems = filteredItems.filter((item) => item.isFolder)
      break
    case filters[4]:
      filteredItems = filteredItems.filter((item) =>
        ResourceFilterConstants.scriptTypes.includes(item.extension)
      )
    default:
      break
  }
  return filteredItems
}
