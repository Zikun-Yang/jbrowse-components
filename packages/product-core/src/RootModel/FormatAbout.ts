import { ConfigurationSchema } from '@jbrowse/core/configuration'
/**
 * #config FormatAbout
 * generally exists on the config.json or root config as configuration.formatAbout
 */
export function FormatAboutConfigSchemaFactory() {
  return ConfigurationSchema('FormatAbout', {
    /**
     * #slot configuration.formatAbout.config
     */
    config: {
      type: 'frozen',
      description: 'formats configuration object in about dialog',
      defaultValue: {},
      contextVariable: ['config'],
    },
    /**
     * #slot configuration.formatAbout.hideUris
     */

    hideUris: {
      type: 'boolean',
      defaultValue: false,
    },

    /**
     * #slot configuration.formatAbout.info
     * markdown template shown at the top of the "About this track" dialog.
     * Tracks that set their own `formatAbout.info` win, this is the site-wide
     * default used by all tracks that do not. Supports `{{path}}`
     * interpolation and `jexl:` prefixed expressions.
     */
    info: {
      type: 'text',
      description:
        'site-wide default markdown template shown in the "About this track" dialog, supports {{path}} interpolation. If the value starts with "jexl:" it is evaluated as an expression',
      defaultValue: '',
      contextVariable: ['track', 'config', 'session', 'assembly'],
    },

    /**
     * #slot configuration.formatAbout.showInfo
     */
    showInfo: {
      type: 'boolean',
      description:
        'set to false to hide the track info section of the "About this track" dialog for every track',
      defaultValue: true,
    },
  })
}
