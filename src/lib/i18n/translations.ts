/**
 * Internationalization (i18n) Support
 * Multi-language support for global reach
 */

export type Locale = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh' | 'pt' | 'it' | 'ru' | 'ar';

export interface Translations {
  [key: string]: string | Translations;
}

/**
 * English translations (default)
 */
export const en: Translations = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    search: 'Search',
    filter: 'Filter',
    export: 'Export',
    import: 'Import',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    confirm: 'Confirm',
  },
  nav: {
    dashboard: 'Dashboard',
    customers: 'Customers',
    products: 'Products',
    orders: 'Orders',
    agents: 'AI Agents',
    workflows: 'Workflows',
    analytics: 'Analytics',
    settings: 'Settings',
  },
  agents: {
    title: 'AI Agents',
    create: 'Create Agent',
    goldenMaster: 'Golden Master',
    goldenMasterDescription: 'Versioned AI agent with customer memory',
    knowledge: 'Knowledge Base',
    uploadKnowledge: 'Upload Knowledge',
    testAgent: 'Test Agent',
  },
  customers: {
    title: 'Customers',
    addCustomer: 'Add Customer',
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    phone: 'Phone',
    status: 'Status',
  },
  ecommerce: {
    products: 'Products',
    orders: 'Orders',
    checkout: 'Checkout',
    addToCart: 'Add to Cart',
    cart: 'Cart',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    tax: 'Tax',
    total: 'Total',
    placeOrder: 'Place Order',
  },
};

/**
 * Spanish translations
 */
export const es: Translations = {
  common: {
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    edit: 'Editar',
    create: 'Crear',
    search: 'Buscar',
    filter: 'Filtrar',
    export: 'Exportar',
    import: 'Importar',
    loading: 'Cargando...',
    error: 'Error',
    success: 'Éxito',
    confirm: 'Confirmar',
  },
  nav: {
    dashboard: 'Panel',
    customers: 'Clientes',
    products: 'Productos',
    orders: 'Pedidos',
    agents: 'Agentes IA',
    workflows: 'Flujos de trabajo',
    analytics: 'Analíticas',
    settings: 'Configuración',
  },
  agents: {
    title: 'Agentes IA',
    create: 'Crear Agente',
    goldenMaster: 'Maestro Dorado',
    goldenMasterDescription: 'Agente IA versionado con memoria del cliente',
    knowledge: 'Base de Conocimientos',
    uploadKnowledge: 'Cargar Conocimiento',
    testAgent: 'Probar Agente',
  },
  customers: {
    title: 'Clientes',
    addCustomer: 'Agregar Cliente',
    firstName: 'Nombre',
    lastName: 'Apellido',
    email: 'Correo Electrónico',
    phone: 'Teléfono',
    status: 'Estado',
  },
  ecommerce: {
    products: 'Productos',
    orders: 'Pedidos',
    checkout: 'Pagar',
    addToCart: 'Agregar al Carrito',
    cart: 'Carrito',
    subtotal: 'Subtotal',
    shipping: 'Envío',
    tax: 'Impuesto',
    total: 'Total',
    placeOrder: 'Realizar Pedido',
  },
};

/**
 * French translations
 */
export const fr: Translations = {
  common: {
    save: 'Enregistrer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    edit: 'Modifier',
    create: 'Créer',
    search: 'Rechercher',
    filter: 'Filtrer',
    export: 'Exporter',
    import: 'Importer',
    loading: 'Chargement...',
    error: 'Erreur',
    success: 'Succès',
    confirm: 'Confirmer',
  },
  nav: {
    dashboard: 'Tableau de bord',
    customers: 'Clients',
    products: 'Produits',
    orders: 'Commandes',
    agents: 'Agents IA',
    workflows: 'Flux de travail',
    analytics: 'Analytiques',
    settings: 'Paramètres',
  },
  agents: {
    title: 'Agents IA',
    create: 'Créer un Agent',
    goldenMaster: 'Maître Doré',
    goldenMasterDescription: 'Agent IA versionné avec mémoire client',
    knowledge: 'Base de Connaissances',
    uploadKnowledge: 'Télécharger Connaissances',
    testAgent: 'Tester Agent',
  },
  customers: {
    title: 'Clients',
    addCustomer: 'Ajouter Client',
    firstName: 'Prénom',
    lastName: 'Nom',
    email: 'Email',
    phone: 'Téléphone',
    status: 'Statut',
  },
  ecommerce: {
    products: 'Produits',
    orders: 'Commandes',
    checkout: 'Payer',
    addToCart: 'Ajouter au Panier',
    cart: 'Panier',
    subtotal: 'Sous-total',
    shipping: 'Livraison',
    tax: 'Taxe',
    total: 'Total',
    placeOrder: 'Passer Commande',
  },
};

