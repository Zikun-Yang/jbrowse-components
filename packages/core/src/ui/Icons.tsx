import { forwardRef } from 'react'

import { useTheme } from '@mui/material/styles'
import {
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpDown,
  BookMarked,
  Bookmark,
  BookmarkPlus,
  Cable as LucideCable,
  CalendarRange,
  Camera,
  ChartPie,
  ChartScatter,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Circle,
  CircleAlert,
  CircleDot,
  CircleHelp,
  Clock,
  CloudUpload,
  Columns2,
  Columns3,
  Copy,
  Crop,
  Database,
  Dna,
  DoorOpen,
  Download,
  Ellipsis,
  EllipsisVertical,
  ExternalLink,
  Eye,
  Files,
  Focus,
  FolderOpen,
  Fullscreen,
  Grid2x2,
  Grid3x3,
  Grip,
  Group,
  Hand,
  Highlighter,
  House,
  Info,
  LayoutDashboard,
  LayoutGrid,
  Link,
  List,
  ListChecks,
  ListPlus,
  ListX,
  Lock,
  LockOpen,
  Menu,
  Minus,
  OctagonAlert,
  Palette,
  PanelLeftOpen,
  Pencil,
  Pin,
  Play,
  Plus,
  Puzzle,
  Redo2,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Ruler,
  Save,
  SaveAll,
  Search,
  Settings,
  Shapes,
  Share2,
  ShoppingCart,
  Shuffle,
  Signature,
  SlidersVertical,
  Square,
  SquareArrowOutUpRight,
  SquareCheck,
  SquareSplitVertical,
  Star,
  Table,
  Tag,
  Tags,
  TextSearch,
  Trash2,
  Type,
  Undo2,
  UnfoldVertical,
  Upload,
  User,
  Waypoints,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

import type { SvgIconProps } from '@mui/material/SvgIcon'
import type { LucideProps } from 'lucide-react'

// MUI SvgIcon fontSize -> lucide size, matching MUI's rem values
const fontSizeMap = {
  small: 20,
  medium: 24,
  large: 35,
  inherit: '1em',
} as const

type LucideIconComponent = React.ForwardRefExoticComponent<
  Omit<LucideProps, 'ref'> & React.RefAttributes<SVGSVGElement>
>

function createIcon(LucideIcon: LucideIconComponent, name: string) {
  const Icon = forwardRef<SVGSVGElement, SvgIconProps>(function Icon(
    {
      fontSize,
      color,
      // MUI-only props, dropped so they don't leak onto the DOM svg element
      htmlColor,
      titleAccess,
      sx,
      component,
      inheritViewBox,
      viewBox,
      ...props
    },
    ref,
  ) {
    const theme = useTheme()
    const paletteColor =
      color === 'action'
        ? theme.palette.action.active
        : color === 'disabled'
          ? theme.palette.action.disabled
          : color === 'primary'
            ? theme.palette.primary.main
            : color === 'secondary'
              ? theme.palette.secondary.main
              : color === 'error'
                ? theme.palette.error.main
                : color === 'info'
                  ? theme.palette.info.main
                  : color === 'success'
                    ? theme.palette.success.main
                    : color === 'warning'
                      ? theme.palette.warning.main
                      : undefined
    return (
      <LucideIcon
        ref={ref}
        size={fontSizeMap[fontSize ?? 'medium'] ?? 24}
        color={htmlColor ?? paletteColor}
        aria-label={titleAccess}
        {...props}
      />
    )
  })
  Icon.displayName = name
  return Icon
}

export const AccessTimeIcon = createIcon(Clock, 'AccessTimeIcon')
export const AddIcon = createIcon(Plus, 'AddIcon')
export const AppsIcon = createIcon(Grip, 'AppsIcon')
export const ArrowBackIcon = createIcon(ArrowLeft, 'ArrowBackIcon')
export const ArrowDropDownIcon = createIcon(ChevronDown, 'ArrowDropDownIcon')
export const ArrowDropUpIcon = createIcon(ChevronUp, 'ArrowDropUpIcon')
export const ArrowForwardIcon = createIcon(ArrowRight, 'ArrowForwardIcon')
export const ArrowForwardIosIcon = createIcon(
  ChevronRight,
  'ArrowForwardIosIcon',
)
export const ArrowLeftIcon = createIcon(ArrowLeft, 'ArrowLeftIcon')
export const ArrowRightIcon = createIcon(ArrowRight, 'ArrowRightIcon')
export const BookmarkAddIcon = createIcon(BookmarkPlus, 'BookmarkAddIcon')
export const BookmarkIcon = createIcon(Bookmark, 'BookmarkIcon')
export const BookmarksIcon = createIcon(BookMarked, 'BookmarksIcon')
export const Cable = createIcon(LucideCable, 'Cable')
export const CalendarViewDayIcon = createIcon(
  CalendarRange,
  'CalendarViewDayIcon',
)
export const CategoryIcon = createIcon(Shapes, 'CategoryIcon')
export const CenterFocusStrongIcon = createIcon(Focus, 'CenterFocusStrongIcon')
export const CheckBoxIcon = createIcon(SquareCheck, 'CheckBoxIcon')
export const CheckBoxOutlineBlankIcon = createIcon(
  Square,
  'CheckBoxOutlineBlankIcon',
)
export const CheckIcon = createIcon(Check, 'CheckIcon')
export const ChevronRightIcon = createIcon(ChevronRight, 'ChevronRightIcon')
export const ClearAllIcon = createIcon(ListX, 'ClearAllIcon')
export const ClearIcon = createIcon(X, 'ClearIcon')
export const CloseIcon = createIcon(X, 'CloseIcon')
export const CloudUploadIcon = createIcon(CloudUpload, 'CloudUploadIcon')
export const ColorLensIcon = createIcon(Palette, 'ColorLensIcon')
export const ContentCopyIcon = createIcon(Copy, 'ContentCopyIcon')
export const CreateIcon = createIcon(Pencil, 'CreateIcon')
export const CropFreeIcon = createIcon(Crop, 'CropFreeIcon')
export const DNA = createIcon(Dna, 'DNA')
export const DashboardIcon = createIcon(LayoutDashboard, 'DashboardIcon')
export const DataUsageIcon = createIcon(ChartPie, 'DataUsageIcon')
export const DeleteIcon = createIcon(Trash2, 'DeleteIcon')
export const EqualizerIcon = createIcon(SlidersVertical, 'EqualizerIcon')
export const ErrorIcon = createIcon(CircleAlert, 'ErrorIcon')
export const ExpandLessIcon = createIcon(ChevronUp, 'ExpandLessIcon')
export const ExpandMoreIcon = createIcon(ChevronDown, 'ExpandMoreIcon')
export const ExtensionIcon = createIcon(Puzzle, 'ExtensionIcon')
export const FileCopyIcon = createIcon(Files, 'FileCopyIcon')
export const FolderOpenIcon = createIcon(FolderOpen, 'FolderOpenIcon')
export const FullscreenIcon = createIcon(Fullscreen, 'FullscreenIcon')
export const GestureIcon = createIcon(Signature, 'GestureIcon')
export const GetAppIcon = createIcon(Download, 'GetAppIcon')
export const GridViewIcon = createIcon(Grid3x3, 'GridViewIcon')
export const HeightIcon = createIcon(UnfoldVertical, 'HeightIcon')
export const HelpIcon = createIcon(CircleHelp, 'HelpIcon')
export const HelpOutlineIcon = createIcon(CircleHelp, 'HelpOutlineIcon')
export const HighlightIcon = createIcon(Highlighter, 'HighlightIcon')
export const HomeIcon = createIcon(House, 'HomeIcon')
export const Indexing = createIcon(TextSearch, 'Indexing')
export const InfoIcon = createIcon(Info, 'InfoIcon')
export const InfoOutlinedIcon = createIcon(Info, 'InfoOutlinedIcon')
export const KeyboardArrowDownIcon = createIcon(
  ChevronDown,
  'KeyboardArrowDownIcon',
)
export const KeyboardArrowRightIcon = createIcon(
  ChevronRight,
  'KeyboardArrowRightIcon',
)
export const KeyboardArrowUpIcon = createIcon(ChevronUp, 'KeyboardArrowUpIcon')
export const KeyboardDoubleArrowDownIcon = createIcon(
  ChevronsDown,
  'KeyboardDoubleArrowDownIcon',
)
export const KeyboardDoubleArrowUpIcon = createIcon(
  ChevronsUp,
  'KeyboardDoubleArrowUpIcon',
)
export const LabelIcon = createIcon(Tag, 'LabelIcon')
export const LaunchIcon = createIcon(ExternalLink, 'LaunchIcon')
export const LineStyleIcon = createIcon(Ruler, 'LineStyleIcon')
export const LinkIcon = createIcon(Link, 'LinkIcon')
export const ListIcon = createIcon(List, 'ListIcon')
export const LockIcon = createIcon(Lock, 'LockIcon')
export const LockOpenIcon = createIcon(LockOpen, 'LockOpenIcon')
export const LowPriorityIcon = createIcon(
  ArrowDownWideNarrow,
  'LowPriorityIcon',
)
export const MeetingRoomIcon = createIcon(DoorOpen, 'MeetingRoomIcon')
export const MenuIcon = createIcon(Menu, 'MenuIcon')
export const MenuOpenIcon = createIcon(PanelLeftOpen, 'MenuOpenIcon')
export const MinimizeIcon = createIcon(Minus, 'MinimizeIcon')
export const MoreHorizIcon = createIcon(Ellipsis, 'MoreHorizIcon')
export const MoreVertIcon = createIcon(EllipsisVertical, 'MoreVertIcon')
export const OpenInNewIcon = createIcon(SquareArrowOutUpRight, 'OpenInNewIcon')
export const PaletteIcon = createIcon(Palette, 'PaletteIcon')
export const PaletteOutlinedIcon = createIcon(Palette, 'PaletteOutlinedIcon')
export const PanToolIcon = createIcon(Hand, 'PanToolIcon')
export const PersonIcon = createIcon(User, 'PersonIcon')
export const PhotoCameraIcon = createIcon(Camera, 'PhotoCameraIcon')
export const PlayArrowIcon = createIcon(Play, 'PlayArrowIcon')
export const PlaylistAddIcon = createIcon(ListPlus, 'PlaylistAddIcon')
export const PublishIcon = createIcon(Upload, 'PublishIcon')
export const PushPinIcon = createIcon(Pin, 'PushPinIcon')
export const RadioButtonCheckedIcon = createIcon(
  CircleDot,
  'RadioButtonCheckedIcon',
)
export const RadioButtonUncheckedIcon = createIcon(
  Circle,
  'RadioButtonUncheckedIcon',
)
export const RedoIcon = createIcon(Redo2, 'RedoIcon')
export const RefreshIcon = createIcon(RefreshCw, 'RefreshIcon')
export const ReportIcon = createIcon(OctagonAlert, 'ReportIcon')
export const RotateLeftIcon = createIcon(RotateCcw, 'RotateLeftIcon')
export const RotateRightIcon = createIcon(RotateCw, 'RotateRightIcon')
export const SaveAsIcon = createIcon(SaveAll, 'SaveAsIcon')
export const SaveIcon = createIcon(Save, 'SaveIcon')
export const ScatterPlotIcon = createIcon(ChartScatter, 'ScatterPlotIcon')
export const SearchIcon = createIcon(Search, 'SearchIcon')
export const SegmentIcon = createIcon(Tags, 'SegmentIcon')
export const SettingsIcon = createIcon(Settings, 'SettingsIcon')
export const ShareIcon = createIcon(Share2, 'ShareIcon')
export const ShoppingCartIcon = createIcon(ShoppingCart, 'ShoppingCartIcon')
export const ShuffleIcon = createIcon(Shuffle, 'ShuffleIcon')
export const SplitscreenIcon = createIcon(Columns2, 'SplitscreenIcon')
export const StarBorderIcon = createIcon(Star, 'StarBorderIcon')
export const StarBorderOutlinedIcon = createIcon(Star, 'StarBorderOutlinedIcon')
export const StarIcon = createIcon(Star, 'StarIcon')
export const StorageIcon = createIcon(Database, 'StorageIcon')
export const SwapVertIcon = createIcon(ArrowUpDown, 'SwapVertIcon')
export const SyncAltIcon = createIcon(ArrowLeftRight, 'SyncAltIcon')
export const TableChartIcon = createIcon(Table, 'TableChartIcon')
export const TextFieldsIcon = createIcon(Type, 'TextFieldsIcon')
export const TimelineIcon = createIcon(Waypoints, 'TimelineIcon')
export const TrackSelector = createIcon(ListChecks, 'TrackSelector')
export const UndoIcon = createIcon(Undo2, 'UndoIcon')
export const VerticalSplitIcon = createIcon(
  SquareSplitVertical,
  'VerticalSplitIcon',
)
export const ViewColumnIcon = createIcon(Columns3, 'ViewColumnIcon')
export const ViewComfyIcon = createIcon(Grid2x2, 'ViewComfyIcon')
export const ViewModuleIcon = createIcon(LayoutGrid, 'ViewModuleIcon')
export const VisibilityIcon = createIcon(Eye, 'VisibilityIcon')
export const WorkspacesIcon = createIcon(Group, 'WorkspacesIcon')
export const ZoomInIcon = createIcon(ZoomIn, 'ZoomInIcon')
export const ZoomOutIcon = createIcon(ZoomOut, 'ZoomOutIcon')
