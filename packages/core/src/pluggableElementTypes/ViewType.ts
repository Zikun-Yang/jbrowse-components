import type React from 'react'

import PluggableElementBase from './PluggableElementBase.ts'

import type DisplayType from './DisplayType.ts'
import type { IAnyModelType, IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

type BasicView = React.ComponentType<{
  // TODO: can we use AbstractViewModel here?

  model: any
  session?: IAnyStateTreeNode
}>

type ViewComponentType = React.LazyExoticComponent<BasicView> | BasicView

interface ViewMetadata {
  hiddenFromGUI?: boolean
}

export default class ViewType extends PluggableElementBase {
  ReactComponent: ViewComponentType

  stateModel: IAnyModelType

  displayTypes: DisplayType[] = []

  viewMetadata: ViewMetadata = {}

  /**
   * one-paragraph description of what this view shows and what tasks it is
   * good for — surfaced to users and AI agents (e.g. jbrowse-agent's
   * viewTypes()) to help them pick the right view
   */
  description?: string

  icon?: React.ComponentType<{ className?: string }>

  // extendedName can be used for when you extend a given view type, and want
  // to register all of that view types displays to yourself
  //
  // e.g. you create a linear-genome-view subtype, and want all the tracks that
  // are compatible display types for the linear-genome-view to be compatible
  // with your type also (without this, display types are only registered to a
  // single view type)
  extendedName?: string

  constructor(stuff: {
    name: string
    displayName?: string
    description?: string
    stateModel: IAnyModelType
    extendedName?: string
    viewMetadata?: ViewMetadata
    icon?: React.ComponentType<{ className?: string }>
    ReactComponent: ViewComponentType
  }) {
    super(stuff)
    this.ReactComponent = stuff.ReactComponent
    this.viewMetadata = stuff.viewMetadata || {}
    this.description = stuff.description
    this.stateModel = stuff.stateModel
    this.extendedName = stuff.extendedName
    this.icon = stuff.icon
  }

  addDisplayType(display: DisplayType) {
    this.displayTypes.push(display)
  }
}
