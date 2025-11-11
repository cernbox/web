<template>
  <div class="sciencemesh-app">
    <div>
      <div class="oc-flex oc-flex-middle oc-px-m oc-pt-s">
        <oc-icon name="user-shared" />
        <h2 class="oc-px-s" v-text="$gettext('Invite users')"></h2>
        <oc-contextual-helper class="oc-pl-xs" v-bind="helperContent" />
      </div>
      <div class="oc-flex oc-flex-middle oc-flex-center oc-p-m">
        <oc-button
          :aria-label="
            $gettext('Generate invitation link that can be shared with one or more invitees')
          "
          @click="openInviteModal"
        >
          <oc-icon name="add" />
          <span v-text="$gettext('Generate invitation')" />
        </oc-button>
      </div>
      <oc-modal
        v-if="showInviteModal"
        :title="$gettext('Generate new invitation')"
        :button-cancel-text="$gettext('Cancel')"
        :button-confirm-text="$gettext('Generate')"
        :button-confirm-disabled="!!descriptionErrorMessage"
        focus-trap-initial="#invite_token_description"
        @cancel="resetGenerateInviteToken"
        @confirm="generateToken"
      >
        <template #content>
          <form autocomplete="off" @submit.prevent="generateToken">
            <oc-text-input
              id="invite_token_description"
              v-model="formInput.description"
              class="oc-mb-s"
              :error-message="descriptionErrorMessage"
              :label="$gettext('Add a description (optional)')"
              :clear-button-enabled="true"
              :description-message="
                !descriptionErrorMessage && `${formInput.description?.length || 0}/${50}`
              "
            />
            <input type="submit" class="oc-hidden" />
          </form>
        </template>
      </oc-modal>
      <app-loading-spinner v-if="loading" />
      <template v-else>
        <no-content-message
          v-if="!sortedTokens.length"
          id="invite-tokens-empty"
          class="files-empty"
          icon="user-shared"
        >
          <template #message>
            <span v-text="$gettext('You have no invitation links')" />
          </template>
        </no-content-message>
        <oc-table v-else :fields="fields" :data="sortedTokens" :highlighted="lastCreatedToken">
          <template #token="rowData">
            <div class="invite-code-wrapper oc-flex oc-flex-middle">
              <div class="oc-text-truncate oc-flex-1">
                <span class="oc-text-truncate">{{
                  rowData.item.tokenAtProvider || encodeInviteToken(rowData.item.token)
                }}</span>
              </div>
              <oc-button
                v-oc-tooltip="$gettext('Copy plain token (token@provider)')"
                :aria-label="$gettext('Copy plain token')"
                appearance="raw"
                class="oc-ml-xs"
                @click="copyPlainToken(rowData)"
              >
                <oc-icon name="file-copy" />
              </oc-button>
              <oc-button
                v-oc-tooltip="$gettext('Copy base64 token')"
                :aria-label="$gettext('Copy base64 token')"
                appearance="raw"
                class="oc-ml-xs"
                @click="copyBase64Token(rowData)"
              >
                <oc-icon name="code" />
              </oc-button>
              <oc-button
                v-if="rowData.item.wayfLink"
                v-oc-tooltip="$gettext('Copy WAYF link')"
                :aria-label="$gettext('Copy WAYF link')"
                appearance="raw"
                class="oc-ml-xs"
                @click="copyWayfLink(rowData)"
              >
                <oc-icon name="link" />
              </oc-button>
            </div>
          </template>
          <template #link="rowData">
            <a v-if="rowData.item.link" :href="rowData.item.link" v-text="$gettext('Link')" />
            <oc-button
              v-if="rowData.item.link"
              v-oc-tooltip="$gettext('Copy invitation link')"
              :aria-label="$gettext('Copy invitation link')"
              appearance="raw"
              @click="copyLink(rowData)"
            >
              <oc-icon name="file-copy" />
            </oc-button>
          </template>
          <template #expiration="rowData">
            <span
              v-oc-tooltip="formatDate(rowData.item.expiration)"
              tabindex="0"
              v-text="formatDateRelative(rowData.item.expiration)"
            />
          </template>
        </oc-table>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref, unref } from 'vue'
