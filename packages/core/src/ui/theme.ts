import { createTheme } from '@mui/material'
import { blue, green, grey, orange, red } from '@mui/material/colors'
import deepmerge from 'deepmerge'

import type {
  PaletteColor,
  PaletteColorOptions,
  Theme,
  ThemeOptions,
} from '@mui/material/styles'

interface PaletteAugmentColorOptions {
  color: PaletteColorOptions
}

type MaybePaletteColor = PaletteColor | undefined
type Frames = [
  null,
  MaybePaletteColor,
  MaybePaletteColor,
  MaybePaletteColor,
  MaybePaletteColor,
  MaybePaletteColor,
  MaybePaletteColor,
]
declare module '@mui/material/styles' {
  interface Palette {
    tertiary: PaletteColor
    quaternary: PaletteColor
    highlight: PaletteColor
    softTeal: PaletteColor
    stopCodon: string
    startCodon: string
    insertion: string
    softclip: string
    skip: string
    hardclip: string
    deletion: string
    bases: {
      A: PaletteColor
      C: PaletteColor
      G: PaletteColor
      T: PaletteColor
    }
    frames: Frames
    framesCDS: Frames
  }
  interface PaletteOptions {
    tertiary?: PaletteColorOptions
    quaternary?: PaletteColorOptions
    highlight?: PaletteColorOptions
    softTeal?: PaletteColorOptions
    stopCodon?: string
    startCodon?: string
    hardclip?: string
    softclip?: string
    insertion?: string
    skip?: string
    deletion?: string
    bases?: {
      A?: PaletteColorOptions
      C?: PaletteColorOptions
      G?: PaletteColorOptions
      T?: PaletteColorOptions
    }
    framesCDS?: Frames
    frames?: Frames
  }
}

const refTheme = createTheme()
const teal = refTheme.palette.augmentColor({ color: { main: '#0A7A62' } })
const softTeal = refTheme.palette.augmentColor({ color: { main: '#49796B' } })
const charcoal = refTheme.palette.augmentColor({ color: { main: '#1A1A1A' } })
const warmGray = refTheme.palette.augmentColor({ color: { main: '#6B6B6B' } })
const amber = refTheme.palette.augmentColor({ color: { main: '#D4A017' } })
const lightgrey = refTheme.palette.augmentColor({ color: { main: '#aaa' } })
const bases = {
  A: refTheme.palette.augmentColor({ color: green }),
  C: refTheme.palette.augmentColor({ color: blue }),
  G: refTheme.palette.augmentColor({ color: orange }),
  T: refTheme.palette.augmentColor({ color: red }),
}
const framesCDS = [
  null,
  refTheme.palette.augmentColor({ color: { main: '#FF8080' } }),
  refTheme.palette.augmentColor({ color: { main: '#80FF80' } }),
  refTheme.palette.augmentColor({ color: { main: '#8080FF' } }),
  refTheme.palette.augmentColor({ color: { main: '#8080FF' } }),
  refTheme.palette.augmentColor({ color: { main: '#80FF80' } }),
  refTheme.palette.augmentColor({ color: { main: '#FF8080' } }),
] as Frames
const frames = [
  null,
  refTheme.palette.augmentColor({ color: { main: '#8f8f8f' } }),
  refTheme.palette.augmentColor({ color: { main: '#adadad' } }),
  refTheme.palette.augmentColor({ color: { main: '#d8d8d8' } }),
  refTheme.palette.augmentColor({ color: { main: '#d8d8d8' } }),
  refTheme.palette.augmentColor({ color: { main: '#adadad' } }),
  refTheme.palette.augmentColor({ color: { main: '#8f8f8f' } }),
] as Frames
const stopCodon = '#e22'
const startCodon = '#3e3'
const insertion = '#800080'
const deletion = '#808080'
const hardclip = '#f00'
const softclip = '#00f'
const skip = '#97b8c9'

const defaults = {
  primary: teal,
  secondary: charcoal,
  tertiary: warmGray,
  quaternary: amber,
  highlight: amber,
  softTeal,
  stopCodon,
  startCodon,
  insertion,
  deletion,
  softclip,
  hardclip,
  bases,
  frames,
  framesCDS,
  skip,
}

function stockTheme() {
  return {
    palette: {
      ...defaults,
      mode: undefined,
      background: {
        default: '#F7F7F6',
        paper: '#FFFFFF',
      },
      text: {
        primary: '#1A1A1A',
        secondary: '#6B6B6B',
      },
      divider: '#E5E5E5',
    },
    components: {
      MuiLink: {
        styleOverrides: {
          // use primary (teal) for links instead of the old midnight/forest
          root: ({ theme }) => ({
            color: theme.palette.primary.main,
          }),
        },
      },
    },
  } satisfies ThemeOptions
}

function getDefaultTheme() {
  return {
    ...stockTheme(),
    name: 'Default (from config)',
  }
}

function getLightStockTheme() {
  return {
    ...stockTheme(),
    name: 'Light (stock)',
  }
}

