<template>
  <div id="tour">
    <oc-button
      id="_toursButton"
      ref="toursButton"
      v-oc-tooltip="'See new features'"
      size="small"
      @click.stop="startTourNewFeatures()"
    >
      <oc-icon name="map" />
      <translate>What's new?</translate>
    </oc-button>

    <!-- <oc-drop
      ref="menu"
      drop-id="tours"
      toggle="#_toursButton"
      mode="click"
      close-on-click
      padding-size="small"
    >
      <oc-list class="user-menu-list">
        <li @click.stop="startTourPersonal()">
          <oc-button appearance="raw">
            <span class="profile-info-wrapper" :class="'oc-py-xs'">
              How to use CERNBox
            </span></oc-button
          >
        </li>
        <li @click.stop="startTourSharedWithMe()">
          <oc-button appearance="raw">
            <span class="profile-info-wrapper" :class="'oc-py-xs'"> File actions </span></oc-button
          >
        </li>
        <li @click.stop="startTourSharedWithOthers()">
          <oc-button appearance="raw">
            <span class="profile-info-wrapper" :class="'oc-py-xs'">
              Advanced sharing
            </span></oc-button
          >
        </li>
        <li @click.stop="startTourSharedViaLink()">
          <oc-button appearance="raw">
            <span class="profile-info-wrapper" :class="'oc-py-xs'"> Projects </span></oc-button
          >
        </li>
      </oc-list>
    </oc-drop> -->
  </div>
</template>

<script>
import { mapGetters, mapState } from 'vuex'
import Shepherd from 'shepherd.js'