import {
  NoContentMessage,
  AppLoadingSpinner,
  useClientService,
  useMessages,
  formatDateFromJSDate,
  formatRelativeDateFromJSDate,
  useConfigStore
} from '@ownclouders/web-pkg'
import { useGettext } from 'vue3-gettext'
import { inviteListSchema, inviteSchema } from '../schemas'

type Token = {
  id: string
  token: string
  link?: string
  tokenAtProvider?: string
  wayfLink?: string
  expiration?: Date
  expirationSeconds?: number
  description?: string
}

export default defineComponent({
  components: {
    NoContentMessage,
    AppLoadingSpinner
  },
  setup() {
    const { showMessage, showErrorMessage } = useMessages()
    const clientService = useClientService()
    const configStore = useConfigStore()
    const { $gettext, current: currentLanguage } = useGettext()

    const lastCreatedToken = ref('')
    const showInviteModal = ref(false)
    const formInput = ref({
      description: ''
    })
    const tokens = ref<Token[]>([])
    const loading = ref(true)
    const descriptionErrorMessage = ref<string>()
    const fields = computed(() => {
      const haveLinks = unref(sortedTokens)[0]?.link

      return [
        haveLinks && {
          name: 'link',
          title: $gettext('Invitation link'),
          alignH: 'left',
          type: 'slot'
        },
        {
          name: 'token',
          title: $gettext('Invite token'),
          alignH: haveLinks ? 'right' : 'left',
          type: 'slot'
        },
        {
          name: 'description',
          title: $gettext('Description'),
          alignH: 'right'
        },
        {
          name: 'expiration',
          title: $gettext('Expires'),
          alignH: 'right',
          type: 'slot'
        }
      ].filter(Boolean)
    })
    const sortedTokens = computed(() => {
      return [...unref(tokens)].sort((a, b) => (a.expirationSeconds < b.expirationSeconds ? 1 : -1))
    })
    const helperContent = computed(() => {
      return {
        text: $gettext(
          'Create an invitation link and send it to the person you want to share with.'
        ),
        title: $gettext('Invitation link')
      }
    })

    const encodeInviteToken = (token: string) => {
      const url = new URL(configStore.serverUrl)
      return btoa(`${token}@${url.host}`)
    }

    const getTokenAtProvider = (token: string) => {
      const url = new URL(configStore.serverUrl)
      return `${token}@${url.host}`
    }

    const generateWayfLink = (token: string) => {
      const url = new URL(configStore.serverUrl)
      return `${url.origin}/open-cloud-mesh/wayf?token=${token}`
    }

    const generateToken = async () => {
      const { description } = unref(formInput)

      if (unref(descriptionErrorMessage)) {
        return
      }
      try {
        const { data: tokenInfo } = await clientService.httpAuthenticated.post(
          '/sciencemesh/generate-invite',
          {
            ...(description && { description })
          },
          {
            schema: inviteSchema
          }
        )

        if (tokenInfo.token) {
          tokens.value.push({
            id: tokenInfo.token,
            link: tokenInfo.invite_link,
            token: tokenInfo.token,
            tokenAtProvider: getTokenAtProvider(tokenInfo.token),
            wayfLink: generateWayfLink(tokenInfo.token),
            ...(tokenInfo.expiration && {
              expiration: toDateTime(tokenInfo.expiration)
            }),
            ...(tokenInfo.expiration && {
              expirationSeconds: tokenInfo.expiration
            }),
            ...(tokenInfo.description && { description: tokenInfo.description })
          })
          showMessage({
            title: $gettext('Success'),
            status: 'success',
            desc: $gettext(
              'New token has been created and copied to your clipboard. Send it to the invitee(s).'
            )
          })

          const quickToken = getTokenAtProvider(tokenInfo.token)
          lastCreatedToken.value = quickToken
          navigator.clipboard.writeText(quickToken)
        }
      } catch (error) {
        lastCreatedToken.value = ''
        errorPopup(error)
      } finally {
        resetGenerateInviteToken()
      }
    }

    const listTokens = async () => {
      const url = '/sciencemesh/list-invite'
      try {
        const { data } = await clientService.httpAuthenticated.get(url, {
          schema: inviteListSchema
        })
        data.forEach((t) => {
          tokens.value.push({
            id: t.token,
            token: t.token,
            tokenAtProvider: getTokenAtProvider(t.token),
            wayfLink: generateWayfLink(t.token),
            ...(t.expiration && {
              expiration: toDateTime(t.expiration)
            }),
            ...(t.expiration && {
              expirationSeconds: t.expiration
            }),
            ...(t.description && { description: t.description })
          })
        })
      } catch (error) {
        console.log(error)
      } finally {
        loading.value = false
      }
    }

    const copyLink = (rowData: { item: { link: string; token: string } }) => {
      navigator.clipboard.writeText(rowData.item.link)
      showMessage({
        title: $gettext('Invitation link copied'),
        desc: $gettext('Invitation link has been copied to your clipboard.')
      })
    }

    const copyPlainToken = (rowData: { item: Token }) => {
      const plainToken = rowData.item.tokenAtProvider || getTokenAtProvider(rowData.item.token)
      navigator.clipboard.writeText(plainToken)
      showMessage({
        title: $gettext('Plain token copied'),
        desc: $gettext('Plain token has been copied to your clipboard.')
      })
    }

    const copyBase64Token = (rowData: { item: Token }) => {
      const base64Token = encodeInviteToken(rowData.item.token)
      navigator.clipboard.writeText(base64Token)
      showMessage({
        title: $gettext('Base64 token copied'),
        desc: $gettext('Base64 token has been copied to your clipboard.')
      })
    }

    const copyWayfLink = (rowData: { item: Token }) => {
      const wayfLink = rowData.item.wayfLink || generateWayfLink(rowData.item.token)
      navigator.clipboard.writeText(wayfLink)
      showMessage({
        title: $gettext('WAYF link copied'),
        desc: $gettext('WAYF link has been copied to your clipboard.')
      })
    }
    const errorPopup = (error: Error) => {
      console.error(error)
      showErrorMessage({
        title: $gettext('Error'),
        desc: $gettext('An error occurred when generating the token'),
        errors: [error]
      })
    }

    const openInviteModal = () => {
      showInviteModal.value = true
    }

    const resetGenerateInviteToken = () => {
      showInviteModal.value = false
      formInput.value = {
        description: ''
      }
    }

    const toDateTime = (secs: number) => {
      const d = new Date(Date.UTC(1970, 0, 1))
      d.setUTCSeconds(secs)
      return d
    }

    onMounted(() => {
      listTokens()
    })

    const formatDate = (date: Date) => {
      return formatDateFromJSDate(date, currentLanguage)
    }
    const formatDateRelative = (date: Date) => {
      return formatRelativeDateFromJSDate(date, currentLanguage)
    }

    return {
      helperContent,
      openInviteModal,
      showInviteModal,
      descriptionErrorMessage,
      resetGenerateInviteToken,
      generateToken,
      formInput,
      loading,
      sortedTokens,
      copyPlainToken,
      copyBase64Token,
      copyWayfLink,
      copyLink,
      lastCreatedToken,
      fields,
      formatDate,
      formatDateRelative,
      encodeInviteToken
    }
  }
})
</script>

<style lang="scss">
.sciencemesh-app {
  .invite-code-wrapper {
    min-width: 300px;
    max-width: 100%;
  }

  #invite-tokens-empty {
    height: 100%;
  }
}
</style>
