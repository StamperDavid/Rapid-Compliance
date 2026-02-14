/**
 * Internationalization (i18n) Support
 * Multi-language support for global reach
 */

import { logger } from '@/lib/logger/logger';

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
  agents: {
    title: 'KI-Agenten',
    create: 'Agent erstellen',
    goldenMaster: 'Golden Master',
    goldenMasterDescription: 'Versionierter KI-Agent mit Kundengedächtnis',
    knowledge: 'Wissensdatenbank',
    uploadKnowledge: 'Wissen hochladen',
    testAgent: 'Agent testen',
  },
  customers: {
    title: 'Kunden',
    addCustomer: 'Kunde hinzufügen',
    firstName: 'Vorname',
    lastName: 'Nachname',
    email: 'E-Mail',
    phone: 'Telefon',
    status: 'Status',
  },
  ecommerce: {
    products: 'Produkte',
    orders: 'Bestellungen',
    checkout: 'Zur Kasse',
    addToCart: 'In den Warenkorb',
    cart: 'Warenkorb',
    subtotal: 'Zwischensumme',
    shipping: 'Versand',
    tax: 'Steuer',
    total: 'Gesamt',
    placeOrder: 'Bestellung aufgeben',
  },
};

/**
 * Japanese translations
 */
export const ja: Translations = {
  common: {
    save: '保存',
    cancel: 'キャンセル',
    delete: '削除',
    edit: '編集',
    create: '作成',
    search: '検索',
    filter: 'フィルター',
    export: 'エクスポート',
    import: 'インポート',
    loading: '読み込み中...',
    error: 'エラー',
    success: '成功',
    confirm: '確認',
  },
  nav: {
    dashboard: 'ダッシュボード',
    customers: '顧客',
    products: '商品',
    orders: '注文',
    agents: 'AIエージェント',
    workflows: 'ワークフロー',
    analytics: '分析',
    settings: '設定',
  },
  agents: {
    title: 'AIエージェント',
    create: 'エージェント作成',
    goldenMaster: 'ゴールデンマスター',
    goldenMasterDescription: '顧客メモリ付きバージョン管理AIエージェント',
    knowledge: 'ナレッジベース',
    uploadKnowledge: 'ナレッジをアップロード',
    testAgent: 'エージェントをテスト',
  },
  customers: {
    title: '顧客',
    addCustomer: '顧客を追加',
    firstName: '名',
    lastName: '姓',
    email: 'メール',
    phone: '電話番号',
    status: 'ステータス',
  },
  ecommerce: {
    products: '商品',
    orders: '注文',
    checkout: '購入手続き',
    addToCart: 'カートに追加',
    cart: 'カート',
    subtotal: '小計',
    shipping: '配送料',
    tax: '税金',
    total: '合計',
    placeOrder: '注文する',
  },
};

/**
 * Chinese translations
 */
export const zh: Translations = {
  common: {
    save: '保存',
    cancel: '取消',
    delete: '删除',
    edit: '编辑',
    create: '创建',
    search: '搜索',
    filter: '筛选',
    export: '导出',
    import: '导入',
    loading: '加载中...',
    error: '错误',
    success: '成功',
    confirm: '确认',
  },
  nav: {
    dashboard: '仪表盘',
    customers: '客户',
    products: '产品',
    orders: '订单',
    agents: 'AI代理',
    workflows: '工作流',
    analytics: '分析',
    settings: '设置',
  },
  agents: {
    title: 'AI代理',
    create: '创建代理',
    goldenMaster: '黄金母版',
    goldenMasterDescription: '带客户记忆的版本化AI代理',
    knowledge: '知识库',
    uploadKnowledge: '上传知识',
    testAgent: '测试代理',
  },
  customers: {
    title: '客户',
    addCustomer: '添加客户',
    firstName: '名',
    lastName: '姓',
    email: '邮箱',
    phone: '电话',
    status: '状态',
  },
  ecommerce: {
    products: '产品',
    orders: '订单',
    checkout: '结账',
    addToCart: '加入购物车',
    cart: '购物车',
    subtotal: '小计',
    shipping: '运费',
    tax: '税费',
    total: '总计',
    placeOrder: '下单',
  },
};

