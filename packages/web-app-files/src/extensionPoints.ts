import {
  ActionExtension,
  CustomComponentExtension,
  ExtensionPoint,
  FolderViewExtension
} from '@ownclouders/web-pkg'
import { computed } from 'vue'

export const uploadMenuExtensionPoint: ExtensionPoint<ActionExtension> = {
  id: 'app.files.upload-menu',
  extensionType: 'action',
  multiple: true
}
export const quickActionsExtensionPoint: ExtensionPoint<ActionExtension> = {
  id: 'app.files.quick-actions',
  extensionType: 'action',
  multiple: true
}
export const batchActionsExtensionPoint: ExtensionPoint<ActionExtension> = {
  id: 'global.files.batch-actions',
  extensionType: 'action',
  multiple: true
}
export const contextActionsExtensionPoint: ExtensionPoint<ActionExtension> = {
  id: 'global.files.context-actions',
  extensionType: 'action',
  multiple: true
}
export const defaultActionsExtensionPoint: ExtensionPoint<ActionExtension> = {
  id: 'global.files.default-actions',
  extensionType: 'action',
  multiple: true
}
export const shareDialogExtensionPoint: ExtensionPoint<CustomComponentExtension> = {
  id: 'global.files.share-dialog',
  extensionType: 'customComponent'
}
export const detailsDialogExtensionPoint: ExtensionPoint<CustomComponentExtension> = {
  id: 'global.files.details-dialog',
  extensionType: 'customComponent'
}
export const spaceMembersDialogExtensionPoint: ExtensionPoint<CustomComponentExtension> = {
  id: 'global.files.space-members-dialog',
  extensionType: 'customComponent'
}
export const folderViewsFolderExtensionPoint: ExtensionPoint<FolderViewExtension> = {
  id: 'app.files.folder-views.folder',
  extensionType: 'folderView'
}
export const folderViewsFavoritesExtensionPoint: ExtensionPoint<FolderViewExtension> = {
  id: 'app.files.folder-views.favorites',
  extensionType: 'folderView'
}
export const folderViewsOfficeFilesExtensionPoint: ExtensionPoint<FolderViewExtension> = {
  id: 'app.files.folder-views.office-files',
  extensionType: 'folderView'
}
export const folderViewsProjectSpacesExtensionPoint: ExtensionPoint<FolderViewExtension> = {
  id: 'app.files.folder-views.project-spaces',
  extensionType: 'folderView'
}

export const extensionPoints = () => {
  return computed<ExtensionPoint<any>[]>(() => {
    return [
      uploadMenuExtensionPoint,
      quickActionsExtensionPoint,
      batchActionsExtensionPoint,
      contextActionsExtensionPoint,
      defaultActionsExtensionPoint,
      shareDialogExtensionPoint,
      detailsDialogExtensionPoint,
      spaceMembersDialogExtensionPoint,
      folderViewsFolderExtensionPoint,
      folderViewsFavoritesExtensionPoint,
      folderViewsOfficeFilesExtensionPoint,
      folderViewsProjectSpacesExtensionPoint
    ]
  })
}
