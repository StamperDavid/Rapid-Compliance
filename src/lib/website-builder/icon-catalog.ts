/**
 * Icon Catalog
 * -----------------------------------------------------------------------------
 * A searchable, categorized catalog over the full lucide-react icon set
 * (~1900 icons). This module is DATA-ONLY: it imports just the icon NAME list
 * from `lucide-react/dynamic` (an array of strings plus a registry of lazy
 * `() => import()` thunks) — it never eager-imports the icon components, so it
 * adds no meaningful weight to the live bundle.
 *
 * Naming model:
 *  - lucide's dynamic registry keys are kebab-case (e.g. `arrow-up-right`).
 *  - Throughout the editor we store/display the PascalCase export name
 *    (e.g. `ArrowUpRight`, `Heart`, `Accessibility`) in `widget.data.icon`,
 *    matching lucide's documented component names.
 *  - `<Icon>` converts the stored PascalCase name back to the kebab key via the
 *    lossless `pascalToKebab()` map below before handing it to `DynamicIcon`.
 *
 * Brand icons: lucide still ships a handful of (deprecated) brand glyphs
 * (Facebook, Github, Linkedin, …) which we surface under "Social & Web". A
 * richer brand set (Font Awesome / simple-icons) is a future add — intentionally
 * NOT installed here to avoid new dependencies / bundle bloat.
 */

import { iconNames as LUCIDE_KEBAB_NAMES } from 'lucide-react/dynamic';

export interface IconCategory {
  id: string;
  label: string;
  icons: string[];
}

// --- Name conversion -------------------------------------------------------

/** kebab-case lucide registry key → PascalCase export name. */
function kebabToPascal(kebab: string): string {
  return kebab
    .split('-')
    .map((seg) => (seg.length === 0 ? seg : seg.charAt(0).toUpperCase() + seg.slice(1)))
    .join('');
}

/**
 * Master maps, derived once from lucide's authoritative kebab list. Building the
 * reverse map from the source list (rather than regex-deriving kebab from
 * Pascal) makes the PascalCase→kebab lookup lossless even for the handful of
 * names a naive regex would mangle (e.g. `Grid2x2`, `ArrowDownAZ`).
 */
const PASCAL_TO_KEBAB: Record<string, string> = {};
const ALL_PASCAL_NAMES: string[] = [];

for (const kebab of LUCIDE_KEBAB_NAMES) {
  const pascal = kebabToPascal(kebab);
  if (!(pascal in PASCAL_TO_KEBAB)) {
    PASCAL_TO_KEBAB[pascal] = kebab;
    ALL_PASCAL_NAMES.push(pascal);
  }
}

ALL_PASCAL_NAMES.sort((a, b) => a.localeCompare(b));

const KNOWN_NAME_SET: ReadonlySet<string> = new Set(ALL_PASCAL_NAMES);

// --- Public name helpers ---------------------------------------------------

/** Every valid lucide icon name (PascalCase), sorted alphabetically. */
export function allIconNames(): string[] {
  return ALL_PASCAL_NAMES.slice();
}

/** True when `name` is a real lucide icon export name (PascalCase). */
export function iconExists(name: string): boolean {
  return KNOWN_NAME_SET.has(name);
}

/**
 * Resolve a stored PascalCase icon name to lucide's kebab registry key, or
 * `undefined` if it isn't a known lucide icon (e.g. a legacy emoji string).
 */
export function pascalToKebab(name: string): string | undefined {
  return PASCAL_TO_KEBAB[name];
}

// --- Curated categories ----------------------------------------------------
// Hand-picked, inclusive groupings. Any name that isn't in the live lucide set
// (typo, renamed, removed across versions) is filtered out at module load, so
// the exported categories never contain a name that fails to render.