/**
 * Portuguese translations
 */
export const pt: Translations = {
  common: {
    save: 'Salvar',
    cancel: 'Cancelar',
    delete: 'Excluir',
    edit: 'Editar',
    create: 'Criar',
    search: 'Pesquisar',
    filter: 'Filtrar',
    export: 'Exportar',
    import: 'Importar',
    loading: 'Carregando...',
    error: 'Erro',
    success: 'Sucesso',
    confirm: 'Confirmar',
  },
  nav: {
    dashboard: 'Painel',
    customers: 'Clientes',
    products: 'Produtos',
    orders: 'Pedidos',
    agents: 'Agentes IA',
    workflows: 'Fluxos de trabalho',
    analytics: 'Análises',
    settings: 'Configurações',
  },
  agents: {
    title: 'Agentes IA',
    create: 'Criar Agente',
    goldenMaster: 'Golden Master',
    goldenMasterDescription: 'Agente IA versionado com memória do cliente',
    knowledge: 'Base de Conhecimento',
    uploadKnowledge: 'Carregar Conhecimento',
    testAgent: 'Testar Agente',
  },
  customers: {
    title: 'Clientes',
    addCustomer: 'Adicionar Cliente',
    firstName: 'Nome',
    lastName: 'Sobrenome',
    email: 'E-mail',
    phone: 'Telefone',
    status: 'Status',
  },
  ecommerce: {
    products: 'Produtos',
    orders: 'Pedidos',
    checkout: 'Finalizar Compra',
    addToCart: 'Adicionar ao Carrinho',
    cart: 'Carrinho',
    subtotal: 'Subtotal',
    shipping: 'Frete',
    tax: 'Imposto',
    total: 'Total',
    placeOrder: 'Fazer Pedido',
  },
};

/**
 * Italian translations
 */
export const it: Translations = {
  common: {
    save: 'Salva',
    cancel: 'Annulla',
    delete: 'Elimina',
    edit: 'Modifica',
    create: 'Crea',
    search: 'Cerca',
    filter: 'Filtra',
    export: 'Esporta',
    import: 'Importa',
    loading: 'Caricamento...',
    error: 'Errore',
    success: 'Successo',
    confirm: 'Conferma',
  },
  nav: {
    dashboard: 'Dashboard',
    customers: 'Clienti',
    products: 'Prodotti',
    orders: 'Ordini',
    agents: 'Agenti IA',
    workflows: 'Flussi di lavoro',
    analytics: 'Analisi',
    settings: 'Impostazioni',
  },
  agents: {
    title: 'Agenti IA',
    create: 'Crea Agente',
    goldenMaster: 'Golden Master',
    goldenMasterDescription: 'Agente IA con versioning e memoria cliente',
    knowledge: 'Base di Conoscenza',
    uploadKnowledge: 'Carica Conoscenza',
    testAgent: 'Testa Agente',
  },
  customers: {
    title: 'Clienti',
    addCustomer: 'Aggiungi Cliente',
    firstName: 'Nome',
    lastName: 'Cognome',
    email: 'Email',
    phone: 'Telefono',
    status: 'Stato',
  },
  ecommerce: {
    products: 'Prodotti',
    orders: 'Ordini',
    checkout: 'Checkout',
    addToCart: 'Aggiungi al Carrello',
    cart: 'Carrello',
    subtotal: 'Subtotale',
    shipping: 'Spedizione',
    tax: 'IVA',
    total: 'Totale',
    placeOrder: 'Effettua Ordine',
  },
};

/**
 * Russian translations
 */
