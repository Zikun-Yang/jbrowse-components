/**
 * @jbrowse/agent-sdk — page-side SDK.
 *
 * This file is injected into a running JBrowse page as-is (no build step).
 * It reads `window.JBrowseSession` / `window.JBrowseRootModel` and exposes a
 * plain-data query API plus a few low-risk actions. AI-written scripts never
 * touch raw MST objects: queries return frozen JSON, and the only bridge to
 * the outside is `window.__jbrowseBridgeScreenshot` (provided by the runner).
 *
 * Keep this file dependency-free plain JS — it runs in the browser verbatim.
 */
;(function () {
  'use strict'

  var DEFAULT_TRACK_LIMIT = 50

  function fail(code, message, hint, candidates) {
    var err = new Error(code + ': ' + message + (hint ? '\nhint: ' + hint : ''))
    err.code = code
    if (candidates) {
      err.candidates = candidates
    }
    throw err
  }

  function session() {
    if (!window.JBrowseSession) {
      fail(
        'NO_SESSION',
        'window.JBrowseSession is not set',
        'wait for the JBrowse app to finish loading before running scripts',
      )
    }
    return window.JBrowseSession
  }

  function toArray(mstArray) {
    // index-by-index copy: slice/spread on a MobX observable array returns
    // another observable, which Object.freeze would then reject
    var out = []
    if (mstArray && mstArray.length) {
      for (var i = 0; i < mstArray.length; i++) {
        out.push(mstArray[i])
      }
    }
    return out
  }

  function freeze(value) {
    // only freeze plain objects/arrays — never MobX/MST class instances
    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) {
        freeze(value[i])
      }
      if (!Object.isFrozen(value)) {
        try {
          Object.freeze(value)
        } catch (e) {
          // MobX dynamic observable objects reject freeze — leaving them
          // unfrozen is fine, outputs are already detached copies
        }
      }
    } else if (value && value.constructor === Object && !Object.isFrozen(value)) {
      for (var k in value) {
        freeze(value[k])
      }
      try {
        Object.freeze(value)
      } catch (e) {
        // same as above
      }
    }
    return value
  }

  // ── serialization (cycle-safe, depth-limited, plain JSON out) ──────────
  function safeSerialize(value, depth) {
    if (depth === undefined) {
      depth = 6
    }
    if (value === undefined || typeof value === 'function') {
      return undefined
    }
    if (value === null || typeof value !== 'object') {
      return value
    }
    if (depth <= 0) {
      return '[...]'
    }
    if (Array.isArray(value)) {
      var arr = []
      for (var i = 0; i < value.length; i++) {
        arr.push(safeSerialize(value[i], depth - 1))
      }
      return arr
    }
    // MST nodes and other class instances: take own enumerable + plain fields
    var obj = {}
    try {
      var keys = Object.keys(value)
      for (var j = 0; j < keys.length; j++) {
        var v = safeSerialize(value[keys[j]], depth - 1)
        if (v !== undefined) {
          obj[keys[j]] = v
        }
      }
    } catch (e) {
      return '[unserializable]'
    }
    return obj
  }

  // ── track helpers ────────────────────────────────────────────────────────

  /** trackIds currently shown in at least one view */
  function openTrackIds() {
    var ids = {}
    var views = toArray(session().views)
    for (var i = 0; i < views.length; i++) {
      var displays = toArray(views[i].tracks)
      for (var j = 0; j < displays.length; j++) {
        var conf = displays[j].configuration
        if (conf && conf.trackId) {
          ids[conf.trackId] = true
        }
      }
    }
    return ids
  }

  function trackInfo(conf, openIds) {
    return freeze({
      id: conf.trackId,
      name: conf.name,
      type: conf.type,
      adapter: conf.adapter ? conf.adapter.type : undefined,
      assemblyNames: toArray(conf.assemblyNames),
      category: toArray(conf.category),
      open: !!(openIds || openTrackIds())[conf.trackId],
    })
  }

  function allTrackConfs() {
    var s = session()
    var confs = toArray(s.tracks)
    if (s.sessionTracks) {
      confs = confs.concat(toArray(s.sessionTracks))
    }
    return confs
  }

  function matchesFilter(info, filter) {
    if (!filter) {
      return true
    }
    if (filter.open !== undefined && info.open !== filter.open) {
      return false
    }
    if (filter.type && info.type !== filter.type) {
      return false
    }
    if (filter.assembly && info.assemblyNames.indexOf(filter.assembly) < 0) {
      return false
    }
    if (filter.name) {
      var needle = String(filter.name).toLowerCase()
      var hay = (info.name + ' ' + info.id).toLowerCase()
      if (hay.indexOf(needle) < 0) {
        return false
      }
    }
    return true
  }

  // ── view helpers ─────────────────────────────────────────────────────────

  function regionsOf(view) {
    if (view.displayedRegions) {
      return toArray(view.displayedRegions).map(function (r) {
        return freeze({
          assemblyName: r.assemblyName,
          refName: r.refName,
          start: r.start,
          end: r.end,
        })
      })
    }
    // comparative views nest per-row views (e.g. LinearSyntenyView.views)
    if (view.views) {
      var out = []
      toArray(view.views).forEach(function (sub) {
        out = out.concat(regionsOf(sub))
      })
      return out
    }
    return []
  }

  function visibleLocOf(view) {
    // coarseVisibleLocStrings reflects the actually-visible window;
    // displayedRegions can span whole chromosomes while zoomed in.
    // (a plain string on linear views, an array on some others)
    var v = view.coarseVisibleLocStrings
    if (v) {
      return typeof v === 'string' ? v : toArray(v).join(', ')
    }
    // composite views (synteny/comparative/split) hold sub-views with their
    // own windows — report each row's visible locstring instead
    var subs = toArray(view.views)
    if (subs.length && subs[0] && subs[0].coarseVisibleLocStrings) {
      return subs
        .map(function (sv) {
          var loc = visibleLocOf(sv)
          var asm =
            sv.assemblyNames && toArray(sv.assemblyNames)[0]
          return loc ? loc + (asm ? ' (' + asm + ')' : '') : null
        })
        .filter(Boolean)
        .join(', ')
    }
    return undefined
  }

  function viewInfo(view) {
    var regions = regionsOf(view)
    var assemblies = {}
    regions.forEach(function (r) {
      if (r.assemblyName) {
        assemblies[r.assemblyName] = true
      }
    })
    return freeze({
      id: view.id,
      type: view.type || 'unknown',
      displayName: view.displayName,
      assemblyNames: toArray(view.assemblyNames).length
        ? toArray(view.assemblyNames)
        : Object.keys(assemblies),
      visible: visibleLocOf(view),
      regions: regions,
      trackIds: toArray(view.tracks)
        .map(function (d) {
          return d.configuration ? d.configuration.trackId : undefined
        })
        .filter(Boolean),
    })
  }

  function locString(r) {
    return (
      r.refName +
      ':' +
      (r.start + 1) +
      '-' +
      r.end +
      (r.assemblyName ? ' (' + r.assemblyName + ')' : '')
    )
  }

  function viewTypeInfos() {
    var root = window.JBrowseRootModel
    var pm = root && root.pluginManager
    if (!pm) {
      return []
    }
    try {
      var els =
        typeof pm.getViewElements === 'function'
          ? pm.getViewElements()
          : typeof pm.getElementTypesInGroup === 'function'
            ? pm.getElementTypesInGroup('view')
            : []
      return els.map(function (vt) {
        return {
          name: vt.name,
          displayName: vt.displayName || undefined,
          description: vt.description || undefined,
          hidden: !!(vt.viewMetadata && vt.viewMetadata.hiddenFromGUI),
        }
      })
    } catch (e) {
      return []
    }
  }

  function viewTypeNames() {
    return viewTypeInfos().map(function (v) {
      return v.name
    })
  }

  function visibleViewTypeInfos() {
    return viewTypeInfos().filter(function (v) {
      return !v.hidden
    })
  }

  // ── idle detection ─────────────────────────────────────────────────────────
  // JBrowse has no global busy flag; loading states are heterogeneous. Two
  // complementary signal sources:
  //
  // 1. DOM (workspace): visible MUI progress bars and "Loading..." text.
  //    Visibility matters — LoadingOverlay keeps its "Loading" text node in
  //    the DOM permanently, hidden with opacity:0 when idle. A naive text
  //    scan sees those decoys forever.
  // 2. MST blockState: server-side rendered blocks (canvas/svg tracks) show
  //    status texts like "Computing feature layout" / "Rendering features"
  //    while rendering — NOT matching /^Loading/ — so DOM alone declares idle
  //    mid-render. The authoritative check is the blockState map itself:
  //    any block that isn't filled, is render-pending, or has a live
  //    statusMessage means work is in flight.

  function workspaceRoot() {
    return (
      document.querySelector('[data-testid="workspace-views"]') ||
      document.querySelector('.dv-dockview') ||
      document.body
    )
  }

  function isShown(el) {
    for (var a = el; a && a.nodeType === 1; a = a.parentElement) {
      var cs = getComputedStyle(a)
      if (
        cs.display === 'none' ||
        cs.visibility === 'hidden' ||
        cs.visibility === 'collapse' ||
        cs.opacity === '0'
      ) {
        return false
      }
    }
    return true
  }

  function blockSignals() {
    var hits = []
    try {
      var sess = session()
      if (!sess) {
        return hits
      }
      var seen = {}
      var walkViews = function (views) {
        toArray(views).forEach(function (v) {
          if (seen[v.id]) {
            return
          }
          seen[v.id] = true
          toArray(v.tracks).forEach(function (t) {
            toArray(t.displays).forEach(function (d) {
              var bs = d.blockState
              if (!bs || typeof bs.entries !== 'function') {
                return
              }
              for (var e = bs.entries(), it = e.next(); !it.done; it = e.next()) {
                var key = it.value[0]
                var b = it.value[1]
                if (b.error || b.message) {
                  continue // terminal states count as done
                }
                if (!b.filled || b.isRenderingPending || b.blockStatusMessage) {
                  hits.push(
                    'block ' + String(key).slice(-30) +
                      (!b.filled ? ' unfilled' : b.isRenderingPending ? ' rendering' : ' busy'),
                  )
                }
              }
            })
          })
          if (v.views) {
            walkViews(v.views)
          }
        })
      }
      walkViews(sess.views)
    } catch (e) {
      // model shape differs — DOM signals still apply
    }
    return hits
  }

  function loadingSignals() {
    var root = workspaceRoot()
    var hits = blockSignals()
    var bars = root.querySelectorAll('[role="progressbar"]')
    for (var i = 0; i < bars.length; i++) {
      if (isShown(bars[i])) {
        hits.push('progressbar')
      }
    }
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    var node
    while ((node = walker.nextNode())) {
      var t = (node.nodeValue || '').trim()
      if (/^Loading/i.test(t) && isShown(node.parentElement)) {
        hits.push(t.slice(0, 60))
      }
    }
    return hits
  }

  // ── the agent ────────────────────────────────────────────────────────────

  function createAgent() {
    var warnings = []

    function warn(msg) {
      warnings.push(msg)
    }

    /** the routed app shell only renders views on the 'workspace' route */
    function ensureWorkspaceRoute() {
      var s = session()
      if (typeof s.setActiveView === 'function') {
        s.setActiveView('workspace')
      }
    }

    /** resolve fuzzy id/name to a TrackInfo, throwing with candidates */
    function resolveTrackInfo(idOrName) {
      var openIds = openTrackIds()
      var infos = allTrackConfs().map(function (c) {
        return trackInfo(c, openIds)
      })
      var needle = String(idOrName).toLowerCase()
      var exact = infos.filter(function (t) {
        return t.id === idOrName
      })
      var nameMatch = infos.filter(function (t) {
        return String(t.name).toLowerCase() === needle
      })
      var fuzzy = infos.filter(function (t) {
        return (
          String(t.name).toLowerCase().indexOf(needle) >= 0 ||
          String(t.id).toLowerCase().indexOf(needle) >= 0
        )
      })
      var found = exact[0] || nameMatch[0]
      if (found) {
        return found
      }
      if (fuzzy.length === 1) {
        return fuzzy[0]
      }
      if (fuzzy.length > 1) {
        fail(
          'AMBIGUOUS_TRACK',
          "'" + idOrName + "' matches " + fuzzy.length + ' tracks',
          'use a more specific name or the exact track id',
          fuzzy.map(function (t) {
            return t.id + ' (' + t.type + ')'
          }),
        )
      }
      fail(
        'TRACK_NOT_FOUND',
        "no track matching '" + idOrName + "'",
        'call tracks() to list available tracks',
        infos.slice(0, 10).map(function (t) {
          return t.id
        }),
      )
    }

    /** find { view, entry, display } showing trackId; viewId optional */
    function findDisplay(trackId, viewId) {
      var views = toArray(session().views)
      for (var i = 0; i < views.length; i++) {
        if (viewId && views[i].id !== viewId) {
          continue
        }
        var displays = toArray(views[i].tracks)
        for (var j = 0; j < displays.length; j++) {
          var entry = displays[j]
          var conf = entry.configuration
          if (conf && conf.trackId === trackId) {
            // view.tracks entries are containers; the stateful display
            // model (setColorBy & friends) is entry.displays[0]
            var display =
              entry.displays && entry.displays.length ? entry.displays[0] : entry
            return { view: views[i], entry: entry, display: display }
          }
        }
      }
      return undefined
    }

    /** collect set* actions across the prototype chain of a display */
    function listSetters(obj) {
      var out = []
      var o = obj
      while (o && o !== Object.prototype) {
        Object.getOwnPropertyNames(o).forEach(function (k) {
          if (
            /^set[A-Z]/.test(k) &&
            typeof obj[k] === 'function' &&
            out.indexOf(k) < 0
          ) {
            out.push(k)
          }
        })
        o = Object.getPrototypeOf(o)
      }
      return out.sort()
    }

    /** setter name for a state slot: 'colorBy' -> 'setColorBy' */
    function setterFor(slot) {
      return 'set' + String(slot).charAt(0).toUpperCase() + String(slot).slice(1)
    }

    /** parse "ref:start-end" into a Region object (0-based half-open) */
    function parseRegion(str, assemblyName) {
      var m = /^(.+?):([\d,]+)(?:-|\.\.)([\d,]+)$/.exec(String(str).trim())
      if (!m) {
        fail(
          'INVALID_LOCATION',
          'cannot parse region "' + str + '"',
          'use "ref:start-end", e.g. "chr1:1000-2000"',
        )
      }
      return {
        assemblyName: assemblyName,
        refName: m[1],
        start: parseInt(m[2].replace(/,/g, ''), 10) - 1,
        end: parseInt(m[3].replace(/,/g, ''), 10),
      }
    }

    var api = {
      // ── queries ──

      /** All views in the session. */
      views: function () {
        return toArray(session().views).map(viewInfo)
      },

      /**
       * All configured tracks (open or not).
       * filter: { open?: boolean, name?: string (substring, case-insensitive),
       *           type?: string, assembly?: string }
       * opts:   { limit?: number } (default 50)
       */
      tracks: function (filter, opts) {
        var limit = (opts && opts.limit) || DEFAULT_TRACK_LIMIT
        var openIds = openTrackIds()
        var all = allTrackConfs()
          .map(function (c) {
            return trackInfo(c, openIds)
          })
          .filter(function (info) {
            return matchesFilter(info, filter)
          })
        if (all.length > limit) {
          warn(
            'tracks() returned ' +
              limit +
              ' of ' +
              all.length +
              ' — use tracks({ name: "..." }) to filter or { limit: n }',
          )
          return all.slice(0, limit)
        }
        return all
      },

      /** One track by exact id or fuzzy name. Errors list candidates. */
      track: function (idOrName) {
        return resolveTrackInfo(idOrName)
      },

      /**
       * View types that can be opened with openView(typeName), enumerated
       * from the plugin manager at runtime. Only GUI-visible views are
       * listed (internal/helper views are excluded). Each entry:
       * { name, displayName?, description? } — description says what the
       * view shows and what tasks it is good for.
       */
      viewTypes: function () {
        return freeze({
          viewTypes: visibleViewTypeInfos().map(function (v) {
            return {
              name: v.name,
              displayName: v.displayName,
              description: v.description,
            }
          }),
        })
      },

      /**
       * Reference sequence names of an assembly (T2T assemblies use
       * accessions, not "chr1"). opts: { limit?: number } default 100.
       */
      refNames: function (assemblyName, opts) {
        var root = window.JBrowseRootModel
        if (!root || !root.assemblyManager) {
          fail(
            'NOT_SUPPORTED',
            'assemblyManager not found on the root model',
            'refNames requires a standard JBrowse root model',
          )
        }
        var limit = (opts && opts.limit) || 100
        return Promise.resolve(
          root.assemblyManager.waitForAssembly(String(assemblyName)),
        ).then(function (asm) {
          var names = asm.allRefNames || asm.refNames
          if (!names || !names.length) {
            fail(
              'REFNAMES_NOT_LOADED',
              'refNames for "' + assemblyName + '" not loaded yet',
              'retry in a few seconds — assembly data loads asynchronously',
            )
          }
          var out = toArray(names)
          if (out.length > limit) {
            warn(
              'refNames() returned ' +
                limit +
                ' of ' +
                out.length +
                ' — pass { limit: n } for more',
            )
            return out.slice(0, limit)
          }
          return out
        })
      },

      /** Assemblies configured in this session. */
      assemblies: function () {
        return toArray(session().assemblies).map(function (a) {
          // unset slots surface as the slot *descriptor* object
          // ({ name, description, type, value }) instead of the value
          var dn = a.displayName
          if (dn && typeof dn === 'object') {
            dn = dn.value || undefined
          }
          return freeze(
            safeSerialize({
              name: a.name,
              displayName: dn,
              aliases: toArray(a.aliases),
            }),
          )
        })
      },

      /** Compact digest of the current state (also auto-attached by the runner). */
      digest: function () {
        var views = api.views()
        var active = views[0]
        var open = api.tracks({ open: true }, { limit: 100 })
        var digest = {
          viewCount: views.length,
          activeView: active
            ? {
                id: active.id,
                type: active.type,
                region:
                  active.visible ||
                  active.regions.map(locString).join(', ') ||
                  '(none)',
              }
            : undefined,
          openTracks: open.map(function (t) {
            return t.name
          }),
        }
        if (warnings.length) {
          digest.warnings = warnings.slice()
        }
        return freeze(digest)
      },

      // ── actions (low-risk set for M1) ──

      /**
       * Navigate the first linear view to a location ("chr1:10000-20000" or a
       * gene name if a text search adapter is configured).
       * If no linear view exists, opens one automatically.
       * opts: { assembly?: string, settleMs?: number (default 1000) }
       */
      goto: function (loc, opts) {
        var views = toArray(session().views)
        var target
        for (var i = 0; i < views.length; i++) {
          if (typeof views[i].navToLocString === 'function') {
            target = views[i]
            break
          }
        }
        if (!target) {
          if (typeof session().addView !== 'function') {
            fail(
              'NO_LINEAR_VIEW',
              'no view with navToLocString and session.addView unavailable',
              'open a LinearGenomeView in the UI first',
            )
          }
          warn('no linear view was open — opened a new LinearGenomeView')
          ensureWorkspaceRoute()
          target = session().addView('LinearGenomeView', {})
        }
        var settleMs = (opts && opts.settleMs) || 1000
        var assembly = opts && opts.assembly
        var locStr = String(loc)
        var nav
        if (/:/.test(locStr) || typeof target.navToSearchString !== 'function') {
          // coordinate string → plain loc parsing
          nav = Promise.resolve(target.navToLocString(locStr, assembly))
        } else {
          // bare name (gene, feature) → text index search
          var asmName =
            assembly ||
            (target.assemblyNames && toArray(target.assemblyNames)[0])
          nav = Promise.resolve(
            window.JBrowseRootModel.assemblyManager.waitForAssembly(asmName),
          ).then(function (asm) {
            return target.navToSearchString({ input: locStr, assembly: asm })
          })
        }
        return nav.then(function () {
          return api.sleep(settleMs)
        })
      },

      /**
       * Open a new view. typeName defaults to 'LinearGenomeView'.
       * opts: { loc?: string, assembly?: string, settleMs?: number,
       *         init?: object — extra snapshot merged into addView, e.g.
       *         multi-way synteny: { init: { views: [{loc, assembly,
       *         tracks?}], tracks?: string[][] (one entry per level,
       *         the gap between views[i] and views[i+1]) } } }
       * Resolves to the new view's ViewInfo.
       */
      openView: function (typeName, opts) {
        if (typeof session().addView !== 'function') {
          fail(
            'NOT_SUPPORTED',
            'session.addView is not available',
            'this session type cannot open views programmatically',
          )
        }
        var name = typeName || 'LinearGenomeView'
        var known = viewTypeNames()
        if (known.length && known.indexOf(name) === -1) {
          fail(
            'UNKNOWN_VIEW_TYPE',
            "no view type '" + name + "'",
            'pick one of the registered view types (viewTypes())',
            visibleViewTypeInfos().map(function (v) {
              return v.name
            }),
          )
        }
        // most views accept an `init` frozen snapshot consumed by an
        // autorun (synteny multi-way setup, spreadsheet import, ...)
        var snapshot = opts && opts.init ? { init: opts.init } : {}
        var view = session().addView(name, snapshot)
        ensureWorkspaceRoute()
        var loc = opts && opts.loc
        var settleMs = (opts && opts.settleMs) || 1000
        var done = loc
          ? Promise.resolve(
              view.navToLocString(String(loc), opts && opts.assembly),
            )
          : Promise.resolve()
        return done
          .then(function () {
            return api.sleep(settleMs)
          })
          .then(function () {
            return viewInfo(view)
          })
      },

      /**
       * Show a track on a view (default: first linear view).
       * trackRef: exact id or fuzzy name. opts: { view?: viewId, settleMs? }
       * Resolves to the shown track's TrackInfo.
       */
      showTrack: function (trackRef, opts) {
        var info = resolveTrackInfo(trackRef)
        var views = toArray(session().views)
        var target
        for (var i = 0; i < views.length; i++) {
          if (opts && opts.view) {
            if (views[i].id === opts.view) {
              target = views[i]
              break
            }
          } else if (typeof views[i].showTrack === 'function') {
            target = views[i]
            break
          }
        }
        if (!target) {
          fail(
            'NO_VIEW',
            opts && opts.view
              ? "no view with id '" + opts.view + "'"
              : 'no view that can show tracks',
            'open one first: goto(loc) or openView()',
          )
        }
        ensureWorkspaceRoute()
        target.showTrack(info.id)
        return api
          .sleep((opts && opts.settleMs) || 1000)
          .then(function () {
            return trackInfo(
              allTrackConfs().find(function (c) {
                return c.trackId === info.id
              }),
              openTrackIds(),
            )
          })
      },

      /**
       * Hide a track from its view. trackRef: exact id or fuzzy name.
       * opts: { view?: viewId }
       */
      hideTrack: function (trackRef, opts) {
        var info = resolveTrackInfo(trackRef)
        var found = findDisplay(info.id, opts && opts.view)
        if (!found) {
          fail(
            'TRACK_NOT_SHOWN',
            "track '" + info.id + "' is not shown" +
              (opts && opts.view ? " in view '" + opts.view + "'" : ''),
            'call tracks({ open: true }) to see what is shown',
          )
        }
        found.view.hideTrack(info.id)
        return api.sleep(300)
      },

      /**
       * Inspect what a shown track's display can be configured with:
       * its set* actions and their current values.
       */
      displayConfig: function (trackRef, opts) {
        var info = resolveTrackInfo(trackRef)
        var found = findDisplay(info.id, opts && opts.view)
        if (!found) {
          fail(
            'TRACK_NOT_SHOWN',
            "track '" + info.id + "' is not shown in any view",
            'call showTrack("' + info.id + '") first',
          )
        }
        var setters = listSetters(found.display)
        var current = {}
        setters.forEach(function (s) {
          var prop = s.slice(3)
          prop = prop.charAt(0).toLowerCase() + prop.slice(1)
          try {
            var v = safeSerialize(found.display[prop])
            if (v !== undefined) {
              current[prop] = v
            }
          } catch (e) {
            // getter may throw for some props — skip
          }
        })
        return freeze({
          trackId: info.id,
          displayType: found.display.type || 'unknown',
          setters: setters,
          current: current,
        })
      },

      /**
       * Set a display state slot on a shown track, e.g.
       * setConfig('genes', 'colorBy', 'identity'). Calls the display's
       * setXxx action; errors list the available setters.
       * opts: { view?: viewId }
       * Resolves to the updated displayConfig().
       */
      setConfig: function (trackRef, slot, value, opts) {
        var info = resolveTrackInfo(trackRef)
        var found = findDisplay(info.id, opts && opts.view)
        if (!found) {
          fail(
            'TRACK_NOT_SHOWN',
            "track '" + info.id + "' is not shown in any view",
            'call showTrack("' + info.id + '") first',
          )
        }
        var setter = setterFor(slot)
        if (typeof found.display[setter] !== 'function') {
          fail(
            'NO_SETTER',
            "display for '" + info.id + "' has no " + setter + '()',
            'call displayConfig("' + info.id + '") to inspect, then pick one',
            listSetters(found.display),
          )
        }
        found.display[setter](value)
        return api.displayConfig(info.id, opts)
      },

      /**
       * Query features straight from a track's data adapter (no UI, no need
       * for the track to be shown). Goes through the CoreGetFeatures RPC.
       * regionStr: "ref:start-end". opts: { assembly?, limit? } (default 100)
       * Resolves to serialized feature JSON array.
       */
      features: function (trackRef, regionStr, opts) {
        var info = resolveTrackInfo(trackRef)
        var conf = allTrackConfs().find(function (c) {
          return c.trackId === info.id
        })
        var adapterConfig = JSON.parse(JSON.stringify(conf.adapter))
        var assemblyName = (opts && opts.assembly) || info.assemblyNames[0]
        var region = parseRegion(regionStr, assemblyName)
        var limit = (opts && opts.limit) || 100
        var s = session()
        return Promise.resolve(
          s.rpcManager.call(s.id, 'CoreGetFeatures', {
            sessionId: s.id,
            regions: [region],
            adapterConfig: adapterConfig,
            statusCallback: function () {},
          }),
        ).then(function (feats) {
          var arr = toArray(feats).map(function (f) {
            return f && typeof f.toJSON === 'function' ? f.toJSON() : f
          })
          var out = safeSerialize(arr)
          if (out.length > limit) {
            warn(
              'features() returned ' +
                limit +
                ' of ' +
                out.length +
                ' — pass { limit: n } for more or narrow the region',
            )
            return out.slice(0, limit)
          }
          return out
        })
      },

      /**
       * Export a view with JBrowse's own renderer (NOT a screenshot):
       * vector SVG, or PNG rasterized from that SVG. opts: { view?, format? }
       * format inferred from the .svg/.png extension when omitted.
       * Resolves to the saved absolute path.
       */
      exportView: function (path, opts) {
        var views = toArray(session().views)
        var target
        for (var i = 0; i < views.length; i++) {
          if (opts && opts.view) {
            if (views[i].id === opts.view) {
              target = views[i]
              break
            }
          } else if (typeof views[i].exportSvg === 'function') {
            target = views[i]
            break
          }
        }
        if (!target) {
          fail(
            'NO_EXPORTABLE_VIEW',
            'no view with exportSvg in this session',
            'open a LinearGenomeView first (goto or openView)',
          )
        }
        if (typeof window.__jbrowseBridgeArmDownload !== 'function') {
          fail(
            'NO_BRIDGE',
            'download bridge not available',
            'run this script through jbrowse-agent run.mjs',
          )
        }
        var format =
          (opts && opts.format) ||
          (/\.png$/i.test(path) ? 'png' : 'svg')
        var doExport = function () {
          var saved = window.__jbrowseBridgeArmDownload(String(path))
          target.exportSvg({
            filename: String(path).split('/').pop(),
            format: format,
          })
          return saved
        }
        if (opts && opts.noWait) {
          return doExport()
        }
        return api.waitForIdle(opts).then(doExport)
      },

      /**
       * Export the full session state (views, open tracks, display configs)
       * as JSON — restorable later via the UI's session import.
       * With path: saves to disk, resolves to { saved }.
       * Without: resolves to the snapshot object itself.
       */
      exportSession: function (path) {
        // MST nodes implement toJSON() = full state snapshot
        var snap = JSON.parse(JSON.stringify(session()))
        if (!path) {
          return snap
        }
        if (typeof window.__jbrowseBridgeSaveFile !== 'function') {
          fail(
            'NO_BRIDGE',
            'save-file bridge not available',
            'run this script through jbrowse-agent run.mjs',
          )
        }
        return window
          .__jbrowseBridgeSaveFile({
            path: String(path),
            content: JSON.stringify(snap, null, 2),
          })
          .then(function (saved) {
            return { saved: saved }
          })
      },

      /**
       * Screenshot to `path` on disk.
       * Default: the whole workspace area (all views together, without the
       * app header/sidebar). opts:
       *   view?: viewId — screenshot that view's container only
       *   selector?: css — arbitrary element
       *   fullPage?: true — the entire page (old behavior)
       * Resolves to the saved absolute path.
       */
      screenshot: function (path, opts) {
        if (typeof window.__jbrowseBridgeScreenshot !== 'function') {
          fail(
            'NO_BRIDGE',
            'screenshot bridge not available',
            'run this script through jbrowse-agent run.mjs',
          )
        }
        var selector = opts && opts.selector
        var viewId = opts && opts.view
        if (!selector && viewId) {
          var views = toArray(session().views)
          var found = false
          for (var i = 0; i < views.length; i++) {
            if (views[i].id === viewId) {
              found = true
              break
            }
          }
          if (!found) {
            fail(
              'VIEW_NOT_FOUND',
              "no view with id '" + viewId + "'",
              'call views() to list view ids',
              views.map(function (v) {
                return v.id
              }),
            )
          }
          selector = '[data-testid="view-container-' + viewId + '"]'
        }
        if (!selector && !(opts && opts.fullPage)) {
          // workspace area: stable testid on newer builds, dockview's own
          // class as fallback, first view container as last resort
          if (document.querySelector('[data-testid="workspace-views"]')) {
            selector = '[data-testid="workspace-views"]'
          } else if (document.querySelector('.dv-dockview')) {
            selector = '.dv-dockview'
          } else {
            var vs = toArray(session().views)
            if (vs.length) {
              selector = '[data-testid="view-container-' + vs[0].id + '"]'
            }
          }
        }
        var payload = { path: String(path) }
        if (selector) {
          payload.selector = selector
        } else {
          payload.fullPage = true
        }
        if (opts && opts.noExpand) {
          payload.noExpand = true
        }
        var shoot = function () {
          return window.__jbrowseBridgeScreenshot(payload)
        }
        if (opts && opts.noWait) {
          return shoot()
        }
        // settle in-flight renders first (timeoutMs/quietMs/pollMs pass through)
        return api.waitForIdle(opts).then(shoot)
      },

      sleep: function (ms) {
        return new Promise(function (resolve) {
          setTimeout(resolve, ms)
        })
      },

      /**
       * Wait until the workspace is idle: no progress bars and no
       * "Loading..." text anywhere in the view area. Loaded, empty and
       * FAILED renders all count as idle — only in-flight loads block.
       * opts: { timeoutMs?: 30000, quietMs?: 500, pollMs?: 200 }
       * Resolves { idle: true, waitedMs } or, on timeout,
       * { idle: false, waitedMs, stillLoading: [samples] } (+ warning).
       * screenshot()/exportView() call this automatically (opts.noWait
       * to skip), so you rarely need it directly.
       */
      waitForIdle: function (opts) {
        var timeoutMs = (opts && opts.timeoutMs) || 30000
        var quietMs = (opts && opts.quietMs) || 500
        var pollMs = (opts && opts.pollMs) || 200
        var start = Date.now()
        var lastBusy = start
        return new Promise(function (resolve) {
          function poll() {
            var hits = loadingSignals()
            var now = Date.now()
            if (hits.length) {
              lastBusy = now
            }
            if (!hits.length && now - lastBusy >= quietMs) {
              return resolve({ idle: true, waitedMs: now - start })
            }
            if (now - start >= timeoutMs) {
              warn(
                'waitForIdle timed out after ' +
                  timeoutMs +
                  'ms — still loading: ' +
                  hits.slice(0, 3).join(' | '),
              )
              return resolve({
                idle: false,
                waitedMs: now - start,
                stillLoading: hits.slice(0, 10),
              })
            }
            setTimeout(poll, pollMs)
          }
          poll()
        })
      },

      // ── meta ──

      /**
       * Verify every internal contract the SDK relies on, so a host-app
       * change shows up as a named failed check instead of silently
       * degraded output (empty viewTypes, half-painted screenshots, …).
       * Read-only — safe to run at the start of every session.
       */
      selfTest: function () {
        var checks = []
        function check(name, fn) {
          try {
            var r = fn()
            if (r === true) {
              checks.push({ name: name, status: 'pass' })
            } else if (typeof r === 'string' && r.indexOf('skip:') === 0) {
              checks.push({ name: name, status: 'skip', detail: r.slice(5) })
            } else {
              checks.push({ name: name, status: 'fail', detail: String(r) })
            }
          } catch (e) {
            checks.push({
              name: name,
              status: 'fail',
              detail: String((e && e.message) || e),
            })
          }
        }

        check('session-exposed', function () {
          return (
            !!window.JBrowseSession ||
            'window.JBrowseSession is missing — the host app does not expose a session handle'
          )
        })

        check('root-model-exposed', function () {
          return (
            !!window.JBrowseRootModel ||
            'window.JBrowseRootModel is missing — viewTypes()/openView() validation will not work'
          )
        })

        check('view-type-enumeration', function () {
          var pm =
            window.JBrowseRootModel && window.JBrowseRootModel.pluginManager
          if (!pm) {
            return 'skip: no pluginManager on the root model'
          }
          if (typeof pm.getViewElements !== 'function') {
            return 'pluginManager.getViewElements is not a function (renamed?)'
          }
          var els = pm.getViewElements()
          return (
            (els && els.length > 0) ||
            'pluginManager.getViewElements() returned no view types'
          )
        })

        check('workspace-anchor', function () {
          if (document.querySelector('[data-testid="workspace-views"]')) {
            return true
          }
          if (document.querySelector('.dv-dockview')) {
            return 'skip: no workspace-views testid (older build), dockview fallback works'
          }
          var sess = session()
          if (sess && toArray(sess.views).length === 0) {
            // routed app shell mounts the workspace only once a view exists
            return 'skip: workspace not mounted (no open views)'
          }
          return 'neither [data-testid="workspace-views"] nor .dv-dockview found — default screenshot scoping will fall back to a single view'
        })

        check('view-container-anchors', function () {
          var sess = session()
          if (!sess) {
            return 'skip: no session'
          }
          var vs = toArray(sess.views)
          if (!vs.length) {
            return 'skip: no open views'
          }
          var missing = []
          vs.forEach(function (v) {
            if (
              !document.querySelector('[data-testid="view-container-' + v.id + '"]')
            ) {
              missing.push(v.id)
            }
          })
          return (
            missing.length === 0 ||
            'no [data-testid="view-container-<id>"] for view(s): ' +
              missing.join(', ') +
              ' — { view } screenshots will fail'
          )
        })

        check('blockstate-shape', function () {
          var sess = session()
          if (!sess) {
            return 'skip: no session'
          }
          var found = 0
          var bad = null
          var walk = function (views) {
            toArray(views).forEach(function (v) {
              toArray(v.tracks).forEach(function (t) {
                toArray(t.displays).forEach(function (d) {
                  var bs = d.blockState
                  if (!bs || typeof bs.entries !== 'function') {
                    return
                  }
                  for (
                    var e = bs.entries(), it = e.next();
                    !it.done;
                    it = e.next()
                  ) {
                    var b = it.value[1]
                    found++
                    if (
                      !('filled' in b) ||
                      !('isRenderingPending' in b) ||
                      !('blockStatusMessage' in b)
                    ) {
                      bad =
                        'block is missing filled/isRenderingPending/blockStatusMessage fields'
                    }
                  }
                })
              })
              if (v.views) {
                walk(v.views)
              }
            })
          }
          walk(sess.views)
          if (bad) {
            return bad + ' — waitForIdle() block signals are blind'
          }
          return (
            found > 0 ||
            'skip: no display blocks yet (show a track first to fully verify)'
          )
        })

        check('loading-decoys-filtered', function () {
          // LoadingOverlay keeps a /^Loading/ text node in the DOM at all
          // times, hidden with opacity:0 when idle. If upstream switches to
          // some other hiding mechanism (transform, clip-path, …) isShown()
          // would call decoys visible and waitForIdle would never settle.
          var root = workspaceRoot()
          var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
          var node
          var unfiltered = 0
          while ((node = walker.nextNode())) {
            var t = (node.nodeValue || '').trim()
            if (!/^Loading/i.test(t)) {
              continue
            }
            var el = node.parentElement
            var rect = el.getBoundingClientRect()
            var onScreen =
              rect.width > 0 &&
              rect.bottom > 0 &&
              rect.right > 0 &&
              rect.top < window.innerHeight &&
              rect.left < window.innerWidth
            // a decoy that isShown() calls visible must at least be
            // geometrically off-screen, otherwise it will false-trigger
            if (isShown(el) && !onScreen) {
              unfiltered++
            }
          }
          return (
            unfiltered === 0 ||
            unfiltered +
              ' hidden "Loading" text node(s) would be counted as loading — isShown() no longer matches how LoadingOverlay hides'
          )
        })

        check('screenshot-bridge', function () {
          return (
            typeof window.__jbrowseBridgeScreenshot === 'function' ||
            'skip: not running under jbrowse-agent run.mjs (no screenshot bridge)'
          )
        })

        var failed = checks.filter(function (c) {
          return c.status === 'fail'
        })
        return freeze({
          ok: failed.length === 0,
          checks: checks,
        })
      },

      help: function (method) {
        if (method && HELP[method]) {
          return method + ' — ' + HELP[method]
        }
        return Object.keys(HELP)
          .map(function (k) {
            return k + ' — ' + HELP[k].split('\n')[0]
          })
          .join('\n')
      },

      /** internal: JSON-safe clone used by the runner */
      __serialize: safeSerialize,
      /** internal: drain warnings */
      __warnings: function () {
        return warnings.slice()
      },
    }

    var HELP = {
      views: 'views(): list all views — [{ id, type, displayName, assemblyNames, regions, trackIds }]',
      tracks:
        'tracks(filter?, opts?): list configured tracks — [{ id, name, type, adapter, assemblyNames, category, open }]\n' +
        '  filter: { open?: boolean, name?: substring, type?: string, assembly?: string }\n' +
        '  opts: { limit?: number } default 50',
      track:
        'track(idOrName): one track by exact id or fuzzy name. Throws with candidates on no/ambiguous match.',
      assemblies: 'assemblies(): configured assemblies — [{ name, displayName, aliases }]',
      refNames:
        'refNames(assemblyName, opts?): reference sequence names of an assembly (T2T assemblies use accessions, not "chr1"). opts: { limit? } default 100.',
      digest: 'digest(): compact state summary { viewCount, activeView, openTracks, warnings? }',
      goto: 'goto(loc, opts?): navigate first linear view to "chr1:10000-20000" (coordinate) or a bare gene/feature name like "NPEPPS" (text index search; assembly must have a text search adapter); opens a LinearGenomeView if none exists. opts: { assembly?, settleMs? } default 1000.',
      openView:
        'openView(typeName?, opts?): open a new view (default LinearGenomeView). opts: { loc?, assembly?, settleMs?, init? — extra addView snapshot, e.g. multi-way synteny { init: { views: [{loc, assembly, tracks?}], tracks?: string[][] } } }. Returns ViewInfo.',
      viewTypes:
        'viewTypes(): view types openable with openView() — [{ name, displayName?, description? }]; description tells you what the view shows and which tasks it fits. Internal helper views are not listed',
      showTrack:
        'showTrack(trackRef, opts?): show a track on a view (default: first linear view). trackRef = exact id or fuzzy name. opts: { view?, settleMs? }. Returns TrackInfo.',
      hideTrack:
        'hideTrack(trackRef, opts?): hide a shown track. opts: { view? }. Errors if the track is not shown.',
      displayConfig:
        'displayConfig(trackRef, opts?): inspect a shown track display — its set* actions and current values. Use before setConfig.',
      setConfig:
        'setConfig(trackRef, slot, value, opts?): set a display state slot (calls setXxx action), e.g. ("genes","colorBy","identity"). Errors list available setters.',
      features:
        'features(trackRef, "ref:start-end", opts?): query a track\'s data adapter directly (no UI). opts: { assembly?, limit? } default 100. Returns feature JSON array.',
      exportView:
        'exportView(path, opts?): export a view with JBrowse\'s own renderer (not a screenshot). .svg = vector, .png = raster. Waits for loading to finish first (opts.noWait to skip). opts: { view?, format? }. Returns saved path.',
      exportSession:
        'exportSession(path?): full session state as JSON. With path saves to disk; without returns the snapshot object.',
      screenshot:
        'screenshot(path, opts?): save PNG to the out dir. Default: the whole workspace area (all views together). Waits for loading to finish first (opts.noWait to skip; timeoutMs/quietMs tune the wait). opts: { view?: viewId — one view only, selector?: css, fullPage?: true }',
      waitForIdle:
        'waitForIdle(opts?): wait until no loading indicators remain in the workspace (failed/empty renders count as done). opts: { timeoutMs?: 30000, quietMs?: 500, pollMs?: 200 }. Returns { idle, waitedMs, stillLoading? }',
      sleep: 'sleep(ms): wait — useful after interactions that trigger async rendering.',
      selfTest:
        'selfTest(): verify every internal contract the SDK relies on (session handle, DOM anchors, blockState shape, loading-decoy filtering, bridges). Read-only; run it at the start of a session. Returns { ok, checks: [{ name, status: pass|fail|skip, detail? }] }.',
      help: 'help(method?): list methods or show details for one.',
    }

    return api
  }

  window.__createJBrowseAgent = createAgent
})()
