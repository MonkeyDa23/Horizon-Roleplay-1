

export type Language = 'ar' | 'en';

export interface Translations {
  [key: string]: {
    [lang in Language]: string;
  };
}

export interface LocalizationContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
  dir: 'rtl' | 'ltr';
}

export interface User {
  id: string; // From Supabase Auth
  username: string; // From Discord provider
  avatar: string; // From Discord provider
  isAdmin: boolean; // From our `profiles` table
  isSuperAdmin: boolean; // From our `profiles` table
  roles: string[]; // Discord role IDs from our `profiles` table
  primaryRole?: {
    id: string;
    name: string;
    color: string;
  };
}

export interface AuthContextType {
  user: User | null;
  login: () => void;
  logout: () => void;
  loading: boolean;
  // FIX: Add updateUser to the context type.
  updateUser: (user: User) => void;
}

export interface AppConfig {
  COMMUNITY_NAME: string;
  LOGO_URL: string;
  DISCORD_INVITE_URL: string;
  MTA_SERVER_URL: string;
  BACKGROUND_IMAGE_URL?: string;
  SHOW_HEALTH_CHECK?: boolean;
  SUPER_ADMIN_ROLE_IDS?: string[];
}


// Store & Cart
export interface Product {
  id: string;
  nameKey: string;
  descriptionKey: string;
  price: number;
  imageUrl: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

// Quiz & Application System
export interface QuizQuestion {
  id: string;
  textKey: string;
  timeLimit: number; // in seconds
}

export interface Quiz {
  id: string;
  titleKey: string;
  descriptionKey: string;
  questions: QuizQuestion[];
  isOpen: boolean;
  logoUrl?: string;
  bannerUrl?: string;
  allowedTakeRoles?: string[];
  lastOpenedAt?: string;
}

export interface Answer {
  questionId: string;
  questionText: string;
  answer: string;
}

export type SubmissionStatus = 'pending' | 'taken' | 'accepted' | 'refused';

export interface CheatAttempt {
    method: string;
    timestamp: string;
}

export interface QuizSubmission {
  id: string;
  quizId: string;
  quizTitle: string;
  userId: string;
  username: string;
  answers: Answer[];
  submittedAt: string;
  status: SubmissionStatus;
  adminId?: string;
  adminUsername?: string;
  cheatAttempts?: CheatAttempt[];
}

// Admin & Rules
export interface AuditLogEntry {
    id: string;
    timestamp: string;
    adminId: string;
    adminUsername: string;
    action: string;
    ipAddress?: string;
}

export interface Rule {
    id: string;
    textKey: string;
}

export interface RuleCategory {
    id: string;
    titleKey: string;
    rules: Rule[];
}

// MTA Server
export interface MtaServerStatus {
    name: string;
    players: number;
    maxPlayers: number;
}