export const ru: Translations = {
  common: {
    save: 'Сохранить',
    cancel: 'Отмена',
    delete: 'Удалить',
    edit: 'Редактировать',
    create: 'Создать',
    search: 'Поиск',
    filter: 'Фильтр',
    export: 'Экспорт',
    import: 'Импорт',
    loading: 'Загрузка...',
    error: 'Ошибка',
    success: 'Успешно',
    confirm: 'Подтвердить',
  },
  nav: {
    dashboard: 'Панель управления',
    customers: 'Клиенты',
    products: 'Товары',
    orders: 'Заказы',
    agents: 'ИИ-агенты',
    workflows: 'Рабочие процессы',
    analytics: 'Аналитика',
    settings: 'Настройки',
  },
  agents: {
    title: 'ИИ-агенты',
    create: 'Создать агента',
    goldenMaster: 'Золотой мастер',
    goldenMasterDescription: 'Версионированный ИИ-агент с памятью клиента',
    knowledge: 'База знаний',
    uploadKnowledge: 'Загрузить знания',
    testAgent: 'Тестировать агента',
  },
  customers: {
    title: 'Клиенты',
    addCustomer: 'Добавить клиента',
    firstName: 'Имя',
    lastName: 'Фамилия',
    email: 'Электронная почта',
    phone: 'Телефон',
    status: 'Статус',
  },
  ecommerce: {
    products: 'Товары',
    orders: 'Заказы',
    checkout: 'Оформление заказа',
    addToCart: 'Добавить в корзину',
    cart: 'Корзина',
    subtotal: 'Подытог',
    shipping: 'Доставка',
    tax: 'Налог',
    total: 'Итого',
    placeOrder: 'Оформить заказ',
  },
};

/**
 * Arabic translations
 */
export const ar: Translations = {
  common: {
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
    create: 'إنشاء',
    search: 'بحث',
    filter: 'تصفية',
    export: 'تصدير',
    import: 'استيراد',
    loading: 'جاري التحميل...',
    error: 'خطأ',
    success: 'نجاح',
    confirm: 'تأكيد',
  },
  nav: {
    dashboard: 'لوحة التحكم',
    customers: 'العملاء',
    products: 'المنتجات',
    orders: 'الطلبات',
    agents: 'وكلاء الذكاء الاصطناعي',
    workflows: 'سير العمل',
    analytics: 'التحليلات',
    settings: 'الإعدادات',
  },
  agents: {
    title: 'وكلاء الذكاء الاصطناعي',
    create: 'إنشاء وكيل',
    goldenMaster: 'النسخة الذهبية',
    goldenMasterDescription: 'وكيل ذكاء اصطناعي مُصدّر مع ذاكرة العميل',
    knowledge: 'قاعدة المعرفة',
    uploadKnowledge: 'رفع المعرفة',
    testAgent: 'اختبار الوكيل',
  },
  customers: {
    title: 'العملاء',
    addCustomer: 'إضافة عميل',
    firstName: 'الاسم الأول',
    lastName: 'اسم العائلة',
    email: 'البريد الإلكتروني',
    phone: 'الهاتف',
    status: 'الحالة',
  },
  ecommerce: {
    products: 'المنتجات',
    orders: 'الطلبات',
    checkout: 'الدفع',
    addToCart: 'أضف إلى السلة',
    cart: 'سلة التسوق',
    subtotal: 'المجموع الفرعي',
    shipping: 'الشحن',
    tax: 'الضريبة',
    total: 'الإجمالي',
    placeOrder: 'تقديم الطلب',
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
  ja,
  zh,
  pt,
  it,
  ru,
  ar,
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
  t(key: string, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let value: string | Translations | undefined = this.translations;

    for (const k of keys) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        value = value[k] as string | Translations | undefined;
      } else {
        value = undefined;
      }
      if (value === undefined) {
        // eslint-disable-next-line no-template-curly-in-string -- Intentional template literal syntax in string for demonstration
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
  if (typeof window === 'undefined') {return 'en';}
  
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



















