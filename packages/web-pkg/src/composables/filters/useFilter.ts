import { Resource } from 'web-client/src'
import { ResourceFilterConstants } from './constants'

interface FilterProps<T> {
  items?: T[]
}

export function useFilter<T>({ items = [] }: FilterProps<T>): {
  items: T[]
  resetFilter: VoidFunction
  setFilter: (filter: string) => void
} {
  let filteredItems = items as Resource[]

  let filter = 'IMAGES'
  function resetFilter() {
    filter = 'ALL'
  }

  function setFilter(newFilter: string) {
    if (ResourceFilterConstants.resourceOptions.includes(newFilter)) {
      filter = newFilter
    }
  }

  switch (filter) {
    case 'IMAGES':
      const imageTypes = [
        'JPEG',
        'JPG',
        'PNG',
        'BMP',
        'GIF',
        'TIFF',
        'SVG',
        'RAW',
        'WEBP',
        'HEIF',
        'ICO',
        'PSD'
      ]

      filteredItems = filteredItems.filter((item) =>
        imageTypes.includes(item.extension.toUpperCase())
      )
      break
    case 'TEXTFILES':
      const textfileTypes = ['TXT', 'DOCX', 'DOC', 'MD', 'XML', 'HTML', 'YAML', 'YML']
      filteredItems = filteredItems.filter((item) =>
        textfileTypes.includes(item.extension.toUpperCase())
      )
      break
    case 'FOLDERS':
      filteredItems = filteredItems.filter((item) => item.isFolder)
      break
    case 'SPREADSHEETS':
      const spreadsheetFiles = ['CSV', 'GSEET', 'GSHEETS', 'XLS', 'XLSX']
      filteredItems = filteredItems.filter((item) =>
        spreadsheetFiles.includes(item.extension.toUpperCase())
      )
      break
    case 'MEDIA FILES':
      const mediaFileTypes = ['MP3', 'WAV', 'FLAC', 'AAC', 'MP4', 'AVI', 'MOV', 'WMV']
      filteredItems = filteredItems.filter((item) =>
        mediaFileTypes.includes(item.extension.toUpperCase())
      )
      break
    default:
      break
  }
  return { items: filteredItems as T[], resetFilter: resetFilter, setFilter: setFilter }
}