/**
 * German translations
 */
export const de: Translations = {
  common: {
    save: 'Speichern',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    create: 'Erstellen',
    search: 'Suchen',
    filter: 'Filtern',
    export: 'Exportieren',
    import: 'Importieren',
    loading: 'Laden...',
    error: 'Fehler',
    success: 'Erfolg',
    confirm: 'Bestätigen',
  },
  nav: {
    dashboard: 'Dashboard',
    customers: 'Kunden',
    products: 'Produkte',
    orders: 'Bestellungen',
    agents: 'KI-Agenten',
    workflows: 'Workflows',
    analytics: 'Analytics',
    settings: 'Einstellungen',
  },
};

/**
 * All translations
 */
export const translations: Record<Locale, Translations> = {
  en,
  es,
  fr,
  de,
  ja: en, // TODO: Add Japanese
  zh: en, // TODO: Add Chinese
  pt: en, // TODO: Add Portuguese
  it: en, // TODO: Add Italian
  ru: en, // TODO: Add Russian
  ar: en, // TODO: Add Arabic
};

/**
 * Translation helper
 */
export class I18n {
  private locale: Locale;
  private translations: Translations;
  
  constructor(locale: Locale = 'en') {
    this.locale = locale;
    this.translations = translations[locale];
  }
  
  /**
   * Translate a key
   */
  t(key: string, params?: Record<string, any>): string {
    const keys = key.split('.');
    let value: any = this.translations;
    
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        logger.warn('Missing translation: ${key} for locale ${this.locale}', { file: 'translations.ts' });
        return key;
      }
    }
    
    let result = value as string;
    
    // Replace parameters
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        result = result.replace(`{${k}}`, String(v));
      });
    }
    
    return result;
  }
  
  /**
   * Change locale
   */
  setLocale(locale: Locale): void {
    this.locale = locale;
    this.translations = translations[locale];
  }
  
  /**
   * Get current locale
   */
  getLocale(): Locale {
    return this.locale;
  }
}

/**
 * Default i18n instance
 */
export const i18n = new I18n();

/**
 * Detect browser locale
 */
export function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  
  const browserLocale = navigator.language.split('-')[0];
  
  if (browserLocale in translations) {
    return browserLocale as Locale;
  }
  
  return 'en';
}

/**
 * Locale names
 */
export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
  zh: '中文',
  pt: 'Português',
  it: 'Italiano',
  ru: 'Русский',
  ar: 'العربية',
};

/**
 * Currency formats by locale
 */
export function formatCurrency(amount: number, locale: Locale = 'en'): string {
  const currencyMap: Record<Locale, string> = {
    en: 'USD',
    es: 'EUR',
    fr: 'EUR',
    de: 'EUR',
    ja: 'JPY',
    zh: 'CNY',
    pt: 'BRL',
    it: 'EUR',
    ru: 'RUB',
    ar: 'AED',
  };
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyMap[locale],
  }).format(amount);
}

/**
 * Date formats by locale
 */
export function formatDate(date: Date, locale: Locale = 'en'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * Number formats by locale
 */
export function formatNumber(num: number, locale: Locale = 'en'): string {
  return new Intl.NumberFormat(locale).format(num);
}



















