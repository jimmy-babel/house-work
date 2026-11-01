import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import postcss from 'postcss'

function desktopFontScalePlugin() {
  return {
    postcssPlugin: 'desktop-font-scale',
    Once(root) {
      const platform = process.env.UNI_PLATFORM || 'h5'
      if (platform !== 'h5') return

      const desktopMedia = postcss.atRule({
        name: 'media',
        params: 'screen and (min-width: 900px)',
      })

      const originalRules = []
      root.walkRules((rule) => originalRules.push(rule))

      originalRules.forEach((rule) => {
        let parent = rule.parent
        let insideKeyframes = false
        while (parent && parent.type !== 'root') {
          if (parent.type === 'atrule' && /keyframes$/i.test(parent.name)) {
            insideKeyframes = true
            break
          }
          parent = parent.parent
        }
        if (insideKeyframes) return

        const fontSizeDeclarations = rule.nodes.filter(
          (node) => node.type === 'decl' && node.prop.toLowerCase() === 'font-size'
        )
        if (!fontSizeDeclarations.length) return

        const scaledRule = rule.clone({ nodes: [] })
        fontSizeDeclarations.forEach((declaration) => {
          const value = declaration.value.trim()
          if (!/^(?:calc|min|max|clamp|var)\(/i.test(value) &&
            !/^[+-]?(?:\d*\.)?\d+(?:rpx|px|rem|em|vw|vh|%)$/i.test(value)) {
          return
          }

          scaledRule.append(declaration.clone({
            value: `calc(${value} * 1.2)`,
            important: true,
          }))
        })
        if (!scaledRule.nodes.length) return

        let scaledNode = scaledRule
        parent = rule.parent
        while (parent && parent.type !== 'root') {
          if (parent.type === 'atrule') {
            const wrapper = postcss.atRule({ name: parent.name, params: parent.params })
            wrapper.append(scaledNode)
            scaledNode = wrapper
          }
          parent = parent.parent
        }
        desktopMedia.append(scaledNode)
      })

      if (desktopMedia.nodes?.length) root.append(desktopMedia)
    },
  }
}

function normalizeBase(base) {
  if (!base) return '/'

  let normalized = base.trim()
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`
  }
  if (!normalized.endsWith('/')) {
    normalized = `${normalized}/`
  }
  return normalized
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const h5Base = normalizeBase(env.VITE_H5_BASE || '/')

  return {
    base: h5Base,
    plugins: [uni()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    css: {
      postcss: {
        plugins: [desktopFontScalePlugin()],
      },
      preprocessorOptions: {
        scss: {
          silenceDeprecations: ['legacy-js-api', 'color-functions', 'import'],
        },
      },
    },
    server: {
      port: 5173,
    },
  }
})
