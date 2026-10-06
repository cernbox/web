import { ref, unref } from 'vue'
import { useClientService, useMessages, useRouter, useRoute } from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'

export const useInvitationAcceptance = () => {
  const { showErrorMessage } = useMessages()
  const clientService = useClientService()
  const router = useRouter()
  const route = useRoute()
  const { $gettext } = useGettext()

  const isAccepting = ref(false)

  const errorPopup = (error: Error) => {
    console.error(error)
    showErrorMessage({
      title: $gettext('Error'),
      desc: $gettext('An error occurred'),
      errors: [error]
    })
  }

  const validateParameters = (token: string, providerDomain: string) => {
    if (!token || !providerDomain) {
      const error = new Error($gettext('Missing required parameters: token and providerDomain'))
      errorPopup(error)
      return false
    }
    return true
  }

  const acceptInvitation = async (token: string, providerDomain: string): Promise<boolean> => {
    if (!validateParameters(token, providerDomain)) {
      return false
    }

    isAccepting.value = true

    try {
      await clientService.httpAuthenticated.post('/sciencemesh/accept-invite', {
        token,
        providerDomain
      })

      // Remove query params
      const { token: currentToken, providerDomain: currentProvider, ...query } = unref(route).query
      await router.replace({
        name: 'open-cloud-mesh-invitations',
        query
      })

      return true
    } catch (error) {
      errorPopup(error)
      return false
    } finally {
      isAccepting.value = false
    }
  }

  return {
    isAccepting,
    acceptInvitation,
    errorPopup,
    validateParameters
  }
}
