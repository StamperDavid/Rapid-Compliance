// Complete Standard CRM Schema Definitions

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
  }
};

export const PICKLIST_VALUES = {
  lead_source: ['Website', 'Referral', 'Cold Call', 'Social Media', 'Email Campaign', 'Trade Show', 'Other'],
  lead_status: ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted'],
  lead_rating: ['Hot', 'Warm', 'Cold'],
  industry: ['Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 'Services', 'Other'],
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
  task_status: ['Not Started', 'In Progress', 'Completed', 'Cancelled']
};

