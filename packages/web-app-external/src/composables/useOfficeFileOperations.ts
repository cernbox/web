import { markRaw, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { dirname } from 'path'
import { Resource, extractNameWithoutExtension } from '@ownclouders/web-client'
import {
  FilePickerModal,
  resolveFileNameDuplicate,
  useClientService,
  useFolderLink,
  useModals
} from '@ownclouders/web-pkg'
import type { OfficePostMessageContext } from './postMessages/types'

/**
 * Shared, app-agnostic file operations triggered from an office app's postMessage
 * protocol (save as / insert graphic / insert file / insert link) - implemented once
 * here, translated to/from each app's own protocol by its dedicated composable.
 */
export function useOfficeFileOperations(ctx: OfficePostMessageContext) {
  const { space, resource } = ctx
  const { $gettext } = useGettext()
  const { dispatchModal } = useModals()
  const { webdav } = useClientService()
  const { getParentFolderLink } = useFolderLink()

  const getSaveAsNameErrorMsg = (newName: string, existingFiles: Resource[]): string | null => {
    if (!newName) {
      return $gettext('The name cannot be empty')
    }
    if (/[/]/.test(newName)) {
      return $gettext('The name cannot contain "/"')
    }
    if (newName === '.') {
      return $gettext('The name cannot be equal to "."')
    }
    if (newName === '..') {
      return $gettext('The name cannot be equal to ".."')
    }
    if (/\s+$/.test(newName)) {
      return $gettext('The name cannot end with whitespace')
    }
    if (existingFiles.some((f) => f.name === newName)) {
      return $gettext('The name "%{name}" is already taken', { name: newName }, true)
    }
    return null
  }

  const saveAs = async (opts: {
    fileExtension?: string
    onConfirm: (newFileName: string) => void
  }): Promise<void> => {
    const currentResource = unref(resource)
    const { children: existingFiles } = await webdav.listFiles(unref(space), {
      path: dirname(currentResource.path)
    })

    const defaultName = opts.fileExtension
      ? `${extractNameWithoutExtension(currentResource)}.${opts.fileExtension}`
      : currentResource.name
    const suggestedName = existingFiles.some((f) => f.name === defaultName)
      ? resolveFileNameDuplicate(
          defaultName,
          opts.fileExtension || currentResource.extension,
          existingFiles
        )
      : defaultName

    const nameWithoutExtension = extractNameWithoutExtension({
      name: suggestedName,
      extension: opts.fileExtension || currentResource.extension
    } as Resource)

    dispatchModal({
      title: opts.fileExtension
        ? $gettext('Export »%{name}« as %{format}', {
            name: currentResource.name,
            format: opts.fileExtension
          })
        : $gettext('Save »%{name}« with new name', { name: currentResource.name }),
      confirmText: $gettext('Save'),
      hasInput: true,
      inputValue: suggestedName,
      inputLabel: $gettext('File name'),
      inputSelectionRange: [0, nameWithoutExtension.length],
      onConfirm: (newName) => opts.onConfirm(newName as string),
      onInput: (newName, setError) => setError(getSaveAsNameErrorMsg(newName, existingFiles))
    })
  }

  const insertGraphic = async (opts: { onPicked: (url: string) => void }): Promise<void> => {
    const currentResource = unref(resource)
    dispatchModal({
      elementClass: 'open-with-app-modal',
      title: $gettext('Insert graphic'),
      customComponent: markRaw(FilePickerModal),
      hideActions: true,
      customComponentAttrs: () => ({
        parentFolderLink: getParentFolderLink(currentResource),
        allowedFileTypes: ['image/png', 'image/gif', 'image/jpeg', 'image/jpg', 'image/svg'],
        callbackFn: ({ resource: picked }: { resource: Resource }) => {
          opts.onPicked(picked.downloadURL)
        }
      }),
      focusTrapInitial: false
    })
  }

  const insertFile = async (opts: {
    mimeTypeFilter?: string[]
    onPicked: (url: string, filename?: string) => void
  }): Promise<void> => {
    const currentResource = unref(resource)
    dispatchModal({
      elementClass: 'open-with-app-modal',
      title: $gettext('Insert file'),
      customComponent: markRaw(FilePickerModal),
      hideActions: true,
      customComponentAttrs: () => ({
        parentFolderLink: getParentFolderLink(currentResource),
        allowedFileTypes: opts.mimeTypeFilter || [],
        callbackFn: ({ resource: picked }: { resource: Resource }) => {
          opts.onPicked(picked.downloadURL, picked.name)
        }
      }),
      focusTrapInitial: false
    })
  }

  const insertLink = async (opts: {
    onPicked: (url: string, text: string) => void
  }): Promise<void> => {
    const currentResource = unref(resource)
    dispatchModal({
      elementClass: 'open-with-app-modal',
      title: $gettext('Pick a file to link'),
      customComponent: markRaw(FilePickerModal),
      hideActions: true,
      customComponentAttrs: () => ({
        parentFolderLink: getParentFolderLink(currentResource),
        allowedFileTypes: [],
        callbackFn: ({ resource: picked }: { resource: Resource }) => {
          opts.onPicked(picked.privateLink, picked.name)
        }
      }),
      focusTrapInitial: false
    })
  }

  return {
    saveAs,
    insertGraphic,
    insertFile,
    insertLink
  }
}
