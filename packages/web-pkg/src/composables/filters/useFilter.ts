import { Resource } from 'web-client/src'
import { ResourceFilterConstants } from './constants'

export function useFilter(files: any[], filter: string, fileType: string) {
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
  if (fileType && fileType !== '') {
    const fileTypeFilter = getFileTypeFilter(fileType.toLowerCase())
    filteredItems = filteredItems.filter((item) => new RegExp(fileTypeFilter).test(item.extension))
  }
  return filteredItems
}

//Checks for filetypes which can have multiple extensions and returns all versions
const getFileTypeFilter = (fileType: string) => {
  let fileFilter = fileType.replace('.', '')
  switch (fileType) {
    case 'jpg':
      fileFilter = 'jpe?g'
      break
    case 'jpeg':
      fileFilter = 'jpe?g'
      break
    case 'yaml':
      fileFilter = 'ya?ml'
      break
    case 'yml':
      fileFilter = 'ya?ml'
      break
    case 'docx':
      fileFilter = 'docx?'
      break
    case 'doc':
      fileFilter = 'docx?'
      break
    case 'xlsx':
      fileFilter = 'xlsx?'
      break
    case 'xls':
      fileFilter = 'xlsx?'
      break
  }
  return fileFilter
}