function getDarkStockTheme() {
  return {
    name: 'Dark (stock)',
    palette: {
      ...defaults,
      mode: 'dark',
    },
    components: {
      MuiAppBar: {
        defaultProps: {
          enableColorOnDark: true,
        },
        styleOverrides: {
          root: ({ theme }) => theme.palette.primary.main,
        },
      },
    },
  } satisfies ThemeOptions & { name: string }
}

function getDarkMinimalTheme() {
  return {
    name: 'Dark (minimal)',
    palette: {
      ...defaults,
      mode: 'dark' as const,
      primary: { main: grey[700] },
      secondary: { main: grey[800] },
      tertiary: refTheme.palette.augmentColor({ color: { main: grey[900] } }),
    },
  } satisfies ThemeOptions & { name: string }
}

function getMinimalTheme() {
  return {
    name: 'Light (minimal)',
    palette: {
      ...defaults,
      primary: { main: grey[900] },
      secondary: { main: grey[800] },
      tertiary: refTheme.palette.augmentColor({ color: { main: grey[900] } }),
    },
  } satisfies ThemeOptions & { name: string }
}

export const defaultThemes = {
  default: getDefaultTheme(),
  lightStock: getLightStockTheme(),
  lightMinimal: getMinimalTheme(),
  darkMinimal: getDarkMinimalTheme(),
  darkStock: getDarkStockTheme(),
} as ThemeMap

function overwriteArrayMerge(_: unknown, sourceArray: unknown[]) {
  return sourceArray
}

export function createJBrowseBaseTheme(theme?: ThemeOptions): ThemeOptions {
  const themeP: ThemeOptions = {
    palette: theme?.palette,
    typography: {
      fontSize: 12,
    },
    spacing: 4,
    components: {
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            fontSize: 12,
          },
        },
      },
      MuiButton: {
        defaultProps: {
          size: 'small' as const,
        },
        styleOverrides: {
          // the default button, especially when not using variant=contained,
          // uses theme.palette.primary.main for text which is very bad with
          // dark mode+midnight primary
          //
          // keeps text secondary for darkmode, uses
          // a text-like coloring to ensure contrast
          // xref https://stackoverflow.com/a/72546130/2129219
          root: ({ theme }) =>
            theme.palette.mode === 'dark'
              ? {
                  color: theme.palette.text.primary,
                }
              : undefined,
        },
      },
      MuiAccordion: {
        defaultProps: {
          disableGutters: true,
          slotProps: {
            transition: {
              timeout: 150,
              unmountOnExit: true,
            },
          },
        },
      },
      MuiFilledInput: {
        defaultProps: {
          margin: 'dense' as const,
        },
      },
      MuiFormControl: {
        defaultProps: {
          margin: 'dense' as const,
          size: 'small' as const,
        },
      },
      MuiFormHelperText: {
        defaultProps: {
          margin: 'dense' as const,
        },
      },

      MuiIconButton: {
        defaultProps: {
          size: 'small' as const,
        },
      },
      MuiInputBase: {
        defaultProps: {
          margin: 'dense' as const,
        },
      },
      MuiAutocomplete: {
        defaultProps: {
          size: 'small' as const,
        },
      },
      MuiInputLabel: {
        defaultProps: {
          margin: 'dense' as const,
        },
      },
      MuiToolbar: {
        defaultProps: {
          variant: 'dense' as const,
        },
      },
      MuiListItem: {
        defaultProps: {
          dense: true,
        },
      },
      MuiOutlinedInput: {
        defaultProps: {
          margin: 'dense' as const,
        },
      },
      MuiFab: {
        defaultProps: {
          size: 'small' as const,
        },
        styleOverrides: {
          secondary: {
            // @ts-expect-error
            backgroundColor: theme?.palette?.quaternary?.main,
          },
        },
      },
      MuiTable: {
        defaultProps: {
          size: 'small' as const,
        },
      },
      MuiPopover: {
        defaultProps: {
          transitionDuration: 0,
        },
      },
      MuiMenu: {
        defaultProps: {
          transitionDuration: 0,
        },
      },
      MuiMenuItem: {
        defaultProps: {
          dense: true,
        },
      },

      MuiTextField: {
        defaultProps: {
          margin: 'dense' as const,
          variant: 'standard' as const,
        },
      },
      MuiLink: {
        styleOverrides: {
          // the default link color uses theme.palette.primary.main which is
          // very bad with dark mode+midnight primary
          root: ({ theme }) => ({
            color: theme.palette.text.secondary,
          }),
        },
      },
      MuiCheckbox: {
        styleOverrides: {
          // the default checkbox-when-checked color uses
          // theme.palette.primary.main which is very bad with dark
          // mode+midnight primary
          //
          // keeps the forest-green checkbox by default but for darkmode, uses
          // a text-like coloring to ensure contrast xref
          // https://stackoverflow.com/a/72546130/2129219
          root: ({ theme }) =>
            theme.palette.mode === 'dark'
              ? {
                  color: theme.palette.text.secondary,
                  '&.Mui-checked': {
                    color: theme.palette.text.secondary,
                  },
                }
              : undefined,
        },
      },
      MuiRadio: {
        styleOverrides: {
          // the default checkbox-when-checked color uses
          // theme.palette.primary.main which is very bad with dark
          // mode+midnight primary
          //
          // keeps the forest-green checkbox by default but for darkmode, uses
          // a text-like coloring to ensure contrast
          // xref https://stackoverflow.com/a/72546130/2129219
          root: ({ theme }) =>
            theme.palette.mode === 'dark'
              ? {
                  color: theme.palette.text.secondary,
                  '&.Mui-checked': {
                    color: theme.palette.text.secondary,
                  },
                }
              : undefined,
        },
      },
      MuiFormLabel: {
        styleOverrides: {
          // the default checkbox-when-checked color uses
          // theme.palette.primary.main which is very bad with dark
          // mode+midnight primary
          //
          // keeps the forest-green checkbox by default but for darkmode, uses
          // a text-like coloring to ensure contrast
          // xref https://stackoverflow.com/a/72546130/2129219
          //

          root: ({ theme }) =>
            theme.palette.mode === 'dark'
              ? {
                  color: theme.palette.text.secondary,
                  '&.Mui-focused': {
                    color: theme.palette.text.secondary,
                  },
                }
              : undefined,
        },
      },
      MuiAccordionSummary: {
        styleOverrides: {
          root: {
            backgroundColor: theme?.palette?.background?.paper,
            borderBottom: `1px solid ${theme?.palette?.divider}`,
          },
          content: {
            color: theme?.palette?.text?.primary,
          },
        },
      },
      MuiToggleButtonGroup: {
        defaultProps: {
          size: 'small' as const,
        },
      },
      // Speed up ripple animations for snappier feel (default is 550ms)
      // See https://mui.com/material-ui/api/button-base/
      // and https://github.com/mui/material-ui/blob/master/packages/mui-material/src/ButtonBase/TouchRipple.js
      MuiButtonBase: {
        styleOverrides: {
          root: {
            '& .MuiTouchRipple-ripple': {
              animationDuration: '50ms !important',
            },
            '& .MuiTouchRipple-child': {
              animationDuration: '50ms !important',
            },
          },
        },
      },
    },
  }
  return deepmerge(themeP, theme || {}, { arrayMerge: overwriteArrayMerge })
}

