//attempts to add colorFeature function to jbrowse

export default class CustomBedPlugin {
  constructor() {
    this.name = 'CustomBedPlugin'
  }

  install(pluginManager) {}

  configure(pluginManager) {
    pluginManager.jexl.addFunction('colorFeature', feature => {
      if (!feature) return 'gray'

      const score = feature.get('score')
      const itemRgb = feature.get('reserved')
      //console.log(score)
      //console.log(itemRgb)

      if (itemRgb != null) {
        const rgb = String(itemRgb)
          .split(',')
          .map(s => {
            const n = parseInt(s.trim(), 10)
            return isNaN(n) ? 0 : Math.max(0, Math.min(255, n))
          })
        if (rgb.length === 3) {
          if (score != null) {
            const alpha = Math.max(0, Math.min(1, score / 100))
            return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
          } else {
            return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 1)`
          }
        }
      }

      return score > 500 ? 'red' : 'blue'
    })
  }
}