export default {
  props: {
    resources: {
      type: Array,
      required: true
    },
    route: {
      type: String,
      required: true
    }
  },

  data() {
    return {
      tourNewFeatures: [],
      tourPersonal: [],
      tourSharedWithMe: [],
      tourSharedWithOthers: [],
      tourSharedViaLink: [],
      tourProjects: [],
      tourDeletedFiles: [],
      tourActions: []
    }
  },
  computed: {
    ...mapState(['user']),
    ...mapState('Files', ['files']),
    ...mapGetters('Files', [
      'highlightedFile',
      'selectedFiles',
      'currentFolder',
      'totalFilesCount',
      'totalFilesSize'
    ])
  },
  mounted() {
    setTimeout(() => {
      if (
        this.$route.name !== 'files-operations-resolver-public-link' &&
        this.$route.name !== 'files-public-files' &&
        !localStorage.getItem('web-version')
      ) {
        localStorage.setItem('web-version', Date.now())
        this.startTourNewFeatures()
      }
    }, 3000)
  },
  methods: {
    startTourPersonal() {
      this.createTourPersonal()
      this.tourPersonal.start()
      const shepherdButtons = document.getElementsByClassName('shepherd-button')
      Array.prototype.forEach.call(shepherdButtons, function (button, index) {
        button.classList.remove('shepherd-button')
      })
    },
    startTourSharedWithMe() {
      this.createTourSharedWithMe()
      this.tourSharedWithMe.start()
    },
    startTourSharedWithOthers() {
      this.createTourSharedWithOthers()
      this.tourSharedWithOthers.start()
    },
    startTourSharedViaLink() {
      this.createTourSharedViaLink()
      this.tourSharedViaLink.start()
    },
    startTourProjects() {
      this.createTourProjects()
      this.tourProjects.start()
    },
    startTourDeletedFiles() {
      this.createTourDeletedFiles()
      this.tourDeletedFiles.start()
    },

    startTourNewFeatures() {
      this.createTourNewFeatures()
      this.tourNewFeatures.start()
    },

    createTourNewFeatures() {
      this.tourNewFeatures = new Shepherd.Tour({
        useModalOverlay: true,
        defaultStepOptions: {
          cancelIcon: {
            enabled: true
          },
          classes: 'new-features',
          scrollTo: { behavior: 'smooth', block: 'center' }
        }
      })

      // introduction
      this.tourNewFeatures.addStep({
        title: 'Welcome the new CERNBox!',
        text: `Discover the new features and try them yourself`,
        buttons: [
          {
            action() {
              return this.next()
            },
            classes: 'oc-button oc-button-m oc-button-primary',
            text: 'Next'
          }
        ],
        id: 'tourstep0'
      })

      // Feature 1
      this.tourNewFeatures.addStep({
        title: '1.  Universal URLs',
        text: `<div><p>CERNBox, which uses the EOS storage system under the hood, now exposes its full namespace. This means most of our access methods (excluding the mobile clients) have a consistent and more intuitive view.
        </p><p><span class="guide-highlight">https://new.cernbox.cern.ch/files/spaces/personal/home<b>/eos/user/&lt;letter&gt;/&lt;username&gt;</b></span></p>
        <p>Now it's possible to just copy your URL and share it directly with someone else. If that person has permissions, he/she will be able to open it.
        </p></div>`,
        buttons: [
          {
            action() {
              return window
                .open('https://new-cernbox-guide.docs.cern.ch/access/#universal-urls', '_blank')
                .focus()
            },
            classes: 'oc-button oc-button-m oc-button-passive',
            text: 'Learn more',
            secondary: true
          },
          {
            action() {
              return this.back()
            },
            classes: 'oc-button oc-button-m oc-button-passive',
            text: 'Back',
            secondary: true
          },
          {
            action() {
              return this.next()
            },
            classes: 'oc-button oc-button-m oc-button-primary',
            text: 'Next'
          }
        ],
        id: 'tourstep1'
      })

      // Feature 2
      this.tourNewFeatures.addStep({
        title: '2.  Single File Sharing',
        text: `<div><p>Now, it's possible to share not only folders but also single files in both read and write modes!
        </p><img class="guide-img" src="https://new-cernbox-guide.docs.cern.ch/assets/screenshots/sharing.png"></img></div>`,
        buttons: [
          {
            action() {
              return window
                .open('https://new-cernbox-guide.docs.cern.ch/sharing/#internal-shares', '_blank')
                .focus()
            },
            classes: 'oc-button oc-button-m oc-button-passive',
            text: 'Learn more',
            secondary: true
          },
          {
            action() {
              return this.back()
            },
            classes: 'oc-button oc-button-m oc-button-passive',
            text: 'Back',
            secondary: true
          },
          {
            action() {
              return this.next()
            },
            classes: 'oc-button oc-button-m oc-button-primary',
            text: 'Next'
          }
        ],
        id: 'tourstep2'
      })

      // Feature 3
      this.tourNewFeatures.addStep({
        title: '3. Improved App Ecosystem',
        text: `<div><p>The new CERNBox has diverse application/file extensions integrations: Microsoft Office 365, Collabora, CodiMD, Draw.io, text editor, PDF viewer, IFC viewer, Jupyter viewer, Root viewer, SWAN, Media viewer.
        </p><img class="guide-img" src="https://new-cernbox-guide.docs.cern.ch/assets/screenshots/apps-context.png"></img></div>`,
        buttons: [
          {
            action() {
              return window.open('https://new-cernbox-guide.docs.cern.ch/apps/', '_blank').focus()
            },
            classes: 'oc-button oc-button-m oc-button-passive',
            text: 'Learn more',
            secondary: true
          },
          {
            action() {
              return this.back()
            },
            classes: 'oc-button oc-button-m oc-button-passive',
            text: 'Back',
            secondary: true
          },
          {
            action() {
              return this.next()
            },
            classes: 'oc-button oc-button-m oc-button-primary',
            text: 'Next'
          }
        ],
        id: 'tourstep3'
      })

      // Feature 4
      this.tourNewFeatures.addStep({
        title: '4. Improved Projects Integration',
        text: `<div><p>Now it's also possible to see and recover files of projects by right clicking on a project and then on "Open trahsbin"
        </p><img class="guide-img" src="https://new-cernbox-guide.docs.cern.ch/assets/screenshots/projects-trashbin.png"></img></div>`,
        buttons: [
          {
            action() {
              return window
                .open('https://new-cernbox-guide.docs.cern.ch/projects/', '_blank')
                .focus()
            },
            classes: 'oc-button oc-button-m oc-button-passive',
            text: 'Learn more',
            secondary: true
          },
          {
            action() {
              return this.back()
            },
            classes: 'oc-button oc-button-m oc-button-passive',
            text: 'Back',
            secondary: true
          },
          {
            action() {
              return this.next()
            },
            classes: 'oc-button oc-button-m oc-button-primary',
            text: 'Next'
          }
        ],
        id: 'tourstep4'
      })

      // Feature 5
      this.tourNewFeatures.addStep({
        title: '5. Lightweight accounts',
        text: `<div><p>The new CERNBox uses the new CERN SSO and it now allows signing in with other accounts, like social or lightweight.
        </p><p>Unlike the normal CERN accounts, these do not have storage associated with them. They can, however, collaborate on shared resources or on Projects.</p><img class="guide-img" src="https://new-cernbox-guide.docs.cern.ch/assets/screenshots/lightweight.png"></img></div>`,
        buttons: [
          {
            action() {
              return window
                .open('https://new-cernbox-guide.docs.cern.ch/access/#accounts-supported', '_blank')
                .focus()
            },
            classes: 'oc-button oc-button-m oc-button-passive',
            text: 'Learn more',
            secondary: true
          },
          {
            action() {
              return this.back()
            },
            classes: 'oc-button oc-button-m oc-button-passive',
            text: 'Back',
            secondary: true
          },
          {
            action() {
              return this.next()
            },
            classes: 'oc-button oc-button-m oc-button-primary',
            text: 'Next'
          }
        ],
        id: 'tourstep5'
      })

      // More features
      this.tourNewFeatures.addStep({
        title: 'Coming soon',
        text: `<div><p>Other features will be coming in the coming months:</p>
        <oc-list><li>Integrations with other services (i.e Indico)</li>
        <li>Improved search</li>
        <li>Auditing and reporting/notifications</li>
        <li>Backup restore UI</li></oc-list>
        <p> Stay tuned!</p></div>`,
        buttons: [
          {
            action() {
              return this.back()
            },
            classes: 'oc-button oc-button-m oc-button-passive',
            text: 'Back',
            secondary: true
          },
          {
            action() {
              return this.next()
            },
            classes: 'oc-button oc-button-m oc-button-primary',
            text: 'End'
          }
        ],
        id: 'tourstep6'
      })
    },

    // create tours
    createTourPersonal() {
      const ref = this
      this.tourPersonal = new Shepherd.Tour({
        useModalOverlay: true,
        defaultStepOptions: {
          cancelIcon: {
            enabled: true
          },
          classes: 'class-1 class-2',
          scrollTo: { behavior: 'smooth', block: 'center' }
        }
      })

      // introduction
      this.tourPersonal.addStep({
        text: `Welcome CERNBox guide`,
        buttons: [
          {
            action() {
              return this.next()
            },
            text: 'Next'
          }
        ],
        id: 'tourstep0'
      })

      // New button
      this.tourPersonal.addStep({
        title: 'Upload or create new files and folders',
        text: `Click on "New" button and select one of options to upload or create file or folder`,
        attachTo: {
          element: '#new-file-menu-btn',
          on: 'bottom'
        },
        buttons: [
          {
            action() {
              return this.back()
            },
            classes: 'shepherd-button-secondary',
            text: 'Back'
          },
          {
            action() {
              return this.next()
            },
            text: 'Next'
          }
        ],
        id: 'tourstep2'
      })

      // Open files and folders
      this.tourPersonal.addStep({
        title: 'Files and folders',
        text: `<div><p>See uploaded files and folders and open them by clicking on their names</p><img class="guide-img" src="https://github.com/elizavetaRa/cernbox-guide-images/blob/master/Personal/Open%20files.gif?raw=true"></img></div>`,
        attachTo: {
          element: '#files-view tbody'
        },
        buttons: [
          {
            action() {
              return this.back()
            },
            classes: 'shepherd-button-secondary',
            text: 'Back'
          },
          {
            action() {
              return this.next()
            },
            text: 'Next'
          }
        ],
        id: 'tourstep2'
      })

      // File actions
      /* this.tourPersonal.addStep({
        title: 'File actions',
        text: `<div><p>Call actions context menu with right click on file or button in actions column.</p><img class="guide-img" src="https://github.com/elizavetaRa/cernbox-guide-images/blob/master/Personal/file_actions.gif?raw=true"></img></div>`,
        attachTo: {
          element: '#files-view tbody',
          on: 'auto-start'
        },
        buttons: [
          {
            action() {
              return this.back()
            },
            classes: 'shepherd-button-secondary',
            text: 'Back'
          },
          {
            action() {
              this.createTourActions()
              return this.next()
            },
            classes: 'shepherd-button-secondary',
            text: 'More about file actions'
          },
          {
            action() {
              return this.next()
            },
            text: 'Next'
          }
        ],
        id: 'tourstep2'
      }) */

      // File details
      this.tourPersonal.addStep({
        title: 'File details',
        text: `<div><p>Watch file details by clickging on "Datails" in context menu.</p><img class="guide-img" src="https://github.com/elizavetaRa/cernbox-guide-images/blob/master/Personal/File_details.gif?raw=true"></img></div>`,
        attachTo: {
          element: '#files-view tbody',
          on: 'bottom'
        },
        buttons: [
          {
            action() {
              return this.back()
            },
            classes: 'shepherd-button-secondary',
            text: 'Back'
          },
          {
            action() {
              return this.next()
            },
            text: 'Next'
          }
        ],
        id: 'details'
      })

      // Share files
      /* this.tourPersonal.addStep({
        title: 'Share files and folders',
        text: `<div><p>Share files and folders by clicking on "Share" button and adding people or e-groups in the sidebar</p><img class="guide-img" src="https://github.com/elizavetaRa/cernbox-guide-images/blob/master/Personal/share_with.gif?raw=true"></img></div>`,
        attachTo: {
          element: '#files-view tbody',
          on: 'bottom'
        },
        buttons: [
          {
            action() {
              return this.back()
            },
            classes: 'shepherd-button-secondary',
            text: 'Back'
          },
          {
            action() {
              return this.back()
            },
            classes: 'shepherd-button-secondary',
            text: 'More about sharing'
          },
          {
            action() {
              return this.next()
            },
            text: 'Next'
          }
        ],
        id: 'tourstep2'
      }) */

      // Share via link
      /*    if (this.resources.length > 0) {
        this.tourPersonal.addStep({
          title: 'Share via public links',
          text: `<div><p>Share files and folders by clicking on "Link" button. You can set expiration date and password.</p><img class="guide-img" src="https://github.com/elizavetaRa/cernbox-guide-images/blob/master/Personal/links.gif?raw=true"></img></div>`,
          attachTo: {
            element: '#files-view tbody',
            on: 'bottom'
          },
          buttons: [
            {
              action() {
                return this.back()
              },
              classes: 'shepherd-button-secondary',
              text: 'Back'
            },
            {
              action() {
                return this.back()
              },
              classes: 'shepherd-button-secondary',
              text: 'More about links'
            },
            {
              action() {
                console.log('route', ref.$router)
                ref.$router.push({ name: 'files-shares-with-me' })
                return this.next()
              },
              text: 'Next'
            }
          ],
          id: 'tourstep2'
        })
      } */

      // Examine shared with me files
      if (this.resources.length > 0) {
        this.tourPersonal.addStep({
          title: 'Shared with me',
          text: `<div><p>Examine shared with me files in section "Shared with me"</p><img class="guide-img" src="https://github.com/elizavetaRa/cernbox-guide-images/blob/master/Personal/shared_with.gif?raw=true"></img></div>`,
          attachTo: {
            element: '#files-view tbody',
            on: 'bottom'
          },
          buttons: [
            {
              action() {
                return this.back()
              },
              classes: 'shepherd-button-secondary',
              text: 'Back'
            },
            {
              action() {
                return this.next()
              },
              text: 'Next'
            }
          ],
          id: 'tourstep2'
        })
      }

      this.tourPersonal.addStep({
        title: 'The end',
        text: `We hope, you enjoyed. Any questions left? Ask us here ...`,
        buttons: [
          {
            action() {
              return this.back()
            },
            classes: 'shepherd-button-secondary',
            text: 'Back'
          }
        ],
        id: 'tourstep4'
      })
    },
    createTourSharedWithMe() {},
    createTourSharedWithOthers() {},
    createTourSharedViaLink() {},
    createTourProjects() {},
    createTourDeletedFiles() {},
    createTourActions() {
      console.log('add additional')

      this.tourPersonal.addStep(
        {
          title: 'File actions: delete',
          text: `Exmple step`,
          attachTo: {
            element: '#files-view tbody',
            on: 'bottom'
          },
          buttons: [
            {
              action() {
                return this.back()
              },
              classes: 'shepherd-button-secondary',
              text: 'Back'
            },
            {
              action() {
                return this.next()
              },
              text: 'Next'
            }
          ],
          id: 'tourstep2'
        },
        4
      )
    }
  }
}
</script>
<style src="shepherd.js/dist/css/shepherd.css"></style>

