import { Timestamp } from 'firebase/firestore';
import { EntityFilter, EntitySort, EntityGroup } from './entity';

/**
 * View
 * Different ways to display entity data (like Airtable views)
 */
export interface View {
  id: string;
  workspaceId: string;
  schemaId: string;
  
  // Basic info
  name: string;
  description?: string;
  icon?: string;
  
  // View type
  type: ViewType;
  config: ViewConfig;
  
  // Data configuration
  visibleFields: string[]; // Field IDs
  fieldOrder: string[];
  hiddenFields: string[];
  
  // Filters
  filters: EntityFilter[];
  filterOperator: 'and' | 'or'; // How to combine filters
  
  // Sorting
  sorts: EntitySort[];
  
  // Grouping
  groups?: EntityGroup[];
  
  // Permissions
  isShared: boolean;
  sharedWith?: string[]; // userIds or 'public'
  permissions: {
    view: string[]; // roles
    edit: string[];
  };
  
  // Personal vs. shared
  isPersonal: boolean; // Personal views only visible to creator
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  
  // Status
  isDefault?: boolean; // Default view for this schema
  status: 'active' | 'archived';
}

export type ViewType =
  | 'table'      // Spreadsheet grid
  | 'kanban'     // Trello-style boards
  | 'calendar'   // Calendar view
  | 'gallery'    // Card gallery
  | 'list'       // Simple list
  | 'form'       // Data entry form
  | 'dashboard'  // Widgets/charts
  | 'timeline'   // Gantt chart
  | 'map';       // Geographic map

/**
 * View Configuration
 * Type-specific settings
 */
export type ViewConfig =
  | TableViewConfig
  | KanbanViewConfig
  | CalendarViewConfig
  | GalleryViewConfig
  | ListViewConfig
  | FormViewConfig
  | DashboardViewConfig
  | TimelineViewConfig
  | MapViewConfig;

export interface TableViewConfig {
  type: 'table';
  
  // Column settings
  columnWidths: Record<string, number>; // fieldId -> width in px
  frozenColumns?: number; // Number of left columns to freeze
  
  // Row settings
  rowHeight: 'compact' | 'comfortable' | 'tall';
  rowNumbers: boolean;
  
  // Features
  enableSearch: boolean;
  enableExport: boolean;
  enableBulkEdit: boolean;
  enableInlineEdit: boolean;
  
  // Pagination
  pageSize: number;
}

export interface KanbanViewConfig {
  type: 'kanban';
  
  // Board settings
  groupByField: string; // Field to use for columns (usually single select)
  cardLayout: KanbanCardLayout;
  
  // Card settings
  coverField?: string; // Image field to use as cover
  displayFields: string[]; // Fields to show on cards
  
  // Features
  enableDragDrop: boolean;
  enableCardClick: boolean;
  
  // Columns
  columnOrder?: string[]; // Option values in custom order
  collapsedColumns?: string[]; // Collapsed column IDs
}

export interface KanbanCardLayout {
  showCover: boolean;
  coverPosition: 'top' | 'side';
  fieldsPosition: 'below' | 'overlay';
  maxFields: number;
}

export interface CalendarViewConfig {
  type: 'calendar';
  
  // Calendar settings
  dateField: string; // Field to use for date
  endDateField?: string; // For date ranges
  
  // Display
  defaultView: 'month' | 'week' | 'day' | 'agenda';
  colorByField?: string; // Field to use for event colors
  
  // Event settings
  eventTitle?: string; // Template for event title
  eventFields: string[]; // Fields to show in event popover
  
  // Features
  enableDragDrop: boolean;
  enableResize: boolean;
}

export interface GalleryViewConfig {
  type: 'gallery';
  
  // Card settings
  cardSize: 'small' | 'medium' | 'large';
  cardsPerRow: number;
  cardAspectRatio: string; // e.g., "16:9", "1:1"
  
  // Content
  coverField?: string; // Image field for card cover
  titleField: string;
  descriptionField?: string;
  displayFields: string[];
  
