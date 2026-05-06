export type Language = 'ar' | 'en';

export interface Translations {
  [key: string]: {
    [lang in Language]: string;
  };
}

export interface LocalizationContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, replacements?: { [key: string]: string | number }) => string;
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
  | 'admin_staff'
  | 'admin_translations'
  | 'admin_appearance'
  | 'admin_audit_log'
  | 'admin_permissions'
  | 'admin_lookup'
  | 'admin_notifications'
  | 'admin_widgets';

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
}

export interface MtaVehicle {
  id: number;
  model: string;
  owner: number;
}

export interface MtaProperty {
  id: number;
  name: string;
  cost: number;
  owner: number;
}

export interface MtaCharacter {
  id: number;
  charactername: string;
  name: string;
  skin: number;
  gender: string;
  dob: string;
  age: number | string;
  nationality: string;
  hoursplayed: number;
  playtime_hours: number;
  level: number;
  job: string;
  faction: string;
  money: number;
  cash: number;
  bankmoney: number;
  bank: number;
  vehicles: MtaVehicle[];
  properties: MtaProperty[];
}

export interface MtaAccountInfo {
  id: number;
  username: string;
  serial: string;
  character_count: number;
  admin_record: {
    id: number;
    type: string;
    reason: string;
    admin: string;
    date: string;
    duration?: string | number;
  }[];
  characters: MtaCharacter[];
}

export interface User {
  id: string;
  discordId: string;
  username: string;
  avatar: string;
  roles: DiscordRole[];
  highestRole: DiscordRole | null;
  permissions: PermissionKey[];
  is_banned: boolean;
  ban_reason: string | null;
  ban_expires_at: string | null;
  balance: number;
  mta_serial: string | null;
  mta_name: string | null;
  mta_linked_at: string | null;
  two_factor_enabled: boolean;
  mta_data?: MtaAccountInfo;
}

export interface AuthContextType {
  user: User | null;
  login: (captchaToken: string) => void;
  logout: () => void;
  loading: boolean;
  isInitialLoading: boolean;
  updateUser: (user: User) => void;
  hasPermission: (key: PermissionKey) => boolean;
  permissionWarning: string | null;
  syncError: Error | null;
  retrySync?: () => Promise<void>;
  refreshUser?: () => Promise<void>;
  isTwoFactorVerified: boolean;
  verifyTwoFactor: (code: string) => Promise<boolean>;
}

export interface UserLookupResult {
    id: string | null;
    discordId: string;
    username: string;
    avatar: string;
    roles: DiscordRole[];
    highestRole: DiscordRole | null;
    is_banned: boolean;
    ban_reason: string | null;
    ban_expires_at: string | null;
    balance: number;
}

export interface RolePermission {
    role_id: string;
    permissions: PermissionKey[];
}


export interface ProductCategory {
  id: string;
  nameKey: string;
  position: number;
  products: Product[];
}

export interface Product {
  id: string;
  nameKey: string;
  descriptionKey: string;
  price: number;
  imageUrl: string;
  category_id: string | null;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface InvoiceItem {
    id?: string;
    productName: string;
    price: number;
    imageUrl?: string;
}

export interface Invoice {
    id: string;
    user_id: string;
    admin_id: string;
    admin_username: string;
    products: InvoiceItem[];
    total_amount: number;
    created_at: string;
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

export interface QuizQuestion {
  id: string;
  textKey: string;
  timeLimit: number;
}

export interface Answer {
  questionId: string;
  questionText: string;
  answer: string;
  timeTaken: number;
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
  user_id: string;
  username: string;
  answers: Answer[];
  submittedAt: string;
  status: SubmissionStatus;
  adminId?: string;
  adminUsername?: string;
  updatedAt?: string;
  cheatAttempts?: CheatAttempt[];
  user_highest_role?: string;
  discord_id?: string;
  reason?: string;
}

export interface Quiz {
  id: string;
  titleKey: string;
  descriptionKey: string;
  instructionsKey: string;
  questions: QuizQuestion[];
  isOpen: boolean;
  allowedTakeRoles?: string[];
  logoUrl?: string;
  bannerUrl?: string;
  lastOpenedAt?: string;
}

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

export interface StaffMember {
  id: string;
  user_id: string;
  role_key: string;
  position: number;
  username: string;
  avatar_url: string;
  discord_id: string;
}


export interface AppConfig {
    siteName: string;
    LOGO_URL: string;
    DISCORD_GUILD_ID: string;
    DISCORD_INVITE_URL: string;
    MTA_SERVER_URL: string;
    BACKGROUND_IMAGE_URL: string;
    SHOW_HEALTH_CHECK: boolean;
    MAINTENANCE_MODE: boolean;
    admin_password: string | null;
    DISCORD_PROXY_URL: string | null;
    DISCORD_PROXY_SECRET: string | null;
    submissions_channel_id: string | null;
    log_channel_submissions: string | null;
    log_channel_bans: string | null;
    log_channel_admin: string | null;
    log_channel_auth: string | null;
    log_channel_finance: string | null;
    log_channel_store: string | null;
    audit_log_channel_id: string | null;
    mention_role_submissions: string | null;
    mention_role_audit_log_submissions: string | null;
    mention_role_audit_log_bans: string | null;
    mention_role_audit_log_admin: string | null;
    mention_role_auth: string | null;
    mention_role_finance: string | null;
    mention_role_store: string | null;
    mention_role_audit_log_general: string | null;
}

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  admin_id: string;
  admin_username: string;
  action: string;
  log_type: string;
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
