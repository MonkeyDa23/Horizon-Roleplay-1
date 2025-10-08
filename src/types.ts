export type Language = 'ar' | 'en';

export interface Translations {
  [key: string]: {
    [lang in Language]: string;
  };
}

export interface LocalizationContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  // FIX: Updated 't' function signature to support replacement values.
  t: (key: string, replacements?: Record<string, string | number>) => string;
  dir: 'rtl' | 'ltr';
}

export interface DiscordRole {
  id: string;
  name: string;
  color: string;
}

export interface User {
  id:string;
  username: string;
  avatar: string;
  isAdmin: boolean;
  // FIX: Added isSuperAdmin to user type for admin panel logic.
  isSuperAdmin: boolean;
  discordRoles: DiscordRole[];
  // FIX: Added roles array for easier permission checking.
  roles: string[];
  // FIX: Added primaryRole for SessionWatcher logic.
  primaryRole?: DiscordRole;
}

export interface AuthContextType {
  user: User | null;
  login: () => void;
  logout: () => void;
  loading: boolean;
  // FIX: Added updateUser to allow components to update the user state.
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
  // FIX: Added optional properties to the Quiz interface based on usage in components.
  lastOpenedAt?: string;
  logoUrl?: string;
  bannerUrl?: string;
}

export interface Answer {
  questionId: string;
  questionText: string;
  answer: string;
}

// FIX: Added CheatAttempt type for anti-cheat logging.
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
  // FIX: Added optional properties based on component usage.
  updatedAt?: string;
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
// FIX: Defined Rule and RuleCategory interfaces.
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

// FIX: Added MtaLogEntry for user lookup panel.
export interface MtaLogEntry {
    timestamp: string;
    text: string;
}

// FIX: Added AppConfig type for dynamic configuration.
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
}