  // Features
  enableHover: boolean;
  hoverFields?: string[]; // Fields to show on hover
}

export interface ListViewConfig {
  type: 'list';
  
  // List settings
  density: 'compact' | 'comfortable' | 'spacious';
  
  // Item display
  primaryField: string;
  secondaryField?: string;
  iconField?: string;
  avatarField?: string;
  
  // Features
  enableCheckboxes: boolean;
  enableActions: boolean;
  enableSearch: boolean;
}

export interface FormViewConfig {
  type: 'form';
  
  // Form layout
  layout: 'single' | 'two-column' | 'custom';
  sections: FormSection[];
  
  // Submission
  submitButtonText: string;
  successMessage: string;
  redirectUrl?: string;
  sendNotification?: boolean;
  notificationEmails?: string[];
  
  // Appearance
  showLogo: boolean;
  showProgress: boolean;
  allowMultipleSubmissions: boolean;
  
  // Features
  enableAutoSave: boolean;
  enableFileUploads: boolean;
}

export interface FormSection {
  id: string;
  title?: string;
  description?: string;
  fields: string[]; // Field IDs
  collapsed?: boolean;
  conditional?: {
    field: string;
    operator: string;
    value: any;
  };
}

export interface DashboardViewConfig {
  type: 'dashboard';
  
  // Layout
  layout: DashboardLayout;
  widgets: DashboardWidget[];
  
  // Settings
  refreshInterval?: number; // Auto-refresh in seconds
  allowExport: boolean;
}

export interface DashboardLayout {
  type: 'grid' | 'freeform';
  columns: number;
  rowHeight: number;
}

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  
  // Position (for grid layout)
  x: number;
  y: number;
  width: number;
  height: number;
  
  // Configuration
  config: WidgetConfig;
  
  // Data
  dataSource?: {
    schemaId: string;
    filters?: EntityFilter[];
  };
}

export type WidgetType =
  | 'metric'        // Single number
  | 'chart'         // Bar, line, pie, etc.
  | 'table'         // Summary table
  | 'list'          // Recent items
  | 'progress'      // Progress bar
  | 'text'          // Custom text/markdown
  | 'embed';        // Embedded content

export interface WidgetConfig {
  // Metric widget
  metric?: {
    field: string;
    aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max';
    format?: string;
    compareToField?: string; // For trend indicators
  };
  
  // Chart widget
  chart?: {
    chartType: 'bar' | 'line' | 'pie' | 'donut' | 'area' | 'scatter';
    xAxis: string; // Field for X axis
    yAxis: string; // Field for Y axis
    groupBy?: string;
    aggregation?: string;
  };
  
  // Text widget
  text?: {
    content: string; // Markdown
  };
  
  // Embed widget
  embed?: {
    url: string;
    height?: number;
  };
}

export interface TimelineViewConfig {
  type: 'timeline';
  
  // Timeline settings
  startDateField: string;
  endDateField: string;
  titleField: string;
  
  // Display
  groupByField?: string;
  colorByField?: string;
  
  // Zoom
  defaultZoom: 'day' | 'week' | 'month' | 'quarter' | 'year';
  
  // Features
  enableDragDrop: boolean;
  enableResize: boolean;
  showWeekends: boolean;
  showToday: boolean;
}

export interface MapViewConfig {
  type: 'map';
  
  // Location field
  locationField: string; // Address or coordinates
  
  // Map settings
  defaultCenter?: [number, number]; // [lat, lng]
  defaultZoom: number;
  mapStyle: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
  
  // Markers
  markerIcon?: string;
  markerColorField?: string;
  clusterMarkers: boolean;
  
  // Info window
  popupFields: string[];
  popupTemplate?: string;
}

/**
 * View Template
 * Pre-configured views for common use cases
 */
export interface ViewTemplate {
  id: string;
  name: string;
  description: string;
  type: ViewType;
  
  // Preview
  thumbnail?: string;
  
  // Template data
  config: Partial<View>;
  
  // Metadata
  category: string;
  isPopular: boolean;
  usageCount: number;
}


