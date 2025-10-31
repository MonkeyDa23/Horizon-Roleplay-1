// src/types.ts

// =============================================
// LANGUAGE & TRANSLATION
// =============================================
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

// =============================================
// AUTH, USER & PERMISSIONS
// =============================================
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
  | 'admin_lookup'
  | 'admin_notifications'
  | 'admin_widgets'; // New permission for Discord widgets

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
}

export interface User {
  id: string; // Supabase Auth User ID
  discordId: string;
  username: string;
  avatar: string;
  roles: DiscordRole[];
  highestRole: DiscordRole | null;
  permissions: PermissionKey[];
  is_banned: boolean;
  ban_reason: string | null;
  ban_expires_at: string | null;
}

export interface AuthContextType {
  user: User | null;
  login: () => void;
  logout: () => void;
  loading: boolean;
  updateUser: (user: User) => void;
  hasPermission: (key: PermissionKey) => boolean;
  permissionWarning: string | null;
}

export interface UserLookupResult {
    id: string;
    username: string;
    avatar: string;
    roles: DiscordRole[];
    highestRole: DiscordRole | null;
    is_banned: boolean;
    ban_reason: string | null;
    ban_expires_at: string | null;
}

export interface RolePermission {
    role_id: string;
    permissions: PermissionKey[];
}


// =============================================
// STORE & CART
// =============================================
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

// =============================================
// QUIZ & SUBMISSION SYSTEM
// =============================================
export interface QuizQuestion {
  id: string;
  textKey: string;
  timeLimit: number; // in seconds
}

export interface Answer {
  questionId: string;
  questionText: string;
  answer: string;
  timeTaken: number; // Time taken in seconds for this question
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
  user_id: string; // Matches DB column name
  username: string;
  answers: Answer[];
  submittedAt: string;
  status: SubmissionStatus;
  adminId?: string;
  adminUsername?: string;
  updatedAt?: string;
  cheatAttempts?: CheatAttempt[];
  user_highest_role?: string;
  reason?: string; // Reason for accept/refuse
}

export interface Quiz {
  id: string;
  titleKey: string;
  descriptionKey: string;
  questions: QuizQuestion[];
  isOpen: boolean;
  allowedTakeRoles?: string[];
  logoUrl?: string;
  bannerUrl?: string;
  lastOpenedAt?: string; // To track "application seasons"
}


// =============================================
// RULES & CONFIG
// =============================================
export interface Rule {
    id: string;
    textKey: string;
}

export interface RuleCategory {
    id: string;
    titleKey: string;
    position: number;
    rules: Rule[];
}

export interface DiscordWidget {
    id: string;
    server_name: string;
    server_id: string;
    invite_url: string;
    position: number;
}

export interface AppConfig {
    COMMUNITY_NAME: string;
    LOGO_URL: string;
    DISCORD_GUILD_ID: string;
    DISCORD_INVITE_URL: string;
    MTA_SERVER_URL: string;
    BACKGROUND_IMAGE_URL: string;
    SHOW_HEALTH_CHECK: boolean;
    SUBMISSIONS_CHANNEL_ID: string | null;
    SUBMISSIONS_MENTION_ROLE_ID: string | null;
    AUDIT_LOG_CHANNEL_ID: string | null;
    AUDIT_LOG_CHANNEL_ID_SUBMISSIONS: string | null;
    AUDIT_LOG_CHANNEL_ID_BANS: string | null;
    AUDIT_LOG_CHANNEL_ID_ADMIN: string | null;
    DISCORD_PROXY_URL: string | null;
    DISCORD_PROXY_SECRET: string | null;
}

// =============================================
// MISC & EXTERNAL
// =============================================
export interface AuditLogEntry {
  id: number;
  timestamp: string;
  admin_id: string;
  admin_username: string;
  action: string;
}

export interface MtaServerStatus {
    name: string;
    players: number;
    maxPlayers: number;
    version: string;
}

export interface MtaLogEntry {
    timestamp: string;
    text: string;
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