const RAW_CATEGORIES: IconCategory[] = [
  {
    id: 'popular',
    label: 'Popular',
    icons: [
      'Heart', 'Star', 'Check', 'CheckCircle', 'CircleCheck', 'X', 'Plus', 'Minus',
      'Search', 'Settings', 'Home', 'User', 'Users', 'Mail', 'Phone', 'Calendar',
      'Clock', 'MapPin', 'Globe', 'Bell', 'Bookmark', 'Camera', 'Image', 'Video',
      'Play', 'Pause', 'Download', 'Upload', 'Share2', 'Link', 'Trash2', 'Edit',
      'Pencil', 'Lock', 'Unlock', 'Eye', 'EyeOff', 'ThumbsUp', 'ThumbsDown',
      'Zap', 'Flame', 'Sparkles', 'Sun', 'Moon', 'Cloud', 'Gift', 'ShoppingCart',
      'CreditCard', 'DollarSign', 'Award', 'Trophy', 'Target', 'Rocket', 'Lightbulb',
      'Shield', 'ShieldCheck', 'Info', 'CircleHelp', 'TriangleAlert', 'CircleAlert',
    ],
  },
  {
    id: 'business',
    label: 'Business & Finance',
    icons: [
      'Briefcase', 'BriefcaseBusiness', 'Building', 'Building2', 'Landmark',
      'ChartBar', 'ChartBarBig', 'ChartLine', 'ChartPie', 'ChartColumn',
      'ChartColumnIncreasing', 'ChartNoAxesColumn', 'ChartArea', 'TrendingUp',
      'TrendingDown', 'Target', 'Goal', 'Award', 'Trophy', 'Medal', 'Crown',
      'Handshake', 'Presentation', 'Calculator', 'Coins', 'DollarSign', 'Euro',
      'PoundSterling', 'Banknote', 'Wallet', 'CreditCard', 'Receipt', 'PiggyBank',
      'Percent', 'BadgeDollarSign', 'BadgePercent', 'BadgeCheck', 'Scale',
      'Gem', 'Factory', 'Warehouse', 'Store', 'ShoppingBag', 'BriefcaseMedical',
      'BookOpen', 'ClipboardList', 'NotebookPen', 'FileSpreadsheet', 'Network',
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    icons: [
      'Mail', 'MailOpen', 'MailCheck', 'Mails', 'Mailbox', 'Inbox', 'Send',
      'SendHorizontal', 'MessageCircle', 'MessageSquare', 'MessagesSquare',
      'MessageSquareText', 'MessageSquareHeart', 'MessageCircleHeart', 'Phone',
      'PhoneCall', 'PhoneIncoming', 'PhoneOutgoing', 'Voicemail', 'AtSign',
      'Bell', 'BellRing', 'BellDot', 'BellOff', 'Megaphone', 'Speech',
      'Headphones', 'Headset', 'Rss', 'Reply', 'ReplyAll', 'Forward', 'Contact',
      'ContactRound', 'BookUser', 'Speaker', 'Mic', 'MicOff',
    ],
  },
  {
    id: 'social',
    label: 'Social & Web',
    icons: [
      'Facebook', 'Twitter', 'Instagram', 'Linkedin', 'Youtube', 'Github',
      'Twitch', 'Slack', 'Figma', 'Dribbble', 'Chrome', 'Globe', 'Globe2',
      'Share', 'Share2', 'Link', 'Link2', 'ExternalLink', 'Rss', 'AtSign',
      'Hash', 'ThumbsUp', 'ThumbsDown', 'Heart', 'HeartHandshake', 'Bookmark',
      'Users', 'UserPlus', 'MessageCircle', 'Bot', 'Cast', 'Webhook', 'Network',
      'Wifi', 'Podcast', 'Radio', 'Rocket',
    ],
  },
  {
    id: 'people',
    label: 'People & Accessibility',
    icons: [
      'Accessibility', 'PersonStanding', 'User', 'Users', 'UserRound',
      'UsersRound', 'UserCheck', 'UserPlus', 'UserMinus', 'UserCog', 'UserPen',
      'UserLock', 'UserSearch', 'Contact', 'ContactRound', 'Group', 'Baby',
      'Heart', 'HeartHandshake', 'HandHeart', 'HandHelping', 'Handshake',
      'Hand', 'HandMetal', 'Smile', 'SmilePlus', 'Frown', 'Meh', 'Laugh',
      'Angry', 'Annoyed', 'Brain', 'Ear', 'EarOff', 'Eye', 'Glasses', 'Footprints',
      'Crown', 'Bone', 'Venus', 'Mars', 'Transgender', 'VenusAndMars', 'Vegan',
      'Drama', 'Speech', 'BookUser', 'IdCard', 'Fingerprint', 'ScanFace',
    ],
  },
  {
    id: 'arrows',
    label: 'Arrows & Directions',
    icons: [
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUpRight',
      'ArrowUpLeft', 'ArrowDownRight', 'ArrowDownLeft', 'ArrowBigUp',
      'ArrowBigDown', 'ArrowBigLeft', 'ArrowBigRight', 'ChevronUp', 'ChevronDown',
      'ChevronLeft', 'ChevronRight', 'ChevronsUp', 'ChevronsDown', 'ChevronsLeft',
      'ChevronsRight', 'ChevronsLeftRight', 'ChevronsRightLeft', 'MoveUp',
      'MoveDown', 'MoveLeft', 'MoveRight', 'MoveUpRight', 'Move', 'CornerUpRight',
      'CornerDownRight', 'CornerLeftUp', 'Undo', 'Redo', 'Undo2', 'Redo2',
      'RotateCw', 'RotateCcw', 'RefreshCw', 'RefreshCcw', 'Repeat', 'Shuffle',
      'Maximize', 'Minimize', 'Maximize2', 'Minimize2', 'Expand', 'Shrink',
      'Navigation', 'Navigation2', 'Compass', 'Milestone', 'Split', 'Merge',
    ],
  },
  {
    id: 'media',
    label: 'Media & Audio',
    icons: [
      'Play', 'Pause', 'Square', 'StopCircle', 'CirclePlay', 'CirclePause',
      'SkipForward', 'SkipBack', 'FastForward', 'Rewind', 'Repeat', 'Repeat1',
      'Shuffle', 'Volume', 'Volume1', 'Volume2', 'VolumeX', 'Music', 'Music2',
      'Music4', 'AudioLines', 'AudioWaveform', 'Mic', 'MicOff', 'Headphones',
      'Radio', 'Disc', 'Disc3', 'Film', 'Clapperboard', 'Video', 'VideoOff',
      'Camera', 'CameraOff', 'Image', 'Images', 'ImagePlay', 'Tv', 'Tv2',
      'MonitorPlay', 'PlayCircle', 'ListMusic', 'Podcast', 'Speaker', 'Captions',
    ],
  },
  {
    id: 'devices',
    label: 'Devices & Tech',
    icons: [
      'Smartphone', 'Tablet', 'Laptop', 'LaptopMinimal', 'Monitor', 'MonitorSmartphone',
      'Computer', 'Server', 'HardDrive', 'Database', 'Cpu', 'MemoryStick',
      'Keyboard', 'Mouse', 'MousePointer', 'MousePointer2', 'Printer', 'Scan',
      'ScanLine', 'QrCode', 'Webcam', 'Watch', 'Gamepad',
      'Gamepad2', 'Joystick', 'Headphones', 'Speaker', 'Router', 'Wifi',
      'WifiOff', 'Bluetooth', 'Battery', 'BatteryCharging', 'BatteryFull',
      'Plug', 'Plug2', 'PlugZap', 'Power', 'Usb', 'Cable', 'Disc',
      'Microchip', 'CircuitBoard', 'Bot',
    ],
  },
  {
    id: 'commerce',
    label: 'Commerce & Shopping',
    icons: [
      'ShoppingCart', 'ShoppingBag', 'ShoppingBasket', 'Store', 'Tag', 'Tags',
      'Ticket', 'TicketPercent', 'BadgePercent', 'Percent', 'Gift', 'Package',
      'PackageOpen', 'PackageCheck', 'PackagePlus', 'Box', 'Boxes', 'Truck',
      'CreditCard', 'Wallet', 'Coins', 'DollarSign', 'Receipt', 'Barcode',
      'QrCode', 'ScanBarcode', 'ShoppingCart', 'Heart', 'Star', 'BadgeCheck',
      'BadgeDollarSign', 'HandCoins', 'WalletCards', 'Banknote', 'Container',
    ],
  },
  {
    id: 'nature',
    label: 'Nature & Weather',
    icons: [
      'Sun', 'SunMedium', 'SunDim', 'Sunrise', 'Sunset', 'Moon', 'MoonStar',
      'Cloud', 'CloudSun', 'CloudMoon', 'CloudRain', 'CloudDrizzle', 'CloudSnow',
      'CloudLightning', 'CloudFog', 'CloudHail', 'Cloudy', 'Wind', 'Tornado',
      'Rainbow', 'Snowflake', 'Droplet', 'Droplets', 'Umbrella', 'Thermometer',
      'Zap', 'Flame', 'Star', 'Sparkles', 'Leaf', 'Trees', 'TreePine',
      'TreePalm', 'Sprout', 'Flower', 'Flower2', 'Clover', 'Wheat', 'Mountain',
      'MountainSnow', 'Waves', 'Earth', 'Globe', 'Bird', 'Fish', 'Bug', 'Cat',
      'Dog', 'Rabbit', 'Squirrel', 'Turtle', 'Shell', 'PawPrint',
    ],
  },
  {
    id: 'files',
    label: 'Files & Documents',
    icons: [
      'File', 'FileText', 'FilePlus', 'FileMinus', 'FileCheck', 'FileX',
      'FilePen', 'FileSearch', 'FileLock', 'FileClock', 'FileSpreadsheet',
      'FileImage', 'FileVideo', 'FileAudio', 'FileCode', 'FileJson', 'FileArchive',
      'Files', 'FileStack', 'Folder', 'FolderOpen', 'FolderPlus', 'FolderCheck',
      'FolderClosed', 'FolderTree', 'Archive', 'Save', 'Copy', 'ClipboardList',
      'Clipboard', 'ClipboardCheck', 'BookOpen', 'Book', 'BookMarked', 'Notebook',
      'NotebookPen', 'StickyNote', 'Newspaper', 'ScrollText', 'Paperclip',
      'Printer', 'Pen', 'PenLine', 'Highlighter',
    ],
  },
  {
    id: 'ui',
    label: 'Interface & Tools',
    icons: [
      'Settings', 'Settings2', 'Sliders', 'SlidersHorizontal', 'Filter', 'Search',
      'Menu', 'LayoutGrid', 'LayoutList', 'LayoutDashboard', 'Grid2x2', 'Grid3x3',
      'List', 'ListChecks', 'Table', 'Columns2', 'Rows2', 'PanelLeft', 'PanelRight',
      'SquarePen', 'Trash', 'Trash2', 'Pencil', 'Eraser', 'Scissors', 'Clipboard',
      'Lock', 'Unlock', 'Key', 'KeyRound', 'Shield', 'ShieldCheck', 'ShieldAlert',
      'Eye', 'EyeOff', 'Bell', 'BellOff', 'Flag', 'Bookmark', 'Pin', 'PinOff',
      'Wrench', 'Hammer', 'Cog', 'CircleHelp', 'Info', 'Plus', 'Minus', 'Check',
      'X', 'MoreHorizontal', 'MoreVertical', 'Ellipsis', 'Loader', 'LoaderCircle',
      'RefreshCw', 'Power', 'LogIn', 'LogOut', 'ExternalLink', 'Palette', 'Brush',
    ],
  },
  {
    id: 'maps',
    label: 'Maps & Travel',
    icons: [
      'Map', 'MapPin', 'MapPinned', 'Navigation', 'Compass', 'Globe', 'Locate',
      'LocateFixed', 'Milestone', 'Route', 'Signpost', 'Plane', 'PlaneTakeoff',
      'PlaneLanding', 'Car', 'CarFront', 'Bus', 'Train', 'TrainFront', 'Ship',
      'Sailboat', 'Bike', 'Truck', 'Fuel', 'ParkingMeter', 'TrafficCone',
      'Footprints', 'Luggage', 'Tent', 'Mountain', 'Hotel', 'BedDouble', 'Anchor',
      'Caravan', 'TramFront',
    ],
  },
  {
    id: 'misc',
    label: 'Misc',
    icons: [
      'Sparkles', 'Wand', 'WandSparkles', 'Lightbulb', 'Rocket', 'Atom', 'FlaskConical',
      'TestTube', 'Microscope', 'Telescope', 'Dna', 'Magnet', 'Anchor', 'Puzzle',
      'Dices', 'Dice5', 'Crown', 'Gem', 'Key', 'Bomb', 'Skull', 'Ghost',
      'PartyPopper', 'Cake', 'Coffee', 'CupSoda', 'Pizza', 'Utensils', 'Wine',
      'Beer', 'IceCream', 'Apple', 'Cherry', 'Carrot', 'Croissant', 'Soup',
      'Bath', 'Bed', 'Lamp', 'Armchair', 'DoorOpen', 'Key', 'Umbrella', 'Glasses',
      'Watch', 'Shirt', 'Footprints', 'Crown', 'Palette', 'Music', 'Feather',
      'Anvil', 'Swords', 'Shield', 'Tent', 'Trophy', 'Medal', 'Bookmark',
    ],
  },
];

/**
 * Curated, render-safe categories. Each category's `icons` list is filtered to
 * names that exist in the installed lucide version and de-duplicated, so the UI
 * can map over them without guarding for unknown names.
 */
export const ICON_CATEGORIES: IconCategory[] = RAW_CATEGORIES.map((cat) => {
  const seen = new Set<string>();
  const icons = cat.icons.filter((name) => {
    if (seen.has(name) || !KNOWN_NAME_SET.has(name)) {
      return false;
    }
    seen.add(name);
    return true;
  });
  return { id: cat.id, label: cat.label, icons };
});
