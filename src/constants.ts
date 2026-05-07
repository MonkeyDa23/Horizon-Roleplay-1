/**
 * Global Configuration Constants
 */

export const CONFIG = {
  // وضع معرفات (Security Roles) رتب الديسكورد التي تحصل على صلاحيات الإدارة تلقائياً
  ADMIN_ROLE_IDS: [
    '123456789012345678', // مثال: رتبة المؤسس
    '876543210987654321', // مثال: رتبة المدير العام
  ],
  
  // الرتب التي يمكنها رؤية لوحة التحكم (Staff)
  STAFF_ROLE_IDS: [
    '112233445566778899', 
  ],

  // إعدادات أخرى
  MAX_CHARACTERS_PER_USER: 3,
};
