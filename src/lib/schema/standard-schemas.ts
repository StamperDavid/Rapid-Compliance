// Complete Standard Schema Definitions
// 35 schemas: 10 CRM Core + 13 Industry Vertical + 12 Platform Core

// ============================================================================
// CRM CORE SCHEMAS (10)
// ============================================================================

export const STANDARD_SCHEMAS = {
  leads: {
    id: 'leads',
    name: 'Lead',
    pluralName: 'Leads',
    singularName: 'Lead',
    icon: '🎯',
    fields: [
      { id: 'f1', key: 'first_name', label: 'First Name', type: 'text', required: true },
      { id: 'f2', key: 'last_name', label: 'Last Name', type: 'text', required: true },
      { id: 'f3', key: 'email', label: 'Email', type: 'email', required: true },
      { id: 'f4', key: 'phone', label: 'Phone', type: 'phoneNumber', required: false },
      { id: 'f5', key: 'company', label: 'Company', type: 'text', required: false },
      { id: 'f6', key: 'title', label: 'Job Title', type: 'text', required: false },
      { id: 'f7', key: 'lead_source', label: 'Lead Source', type: 'singleSelect', required: false, options: ['Website', 'Referral', 'Cold Call', 'Social Media', 'Email Campaign', 'Trade Show', 'Other'] },
      { id: 'f8', key: 'lead_status', label: 'Status', type: 'singleSelect', required: true, options: ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted'] },
      { id: 'f9', key: 'rating', label: 'Rating', type: 'singleSelect', required: false, options: ['Hot', 'Warm', 'Cold'] },
      { id: 'f10', key: 'estimated_value', label: 'Estimated Value', type: 'currency', required: false },
      { id: 'f11', key: 'notes', label: 'Notes', type: 'longText', required: false }
    ]
  },

  companies: {
    id: 'companies',
    name: 'Company',
    pluralName: 'Companies',
    singularName: 'Company',
    icon: '🏢',
    fields: [
      { id: 'f1', key: 'name', label: 'Company Name', type: 'text', required: true },
      { id: 'f2', key: 'website', label: 'Website', type: 'url', required: false },
      { id: 'f3', key: 'phone', label: 'Phone', type: 'phoneNumber', required: false },
      { id: 'f4', key: 'email', label: 'Email', type: 'email', required: false },
      { id: 'f5', key: 'industry', label: 'Industry', type: 'singleSelect', required: false },
      { id: 'f6', key: 'employee_count', label: 'Employee Count', type: 'number', required: false },
      { id: 'f7', key: 'annual_revenue', label: 'Annual Revenue', type: 'currency', required: false },
      { id: 'f8', key: 'address', label: 'Address', type: 'longText', required: false },
      { id: 'f9', key: 'city', label: 'City', type: 'text', required: false },
      { id: 'f10', key: 'state', label: 'State', type: 'text', required: false },
      { id: 'f11', key: 'country', label: 'Country', type: 'text', required: false },
      { id: 'f12', key: 'zip', label: 'ZIP Code', type: 'text', required: false },
      { id: 'f13', key: 'status', label: 'Status', type: 'singleSelect', required: true }
    ]
  },

  contacts: {
    id: 'contacts',
    name: 'Contact',
    pluralName: 'Contacts',
    singularName: 'Contact',
    icon: '👤',
    fields: [
      { id: 'f1', key: 'first_name', label: 'First Name', type: 'text', required: true },
      { id: 'f2', key: 'last_name', label: 'Last Name', type: 'text', required: true },
      { id: 'f3', key: 'email', label: 'Email', type: 'email', required: true },
      { id: 'f4', key: 'phone', label: 'Phone', type: 'phoneNumber', required: false },
      { id: 'f5', key: 'mobile', label: 'Mobile', type: 'phoneNumber', required: false },
      { id: 'f6', key: 'title', label: 'Job Title', type: 'text', required: false },
      { id: 'f7', key: 'company_id', label: 'Company', type: 'lookup', required: false, config: { linkedSchema: 'companies' } },
      { id: 'f8', key: 'linkedin', label: 'LinkedIn', type: 'url', required: false },
      { id: 'f9', key: 'status', label: 'Status', type: 'singleSelect', required: true }
    ]
  },

  deals: {
    id: 'deals',
    name: 'Deal',
    pluralName: 'Deals',
    singularName: 'Deal',
    icon: '💼',
    fields: [
      { id: 'f1', key: 'name', label: 'Deal Name', type: 'text', required: true },
      { id: 'f2', key: 'company_id', label: 'Company', type: 'lookup', required: true, config: { linkedSchema: 'companies' } },
      { id: 'f3', key: 'contact_id', label: 'Primary Contact', type: 'lookup', required: false, config: { linkedSchema: 'contacts' } },
      { id: 'f4', key: 'amount', label: 'Amount', type: 'currency', required: true },
      { id: 'f5', key: 'stage', label: 'Stage', type: 'singleSelect', required: true },
      { id: 'f6', key: 'probability', label: 'Probability', type: 'percent', required: false },
      { id: 'f7', key: 'expected_close_date', label: 'Expected Close Date', type: 'date', required: true },
      { id: 'f8', key: 'actual_close_date', label: 'Actual Close Date', type: 'date', required: false },
      { id: 'f9', key: 'description', label: 'Description', type: 'longText', required: false },
      { id: 'f10', key: 'next_step', label: 'Next Step', type: 'text', required: false },
      { id: 'f11', key: 'lost_reason', label: 'Lost Reason', type: 'text', required: false }
    ]
  },

  products: {
    id: 'products',
    name: 'Product',
    pluralName: 'Products',
    singularName: 'Product',
    icon: '📦',
    fields: [
      { id: 'f1', key: 'name', label: 'Product Name', type: 'text', required: true },
      { id: 'f2', key: 'sku', label: 'SKU', type: 'text', required: true },
      { id: 'f3', key: 'description', label: 'Description', type: 'longText', required: false },
      { id: 'f4', key: 'price', label: 'Price', type: 'currency', required: true },
      { id: 'f5', key: 'cost', label: 'Cost', type: 'currency', required: false },
      { id: 'f6', key: 'category', label: 'Category', type: 'singleSelect', required: false },
      { id: 'f7', key: 'active', label: 'Active', type: 'checkbox', required: true },
      { id: 'f8', key: 'stock_quantity', label: 'Stock Quantity', type: 'number', required: false },
      { id: 'f9', key: 'unit', label: 'Unit', type: 'text', required: false }
    ]
  },

  quotes: {
    id: 'quotes',
    name: 'Quote',
    pluralName: 'Quotes',
    singularName: 'Quote',
    icon: '📄',
    fields: [
      { id: 'f1', key: 'quote_number', label: 'Quote Number', type: 'text', required: true },
      { id: 'f2', key: 'company_id', label: 'Company', type: 'lookup', required: true, config: { linkedSchema: 'companies' } },
      { id: 'f3', key: 'contact_id', label: 'Contact', type: 'lookup', required: false, config: { linkedSchema: 'contacts' } },
      { id: 'f4', key: 'deal_id', label: 'Related Deal', type: 'lookup', required: false, config: { linkedSchema: 'deals' } },
      { id: 'f5', key: 'quote_date', label: 'Quote Date', type: 'date', required: true },
      { id: 'f6', key: 'expiry_date', label: 'Expiry Date', type: 'date', required: true },
      { id: 'f7', key: 'subtotal', label: 'Subtotal', type: 'currency', required: true },
      { id: 'f8', key: 'tax', label: 'Tax', type: 'currency', required: false },
      { id: 'f9', key: 'discount', label: 'Discount', type: 'currency', required: false },
      { id: 'f10', key: 'total', label: 'Total', type: 'currency', required: true },
      { id: 'f11', key: 'status', label: 'Status', type: 'singleSelect', required: true },
      { id: 'f12', key: 'notes', label: 'Notes', type: 'longText', required: false }
    ]
  },

  invoices: {
    id: 'invoices',
    name: 'Invoice',
    pluralName: 'Invoices',
    singularName: 'Invoice',
    icon: '🧾',
    fields: [
      { id: 'f1', key: 'invoice_number', label: 'Invoice Number', type: 'text', required: true },
      { id: 'f2', key: 'company_id', label: 'Company', type: 'lookup', required: true, config: { linkedSchema: 'companies' } },
      { id: 'f3', key: 'contact_id', label: 'Contact', type: 'lookup', required: false, config: { linkedSchema: 'contacts' } },
      { id: 'f4', key: 'deal_id', label: 'Related Deal', type: 'lookup', required: false, config: { linkedSchema: 'deals' } },
      { id: 'f5', key: 'quote_id', label: 'Related Quote', type: 'lookup', required: false, config: { linkedSchema: 'quotes' } },
      { id: 'f6', key: 'invoice_date', label: 'Invoice Date', type: 'date', required: true },
      { id: 'f7', key: 'due_date', label: 'Due Date', type: 'date', required: true },
      { id: 'f8', key: 'subtotal', label: 'Subtotal', type: 'currency', required: true },
      { id: 'f9', key: 'tax', label: 'Tax', type: 'currency', required: false },
      { id: 'f10', key: 'total', label: 'Total', type: 'currency', required: true },
      { id: 'f11', key: 'paid_amount', label: 'Paid Amount', type: 'currency', required: false },
      { id: 'f12', key: 'balance', label: 'Balance', type: 'currency', required: false },
      { id: 'f13', key: 'status', label: 'Status', type: 'singleSelect', required: true },
      { id: 'f14', key: 'payment_terms', label: 'Payment Terms', type: 'text', required: false },
      { id: 'f15', key: 'notes', label: 'Notes', type: 'longText', required: false }
    ]
  },

  payments: {
    id: 'payments',
    name: 'Payment',
    pluralName: 'Payments',
    singularName: 'Payment',
    icon: '💳',
    fields: [
      { id: 'f1', key: 'payment_number', label: 'Payment Number', type: 'text', required: true },
      { id: 'f2', key: 'invoice_id', label: 'Invoice', type: 'lookup', required: true, config: { linkedSchema: 'invoices' } },
      { id: 'f3', key: 'payment_date', label: 'Payment Date', type: 'date', required: true },
      { id: 'f4', key: 'amount', label: 'Amount', type: 'currency', required: true },
      { id: 'f5', key: 'payment_method', label: 'Payment Method', type: 'singleSelect', required: true },
      { id: 'f6', key: 'transaction_id', label: 'Transaction ID', type: 'text', required: false },
      { id: 'f7', key: 'notes', label: 'Notes', type: 'longText', required: false },
      { id: 'f8', key: 'status', label: 'Status', type: 'singleSelect', required: true }
    ]
  },

  orders: {
    id: 'orders',
    name: 'Order',
    pluralName: 'Orders',
    singularName: 'Order',
    icon: '📋',
    fields: [
      { id: 'f1', key: 'order_number', label: 'Order Number', type: 'text', required: true },
      { id: 'f2', key: 'company_id', label: 'Company', type: 'lookup', required: true, config: { linkedSchema: 'companies' } },
      { id: 'f3', key: 'contact_id', label: 'Contact', type: 'lookup', required: false, config: { linkedSchema: 'contacts' } },
      { id: 'f4', key: 'quote_id', label: 'Related Quote', type: 'lookup', required: false, config: { linkedSchema: 'quotes' } },
      { id: 'f5', key: 'order_date', label: 'Order Date', type: 'date', required: true },
      { id: 'f6', key: 'expected_delivery', label: 'Expected Delivery', type: 'date', required: false },
      { id: 'f7', key: 'subtotal', label: 'Subtotal', type: 'currency', required: true },
      { id: 'f8', key: 'tax', label: 'Tax', type: 'currency', required: false },
      { id: 'f9', key: 'shipping', label: 'Shipping', type: 'currency', required: false },
      { id: 'f10', key: 'total', label: 'Total', type: 'currency', required: true },
      { id: 'f11', key: 'status', label: 'Status', type: 'singleSelect', required: true },
      { id: 'f12', key: 'shipping_address', label: 'Shipping Address', type: 'longText', required: false },
      { id: 'f13', key: 'notes', label: 'Notes', type: 'longText', required: false }
    ]
  },

  tasks: {
    id: 'tasks',
    name: 'Task',
    pluralName: 'Tasks',
    singularName: 'Task',
    icon: '✅',
    fields: [
      { id: 'f1', key: 'subject', label: 'Subject', type: 'text', required: true },
      { id: 'f2', key: 'description', label: 'Description', type: 'longText', required: false },
      { id: 'f3', key: 'due_date', label: 'Due Date', type: 'date', required: true },
      { id: 'f4', key: 'priority', label: 'Priority', type: 'singleSelect', required: true },
      { id: 'f5', key: 'status', label: 'Status', type: 'singleSelect', required: true },
      { id: 'f6', key: 'related_to_type', label: 'Related To Type', type: 'singleSelect', required: false },
      { id: 'f7', key: 'related_to_id', label: 'Related To ID', type: 'text', required: false },
      { id: 'f8', key: 'completed_date', label: 'Completed Date', type: 'date', required: false }
    ]
  },

  // ============================================================================
  // INDUSTRY: TRANSPORTATION & COMPLIANCE (3)
  // ============================================================================

  drivers: {
    id: 'drivers',
    name: 'Driver',
    pluralName: 'Drivers',
    singularName: 'Driver',
    icon: '🚛',
    fields: [
      { id: 'f1', key: 'name', label: 'Driver Name', type: 'text', required: true },
      { id: 'f2', key: 'license_number', label: 'License Number', type: 'text', required: true },
      { id: 'f3', key: 'license_expiry', label: 'License Expiry', type: 'date', required: true },
      { id: 'f4', key: 'company_id', label: 'Company', type: 'lookup', required: false, config: { linkedSchema: 'companies' } },
      { id: 'f5', key: 'phone', label: 'Phone', type: 'phoneNumber', required: false },
      { id: 'f6', key: 'email', label: 'Email', type: 'email', required: false },
      { id: 'f7', key: 'status', label: 'Status', type: 'singleSelect', required: true, options: ['Active', 'Inactive', 'Suspended', 'Expired'] }
    ]
  },

  vehicles: {
    id: 'vehicles',
    name: 'Vehicle',
    pluralName: 'Vehicles',
    singularName: 'Vehicle',
    icon: '🚚',
    fields: [
      { id: 'f1', key: 'vehicle_number', label: 'Vehicle Number', type: 'text', required: true },
      { id: 'f2', key: 'vin', label: 'VIN', type: 'text', required: true },
      { id: 'f3', key: 'make', label: 'Make', type: 'text', required: false },
      { id: 'f4', key: 'model', label: 'Model', type: 'text', required: false },
      { id: 'f5', key: 'year', label: 'Year', type: 'number', required: false },
      { id: 'f6', key: 'company_id', label: 'Company', type: 'lookup', required: false, config: { linkedSchema: 'companies' } },
      { id: 'f7', key: 'inspection_due', label: 'Inspection Due', type: 'date', required: false },
      { id: 'f8', key: 'status', label: 'Status', type: 'singleSelect', required: true, options: ['Active', 'In Maintenance', 'Out of Service', 'Retired'] }
    ]
  },

  compliance_documents: {
    id: 'compliance_documents',
    name: 'Compliance Document',
    pluralName: 'Compliance Documents',
    singularName: 'Compliance Document',
    icon: '📑',
    fields: [
      { id: 'f1', key: 'document_type', label: 'Document Type', type: 'singleSelect', required: true, options: ['CDL', 'Medical Card', 'MVR', 'Drug Test', 'Insurance', 'Registration', 'Permit', 'Other'] },
      { id: 'f2', key: 'company_id', label: 'Company', type: 'lookup', required: false, config: { linkedSchema: 'companies' } },
      { id: 'f3', key: 'driver_id', label: 'Driver', type: 'lookup', required: false, config: { linkedSchema: 'drivers' } },
      { id: 'f4', key: 'vehicle_id', label: 'Vehicle', type: 'lookup', required: false, config: { linkedSchema: 'vehicles' } },
      { id: 'f5', key: 'issue_date', label: 'Issue Date', type: 'date', required: true },
      { id: 'f6', key: 'expiry_date', label: 'Expiry Date', type: 'date', required: true },
      { id: 'f7', key: 'status', label: 'Status', type: 'singleSelect', required: true, options: ['Valid', 'Expiring Soon', 'Expired', 'Pending Review'] },
      { id: 'f8', key: 'notes', label: 'Notes', type: 'longText', required: false }
    ]
  },

  // ============================================================================
  // INDUSTRY: SERVICE BUSINESS (2)
  // ============================================================================

  projects: {
    id: 'projects',
    name: 'Project',
    pluralName: 'Projects',
    singularName: 'Project',
    icon: '📐',
    fields: [
      { id: 'f1', key: 'name', label: 'Project Name', type: 'text', required: true },
      { id: 'f2', key: 'company_id', label: 'Company', type: 'lookup', required: false, config: { linkedSchema: 'companies' } },
      { id: 'f3', key: 'contact_id', label: 'Primary Contact', type: 'lookup', required: false, config: { linkedSchema: 'contacts' } },
      { id: 'f4', key: 'start_date', label: 'Start Date', type: 'date', required: true },
      { id: 'f5', key: 'end_date', label: 'End Date', type: 'date', required: false },
      { id: 'f6', key: 'budget', label: 'Budget', type: 'currency', required: false },
      { id: 'f7', key: 'status', label: 'Status', type: 'singleSelect', required: true, options: ['Planning', 'In Progress', 'On Hold', 'Completed', 'Cancelled'] },
      { id: 'f8', key: 'description', label: 'Description', type: 'longText', required: false }
    ]
  },

  time_entries: {
    id: 'time_entries',
    name: 'Time Entry',
    pluralName: 'Time Entries',
    singularName: 'Time Entry',
    icon: '⏱️',
    fields: [
      { id: 'f1', key: 'project_id', label: 'Project', type: 'lookup', required: true, config: { linkedSchema: 'projects' } },
      { id: 'f2', key: 'date', label: 'Date', type: 'date', required: true },
      { id: 'f3', key: 'hours', label: 'Hours', type: 'number', required: true },
      { id: 'f4', key: 'description', label: 'Description', type: 'longText', required: false },
      { id: 'f5', key: 'billable', label: 'Billable', type: 'checkbox', required: true },
      { id: 'f6', key: 'rate', label: 'Rate', type: 'currency', required: false }
    ]
  },

  // ============================================================================
  // INDUSTRY: E-COMMERCE (2)
  // ============================================================================

  customers: {
    id: 'customers',
    name: 'Customer',
    pluralName: 'Customers',
    singularName: 'Customer',
    icon: '🛒',
    fields: [
      { id: 'f1', key: 'email', label: 'Email', type: 'email', required: true },
      { id: 'f2', key: 'first_name', label: 'First Name', type: 'text', required: true },
      { id: 'f3', key: 'last_name', label: 'Last Name', type: 'text', required: true },
      { id: 'f4', key: 'phone', label: 'Phone', type: 'phoneNumber', required: false },
      { id: 'f5', key: 'total_orders', label: 'Total Orders', type: 'number', required: false },
      { id: 'f6', key: 'lifetime_value', label: 'Lifetime Value', type: 'currency', required: false },
      { id: 'f7', key: 'status', label: 'Status', type: 'singleSelect', required: true, options: ['Active', 'Inactive', 'VIP', 'Churned'] }
    ]
  },

  inventory: {
    id: 'inventory',
    name: 'Inventory Item',
    pluralName: 'Inventory',
    singularName: 'Inventory Item',
    icon: '📊',
    fields: [
      { id: 'f1', key: 'product_id', label: 'Product', type: 'lookup', required: true, config: { linkedSchema: 'products' } },
      { id: 'f2', key: 'quantity', label: 'Quantity', type: 'number', required: true },
      { id: 'f3', key: 'location', label: 'Location', type: 'text', required: false },
      { id: 'f4', key: 'reorder_point', label: 'Reorder Point', type: 'number', required: false },
      { id: 'f5', key: 'status', label: 'Status', type: 'singleSelect', required: true, options: ['In Stock', 'Low Stock', 'Out of Stock', 'Discontinued'] }
    ]
  },

  // ============================================================================
  // INDUSTRY: REAL ESTATE (2)
  // ============================================================================

  properties: {
    id: 'properties',
    name: 'Property',
    pluralName: 'Properties',
    singularName: 'Property',
    icon: '🏠',
    fields: [
      { id: 'f1', key: 'address', label: 'Address', type: 'text', required: true },
      { id: 'f2', key: 'price', label: 'Price', type: 'currency', required: true },
      { id: 'f3', key: 'bedrooms', label: 'Bedrooms', type: 'number', required: false },
      { id: 'f4', key: 'bathrooms', label: 'Bathrooms', type: 'number', required: false },
      { id: 'f5', key: 'sqft', label: 'Square Feet', type: 'number', required: false },
      { id: 'f6', key: 'property_type', label: 'Property Type', type: 'singleSelect', required: true, options: ['Single Family', 'Condo', 'Townhouse', 'Multi-Family', 'Commercial', 'Land'] },
      { id: 'f7', key: 'status', label: 'Status', type: 'singleSelect', required: true, options: ['Available', 'Under Contract', 'Sold', 'Off Market'] },
      { id: 'f8', key: 'description', label: 'Description', type: 'longText', required: false }
    ]
  },

  showings: {
    id: 'showings',
    name: 'Showing',
    pluralName: 'Showings',
    singularName: 'Showing',
    icon: '🔑',
    fields: [
      { id: 'f1', key: 'property_id', label: 'Property', type: 'lookup', required: true, config: { linkedSchema: 'properties' } },
      { id: 'f2', key: 'contact_id', label: 'Contact', type: 'lookup', required: true, config: { linkedSchema: 'contacts' } },
      { id: 'f3', key: 'date_time', label: 'Date & Time', type: 'dateTime', required: true },
      { id: 'f4', key: 'status', label: 'Status', type: 'singleSelect', required: true, options: ['Scheduled', 'Completed', 'Cancelled', 'No Show'] },
      { id: 'f5', key: 'feedback', label: 'Feedback', type: 'longText', required: false }
    ]
  },

  // ============================================================================
  // INDUSTRY: LEGAL SERVICES (2)
  // ============================================================================

  cases: {
    id: 'cases',
    name: 'Case',
    pluralName: 'Cases',
    singularName: 'Case',
    icon: '⚖️',
    fields: [
      { id: 'f1', key: 'case_number', label: 'Case Number', type: 'text', required: true },
      { id: 'f2', key: 'client_id', label: 'Client', type: 'lookup', required: true, config: { linkedSchema: 'contacts' } },
      { id: 'f3', key: 'case_type', label: 'Case Type', type: 'singleSelect', required: true, options: ['Civil', 'Criminal', 'Family', 'Corporate', 'Immigration', 'Personal Injury', 'Real Estate', 'Other'] },
      { id: 'f4', key: 'filing_date', label: 'Filing Date', type: 'date', required: false },
      { id: 'f5', key: 'court', label: 'Court', type: 'text', required: false },
      { id: 'f6', key: 'status', label: 'Status', type: 'singleSelect', required: true, options: ['Open', 'In Discovery', 'In Trial', 'Settled', 'Closed', 'Appealed'] },
      { id: 'f7', key: 'description', label: 'Description', type: 'longText', required: false }
    ]
  },

  billing_entries: {
    id: 'billing_entries',
    name: 'Billing Entry',
    pluralName: 'Billing Entries',
    singularName: 'Billing Entry',
    icon: '💰',
    fields: [
      { id: 'f1', key: 'case_id', label: 'Case', type: 'lookup', required: true, config: { linkedSchema: 'cases' } },
      { id: 'f2', key: 'date', label: 'Date', type: 'date', required: true },
      { id: 'f3', key: 'hours', label: 'Hours', type: 'number', required: true },
      { id: 'f4', key: 'rate', label: 'Rate', type: 'currency', required: true },
      { id: 'f5', key: 'description', label: 'Description', type: 'longText', required: false },
      { id: 'f6', key: 'billable', label: 'Billable', type: 'checkbox', required: true }
    ]
  },

  // ============================================================================
  // INDUSTRY: HEALTHCARE / WELLNESS (2)
  // ============================================================================

  patients: {
    id: 'patients',
    name: 'Patient',
    pluralName: 'Patients',
    singularName: 'Patient',
    icon: '🏥',
    fields: [
      { id: 'f1', key: 'first_name', label: 'First Name', type: 'text', required: true },
      { id: 'f2', key: 'last_name', label: 'Last Name', type: 'text', required: true },
      { id: 'f3', key: 'email', label: 'Email', type: 'email', required: false },
      { id: 'f4', key: 'phone', label: 'Phone', type: 'phoneNumber', required: true },
      { id: 'f5', key: 'date_of_birth', label: 'Date of Birth', type: 'date', required: false },
      { id: 'f6', key: 'insurance_provider', label: 'Insurance Provider', type: 'text', required: false },
      { id: 'f7', key: 'status', label: 'Status', type: 'singleSelect', required: true, options: ['Active', 'Inactive', 'New'] }
    ]
  },

  appointments: {
    id: 'appointments',
    name: 'Appointment',
    pluralName: 'Appointments',
    singularName: 'Appointment',
    icon: '📅',
    fields: [
      { id: 'f1', key: 'patient_id', label: 'Patient', type: 'lookup', required: true, config: { linkedSchema: 'patients' } },
      { id: 'f2', key: 'date_time', label: 'Date & Time', type: 'dateTime', required: true },
      { id: 'f3', key: 'appointment_type', label: 'Type', type: 'singleSelect', required: true, options: ['Consultation', 'Follow-Up', 'Procedure', 'Emergency', 'Telehealth'] },
      { id: 'f4', key: 'status', label: 'Status', type: 'singleSelect', required: true, options: ['Scheduled', 'Checked In', 'In Progress', 'Completed', 'Cancelled', 'No Show'] },
      { id: 'f5', key: 'notes', label: 'Notes', type: 'longText', required: false }
    ]
  },

  // ============================================================================
  // PLATFORM CORE SCHEMAS (12)
  // ============================================================================

  activities: {
    id: 'activities',
    name: 'Activity',
    pluralName: 'Activities',
    singularName: 'Activity',
    icon: '📞',
    fields: [
      { id: 'f1', key: 'subject', label: 'Subject', type: 'text', required: true },
      { id: 'f2', key: 'type', label: 'Type', type: 'singleSelect', required: true, options: ['Call', 'Email', 'Meeting', 'Note', 'Task'] },
      { id: 'f3', key: 'direction', label: 'Direction', type: 'singleSelect', required: false, options: ['Inbound', 'Outbound'] },
      { id: 'f4', key: 'related_to_type', label: 'Related To Type', type: 'singleSelect', required: false, options: ['Lead', 'Contact', 'Company', 'Deal'] },
      { id: 'f5', key: 'related_to_id', label: 'Related To ID', type: 'text', required: false },
      { id: 'f6', key: 'due_date', label: 'Due Date', type: 'date', required: false },
      { id: 'f7', key: 'completed', label: 'Completed', type: 'checkbox', required: false },
      { id: 'f8', key: 'description', label: 'Description', type: 'longText', required: false }
    ]
  },

  campaigns: {
    id: 'campaigns',
    name: 'Campaign',
    pluralName: 'Campaigns',
    singularName: 'Campaign',
    icon: '📣',
    fields: [
      { id: 'f1', key: 'name', label: 'Name', type: 'text', required: true },
      { id: 'f2', key: 'type', label: 'Type', type: 'singleSelect', required: true, options: ['Email', 'Social Media', 'SMS', 'Direct Mail', 'Event', 'Webinar', 'Other'] },
      { id: 'f3', key: 'status', label: 'Status', type: 'singleSelect', required: true, options: ['Draft', 'Scheduled', 'Active', 'Paused', 'Completed', 'Cancelled'] },
      { id: 'f4', key: 'start_date', label: 'Start Date', type: 'date', required: false },
      { id: 'f5', key: 'end_date', label: 'End Date', type: 'date', required: false },
      { id: 'f6', key: 'audience_size', label: 'Audience Size', type: 'number', required: false },
      { id: 'f7', key: 'budget', label: 'Budget', type: 'currency', required: false },
      { id: 'f8', key: 'open_rate', label: 'Open Rate', type: 'percent', required: false },
      { id: 'f9', key: 'description', label: 'Description', type: 'longText', required: false }
    ]
  },

  sequences: {
    id: 'sequences',
    name: 'Sequence',
    pluralName: 'Sequences',
    singularName: 'Sequence',
    icon: '🔄',
    fields: [
      { id: 'f1', key: 'name', label: 'Name', type: 'text', required: true },
      { id: 'f2', key: 'status', label: 'Status', type: 'singleSelect', required: true, options: ['Draft', 'Active', 'Paused', 'Archived'] },
      { id: 'f3', key: 'steps_count', label: 'Steps Count', type: 'number', required: false },
      { id: 'f4', key: 'enrollment_count', label: 'Enrollment Count', type: 'number', required: false },
      { id: 'f5', key: 'trigger_type', label: 'Trigger Type', type: 'singleSelect', required: false, options: ['Manual', 'Form Submission', 'Tag Added', 'Deal Stage Change', 'API'] },
      { id: 'f6', key: 'start_date', label: 'Start Date', type: 'date', required: false },
      { id: 'f7', key: 'description', label: 'Description', type: 'longText', required: false }
    ]
  },

  workflows: {
    id: 'workflows',
    name: 'Workflow',
    pluralName: 'Workflows',
    singularName: 'Workflow',
    icon: '⚙️',
    fields: [
      { id: 'f1', key: 'name', label: 'Name', type: 'text', required: true },
      { id: 'f2', key: 'status', label: 'Status', type: 'singleSelect', required: true, options: ['Draft', 'Active', 'Paused', 'Archived'] },
      { id: 'f3', key: 'trigger_type', label: 'Trigger Type', type: 'singleSelect', required: false, options: ['Record Created', 'Record Updated', 'Field Changed', 'Schedule', 'Webhook', 'Manual'] },
      { id: 'f4', key: 'last_run', label: 'Last Run', type: 'dateTime', required: false },
      { id: 'f5', key: 'run_count', label: 'Run Count', type: 'number', required: false },
      { id: 'f6', key: 'created_by', label: 'Created By', type: 'text', required: false },
      { id: 'f7', key: 'description', label: 'Description', type: 'longText', required: false }
    ]
  },

  forms: {
    id: 'forms',
    name: 'Form',
    pluralName: 'Forms',
    singularName: 'Form',
    icon: '📝',
    fields: [
      { id: 'f1', key: 'name', label: 'Name', type: 'text', required: true },
      { id: 'f2', key: 'status', label: 'Status', type: 'singleSelect', required: true, options: ['Draft', 'Published', 'Archived'] },
      { id: 'f3', key: 'fields_count', label: 'Fields Count', type: 'number', required: false },
      { id: 'f4', key: 'submissions_count', label: 'Submissions Count', type: 'number', required: false },
      { id: 'f5', key: 'redirect_url', label: 'Redirect URL', type: 'url', required: false },
      { id: 'f6', key: 'published', label: 'Published', type: 'checkbox', required: false }
    ]
  },

  pages: {
    id: 'pages',
    name: 'Page',
    pluralName: 'Pages',
    singularName: 'Page',
    icon: '🌐',
    fields: [
      { id: 'f1', key: 'title', label: 'Title', type: 'text', required: true },
      { id: 'f2', key: 'slug', label: 'Slug', type: 'text', required: true },
      { id: 'f3', key: 'status', label: 'Status', type: 'singleSelect', required: true, options: ['Draft', 'Published', 'Archived'] },
      { id: 'f4', key: 'template', label: 'Template', type: 'singleSelect', required: false, options: ['Blank', 'Landing Page', 'About', 'Contact', 'Pricing', 'Custom'] },
      { id: 'f5', key: 'seo_title', label: 'SEO Title', type: 'text', required: false },
      { id: 'f6', key: 'published_at', label: 'Published At', type: 'dateTime', required: false }
    ]
  },

  blog_posts: {
    id: 'blog_posts',
    name: 'Blog Post',
    pluralName: 'Blog Posts',
    singularName: 'Blog Post',
    icon: '✍️',
    fields: [
      { id: 'f1', key: 'title', label: 'Title', type: 'text', required: true },
      { id: 'f2', key: 'slug', label: 'Slug', type: 'text', required: true },
      { id: 'f3', key: 'author', label: 'Author', type: 'text', required: false },
      { id: 'f4', key: 'category', label: 'Category', type: 'singleSelect', required: false, options: ['News', 'Tutorial', 'Case Study', 'Industry', 'Product Update', 'Other'] },
      { id: 'f5', key: 'status', label: 'Status', type: 'singleSelect', required: true, options: ['Draft', 'In Review', 'Published', 'Archived'] },
      { id: 'f6', key: 'published_at', label: 'Published At', type: 'dateTime', required: false },
      { id: 'f7', key: 'featured', label: 'Featured', type: 'checkbox', required: false }
    ]
  },

  domains: {
    id: 'domains',
    name: 'Domain',
    pluralName: 'Domains',
    singularName: 'Domain',
    icon: '🔗',
    fields: [
      { id: 'f1', key: 'domain_name', label: 'Domain Name', type: 'text', required: true },
      { id: 'f2', key: 'status', label: 'Status', type: 'singleSelect', required: true, options: ['Active', 'Pending', 'Expired', 'Suspended'] },
      { id: 'f3', key: 'verified', label: 'Verified', type: 'checkbox', required: false },
      { id: 'f4', key: 'ssl_status', label: 'SSL Status', type: 'singleSelect', required: false, options: ['Active', 'Pending', 'Expired', 'None'] },
      { id: 'f5', key: 'primary', label: 'Primary', type: 'checkbox', required: false },
      { id: 'f6', key: 'added_date', label: 'Added Date', type: 'date', required: false }
    ]
  },

  coupons: {
    id: 'coupons',
    name: 'Coupon',
    pluralName: 'Coupons',
    singularName: 'Coupon',
    icon: '🏷️',
    fields: [
      { id: 'f1', key: 'code', label: 'Code', type: 'text', required: true },
      { id: 'f2', key: 'discount_type', label: 'Discount Type', type: 'singleSelect', required: true, options: ['Percentage', 'Fixed Amount', 'Free Shipping'] },
      { id: 'f3', key: 'value', label: 'Value', type: 'number', required: true },
      { id: 'f4', key: 'usage_count', label: 'Usage Count', type: 'number', required: false },
      { id: 'f5', key: 'max_uses', label: 'Max Uses', type: 'number', required: false },
      { id: 'f6', key: 'expiry_date', label: 'Expiry Date', type: 'date', required: false },
      { id: 'f7', key: 'status', label: 'Status', type: 'singleSelect', required: true, options: ['Active', 'Expired', 'Disabled'] }
    ]
  },

  proposals: {
    id: 'proposals',
    name: 'Proposal',
    pluralName: 'Proposals',
    singularName: 'Proposal',
    icon: '📑',
    fields: [
      { id: 'f1', key: 'title', label: 'Title', type: 'text', required: true },
      { id: 'f2', key: 'company_id', label: 'Company', type: 'lookup', required: false, config: { linkedSchema: 'companies' } },
      { id: 'f3', key: 'contact_id', label: 'Contact', type: 'lookup', required: false, config: { linkedSchema: 'contacts' } },
      { id: 'f4', key: 'amount', label: 'Amount', type: 'currency', required: false },
      { id: 'f5', key: 'status', label: 'Status', type: 'singleSelect', required: true, options: ['Draft', 'Sent', 'Viewed', 'Accepted', 'Declined', 'Expired'] },
      { id: 'f6', key: 'sent_date', label: 'Sent Date', type: 'date', required: false },
      { id: 'f7', key: 'expiry_date', label: 'Expiry Date', type: 'date', required: false },
      { id: 'f8', key: 'description', label: 'Description', type: 'longText', required: false }
    ]
  },

  subscriptions: {
    id: 'subscriptions',
    name: 'Subscription',
    pluralName: 'Subscriptions',
    singularName: 'Subscription',
    icon: '🔁',
    fields: [
      { id: 'f1', key: 'customer_id', label: 'Customer', type: 'lookup', required: true, config: { linkedSchema: 'contacts' } },
      { id: 'f2', key: 'plan', label: 'Plan', type: 'text', required: true },
      { id: 'f3', key: 'status', label: 'Status', type: 'singleSelect', required: true, options: ['Active', 'Past Due', 'Cancelled', 'Trialing', 'Paused'] },
      { id: 'f4', key: 'start_date', label: 'Start Date', type: 'date', required: true },
      { id: 'f5', key: 'renewal_date', label: 'Renewal Date', type: 'date', required: false },
      { id: 'f6', key: 'mrr', label: 'MRR', type: 'currency', required: false }
    ]
  },

  email_templates: {
    id: 'email_templates',
    name: 'Email Template',
    pluralName: 'Email Templates',
    singularName: 'Email Template',
    icon: '✉️',
    fields: [
      { id: 'f1', key: 'name', label: 'Name', type: 'text', required: true },
      { id: 'f2', key: 'subject', label: 'Subject', type: 'text', required: true },
      { id: 'f3', key: 'category', label: 'Category', type: 'singleSelect', required: false, options: ['Sales', 'Marketing', 'Support', 'Onboarding', 'Follow-Up', 'Newsletter', 'Other'] },
      { id: 'f4', key: 'status', label: 'Status', type: 'singleSelect', required: true, options: ['Draft', 'Active', 'Archived'] },
      { id: 'f5', key: 'usage_count', label: 'Usage Count', type: 'number', required: false }
    ]
  }
};

// ============================================================================
// PICKLIST VALUES
// ============================================================================

export const PICKLIST_VALUES = {
  // --- CRM Core ---
  lead_source: ['Website', 'Referral', 'Cold Call', 'Social Media', 'Email Campaign', 'Trade Show', 'Other'],
  lead_status: ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted'],
  lead_rating: ['Hot', 'Warm', 'Cold'],
  industry: ['Technology', 'Finance', 'Manufacturing', 'Retail', 'Services', 'Transportation', 'Real Estate', 'Other'],
  company_status: ['Active', 'Inactive', 'Prospect'],
  contact_status: ['Active', 'Inactive'],
  deal_stage: ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'],
  product_category: ['Hardware', 'Software', 'Service', 'Subscription'],
  quote_status: ['Draft', 'Sent', 'Accepted', 'Declined', 'Expired'],
  invoice_status: ['Draft', 'Sent', 'Partial', 'Paid', 'Overdue', 'Cancelled'],
  payment_method: ['Credit Card', 'Bank Transfer', 'Check', 'Cash', 'PayPal', 'Stripe'],
  payment_status: ['Completed', 'Pending', 'Failed', 'Refunded'],
  order_status: ['Draft', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
  task_priority: ['Low', 'Normal', 'High', 'Urgent'],
  task_status: ['Not Started', 'In Progress', 'Completed', 'Cancelled'],

  // --- Industry: Transportation & Compliance ---
  driver_status: ['Active', 'Inactive', 'Suspended', 'Expired'],
  vehicle_status: ['Active', 'In Maintenance', 'Out of Service', 'Retired'],
  compliance_document_type: ['CDL', 'Medical Card', 'MVR', 'Drug Test', 'Insurance', 'Registration', 'Permit', 'Other'],
  compliance_document_status: ['Valid', 'Expiring Soon', 'Expired', 'Pending Review'],

  // --- Industry: Service Business ---
  project_status: ['Planning', 'In Progress', 'On Hold', 'Completed', 'Cancelled'],

  // --- Industry: E-Commerce ---
  customer_status: ['Active', 'Inactive', 'VIP', 'Churned'],
  inventory_status: ['In Stock', 'Low Stock', 'Out of Stock', 'Discontinued'],

  // --- Industry: Real Estate ---
  property_type: ['Single Family', 'Condo', 'Townhouse', 'Multi-Family', 'Commercial', 'Land'],
  property_status: ['Available', 'Under Contract', 'Sold', 'Off Market'],
  showing_status: ['Scheduled', 'Completed', 'Cancelled', 'No Show'],

  // --- Industry: Legal Services ---
  case_type: ['Civil', 'Criminal', 'Family', 'Corporate', 'Immigration', 'Personal Injury', 'Real Estate', 'Other'],
  case_status: ['Open', 'In Discovery', 'In Trial', 'Settled', 'Closed', 'Appealed'],

  // --- Industry: Healthcare / Wellness ---
  patient_status: ['Active', 'Inactive', 'New'],
  appointment_type: ['Consultation', 'Follow-Up', 'Procedure', 'Emergency', 'Telehealth'],
  appointment_status: ['Scheduled', 'Checked In', 'In Progress', 'Completed', 'Cancelled', 'No Show'],

  // --- Platform Core ---
  activity_type: ['Call', 'Email', 'Meeting', 'Note', 'Task'],
  activity_direction: ['Inbound', 'Outbound'],
  activity_related_to_type: ['Lead', 'Contact', 'Company', 'Deal'],
  campaign_type: ['Email', 'Social Media', 'SMS', 'Direct Mail', 'Event', 'Webinar', 'Other'],
  campaign_status: ['Draft', 'Scheduled', 'Active', 'Paused', 'Completed', 'Cancelled'],
  sequence_status: ['Draft', 'Active', 'Paused', 'Archived'],
  sequence_trigger_type: ['Manual', 'Form Submission', 'Tag Added', 'Deal Stage Change', 'API'],
  workflow_status: ['Draft', 'Active', 'Paused', 'Archived'],
  workflow_trigger_type: ['Record Created', 'Record Updated', 'Field Changed', 'Schedule', 'Webhook', 'Manual'],
  form_status: ['Draft', 'Published', 'Archived'],
  page_status: ['Draft', 'Published', 'Archived'],
  page_template: ['Blank', 'Landing Page', 'About', 'Contact', 'Pricing', 'Custom'],
  blog_post_category: ['News', 'Tutorial', 'Case Study', 'Industry', 'Product Update', 'Other'],
  blog_post_status: ['Draft', 'In Review', 'Published', 'Archived'],
  domain_status: ['Active', 'Pending', 'Expired', 'Suspended'],
  ssl_status: ['Active', 'Pending', 'Expired', 'None'],
  coupon_discount_type: ['Percentage', 'Fixed Amount', 'Free Shipping'],
  coupon_status: ['Active', 'Expired', 'Disabled'],
  proposal_status: ['Draft', 'Sent', 'Viewed', 'Accepted', 'Declined', 'Expired'],
  subscription_status: ['Active', 'Past Due', 'Cancelled', 'Trialing', 'Paused'],
  email_template_category: ['Sales', 'Marketing', 'Support', 'Onboarding', 'Follow-Up', 'Newsletter', 'Other'],
  email_template_status: ['Draft', 'Active', 'Archived']
};
