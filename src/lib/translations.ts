
import { Translations } from '../types';

// This file serves as a fallback for translations if the database connection fails.
// All translations are now primarily managed in the 'translations' table in the database
// and can be edited via the Admin Panel.

export const translations: Translations = {
  // Navbar
  home: { ar: 'الرئيسية', en: 'Home' },
  store: { ar: 'المتجر', en: 'Store' },
  rules: { ar: 'القوانين', en: 'Rules' },
  applies: { ar: 'التقديمات', en: 'Applies' },
  about_us: { ar: 'من نحن', en: 'About Us' },
  login_discord: { ar: 'تسجيل الدخول', en: 'Login with Discord' },
  logout: { ar: 'تسجيل الخروج', en: 'Logout' },
  welcome: { ar: 'أهلاً', en: 'Welcome' },
  admin_panel: { ar: 'لوحة التحكم', en: 'Admin Panel' },
  my_applications: { ar: 'تقديماتي', en: 'My Applications' },
  my_profile: { ar: 'ملفي الشخصي', en: 'My Profile' },

  // Hero Section
  hero_title: { ar: 'مجتمع {communityName}', en: '{communityName} Community' },
  hero_subtitle: { ar: 'حيث تبدأ قصتك. انضم إلى عالم غامر من الاحتمالات اللانهائية.', en: 'Where your story begins. Join an immersive world of endless possibilities.' },
  join_us: { ar: 'انضم إلينا', en: 'Join Us' },

  // Join Us Modal
  join_modal_title: { ar: 'انضم إلى مجتمعنا', en: 'Join Our Community' },
  join_discord: { ar: 'انضم لسيرفر الديسكورد', en: 'Join Discord Server' },
  connect_mta: { ar: 'اتصل بسيرفر MTA', en: 'Connect to MTA Server' },
  
  // Pages General
  page_title_store: { ar: 'متجر {communityName}', en: '{communityName} Store' },
  page_title_rules: { ar: 'قوانين السيرفر', en: 'Server Rules' },
  page_title_applies: { ar: 'التقديمات المتاحة', en: 'Available Applications' },
  page_title_about: { ar: 'عن {communityName}', en: 'About {communityName}' },
  page_title_admin: { ar: 'لوحة تحكم المشرفين', en: 'Admin Control Panel' },
  page_title_my_applications: { ar: 'حالة تقديماتي', en: 'My Applications Status' },
  coming_soon: { ar: 'قريباً...', en: 'Coming Soon...' },
  questions: { ar: 'أسئلة', en: 'Questions' },
  
  // About Us Page
  about_intro: { ar: '{communityName} هو أكثر من مجرد سيرفر - إنه مجتمع نابض بالحياة من اللاعبين الذين يتشاركون شغف اللعب الأدوار.', en: '{communityName} is more than just a server - it is a vibrant community of players who share a passion for roleplaying.' },
  our_mission: { ar: 'مهمتنا', en: 'Our Mission' },
  mission_text: { ar: 'مهمتنا هي توفير بيئة لعب أدوار غامرة وعالية الجودة حيث يمكن للاعبين إنشاء قصصهم وشخصياتهم الفريدة.', en: 'Our mission is to provide an immersive, high-quality roleplaying environment where players can create their own unique stories and characters.' },
  join_community: { ar: 'انضم لمجتمعنا على ديسكورد', en: 'Join Our Discord Community' },
  
  // Discord Embed
  discord_online: { ar: 'متصل', en: 'Online' },
  discord_members: { ar: 'عضو', en: 'Members' },

  // Footer
  footer_rights: { ar: '© {year} {communityName}. جميع الحقوق محفوظة.', en: '© {year} {communityName}. All Rights Reserved.' },

  // Store & Cart
  add_to_cart: { ar: 'أضف للسلة', en: 'Add to Cart' },
  item_added_to_cart: { ar: 'تمت إضافة {itemName} إلى السلة!', en: '{itemName} added to cart!' },
  your_cart: { ar: 'سلة التسوق', en: 'Your Cart' },
  empty_cart: { ar: 'سلتك فارغة.', en: 'Your cart is empty.' },
  subtotal: { ar: 'المجموع الفرعي', en: 'Subtotal' },
  checkout: { ar: 'الدفع', en: 'Checkout' },
  remove: { ar: 'إزالة', en: 'Remove' },
  checkout_via_discord: { ar: 'الدفع عبر ديسكورد', en: 'Checkout via Discord' },
  checkout_instructions: { ar: 'لإكمال عملية الشراء، يرجى فتح تذكرة في سيرفر الديسكورد الخاص بنا وسيقوم أحد المسؤولين بمساعدتك.', en: 'To complete your purchase, please open a ticket in our Discord server and an admin will assist you.' },
  open_ticket: { ar: 'فتح تذكرة', en: 'Open a Ticket' },
  
  // Applies & Quiz
  apply_now: { ar: 'قدم الآن', en: 'Apply Now' },
  already_applied: { ar: 'تم التقديم', en: 'Already Applied' },
  application_closed: { ar: 'التقديم مغلق', en: 'Application Closed' },
  no_applies_open: { ar: 'لا يوجد تقديمات مفتوحة حالياً.', en: 'No applications are open at this time.'},
  no_rules_yet: { ar: 'سيتم إضافة القوانين قريباً.', en: 'Rules will be added soon.'},
  quiz_rules: { ar: 'تعليمات التقديم', en: 'Application Instructions' },
  begin_quiz: { ar: 'ابدأ الاختبار', en: 'Begin Quiz' },
  question: { ar: 'سؤال', en: 'Question' },
  of: { ar: 'من', en: 'of' },
  time_left: { ar: 'الوقت المتبقي', en: 'Time Left' },
  seconds: { ar: 'ثانية', en: 'seconds' },
  next_question: { ar: 'السؤال التالي', en: 'Next Question' },
  submit_application: { ar: 'إرسال التقديم', en: 'Submit Application' },
  application_submitted: { ar: 'تم إرسال تقديمك بنجاح!', en: 'Your application has been submitted successfully!' },
  application_submitted_desc: { ar: 'ستتم مراجعته من قبل الإدارة قريباً. يمكنك متابعة حالته من صفحة "تقديماتي".', en: 'It will be reviewed by the administration soon. You can track its status on the "My Applications" page.' },
  view_my_applications: { ar: 'عرض تقديماتي', en: 'View My Applications' },
  cheat_attempt_detected: { ar: 'تم كشف محاولة غش! تم إعادة تعيين التقديم.', en: 'Cheat attempt detected! Application has been reset.' },
  cheat_method_switched_tab: { ar: 'تبديل التبويبات', en: 'Switched Tabs' },
  cheat_method_lost_focus: { ar: 'فقدان التركيز', en: 'Lost Focus' },
  cheat_attempts_report: { ar: 'تقرير محاولات الغش', en: 'Cheat Attempts Report' },
  cheat_attempts_count: { ar: 'تم تسجيل {count} محاولة/محاولات.', en: '{count} attempt(s) were logged.' },
  no_cheat_attempts: { ar: 'لم يتم تسجيل أي محاولات غش. عمل رائع!', en: 'No cheat attempts logged. Great job!' },


  // Admin Page
  dashboard: { ar: 'الرئيسية', en: 'Dashboard' },
  admin_dashboard_welcome_message: { ar: 'أهلاً بك في لوحة التحكم. يمكنك إدارة جميع إعدادات الموقع من الشريط الجانبي.', en: 'Welcome to the control panel. You can manage all website settings from the sidebar.'},
  loading_submissions: { ar: 'جاري تحميل التقديمات...', en: 'Loading submissions...' },
  quiz_management: { ar: 'إدارة نماذج التقديم', en: 'Quiz Forms Management' },
  submission_management: { ar: 'إدارة طلبات التقديم', en: 'Application Submissions' },
  rules_management: { ar: 'إدارة القوانين', en: 'Rules Management' },
  store_management: { ar: 'إدارة المتجر', en: 'Store Management' },
  appearance_settings: { ar: 'إعدادات المظهر', en: 'Appearance Settings' },
  translations_management: { ar: 'إدارة الترجمات', en: 'Translations Management' },
  permissions_management: { ar: 'إدارة الصلاحيات', en: 'Permissions Management' },
  audit_log: { ar: 'سجل التدقيق', en: 'Audit Log' },
  user_lookup: { ar: 'بحث عن مستخدم', en: 'User Lookup' },
  create_new_quiz: { ar: 'إنشاء تقديم جديد', en: 'Create New Quiz' },
  edit_quiz: { ar: 'تعديل التقديم', en: 'Edit Quiz' },
  quiz_title: { ar: 'عنوان التقديم (مفتاح الترجمة)', en: 'Quiz Title (Translation Key)' },
  quiz_description: { ar: 'وصف التقديم (مفتاح الترجمة)', en: 'Quiz Description (Translation Key)' },
  quiz_questions: { ar: 'أسئلة التقديم', en: 'Quiz Questions' },
  add_question: { ar: 'إضافة سؤال', en: 'Add Question' },
  question_text: { ar: 'نص السؤال (مفتاح الترجمة)', en: 'Question Text (Translation Key)' },
  time_limit_seconds: { ar: 'الوقت المحدد (بالثواني)', en: 'Time Limit (seconds)' },
  save_quiz: { ar: 'حفظ التقديم', en: 'Save Quiz' },
  save_rules: { ar: 'حفظ القوانين', en: 'Save Rules' },
  save_settings: { ar: 'حفظ الإعدادات', en: 'Save Settings' },
  save_translations: { ar: 'حفظ الترجمات', en: 'Save Translations' },
  save_permissions: { ar: 'حفظ الصلاحيات', en: 'Save Permissions' },
  delete_quiz: { ar: 'حذف التقديم', en: 'Delete Quiz' },
  status: { ar: 'الحالة', en: 'Status' },
  open: { ar: 'مفتوح', en: 'Open' },
  closed: { ar: 'مغلق', en: 'Closed' },
  actions: { ar: 'الإجراءات', en: 'Actions' },
  edit: { ar: 'تعديل', en: 'Edit' },
  applicant: { ar: 'المتقدم', en: 'Applicant' },
  highest_role: { ar: 'أعلى رتبة', en: 'Highest Role' },
  submitted_on: { ar: 'تاريخ التقديم', en: 'Submitted On' },
  result_date: { ar: 'تاريخ النتيجة', en: 'Result Date' },
  view_submission: { ar: 'عرض الطلب', en: 'View Submission' },
  take_order: { ar: 'استلام الطلب', en: 'Take Order' },
  take_order_forbidden: { ar: 'غير مسموح', en: 'Not Allowed' },
  taken_by: { ar: 'مستلم بواسطة', en: 'Taken by' },
  accept: { ar: 'قبول', en: 'Accept' },
  refuse: { ar: 'رفض', en: 'Refuse' },
  submission_details: { ar: 'تفاصيل الطلب', en: 'Submission Details' },
  close: { ar: 'إغلاق', en: 'Close' },
  no_pending_submissions: { ar: 'لا توجد طلبات تقديم معلقة حالياً.', en: 'There are no pending submissions.' },
  admin_revoked: { ar: 'تم سحب صلاحيات المشرف منك.', en: 'Your admin permissions have been revoked.' },
  admin_granted: { ar: 'تم منحك صلاحيات المشرف.', en: 'You have been granted admin permissions.' },
  admin_permissions_error: { ar: 'خطأ في صلاحيات المشرف أو انتهت صلاحية الجلسة. تم تسجيل خروجك.', en: 'Admin permission error or session expired. You have been logged out.' },
  admin_session_error_warning: { ar: 'لا يمكن التحقق من جلسة المشرف مع الخادم. يرجى المحاولة مرة أخرى لاحقاً.', en: 'Could not verify admin session with the server. Please try again later.'},
  verifying_admin_permissions: { ar: 'جاري التحقق من صلاحيات المشرف...', en: 'Verifying admin permissions...' },
  quiz_handler_roles: { ar: 'رتب معالجة التقديم', en: 'Application Handler Roles'},
  quiz_handler_roles_desc: { ar: 'ضع هنا آي دي الرتب المسموح لها باستلام هذا النوع من التقديمات (افصل بينها بفاصلة).', en: 'Enter Role IDs allowed to handle these submissions (comma-separated).'},
  config_updated_success: { ar: 'تم تحديث الإعدادات بنجاح!', en: 'Settings updated successfully!' },
  rules_updated_success: { ar: 'تم تحديث القوانين بنجاح!', en: 'Rules updated successfully!' },
  permissions_saved_success: { ar: 'تم حفظ الصلاحيات بنجاح!', en: 'Permissions saved successfully!'},
  permissions_load_error: { ar: 'فشل تحميل الصلاحيات', en: 'Failed to load permissions' },
  
  // Admin Page - Bilingual Inputs & Forms
  text_en: { ar: 'النص بالإنجليزي', en: 'Text (English)' },
  text_ar: { ar: 'النص بالعربي', en: 'Text (Arabic)' },
  title_en: { ar: 'العنوان بالإنجليزي', en: 'Title (English)' },
  title_ar: { ar: 'العنوان بالعربي', en: 'Title (Arabic)' },
  description_en: { ar: 'الوصف بالإنجليزي', en: 'Description (English)' },
  description_ar: { ar: 'الوصف بالعربي', en: 'Description (Arabic)' },
  name_en: { ar: 'الاسم بالإنجليزي', en: 'Name (English)' },
  name_ar: { ar: 'الاسم بالعربي', en: 'Name (Arabic)' },
  price: { ar: 'السعر', en: 'Price' },
  image_url: { ar: 'رابط الصورة', en: 'Image URL' },
  create_product: { ar: 'إنشاء منتج جديد', en: 'Create New Product' },
  edit_product: { ar: 'تعديل المنتج', en: 'Edit Product' },
  save_product: { ar: 'حفظ المنتج', en: 'Save Product' },
  add_new_product: { ar: 'إضافة منتج جديد', en: 'Add New Product' },
  logo_image_url: { ar: 'رابط صورة الشعار', en: 'Logo Image URL' },
  banner_image_url: { ar: 'رابط صورة البانر', en: 'Banner Image URL' },
  
  // Admin Page - User Lookup & Bans
  discord_id_placeholder: { ar: 'معرف مستخدم ديسكورد...', en: 'Discord User ID...' },
  search: { ar: 'بحث', en: 'Search' },
  ban: { ar: 'حظر', en: 'Ban' },
  unban: { ar: 'فك الحظر', en: 'Unban' },
  reason: { ar: 'السبب', en: 'Reason' },
  duration: { ar: 'المدة', en: 'Duration' },
  confirm_ban: { ar: 'تأكيد الحظر', en: 'Confirm Ban' },
  banned_indefinitely: {ar: 'محظور بشكل دائم', en: 'Banned indefinitely'},
  banned_until: {ar: 'محظور حتى {date}', en: 'Banned until {date}'},

  // Banned Page
  you_are_banned: { ar: 'أنت محظور', en: 'You Are Banned' },
  banned_page_message: { ar: 'تم حظرك من الوصول إلى هذا الموقع.', en: 'You have been banned from accessing this site.' },
  ban_reason: { ar: 'سبب الحظر:', en: 'Reason for ban:' },
  ban_expires: { ar: 'ينتهي الحظر في:', en: 'Ban expires:' },
  ban_permanent: { ar: 'الحظر دائم.', en: 'This ban is permanent.' },
  
  // Admin Page - Appearance
  community_name: { ar: 'اسم المجتمع', en: 'Community Name'},
  logo_url: { ar: 'رابط الشعار (URL)', en: 'Logo URL'},
  background_image_url: { ar: 'رابط صورة الخلفية (URL)', en: 'Background Image URL'},
  background_image_url_desc: { ar: 'اتركه فارغاً لاستخدام الخلفية الافتراضية.', en: 'Leave empty to use the default animated background.'},
  discord_guild_id: { ar: 'آي دي سيرفر الديسكورد', en: 'Discord Guild ID'},
  discord_guild_id_desc: { ar: 'مطلوب للمصادقة ومزامنة الرتب.', en: 'Required for authentication and role sync.'},
  submissions_webhook_url: { ar: 'معرف قناة التقديمات', en: 'Submissions Channel ID'},
  submissions_webhook_url_desc: { ar: 'المعرف الرقمي للقناة التي تستقبل إشعارات التقديمات الجديدة.', en: 'The ID of the channel that receives new submission notifications.'},
  audit_log_webhook_url: { ar: 'معرف قناة سجل التدقيق العام', en: 'General Audit Log Channel ID'},
  audit_log_webhook_url_desc: { ar: 'قناة عامة/احتياطية لسجلات إجراءات المشرفين.', en: 'A general/fallback channel for admin action logs.'},
  log_channel_submissions: { ar: 'معرف قناة سجلات التقديمات', en: 'Submissions Log Channel ID'},
  log_channel_submissions_desc: { ar: 'قناة للسجلات المتعلقة بحالة التقديمات (استلام، قبول، رفض).', en: 'Channel for logs related to submission status changes (taken, accepted, refused).'},
  log_channel_bans: { ar: 'معرف قناة سجلات الحظر', en: 'Bans Log Channel ID'},
  log_channel_bans_desc: { ar: 'قناة للسجلات المتعلقة بحظر وفك حظر المستخدمين.', en: 'Channel for logs related to user bans and unbans.'},
  log_channel_admin: { ar: 'معرف قناة سجلات الإدارة', en: 'Admin Actions Log Channel ID'},
  log_channel_admin_desc: { ar: 'قناة للسجلات المتعلقة بتغييرات لوحة التحكم (مثل تعديل التقديمات، القوانين، الإعدادات).', en: 'Channel for logs related to admin panel changes (e.g., editing quizzes, rules, settings).'},

  // Admin Page - Permissions
  discord_roles: { ar: 'رتب الديسكورد', en: 'Discord Roles' },
  available_permissions: { ar: 'الصلاحيات المتاحة', en: 'Available Permissions' },
  select_role_to_manage: { ar: 'اختر رتبة لعرض صلاحياتها.', en: 'Select a role to see its permissions.' },
  admin_permissions_instructions: { ar: 'اختر رتبة من القائمة لعرض وتعديل صلاحياتها. صلاحية <code>_super_admin</code> تمنح جميع الصلاحيات الأخرى تلقائياً.', en: 'Select a role from the list to view and modify its permissions. The <code>_super_admin</code> permission automatically grants all other permissions.'},
  admin_permissions_bootstrap_instructions_title: { ar: 'غير قادر على الدخول؟', en: 'Locked Out?' },
  admin_permissions_bootstrap_instructions_body: { ar: 'لمنح صلاحيات المشرف الأولية، اذهب إلى جدول <code>role_permissions</code> في Supabase. أضف صفاً جديداً، ضع آي دي رتبة المشرف في <code>role_id</code>، واكتب <code>{\\"_super_admin\\"}</code> في حقل <code>permissions</code> ثم قم بتحديث الصفحة.', en: 'To grant initial admin access, go to your Supabase <code>role_permissions</code> table. Insert a new row, put your admin role ID in <code>role_id</code>, and type <code>{\\"_super_admin\\"}</code> into the <code>permissions</code> field, then refresh the site.' },


  // Submission Statuses
  status_pending: { ar: 'قيد الانتظار', en: 'Pending' },
  status_taken: { ar: 'قيد المراجعة', en: 'Under Review' },
  status_accepted: { ar: 'مقبول', en: 'Accepted' },
  status_refused: { ar: 'مرفوض', en: 'Refused' },

  // My Applications & Profile Page
  no_applications_submitted: { ar: 'لم تقم بتقديم أي طلبات بعد.', en: 'You have not submitted any applications yet.' },
  application_type: { ar: 'نوع التقديم', en: 'Application Type' },
  user_id: { ar: 'معرف المستخدم', en: 'User ID' },
  view_on_discord: { ar: 'عرض في ديسكورد', en: 'View on Discord' },
  recent_applications: { ar: 'التقديمات الأخيرة', en: 'Recent Applications' },
  member: { ar: 'عضو', en: 'Member' },
  refresh_profile_tooltip: { ar: 'مزامنة بياناتي مع ديسكورد', en: 'Sync my data with Discord' },
  profile_synced_success: { ar: 'تم تحديث ملفك الشخصي بنجاح!', en: 'Your profile has been successfully updated!' },
  profile_synced_error: { ar: 'فشل تحديث الملف الشخصي. حاول مرة أخرى.', en: 'Failed to update profile. Please try again.' },
  
  // Audit Logs
  log_timestamp: { ar: 'الوقت', en: 'Timestamp' },
  log_admin: { ar: 'المشرف', en: 'Admin' },
  log_action: { ar: 'الإجراء', en: 'Action' },
  no_logs_found: { ar: 'لا توجد سجلات لعرضها.', en: 'No logs to display.' },

  // Health Check
  health_check_title: { ar: 'فحص صحة النظام', en: 'System Health Check' },
  health_check_desc: { ar: 'أداة تشخيصية للمطورين للتأكد من أن جميع أجزاء النظام متصلة بشكل صحيح.', en: 'A diagnostic tool for developers to ensure all system components are correctly connected.'},
  health_check_step1: { ar: 'الخطوة 1: رابط الاسترجاع (OAuth Redirect URI)', en: 'Step 1: OAuth Redirect URI' },
  health_check_step1_desc: { ar: 'تأكد من أن هذا الرابط مضاف في قسم "URL Configuration" في إعدادات المصادقة في Supabase.', en: 'Ensure this URI is added to your Supabase Authentication > URL Configuration settings.'},
  health_check_uri_label: { ar: 'رابط الاسترجاع الخاص بك هو:', en: 'Your Redirect URI is:'},
  health_check_env_vars: { ar: 'الخطوة 2: متغيرات البيئة (Frontend)', en: 'Step 2: Environment Variables (Frontend)'},
  health_check_env_vars_desc: { ar: 'هذه هي المتغيرات المحملة في الواجهة الأمامية من ملف .env الخاص بك.', en: 'These are the variables loaded into the frontend from your .env file.'},
  health_check_step3: { ar: 'الخطوة 3: اختبار اتصال البوت', en: 'Step 3: Bot Connection Test'},
  health_check_step3_desc: { ar: 'هذا الاختبار يتحقق مما إذا كانت دالة Supabase يمكنها الوصول إلى البوت الخاص بك بنجاح.', en: 'This test checks if the Supabase Function can successfully reach your Discord bot.'},
  health_check_run_test: { ar: 'تشغيل اختبار الاتصال', en: 'Run Connection Test'},
  health_check_test_running: { ar: 'جاري الاختبار...', en: 'Testing...'},
  health_check_test_result: { ar: 'نتيجة الاختبار', en: 'Test Result'},
  health_check_step4: { ar: 'الخطوة 4: اختبار مزامنة المستخدم', en: 'Step 4: User Sync Test'},
  // FIX: Escaped single quote in the English translation string.
  health_check_step4_desc: { ar: 'اختبر جلب بيانات مستخدم معين من ديسكورد عبر البوت.', en: 'Test fetching a specific user\'s data from Discord via the bot.'},
  health_check_get_discord_id: { ar: 'كيف أحصل على معرف ديسكورد؟', en: 'How to get a Discord ID?'},
  health_check_get_discord_id_steps: { ar: 'في ديسكورد، اذهب إلى الإعدادات > متقدم > فعل وضع المطور. ثم انقر بزر الماوس الأيمن على أي مستخدم واختر "نسخ معرف المستخدم".', en: 'In Discord, go to Settings > Advanced > enable Developer Mode. Then, right-click any user and select "Copy User ID".'},
  health_check_discord_id_input: { ar: 'أدخل معرف ديسكورد هنا...', en: 'Enter Discord User ID...'},
  health_check_run_sync_test: { ar: 'تشغيل اختبار المزامنة', en: 'Run Sync Test'},
  health_check_sync_test_result: { ar: 'نتيجة المزامنة', en: 'Sync Result'},
  health_check_result_interpretation: { ar: 'تفسير النتائج', en: 'Interpreting the Results'},
  health_check_result_success: { ar: '<ul><li class="mb-2"><strong>Success (200 OK):</strong> Excellent! The user was found in the guild and their data was fetched successfully. This confirms everything is working.</li>', en: '<ul><li class="mb-2"><strong>Success (200 OK):</strong> Excellent! The user was found in the guild and their data was fetched successfully. This confirms everything is working.</li>'},
  // FIX: Escaped single quote in translation strings to fix parsing error.
  health_check_result_404: { ar: '<li class="mb-2"><strong>Error (404 Not Found):</strong> This means the bot connected to Discord correctly, but couldn\'t find a user with that ID in your server. Check the ID or ensure the user is a member.</li>', en: '<li class="mb-2"><strong>Error (404 Not Found):</strong> This means the bot connected to Discord correctly, but couldn\'t find a user with that ID in your server. Check the ID or ensure the user is a member.</li>'},
  // FIX: Escaped single quote in translation strings to fix parsing error.
  health_check_result_503: { ar: '<li class="mb-2"><strong>Error (503 Service Unavailable):</strong> The most common cause is that the <strong>Server Members Intent</strong> is not enabled in the Discord Developer Portal. Go to your bot\'s settings and turn it on.</li>', en: '<li class="mb-2"><strong>Error (503 Service Unavailable):</strong> The most common cause is that the <strong>Server Members Intent</strong> is not enabled in the Discord Developer Portal. Go to your bot\'s settings and turn it on.</li>'},
  // FIX: Escaped single quotes in translation strings to fix parsing error.
  health_check_result_other: { ar: '<li><strong>Other Errors:</strong> Usually indicates a problem with the bot\'s configuration or it being offline. Check the bot\'s logs for more details.</li></ul>', en: '<li><strong>Other Errors:</strong> Usually indicates a problem with the bot\'s configuration or it being offline. Check the bot\'s logs for more details.</li></ul>'},
  health_check_banner_link: { ar: 'اضغط هنا لتشغيل فحص النظام التشخيصي.', en: 'Click here to run system diagnostics.' },
  
  // Session Management
  session_expired_not_in_guild: { ar: 'انتهت صلاحية جلستك أو لم تعد عضواً في السيرفر. تم تسجيل خروجك.', en: 'Your session has expired or you are no longer in the guild. You have been logged out.'},
  
  // MOCK DATA TRANSLATIONS
  // Products
  product_vip_bronze_name: { ar: 'عضوية VIP برونزية', en: 'Bronze VIP Membership' },
  product_vip_bronze_desc: { ar: 'مميزات حصرية داخل السيرفر لمدة شهر.', en: 'Exclusive in-server perks for one month.' },
  product_vip_silver_name: { ar: 'عضوية VIP فضية', en: 'Silver VIP Membership' },
  product_vip_silver_desc: { ar: 'مميزات أفضل مع وصول خاص للمركبات.', en: 'Better perks with special vehicle access.' },
  product_cash_1_name: { ar: 'حزمة نقدية 100 ألف', en: '100k Cash Pack' },
  product_cash_1_desc: { ar: 'دفعة نقدية داخل اللعبة لتبدأ بقوة.', en: 'An in-game cash boost to get you started.' },
  product_custom_plate_name: { ar: 'لوحة سيارة مخصصة', en: 'Custom License Plate' },
  product_custom_plate_desc: { ar: 'لوحة فريدة لسيارتك المفضلة.', en: 'A unique license plate for your favorite vehicle.' },

  // Quizzes
  quiz_police_name: { ar: 'تقديم قسم الشرطة', en: 'Police Department Application' },
  quiz_police_desc: { ar: 'اقرأ القوانين جيداً. أي محاولة غش ستؤدي للرفض الفوري.', en: 'Read the rules carefully. Any attempt to cheat will result in immediate rejection.' },
  q_police_1: { ar: 'ما هو الإجراء الأول عند التعامل مع شخص مشتبه به؟', en: 'What is the first procedure when dealing with a suspect?' },
  q_police_2: { ar: 'متى يسمح لك باستخدام القوة المميتة؟', en: 'When are you permitted to use lethal force?' },
  
  quiz_medic_name: { ar: 'تقديم قسم الإسعاف', en: 'EMS Department Application' },
  quiz_medic_desc: { ar: 'مطلوب منك الهدوء والاحترافية في جميع الأوقات.', en: 'You are required to be calm and professional at all times.' },
  q_medic_1: { ar: 'ما هي أولويتك القصوى عند الوصول إلى مكان الحادث؟', en: 'What is your top priority when arriving at an accident scene?' },
// FIX: Removed invalid SQL syntax and correctly closed the object.
};