<style lang="scss">
.guide-highlight {
  background-color: var(--oc-color-background-highlight);
}

#tour {
  height: 100%;
  width: 100%;
}
.guide-img {
  width: 100%;
}
.shepherd-element {
  max-width: 700px !important;
}

.shepherd-header {
  align-items: center !important;
  background-color: var(--oc-color-swatch-brand-default) !important;
  border: 1px solid var(--oc-color-swatch-brand-default) !important;
  border: 0 !important;
  box-shadow: 5px 0 25px rgb(0 0 0 / 30%) !important;
  display: flex !important;
  flex-flow: row wrap !important;
  padding: var(--oc-space-small) var(--oc-space-medium) !important;
  h3 {
    color: var(--oc-color-swatch-inverse-default) !important;
    font-size: 1rem !important;
    font-weight: 700 !important;
    margin: 0 !important;
  }
}
.shepherd-text {
  border-top: 1px solid var(--oc-color-swatch-brand-default) !important;
}
.shepherd-element {
  border-radius: 15px !important;
  background-color: var(--oc-color-background-default) !important;
}

.shepherd-text,
.shepherd-footer {
  background-color: var(--oc-color-background-default) !important;
  border: 0 !important;
  //box-shadow: 5px 0 25px rgb(0 0 0 / 30%) !important;
  color: var(--oc-color-text-default) !important;
  padding: var(--oc-space-medium) !important;
}
.shepherd-footer {
  border: 0 !important;
}
.shepherd-button {
  background-color: var(--oc-color-swatch-primary-default) !important;
  border-color: var(--oc-color-swatch-primary-default) !important;
}
.shepherd-button-secondary {
  background-color: initial !important;
  color: var(--oc-color-swatch-passive-default) !important;
  border: 1px solid transparent !important;
  border-color: var(--oc-color-swatch-passive-default) !important;
}
</style>
