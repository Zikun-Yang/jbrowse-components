import { CascadingMenuButton } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import { MenuIcon } from '@jbrowse/core/ui/Icons'

import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import type { IconButtonProps, SvgIconProps } from '@mui/material'

const ViewMenu = observer(function ViewMenu({
  model,
  IconButtonProps,
  IconProps,
}: {
  model: IBaseViewModel
  IconButtonProps?: IconButtonProps
  IconProps?: SvgIconProps
}) {
  return (
    <CascadingMenuButton
      menuItems={() => model.menuItems()}
      data-testid="view_menu_icon"
      {...IconButtonProps}
    >
      <MenuIcon {...IconProps} />
    </CascadingMenuButton>
  )
})

export default ViewMenu
