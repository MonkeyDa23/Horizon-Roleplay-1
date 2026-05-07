/**
 * Global Configuration Constants
 */

export const CONFIG = {
  // وضع معرفات (Security Roles) رتب الديسكورد التي تحصل على صلاحيات الإدارة تلقائياً
  ADMIN_ROLE_IDS: [
    '1432703261533798552', // مثال: رتبة المؤسس
    '1432703261533798552', // مثال: رتبة المدير العام
  ],
  
  // الرتب التي يمكنها رؤية لوحة التحكم (Staff)
  STAFF_ROLE_IDS: [
    '1432703261533798552', 
  ],

  // إعدادات أخرى
  MAX_CHARACTERS_PER_USER: 3,
};
