---
id: track_info
title: Track info
---

# Track info

Every track can carry a short description that appears at the top of the **About
this track** dialog, above the configuration dump. Use it for the things a
config file cannot say: where the data came from, what the score means, known
gaps, who to ask.

It is plain markdown in the config, so it can come from anywhere a config comes
from — a shared session, a track hub, or an analysis pipeline that writes the
track config.

## Writing it

Track-level, in any track config:

```json
{
  "type": "FeatureTrack",
  "trackId": "gtex_tpm",
  "name": "GTEx expression",
  "formatAbout": {
    "info": "## GTEx v8\n\nMedian TPM per tissue, GRCh38.\n\n- **source**: [GTEx portal](https://gtexportal.org)\n- **contact**: expression-team@example.org"
  }
}
```

Site-wide default, in `config.json` (applies to every track that does not set
its own):

```json
{
  "configuration": {
    "formatAbout": {
      "info": "Data provided by {{session.assemblies.0.displayName}} users."
    }
  }
}
```

| setting                              | scope                   | default |
| ------------------------------------ | ----------------------- | ------- |
| `formatAbout.info`                   | one track               | `""`    |
| `configuration.formatAbout.info`     | every track without one | `""`    |
| `formatAbout.showInfo`               | one track               | `true`  |
| `configuration.formatAbout.showInfo` | every track             | `true`  |
| `formatAbout.hideUris`               | one track (dialog only) | `false` |
| `configuration.formatAbout.hideUris` | every track (dialog)    | `false` |

A track template wins over the site default. A whitespace-only template counts
as "not set" and falls through to the next level, so a generated config cannot
hide the description by writing `"info": "  "`.

`showInfo: false` hides the panel; on the root config it hides it for every
track and a track cannot override that back on. It does **not** delete the text:
the same string is still available to the agent SDK (see below), because "the
dialog is clean" and "the description does not exist" are different requests.
`hideUris` removes local paths from the config dump and hides relative links and
images when the panel renders; a path typed literally into `info` is not
rewritten, so do not paste private paths there.

## Template variables

`{{path}}` placeholders are replaced with the track's context. Missing keys
render as an empty string (and log a warning in development builds), so a typo
never breaks the dialog.

| namespace  | fields                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------ |
| `track`    | `trackId`, `name`, `type`, `description`, `category`, `metadata.*`, `adapter.*`, `assemblyNames` |
| `config`   | the resolved config shown in the dialog (after `formatAbout.config`, uris removed if hidden)     |
| `assembly` | `name`, `displayName`, `aliases` of the track's first assembly                                   |
| `session`  | `assemblyNames`, `assemblies` (`[{ name, displayName, aliases }]`)                               |

Examples:

```text
{{track.metadata.source}} · {{assembly.displayName}} · {{track.adapter.type}}
```

Plugins can add their own namespaces (`{{feature.*}}`, `{{chart.*}}`, …) through
the
[`Core-trackInfoContext`](/docs/developer_guides/extension_points#core-trackinfocontext)
extension point. Core namespaces win on a name collision.

For anything that needs logic, prefix the whole template with `jexl:` — the
expression is evaluated first and its **result** is rendered as a `{{path}}`
template:

```json
{ "formatAbout": { "info": "jexl:`## ${track.name}`" } }
```

The expression sees the same namespaces (`track`, `config`, `assembly`,
`session`) and jexl's operators, and its result is then rendered as a normal
`{{path}}` template — so `jexl:` is for computing a value, `{{ }}` for reading
one.

## Markdown and safety

Supported markdown: headings, paragraphs, lists, blockquotes, tables (GFM),
fenced and inline code, bold/italic/strikethrough, links and images.

The track info panel is deliberately narrow about what it will execute:

- **raw HTML is skipped**, not sanitized. `<script>`, `<iframe>` and odd
  attribute handlers in `info` never become markup, so a hostile config cannot
  script the page through this slot.
- link and image targets are filtered: only `http:`, `https:`, `mailto:`,
  `#fragment` and relative paths are kept (`javascript:` and `data:` are
  dropped). Combined with `hideUris`, a shared session cannot leak local paths.
- the text is user-supplied markdown rendered with `react-markdown`; nothing in
  it is executed as code. `jexl:` expressions are evaluated by JBrowse's jexl
  instance, which is the same trust level as the rest of the config file.

Treat a track config like code you run: the danger is the data URLs you point it
at, not the markdown.

## Reading it as an agent

`@jbrowse/agent-sdk` exposes the same rendered text through its tracks API (see
`products/jbrowse-agent/README.md` in the repository):

```js
const track = await jbrowse.track('gtex_tpm')
track.info // '## GTEx v8\n\nMedian TPM per tissue, GRCh38.…' (markdown)
track.infoText // 'GTEx v8\n\nMedian TPM per tissue, GRCh38.…' (markdown stripped)
```

`info`/`infoText` are **absent** (not empty) for a track without info, and
`tracks({}, { info: false })` skips the render when a script only needs names.
The agent path and the UI path are the same function (`resolveTrackInfo`), so a
description can never read differently in the two places.

## Troubleshooting

| symptom                                      | cause / fix                                                                            |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| panel missing on one track                   | `showInfo: false` on that track, or `info` is empty/whitespace                         |
| panel missing everywhere                     | `configuration.formatAbout.showInfo: false`, or neither level sets `info`              |
| placeholder renders as nothing               | the `{{path}}` does not exist in the context; check the namespace table above          |
| markdown shows as literal text               | the template starts with `jexl:` but the evaluation failed — check the browser console |
| links do nothing                             | the URL scheme is not allowed (only http(s), mailto, fragments, relative paths)        |
| relative link disappears in a shared session | `hideUris: true` on the track or root strips local paths                               |
