import {
  CHART_BINS_MAX,
  CHART_BINS_MIN,
  CHART_DATA_FORMS,
  CHART_KINDS,
  CHART_KIND_DATA_FORMS,
  CHART_SPEC_VERSION,
  DEFAULT_CHART_BINS,
} from './chartSpec.ts'
import { listColorSchemeNames } from './colorSchemes.ts'

import type { ChartDataForm, ChartKind } from './chartModel.ts'

/**
 * The v1 chart spec vocabulary, as data.
 *
 * Two audiences, one document:
 *
 * - the `jsonSchema` part is the "minimal JSON Schema (for agents)" printed in
 *   `SPEC.md` §11 — a schema validator can reject a bad spec before the config
 *   is ever loaded. `chartSpecSchema.test.ts` compares the two so the doc block
 *   and this generator cannot drift;
 * - the top-level `kinds`/`dataForms`/`kindDataForms`/`bins`/`colorSchemes`
 *   tables are the same facts in a shape an agent can read without walking the
 *   JSON Schema (that is what `jbrowse.chartSpecSchema()` returns).
 *
 * Everything is derived from the constants `validateChartSpec` enforces, so the
 * published vocabulary cannot describe a spec the validator would reject on a
 * *closed set* (kind, form, palette, bins range). The JSON Schema is slightly
 * stricter than the runtime validator in two places — `path` shape and
 * `axes.yLabel` length — on purpose: a config that satisfies the schema always
 * loads, and the extra strictness is a lint hint, not a new runtime rule.
 */
export const CHART_SPEC_SCHEMA_ID = 'jbrowse-feature-chart-spec'

/**
 * Extension point that publishes `chartSpecSchema()` through the
 * `PluginManager`, which is how `@jbrowse/agent-sdk` reads it without importing
 * this package (the SDK is plain JS injected into the page).
 */
export const CHART_SPEC_SCHEMA_EXTENSION_POINT = 'Core-featureChartSpecSchema'

/** `axes.yLabel` length hint used by the JSON Schema (not enforced at runtime). */
export const CHART_SPEC_Y_LABEL_MAX_LENGTH = 64

/** Dotted-path shape hint used by the JSON Schema (not enforced at runtime). */
export const CHART_SPEC_DATA_PATH_PATTERN = '^$|^[^.[\\]]+(\\.[^.[\\]]+)*$'

export interface ChartSpecJsonSchema {
  $schema: string
  $id: string
  title: string
  description: string
  type: 'object'
  additionalProperties: false
  required: string[]
  properties: Record<string, unknown>
  allOf: unknown[]
}

export interface ChartSpecSchema extends ChartSpecJsonSchema {
  /** where a spec lives in a track config */
  configPath: string
  /** current vocabulary version (`specVersion`) */
  specVersion: number
  /** the closed sets, repeated so a caller need not walk the schema */
  kinds: ChartKind[]
  dataForms: ChartDataForm[]
  /** which `data.form` values each `kind` accepts (`validateChartSpec` rule) */
  kindDataForms: Record<ChartKind, ChartDataForm[]>
  /** `style.bins`, histogram only */
  bins: { min: number; max: number; default: number }
  /** valid `style.colorScheme` names */
  colorSchemes: string[]
}

/**
 * Build the spec vocabulary document. Pure and cheap (a handful of object
 * literals), so both the extension point and tests can call it freely.
 */
export function chartSpecSchema(): ChartSpecSchema {
  const colorSchemes = listColorSchemeNames()
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: CHART_SPEC_SCHEMA_ID,
    title: 'FeatureChart chart spec v1',
    description:
      'Declarative chart description for a FeatureChartTrack renderer ' +
      '(renderer.drawer: "spec"). The spec says what to draw, not how: the same ' +
      'spec renders on the canvas and Plotly backends. The runtime validator is ' +
      'the authority; this schema is a conservative pre-flight check.',
    configPath: 'tracks[].renderer.spec',
    specVersion: CHART_SPEC_VERSION,
    type: 'object',
    additionalProperties: false,
    required: ['specVersion', 'kind', 'data'],
    kinds: [...CHART_KINDS],
    dataForms: [...CHART_DATA_FORMS],
    kindDataForms: Object.fromEntries(
      CHART_KINDS.map(kind => [kind, [...CHART_KIND_DATA_FORMS[kind]]]),
    ) as Record<ChartKind, ChartDataForm[]>,
    bins: {
      min: CHART_BINS_MIN,
      max: CHART_BINS_MAX,
      default: DEFAULT_CHART_BINS,
    },
    colorSchemes,
    properties: {
      specVersion: { const: CHART_SPEC_VERSION },
      kind: { enum: [...CHART_KINDS] },
      data: {
        type: 'object',
        required: ['form'],
        additionalProperties: false,
        properties: {
          form: { enum: [...CHART_DATA_FORMS] },
          path: { type: 'string', pattern: CHART_SPEC_DATA_PATH_PATTERN },
        },
      },
      axes: {
        type: 'object',
        additionalProperties: false,
        properties: {
          yLabel: { type: 'string', maxLength: CHART_SPEC_Y_LABEL_MAX_LENGTH },
        },
      },
      style: {
        type: 'object',
        additionalProperties: false,
        properties: {
          colorScheme: { enum: colorSchemes },
          bins: {
            type: 'integer',
            minimum: CHART_BINS_MIN,
            maximum: CHART_BINS_MAX,
          },
        },
      },
    },
    // the legality matrix as `if/then` blocks: each kind narrows `data.form`
    allOf: CHART_KINDS.map(kind => {
      const allowed = CHART_KIND_DATA_FORMS[kind]
      return {
        if: { properties: { kind: { const: kind } } },
        then: {
          properties: {
            data: {
              properties: {
                form:
                  allowed.length === 1
                    ? { const: allowed[0] }
                    : { enum: [...allowed] },
              },
            },
          },
        },
      }
    }),
  }
}
