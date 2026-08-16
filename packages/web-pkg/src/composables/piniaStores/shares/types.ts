import {
  CollaboratorShare,
  LinkShare,
  Resource,
  SpaceResource,
  type ConfirmSharingHierarchyConflict,
  type GraphRequestOptions,
  type InformSharingHierarchyConflict
} from '@ownclouders/web-client'
import { DriveItemCreateLink, DriveItemInvite } from '@ownclouders/web-client/graph/generated'
import { ClientService } from '../../../services'
export interface AddShareOptions {
  clientService: ClientService
  space: SpaceResource
  resource: Resource
  options: DriveItemInvite
  graphRequestOptions?: GraphRequestOptions
  confirmSharingHierarchyConflict?: ConfirmSharingHierarchyConflict
  informSharingHierarchyConflict?: InformSharingHierarchyConflict
  /** When true, 409 with `can_force` throws instead of opening a confirmation dialog (for batched invite UX). */
  deferSharingHierarchyConflictConfirm?: boolean
}

export interface UpdateShareOptions {
  clientService: ClientService
  space: SpaceResource
  resource: Resource
  collaboratorShare: CollaboratorShare
  options: DriveItemInvite
  graphRequestOptions?: GraphRequestOptions
  confirmSharingHierarchyConflict?: ConfirmSharingHierarchyConflict
  informSharingHierarchyConflict?: InformSharingHierarchyConflict
}

export interface DeleteShareOptions {
  clientService: ClientService
  space: SpaceResource
  resource: Resource
  collaboratorShare: CollaboratorShare
  graphRequestOptions?: GraphRequestOptions
  confirmSharingHierarchyConflict?: ConfirmSharingHierarchyConflict
  informSharingHierarchyConflict?: InformSharingHierarchyConflict
}

export interface AddLinkOptions {
  clientService: ClientService
  space: SpaceResource
  resource: Resource
  options: DriveItemCreateLink
}

export interface UpdateLinkOptions {
  clientService: ClientService
  space: SpaceResource
  resource: Resource
  linkShare: LinkShare
  options: Omit<DriveItemCreateLink, '@libre.graph.quickLink'>
}

export interface DeleteLinkOptions {
  clientService: ClientService
  space: SpaceResource
  resource: Resource
  linkShare: LinkShare
}
