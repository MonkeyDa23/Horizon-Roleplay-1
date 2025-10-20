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

export type PermissionKey = 
  | '_super_admin'
  | 'page_store'
  | 'page_rules'
  | 'page_applies'
  | 'admin_panel'
  | 'admin_submissions'
  | 'admin_quizzes'
  | 'admin_rules'
  | 'admin_store'
  | 'admin_translations'
  | 'admin_appearance'
  | 'admin_audit_log'
  | 'admin_permissions'
  | 'admin_lookup';


export interface User {
  id: string; // This is the Supabase auth.users.id (UUID)
  discordId: string; // This is the user's actual Discord ID (Snowflake)
  username: string;
  avatar: string;
  roles: DiscordRole[]; // Now an array of rich role objects
  highestRole: DiscordRole | null;
  permissions: Set<PermissionKey>; // The new source of truth for all user permissions
}

export interface AuthContextType {
  user: User | null;
  login: () => void;
  logout: () => void;
  loading: boolean;
  updateUser: (user: User) => void;
  hasPermission: (key: PermissionKey) => boolean; // Helper function for easy permission checks
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
  user_id: string; // Switched to user_id to match DB schema
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
    admin_id: string; // Switched to admin_id
    admin_username: string; // Switched to admin_username
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
}

export interface UserLookupResult {
  id: string;
  username: string;
  avatar: string;
  joinedAt: string;
  submissions: QuizSubmission[];
}

export interface DiscordRole {
    id: string;
    name: string;
    color: number;
    position: number;
}

export interface RolePermission {
    role_id: string;
    permissions: PermissionKey[];
}