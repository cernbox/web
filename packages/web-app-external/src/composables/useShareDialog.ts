import { unref } from 'vue'
import { Resource, ShareResource, SpaceResource } from '@ownclouders/web-client'
import { useCanShare, useFileActionsShowShares } from '@ownclouders/web-pkg'

/**
 * Shared, app-agnostic "open the share dialog" behavior - implemented once here,
 * reused by every per-app postMessage handler that receives a "share button clicked"
 * message (e.g. EuroOffice's/MS365's UI_Sharing).
 */
export function useShareDialog() {
  const { canShare } = useCanShare()
  const { actions: shareActions } = useFileActionsShowShares()

  const openShareDialog = (space: SpaceResource, resource: Resource): void => {
    if (!canShare({ space, resource })) {
      return
    }
    // useFileActionsShowShares's action only reads resource.id, but is typed against
    // ShareResource; a plain Resource is safe here at runtime.
    unref(shareActions)[0].handler({ space, resources: [resource as ShareResource] })
  }

  return { openShareDialog }
}
