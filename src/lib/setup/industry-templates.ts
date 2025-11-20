/**
 * Industry Templates
 * Pre-configured CRM setups for different industries
 */

export interface IndustryTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  schemas: string[];  // Which standard schemas to enable
  customSchemas?: any[];  // Industry-specific schemas
  fieldCustomizations: Record<string, any>;  // Modifications to standard schemas
  workflows?: any[];  // Pre-built workflows
  aiAgentPrompt: string;  // Industry-specific AI agent configuration
}

export const INDUSTRY_TEMPLATES: Record<string, IndustryTemplate> = {
  general: {
    id: 'general',
    name: 'General Business',
    description: 'Standard CRM for any business',
    icon: '💼',
    schemas: ['companies', 'contacts', 'deals', 'products', 'quotes', 'invoices', 'orders', 'tasks'],
    fieldCustomizations: {},
    aiAgentPrompt: 'You are a helpful business assistant.'
  },

  transportation: {
    id: 'transportation',
    name: 'Transportation & Compliance',
    description: 'For trucking, logistics, and compliance services',
    icon: '🚚',
    schemas: ['companies', 'contacts', 'deals', 'products', 'invoices', 'orders', 'tasks'],
    customSchemas: [
      {
        name: 'Driver',
        fields: [
          { key: 'name', label: 'Driver Name', type: 'text' },
          { key: 'license_number', label: 'License Number', type: 'text' },
          { key: 'license_expiry', label: 'License Expiry', type: 'date' },
          { key: 'company_id', label: 'Company', type: 'lookup' },
          { key: 'status', label: 'Status', type: 'singleSelect' }
        ]
      },
      {
        name: 'Vehicle',
        fields: [
          { key: 'vehicle_number', label: 'Vehicle Number', type: 'text' },
          { key: 'vin', label: 'VIN', type: 'text' },
          { key: 'company_id', label: 'Company', type: 'lookup' },
          { key: 'inspection_due', label: 'Inspection Due', type: 'date' },
          { key: 'status', label: 'Status', type: 'singleSelect' }
        ]
      },
      {
        name: 'Compliance Document',
        fields: [
          { key: 'document_type', label: 'Document Type', type: 'singleSelect' },
          { key: 'company_id', label: 'Company', type: 'lookup' },
          { key: 'driver_id', label: 'Driver', type: 'lookup' },
          { key: 'issue_date', label: 'Issue Date', type: 'date' },
          { key: 'expiry_date', label: 'Expiry Date', type: 'date' },
          { key: 'status', label: 'Status', type: 'singleSelect' }
        ]
      }
    ],
    fieldCustomizations: {
      companies: {
        addFields: [
          { key: 'dot_number', label: 'DOT Number', type: 'text' },
          { key: 'mc_number', label: 'MC Number', type: 'text' },
          { key: 'fleet_size', label: 'Fleet Size', type: 'number' }
        ]
      },
      products: {
        rename: 'Services',
        addFields: [
          { key: 'service_type', label: 'Service Type', type: 'singleSelect', options: ['Compliance Audit', 'Drug Testing', 'DOT Filing', 'Training'] }
        ]
      }
    },
    aiAgentPrompt: 'You are a transportation compliance expert. Help clients with DOT regulations, FMCSA compliance, and fleet management.'
  },

  services: {
    id: 'services',
    name: 'Service Business',
    description: 'For consulting, agencies, contractors',
    icon: '🛠️',
    schemas: ['companies', 'contacts', 'deals', 'products', 'invoices', 'tasks'],
    customSchemas: [
      {
        name: 'Project',
        fields: [
          { key: 'project_name', label: 'Project Name', type: 'text' },
          { key: 'company_id', label: 'Company', type: 'lookup' },
          { key: 'start_date', label: 'Start Date', type: 'date' },
          { key: 'end_date', label: 'End Date', type: 'date' },
          { key: 'budget', label: 'Budget', type: 'currency' },
          { key: 'status', label: 'Status', type: 'singleSelect' }
        ]
      },
      {
        name: 'Time Entry',
        fields: [
          { key: 'project_id', label: 'Project', type: 'lookup' },
          { key: 'date', label: 'Date', type: 'date' },
          { key: 'hours', label: 'Hours', type: 'number' },
          { key: 'description', label: 'Description', type: 'longText' },
          { key: 'billable', label: 'Billable', type: 'checkbox' }
        ]
      }
    ],
    fieldCustomizations: {
      products: {
        rename: 'Services',
        addFields: [
          { key: 'hourly_rate', label: 'Hourly Rate', type: 'currency' },
          { key: 'duration', label: 'Estimated Duration', type: 'number' }
        ]
      }
    },
    aiAgentPrompt: 'You are a service business assistant. Help clients book services, track projects, and manage billing.'
  },

  ecommerce: {
    id: 'ecommerce',
    name: 'E-Commerce',
    description: 'Online store and product sales',
    icon: '🛒',
    schemas: ['companies', 'contacts', 'products', 'orders', 'invoices'],
    customSchemas: [
      {
        name: 'Customer',
        fields: [
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'first_name', label: 'First Name', type: 'text' },
          { key: 'last_name', label: 'Last Name', type: 'text' },
          { key: 'phone', label: 'Phone', type: 'phoneNumber' },
          { key: 'total_orders', label: 'Total Orders', type: 'number' },
          { key: 'lifetime_value', label: 'Lifetime Value', type: 'currency' }
        ]
      },
      {
        name: 'Inventory',
        fields: [
          { key: 'product_id', label: 'Product', type: 'lookup' },
          { key: 'quantity', label: 'Quantity', type: 'number' },
          { key: 'location', label: 'Location', type: 'text' },
          { key: 'reorder_point', label: 'Reorder Point', type: 'number' }
        ]
      }
    ],
    fieldCustomizations: {
      products: {
        addFields: [
          { key: 'weight', label: 'Weight', type: 'number' },
          { key: 'dimensions', label: 'Dimensions', type: 'text' },
          { key: 'variants', label: 'Has Variants', type: 'checkbox' },
          { key: 'images', label: 'Images', type: 'attachment' }
        ]
      },
      companies: {
        hide: true  // E-commerce uses customers instead
      }
    },
    aiAgentPrompt: 'You are an e-commerce sales assistant. Help customers find products, answer questions, and complete purchases.'
  },

  real_estate: {
    id: 'real_estate',
    name: 'Real Estate',
    description: 'Property sales and management',
    icon: '🏠',
    schemas: ['companies', 'contacts', 'deals', 'tasks'],
    customSchemas: [
      {
        name: 'Property',
        fields: [
          { key: 'address', label: 'Address', type: 'text' },
          { key: 'price', label: 'Price', type: 'currency' },
          { key: 'bedrooms', label: 'Bedrooms', type: 'number' },
          { key: 'bathrooms', label: 'Bathrooms', type: 'number' },
          { key: 'sqft', label: 'Square Feet', type: 'number' },
          { key: 'property_type', label: 'Property Type', type: 'singleSelect' },
          { key: 'status', label: 'Status', type: 'singleSelect' }
        ]
      },
      {
        name: 'Showing',
        fields: [
          { key: 'property_id', label: 'Property', type: 'lookup' },
          { key: 'contact_id', label: 'Contact', type: 'lookup' },
          { key: 'date_time', label: 'Date & Time', type: 'dateTime' },
          { key: 'status', label: 'Status', type: 'singleSelect' },
          { key: 'feedback', label: 'Feedback', type: 'longText' }
        ]
      }
    ],
    fieldCustomizations: {
      deals: {
        rename: 'Offers',
        addFields: [
          { key: 'property_id', label: 'Property', type: 'lookup' },
          { key: 'offer_amount', label: 'Offer Amount', type: 'currency' },
          { key: 'contingencies', label: 'Contingencies', type: 'longText' }
        ]
      }
    },
    aiAgentPrompt: 'You are a real estate assistant. Help clients find properties, schedule showings, and manage offers.'
  },

  healthcare: {
    id: 'healthcare',
    name: 'Healthcare Services',
    description: 'Medical practices and clinics',
    icon: '🏥',
    schemas: ['contacts', 'tasks', 'invoices'],
    customSchemas: [
      {
        name: 'Patient',
        fields: [
          { key: 'first_name', label: 'First Name', type: 'text' },
          { key: 'last_name', label: 'Last Name', type: 'text' },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'phone', label: 'Phone', type: 'phoneNumber' },
          { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
          { key: 'insurance', label: 'Insurance Provider', type: 'text' },
          { key: 'status', label: 'Status', type: 'singleSelect' }
        ]
      },
      {
        name: 'Appointment',
        fields: [
          { key: 'patient_id', label: 'Patient', type: 'lookup' },
          { key: 'appointment_date', label: 'Date & Time', type: 'dateTime' },
          { key: 'duration', label: 'Duration (mins)', type: 'number' },
          { key: 'type', label: 'Appointment Type', type: 'singleSelect' },
          { key: 'status', label: 'Status', type: 'singleSelect' },
          { key: 'notes', label: 'Notes', type: 'longText' }
        ]
      }
    ],
    fieldCustomizations: {
      contacts: {
        hide: true  // Use Patients instead
      }
    },
    aiAgentPrompt: 'You are a healthcare appointment assistant. Help patients schedule appointments and answer general questions.'
  },

  legal: {
    id: 'legal',
    name: 'Legal Services',
    description: 'Law firms and legal practices',
    icon: '⚖️',
    schemas: ['companies', 'contacts', 'invoices', 'tasks'],
    customSchemas: [
      {
        name: 'Case',
        fields: [
          { key: 'case_number', label: 'Case Number', type: 'text' },
          { key: 'client_id', label: 'Client', type: 'lookup' },
          { key: 'case_type', label: 'Case Type', type: 'singleSelect' },
          { key: 'filing_date', label: 'Filing Date', type: 'date' },
          { key: 'court', label: 'Court', type: 'text' },
          { key: 'status', label: 'Status', type: 'singleSelect' },
          { key: 'description', label: 'Description', type: 'longText' }
        ]
      },
      {
        name: 'Billing Entry',
        fields: [
          { key: 'case_id', label: 'Case', type: 'lookup' },
          { key: 'date', label: 'Date', type: 'date' },
          { key: 'hours', label: 'Hours', type: 'number' },
          { key: 'rate', label: 'Rate', type: 'currency' },
          { key: 'description', label: 'Description', type: 'longText' },
          { key: 'billable', label: 'Billable', type: 'checkbox' }
        ]
      }
    ],
    fieldCustomizations: {
      companies: {
        rename: 'Clients'
      }
    },
    aiAgentPrompt: 'You are a legal practice assistant. Help with case management and client communications.'
  }
};

/**
 * AI-Guided Setup Wizard
 * Asks questions and configures the CRM automatically
 */
export const SETUP_QUESTIONS = [
  {
    id: 'industry',
    question: 'What industry is your business in?',
    type: 'select',
    options: Object.keys(INDUSTRY_TEMPLATES),
    required: true
  },
  {
    id: 'business_name',
    question: 'What is your company name?',
    type: 'text',
    required: true
  },
  {
    id: 'primary_service',
    question: 'What is your primary product or service?',
    type: 'text',
    required: true
  },
  {
    id: 'team_size',
    question: 'How many people will use this CRM?',
    type: 'select',
    options: ['Just me', '2-5', '6-20', '21-50', '50+'],
    required: true
  },
  {
    id: 'main_goal',
    question: 'What is your main goal?',
    type: 'select',
    options: [
      'Manage customer relationships',
      'Track sales pipeline',
      'Automate invoicing',
      'Manage projects',
      'E-commerce store',
      'All of the above'
    ],
    required: true
  },
  {
    id: 'custom_needs',
    question: 'Any specific fields or objects you need? (AI will help you set these up)',
    type: 'longText',
    required: false
  }
];

