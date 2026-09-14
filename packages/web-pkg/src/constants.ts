export const EVENT_TROW_MOUNTED = 'rowMounted'
export const EVENT_FILE_DROPPED = 'fileDropped'
export const EVENT_TROW_CONTEXTMENU = 'contextmenuClicked'

export abstract class ImageDimension {
  static readonly Thumbnail: [number, number] = [36, 36]
  static readonly Tile: [number, number] = [1000, 1000]
  static readonly Preview: [number, number] = [1200, 1200]
  static readonly Avatar: number = 64
}

export abstract class ImageType {
  static readonly Thumbnail: string = 'thumbnail'
  static readonly Preview: string = 'preview'
  static readonly Avatar: string = 'avatar'
}

// Re-exported from web-client where they are defined to avoid circular workspace dependency
export { HIDDEN_FILE_EXTENSIONS, PASSWORD_PROTECTED_FOLDER_FILE_EXTENSION } from '@ownclouders/web-client'
