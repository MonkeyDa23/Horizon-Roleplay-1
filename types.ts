

export type Language = 'ar' | 'en';

export interface Translations {
  [key: string]: {
    [lang in Language]: string;
  };
}

export interface LocalizationContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  dir: 'rtl' | 'ltr';
}

// FIX: Added PermissionKey type definition, which was missing.
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
  id: string;
  username: string;
  avatar: string;
  isAdmin: boolean;
  // FIX: Replaced Set with an array to support older JS targets.
  permissions: PermissionKey[];
  // FIX: Added 'roles' property to the User interface to match its usage.
  roles: any[];
}

export interface AuthContextType {
  user: User | null;
  login: () => void;
  logout: () => void;
  loading: boolean;
  // FIX: Added 'updateUser' and 'hasPermission' to match the implementation in AuthProvider.
  updateUser: (user: User) => void;
  hasPermission: (key: PermissionKey) => boolean;
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
  // FIX: Added 'allowedTakeRoles' to Quiz interface to match usage in AdminPage.
  allowedTakeRoles?: string[];
}

export interface Answer {
  questionId: string;
  questionText: string;
  answer: string;
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
}