type ThemeMap = Record<string, ThemeOptions>

const themeCache = new Map<string, Theme>()

function getThemeCacheKey(
  configTheme: ThemeOptions,
  themeName: string,
): string {
  return JSON.stringify({ configTheme, themeName })
}

export function createJBrowseTheme(
  configTheme: ThemeOptions = {},
  themes = defaultThemes,
  themeName = 'default',
) {
  const cacheKey = getThemeCacheKey(configTheme, themeName)
  const cached = themeCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const theme = createTheme(
    createJBrowseBaseTheme(
      themeName === 'default'
        ? deepmerge(themes.default!, augmentThemeColors(configTheme), {
            arrayMerge: overwriteArrayMerge,
          })
        : addMissingColors(themes[themeName]),
    ),
  )

  themeCache.set(cacheKey, theme)
  return theme
}

// MUI by default allows strings like '#f00' for primary and secondary and
// augments them to have light and dark variants but not for anything else, so
// we augment them here
function augmentThemeColors(theme: ThemeOptions = {}) {
  const augmentedPalette: Record<string, PaletteColor> = Object.create(null)
  for (const entry of [
    'primary',
    'secondary',
    'tertiary',
    'quaternary',
    'highlight',
  ] as const) {
    const paletteEntry = theme.palette?.[entry]
    if (paletteEntry) {
      augmentedPalette[entry] = refTheme.palette.augmentColor(
        'color' in paletteEntry
          ? (paletteEntry as PaletteAugmentColorOptions)
          : { color: paletteEntry },
      )
    }
  }
  return Object.keys(augmentedPalette).length > 0
    ? deepmerge(theme, { palette: augmentedPalette })
    : theme
}

// adds missing colors to users theme
function addMissingColors(theme: ThemeOptions = {}) {
  const { palette } = theme
  return augmentThemeColors(
    deepmerge(theme, {
      palette: {
        quaternary: palette?.quaternary || lightgrey,
        tertiary: palette?.tertiary || lightgrey,
        highlight: palette?.highlight || amber,
        softTeal: palette?.softTeal || softTeal,
        insertion: palette?.insertion || insertion,
        softclip: palette?.softclip || softclip,
        skip: palette?.skip || skip,
        hardclip: palette?.hardclip || hardclip,
        deletion: palette?.deletion || deletion,
        startCodon: palette?.startCodon || startCodon,
        stopCodon: palette?.stopCodon || stopCodon,
      },
    }),
  )
}
