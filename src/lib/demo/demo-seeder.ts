/**
 * Demo Seeder
 *
 * Populates demo accounts with niche-specific production data.
 */

export interface DemoLead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'abandoned';
  source: string;
  notes?: string;
  value?: number;
  createdAt: string;
}

export interface DemoVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  views: number;
  platform: 'youtube' | 'tiktok' | 'instagram' | 'linkedin';
  status: 'draft' | 'published' | 'scheduled';
  createdAt: string;
}

export interface NicheData {
  industry: string;
  leads: DemoLead[];
  videos: DemoVideo[];
}

const generateId = () => `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const randomDate = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date.toISOString();
};

/**
 * Restaurant / Food Service Demo Data
 */
export function getRestaurantData(): NicheData {
  return {
    industry: 'Restaurant & Food Service',
    leads: [
      { id: generateId(), name: 'Maria Rodriguez', email: 'maria@tacofusion.com', phone: '(555) 123-4567', company: 'Taco Fusion', status: 'qualified', source: 'Instagram DM', notes: 'Interested in catering AI', value: 2500, createdAt: randomDate(5) },
      { id: generateId(), name: 'James Chen', email: 'james@goldenwok.com', phone: '(555) 234-5678', company: 'Golden Wok', status: 'new', source: 'Website Form', notes: 'Wants reservation bot', value: 1800, createdAt: randomDate(2) },
      { id: generateId(), name: 'Sarah Miller', email: 'sarah@millerbakery.com', phone: '(555) 345-6789', company: 'Miller Bakery', status: 'contacted', source: 'Facebook Ad', notes: 'Custom cake orders automation', value: 1200, createdAt: randomDate(7) },
      { id: generateId(), name: 'Tony Soprano', email: 'tony@vesuvios.com', phone: '(555) 456-7890', company: 'Vesuvios', status: 'converted', source: 'Referral', notes: 'Full menu AI implementation', value: 5000, createdAt: randomDate(14) },
      { id: generateId(), name: 'Lisa Park', email: 'lisa@seoulkitchen.com', phone: '(555) 567-8901', company: 'Seoul Kitchen', status: 'abandoned', source: 'Google Ads', notes: 'Price concern - follow up', value: 2200, createdAt: randomDate(10) },
      { id: generateId(), name: 'Mike Johnson', email: 'mike@burgerbliss.com', phone: '(555) 678-9012', company: 'Burger Bliss', status: 'new', source: 'TikTok', notes: 'Viral video inquiry', value: 1500, createdAt: randomDate(1) },
      { id: generateId(), name: 'Emma Watson', email: 'emma@teahouse.com', phone: '(555) 789-0123', company: 'The Tea House', status: 'qualified', source: 'LinkedIn', notes: 'B2B catering focus', value: 3500, createdAt: randomDate(4) },
      { id: generateId(), name: 'Carlos Mendez', email: 'carlos@elranchero.com', phone: '(555) 890-1234', company: 'El Ranchero', status: 'contacted', source: 'Yelp', notes: 'Multiple locations', value: 8000, createdAt: randomDate(6) },
    ],
    videos: [
      { id: generateId(), title: 'Our Famous Taco Tuesday Special', description: 'Come experience the best tacos in town every Tuesday!', thumbnail: '/demo/restaurant-taco.jpg', duration: '0:45', views: 12500, platform: 'tiktok', status: 'published', createdAt: randomDate(3) },
      { id: generateId(), title: 'Behind the Scenes: Kitchen Tour', description: 'See how we prepare your favorite dishes fresh daily', thumbnail: '/demo/restaurant-kitchen.jpg', duration: '2:30', views: 8200, platform: 'youtube', status: 'published', createdAt: randomDate(7) },
      { id: generateId(), title: 'Chef Interview: Our Story', description: 'Meet the chef and learn about our culinary journey', thumbnail: '/demo/restaurant-chef.jpg', duration: '5:15', views: 4300, platform: 'youtube', status: 'published', createdAt: randomDate(14) },
      { id: generateId(), title: 'New Menu Launch Announcement', description: 'Exciting new dishes coming this spring!', thumbnail: '/demo/restaurant-menu.jpg', duration: '1:00', views: 0, platform: 'instagram', status: 'scheduled', createdAt: randomDate(1) },
    ],
  };
}

/**
 * Salon / Spa Demo Data
 */
export function getSalonData(): NicheData {
  return {
    industry: 'Salon & Spa',
    leads: [
      { id: generateId(), name: 'Jennifer Adams', email: 'jen@glamgirl.com', phone: '(555) 111-2222', company: 'Glam Girl Studio', status: 'qualified', source: 'Instagram', notes: 'Wants booking automation', value: 1800, createdAt: randomDate(3) },
      { id: generateId(), name: 'Rachel Green', email: 'rachel@hairheaven.com', phone: '(555) 222-3333', company: 'Hair Heaven', status: 'new', source: 'Google Search', notes: 'Stylist matching AI', value: 2200, createdAt: randomDate(1) },
      { id: generateId(), name: 'Monica Geller', email: 'monica@zenspany.com', phone: '(555) 333-4444', company: 'Zen Spa NY', status: 'converted', source: 'Referral', notes: 'Full spa management suite', value: 6500, createdAt: randomDate(21) },
      { id: generateId(), name: 'Phoebe Buffay', email: 'phoebe@naturalnails.com', phone: '(555) 444-5555', company: 'Natural Nails', status: 'contacted', source: 'Facebook', notes: 'Interested in loyalty program', value: 1200, createdAt: randomDate(5) },
      { id: generateId(), name: 'Kim Kardashian', email: 'kim@luxebeauty.com', phone: '(555) 555-6666', company: 'Luxe Beauty Bar', status: 'qualified', source: 'Celebrity Referral', notes: 'VIP client management', value: 15000, createdAt: randomDate(2) },
      { id: generateId(), name: 'Taylor Swift', email: 'taylor@starcuts.com', phone: '(555) 666-7777', company: 'Star Cuts', status: 'abandoned', source: 'TikTok', notes: 'Budget review needed', value: 3000, createdAt: randomDate(8) },
    ],
    videos: [
      { id: generateId(), title: 'Balayage Transformation', description: 'Watch this stunning hair transformation from start to finish', thumbnail: '/demo/salon-balayage.jpg', duration: '3:20', views: 45000, platform: 'tiktok', status: 'published', createdAt: randomDate(5) },
      { id: generateId(), title: 'Meet Our Team', description: 'Get to know our talented stylists and their specialties', thumbnail: '/demo/salon-team.jpg', duration: '4:00', views: 12000, platform: 'youtube', status: 'published', createdAt: randomDate(10) },
      { id: generateId(), title: 'Spa Day Experience', description: 'Tour our relaxing spa facilities and services', thumbnail: '/demo/salon-spa.jpg', duration: '2:15', views: 8500, platform: 'instagram', status: 'published', createdAt: randomDate(7) },
    ],
  };
}

/**
 * Gym / Fitness Demo Data
 */
export function getGymData(): NicheData {
  return {
    industry: 'Gym & Fitness',
    leads: [
      { id: generateId(), name: 'John Cena', email: 'john@powerlifters.com', phone: '(555) 111-0001', company: 'PowerLifters Gym', status: 'qualified', source: 'Instagram', notes: 'Membership AI bot', value: 4500, createdAt: randomDate(2) },
      { id: generateId(), name: 'Dwayne Johnson', email: 'dwayne@ironparadise.com', phone: '(555) 222-0002', company: 'Iron Paradise', status: 'converted', source: 'Direct', notes: 'Full gym management suite', value: 25000, createdAt: randomDate(30) },
      { id: generateId(), name: 'Kayla Itsines', email: 'kayla@sweatstudio.com', phone: '(555) 333-0003', company: 'Sweat Studio', status: 'new', source: 'YouTube', notes: 'Online class booking', value: 3200, createdAt: randomDate(1) },
      { id: generateId(), name: 'Chris Hemsworth', email: 'chris@centr.com', phone: '(555) 444-0004', company: 'Centr Fitness', status: 'qualified', source: 'App Store', notes: 'AI personal trainer', value: 18000, createdAt: randomDate(4) },
      { id: generateId(), name: 'Michelle Lewin', email: 'michelle@fitlife.com', phone: '(555) 555-0005', company: 'FitLife Studios', status: 'contacted', source: 'Facebook Ad', notes: 'Class scheduling AI', value: 2800, createdAt: randomDate(6) },
      { id: generateId(), name: 'Arnold Classic', email: 'arnold@goldsgym.com', phone: '(555) 666-0006', company: 'Golds Gym Franchise', status: 'abandoned', source: 'Trade Show', notes: 'Multi-location deal', value: 50000, createdAt: randomDate(15) },
    ],
    videos: [
      { id: generateId(), title: 'Full Body HIIT Workout', description: '30-minute high intensity workout you can do anywhere', thumbnail: '/demo/gym-hiit.jpg', duration: '32:00', views: 125000, platform: 'youtube', status: 'published', createdAt: randomDate(14) },
      { id: generateId(), title: 'Gym Tour: State of the Art Equipment', description: 'Check out our brand new facility and equipment', thumbnail: '/demo/gym-tour.jpg', duration: '5:45', views: 18000, platform: 'youtube', status: 'published', createdAt: randomDate(21) },
      { id: generateId(), title: 'Member Success Story: 50lb Transformation', description: 'Watch Johns incredible fitness journey with us', thumbnail: '/demo/gym-transform.jpg', duration: '4:30', views: 67000, platform: 'tiktok', status: 'published', createdAt: randomDate(7) },
    ],
  };
}

/**
 * Real Estate Demo Data
 */
export function getRealEstateData(): NicheData {
  return {
    industry: 'Real Estate',
    leads: [
      { id: generateId(), name: 'Ryan Serhant', email: 'ryan@serhant.com', phone: '(555) 777-0001', company: 'SERHANT.', status: 'qualified', source: 'LinkedIn', notes: 'Luxury listing AI', value: 35000, createdAt: randomDate(3) },
      { id: generateId(), name: 'Barbara Corcoran', email: 'barbara@corcoran.com', phone: '(555) 888-0002', company: 'Corcoran Group', status: 'converted', source: 'Referral', notes: 'Full brokerage solution', value: 75000, createdAt: randomDate(45) },
      { id: generateId(), name: 'Fredrik Eklund', email: 'fredrik@douglaselliman.com', phone: '(555) 999-0003', company: 'Douglas Elliman', status: 'new', source: 'Instagram', notes: 'Virtual tour AI', value: 12000, createdAt: randomDate(1) },
      { id: generateId(), name: 'Josh Flagg', email: 'josh@rodeodriveagent.com', phone: '(555) 000-0004', company: 'Rodeo Realty', status: 'contacted', source: 'TV Show', notes: 'Celebrity client matching', value: 28000, createdAt: randomDate(5) },
      { id: generateId(), name: 'Mauricio Umansky', email: 'mauricio@theagency.com', phone: '(555) 111-0005', company: 'The Agency', status: 'qualified', source: 'YouTube', notes: 'International expansion AI', value: 45000, createdAt: randomDate(8) },
    ],
    videos: [
      { id: generateId(), title: 'Luxury Penthouse Tour - $15M', description: 'Exclusive tour of this stunning Manhattan penthouse', thumbnail: '/demo/realestate-penthouse.jpg', duration: '8:45', views: 250000, platform: 'youtube', status: 'published', createdAt: randomDate(10) },
      { id: generateId(), title: 'First Time Home Buyer Tips', description: '5 things you need to know before buying your first home', thumbnail: '/demo/realestate-tips.jpg', duration: '6:30', views: 85000, platform: 'youtube', status: 'published', createdAt: randomDate(21) },
      { id: generateId(), title: 'Behind the Deal: $50M Estate Sale', description: 'How we closed the biggest deal of the year', thumbnail: '/demo/realestate-deal.jpg', duration: '12:00', views: 180000, platform: 'youtube', status: 'published', createdAt: randomDate(30) },
    ],
  };
}

/**
 * Auto Dealership Demo Data
 */
export function getAutoDealershipData(): NicheData {
  return {
    industry: 'Auto Dealership',
    leads: [
      { id: generateId(), name: 'Mike Brewer', email: 'mike@wheelerdealer.com', phone: '(555) 222-1111', company: 'Wheeler Dealers Auto', status: 'qualified', source: 'Website', notes: 'Inventory AI management', value: 8500, createdAt: randomDate(2) },
      { id: generateId(), name: 'Doug DeMuro', email: 'doug@carsandbids.com', phone: '(555) 333-2222', company: 'Cars & Bids', status: 'converted', source: 'YouTube', notes: 'Auction platform AI', value: 45000, createdAt: randomDate(60) },
      { id: generateId(), name: 'Jay Leno', email: 'jay@lenosgarage.com', phone: '(555) 444-3333', company: 'Lenos Garage', status: 'new', source: 'Direct', notes: 'Classic car specialist AI', value: 25000, createdAt: randomDate(1) },
      { id: generateId(), name: 'Chris Harris', email: 'chris@topgear.com', phone: '(555) 555-4444', company: 'Top Gear Motors', status: 'contacted', source: 'TV Show', notes: 'Performance vehicle focus', value: 18000, createdAt: randomDate(7) },
      { id: generateId(), name: 'Sarah Parker', email: 'sarah@familyauto.com', phone: '(555) 666-5555', company: 'Family Auto Group', status: 'abandoned', source: 'Google Ads', notes: 'Budget concerns - 5 locations', value: 35000, createdAt: randomDate(12) },
    ],
    videos: [
      { id: generateId(), title: '2024 Model Lineup Showcase', description: 'Check out all the exciting new models arriving this year', thumbnail: '/demo/auto-lineup.jpg', duration: '15:00', views: 95000, platform: 'youtube', status: 'published', createdAt: randomDate(14) },
      { id: generateId(), title: 'Test Drive: Electric SUV Comparison', description: 'We compare the top 5 electric SUVs on the market', thumbnail: '/demo/auto-ev.jpg', duration: '22:30', views: 320000, platform: 'youtube', status: 'published', createdAt: randomDate(21) },
      { id: generateId(), title: 'Customer Delivery Day Compilation', description: 'Watch our happy customers drive off in their new cars', thumbnail: '/demo/auto-delivery.jpg', duration: '5:00', views: 45000, platform: 'tiktok', status: 'published', createdAt: randomDate(5) },
    ],
  };
}

/**
 * Get demo data for a specific niche
 */
export function getDemoDataForNiche(niche: string): NicheData {
  const nicheMap: Record<string, () => NicheData> = {
    restaurant: getRestaurantData,
    'food-service': getRestaurantData,
    salon: getSalonData,
    spa: getSalonData,
    beauty: getSalonData,
    gym: getGymData,
    fitness: getGymData,
    'real-estate': getRealEstateData,
    realestate: getRealEstateData,
    auto: getAutoDealershipData,
    dealership: getAutoDealershipData,
    automotive: getAutoDealershipData,
  };

  const normalizedNiche = niche.toLowerCase().replace(/\s+/g, '-');
  const dataFn = nicheMap[normalizedNiche];

  if (dataFn) {
    return dataFn();
  }

  // Default to restaurant data
  return getRestaurantData();
}

/**
 * Get all available niches
 */
export function getAvailableNiches(): string[] {
  return [
    'Restaurant & Food Service',
    'Salon & Spa',
    'Gym & Fitness',
    'Real Estate',
    'Auto Dealership',
  ];
}

/**
 * Seed demo data for an organization
 */
export function seedDemoData(
  niche: string,
  options?: { includeAbandoned?: boolean }
): { leadsSeeded: number; videosSeeded: number } {
  const data = getDemoDataForNiche(niche);

  let leads = data.leads;
  if (!options?.includeAbandoned) {
    leads = leads.filter((l) => l.status !== 'abandoned');
  }

  // In production, this would write to Firestore
  // Data seeding occurs synchronously for demo purposes

  return {
    leadsSeeded: leads.length,
    videosSeeded: data.videos.length,
  };
}
