import { PluginOption, defineConfig, searchForWorkspaceRoot } from 'vite'
import _defineConfig, { historyModePlugins } from './vite.config'
import { join } from 'path'

/**
 * NOTE: This is a special config file for CERN. It overwrites some of the code paths to implement custom logic
 * that only applies to CERN. It can and should be ignored in all other cases!
 *
 * Web can be run using this config via `pnpm build:w -c vite.cern.config.ts` or `pnpm vite -c vite.cern.config.ts`.
 */

const projectRootDir = searchForWorkspaceRoot(process.cwd())

const stockCreateSpace = join(
  projectRootDir,
  'packages/web-pkg/src/components/AppBar/CreateSpace.vue'
)
const cernCreateSpace = join(projectRootDir, 'packages/web-pkg/src/cern/components/CreateSpace.vue')

export default defineConfig(async (args) => {
  let config
  if (typeof _defineConfig === 'function') {
    config = await _defineConfig(args)
  } else {
    config = _defineConfig
  }

  config.server = {
    port: 9201,
    strictPort: true
  }

  // create space component. Matched on the resolved file rather than through resolve.alias,
  // because the component is imported through the @ownclouders/web-pkg barrel and therefore
  // has no import specifier that is stable enough to alias against.
  config.plugins.push({
    name: 'cern:create-space',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer) {
        return null
      }
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      return resolved?.id.split('?')[0] === stockCreateSpace ? cernCreateSpace : null
    }
  } as PluginOption)

  config.plugins.push(historyModePlugins()[0] as PluginOption)

  return config
})
