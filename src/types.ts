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

export interface DiscordRole {
  id: string;
  name: string;
  color: string;
  position: number;
}

export interface User {
  id:string;
  username: string;
  avatar: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  discordRoles: DiscordRole[];
  roles: string[];
  highestRole: DiscordRole | null;
}

export interface AuthContextType {
  user: User | null;
  login: () => void;
  logout: () => void;
  loading: boolean;
  updateUser: (user: User) => void;
}

// Store & Cart
export interface Product {
  id: string;
  nameKey: string; // Key for translation
  descriptionKey: string; // Key for translation
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
  textKey: string; // Key for translation
  timeLimit: number; // in seconds
}

export interface Quiz {
  id: string;
  titleKey: string; // Key for translation
  descriptionKey: string; // These are the rules shown before starting
  questions: QuizQuestion[];
  isOpen: boolean;
  allowedTakeRoles?: string[];
  lastOpenedAt?: string;
  logoUrl?: string;
  bannerUrl?: string;
}

export interface Answer {
  questionId: string;
  questionText: string;
  answer: string;
}

export interface CheatAttempt {
  method: string;
  timestamp: string;
}

export type SubmissionStatus = 'pending' | 'taken' | 'accepted' | 'refused';

export interface QuizSubmission {
  id: string;
  quizId: string;
  quizTitle: string;
  userId: string;
  username: string;
  answers: Answer[];
  submittedAt: string;
  status: SubmissionStatus;
  adminId?: string; // ID of the admin who claimed/handled it
  adminUsername?: string; // Username of the admin
  updatedAt?: string;
  user_highest_role?: string;
  cheatAttempts?: CheatAttempt[];
}

// Admin Types
export interface AuditLogEntry {
    id: string;
    timestamp: string;
    adminId: string;
    adminUsername: string;
    action: string;
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

export interface DiscordAnnouncement {
  id: string;
  title: string;
  content: string;
  author: {
    name: string;
    avatarUrl: string;
  };
  timestamp: string;
  url: string;
}

export interface MtaServerStatus {
    name: string;
    players: number;
    maxPlayers: number;
}

export interface MtaLogEntry {
    timestamp: string;
    text: string;
}

export interface AppConfig {
    COMMUNITY_NAME: string;
    LOGO_URL: string;
    DISCORD_GUILD_ID: string;
    DISCORD_INVITE_URL: string;
    MTA_SERVER_URL: string;
    BACKGROUND_IMAGE_URL: string;
    SHOW_HEALTH_CHECK: boolean;
    SUPER_ADMIN_ROLE_IDS: string[];
    HANDLER_ROLE_IDS: string[];
    SUBMISSIONS_WEBHOOK_URL: string;
    AUDIT_LOG_WEBHOOK_URL: string;
}