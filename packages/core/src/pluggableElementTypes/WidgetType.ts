import type { ComponentType, LazyExoticComponent } from 'react'
import type React from 'react'

import PluggableElementBase from './PluggableElementBase.ts'

import type { AnyConfigurationSchemaType } from '../configuration/index.ts'
import type { IAnyModelType, IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

type WidgetComponentType = LazyExoticComponent<React.FC<any>> | React.FC<any>

type HeadingComponentType = ComponentType<{ model: IAnyStateTreeNode }>

export default class WidgetType extends PluggableElementBase {
  heading?: string

  configSchema: AnyConfigurationSchemaType

  HeadingComponent?: HeadingComponentType

  ReactComponent: WidgetComponentType

  stateModel: IAnyModelType

  helpText?: React.ReactNode

  // widgets with this flag are shown in a modal dialog instead of the drawer
  modalByDefault?: boolean

  constructor(stuff: {
    name: string
    heading?: string
    HeadingComponent?: HeadingComponentType
    configSchema: AnyConfigurationSchemaType
    stateModel: IAnyModelType
    ReactComponent: WidgetComponentType
    helpText?: React.ReactNode
    modalByDefault?: boolean
  }) {
    super(stuff)
    this.heading = stuff.heading
    this.HeadingComponent = stuff.HeadingComponent
    this.configSchema = stuff.configSchema
    this.stateModel = stuff.stateModel
    this.ReactComponent = stuff.ReactComponent
    this.helpText = stuff.helpText
    this.modalByDefault = stuff.modalByDefault
  }
}
