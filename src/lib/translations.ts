import { Translations } from '../types';

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
  hero_title: { ar: 'مجتمع {communityName} للعب الأدوار', en: '{communityName} Roleplay Community' },
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
  
  // About Us Page
  about_intro: { ar: '{communityName} هو أكثر من مجرد سيرفر - إنه مجتمع نابض بالحياة من اللاعبين الذين يتشاركون شغف اللعب الأدوار.', en: '{communityName} is more than just a server - it is a vibrant community of players who share a passion for roleplaying.' },
  our_mission: { ar: 'مهمتنا', en: 'Our Mission' },
  mission_text: { ar: 'مهمتنا هي توفير بيئة لعب أدوار غامرة وعالية الجودة حيث يمكن للاعبين إنشاء قصصهم وشخصياتهم الفريدة.', en: 'Our mission is to provide an immersive, high-quality roleplaying environment where players can create their own unique stories and characters.' },
  join_community: { ar: 'انضم لمجتمعنا على ديسكورد', en: 'Join Our Discord Community' },
  
  // Discord Embed
  discord_online: { ar: 'متصل', en: 'Online' },
  discord_members: { ar: 'عضو', en: 'Members' },
  discord_widget_error: { ar: 'بيانات الأعضاء الحية غير متاحة.', en: 'Live member count unavailable.' },
  discord_widget_error_misconfigured: { ar: 'الويدجت غير معد. يرجى وضع ID السيرفر في ملف الإعدادات.', en: 'Widget is not configured. Please set your Server ID in the config file.' },
  discord_widget_error_invalid_id: { ar: 'ID سيرفر الديسكورد غير صالح. يرجى التحقق من الإعدادات.', en: 'Invalid Discord Server ID. Please check your configuration.' },
  discord_widget_error_disabled: { ar: 'ويدجت الديسكورد معطل. يرجى تفعيله من إعدادات السيرفر.', en: 'Discord widget is disabled. Please enable it in your server settings.' },

  // Footer
  footer_rights: { ar: '© {year} {communityName}. جميع الحقوق محفوظة.', en: '© {year} {communityName}. All Rights Reserved.' },

  // Store & Cart
  add_to_cart: { ar: 'أضف للسلة', en: 'Add to Cart' },
  your_cart: { ar: 'سلة التسوق', en: 'Your Cart' },
  empty_cart: { ar: 'سلتك فارغة.', en: 'Your cart is empty.' },
  subtotal: { ar: 'المجموع الفرعي', en: 'Subtotal' },
  checkout: { ar: 'الدفع', en: 'Checkout' },
  remove: { ar: 'إزالة', en: 'Remove' },
  checkout_via_discord: { ar: 'الدفع عبر ديسكورد', en: 'Checkout via Discord' },
  checkout_instructions: { ar: 'لإتمام عملية الشراء، يرجى الانضمام إلى سيرفر الديسكورد الخاص بنا وفتح تذكرة في قناة الدعم. سيقوم أحد أعضاء فريقنا بمساعدتك في أسرع وقت ممكن.', en: 'To complete your purchase, please join our Discord server and open a ticket in the support channel. A team member will assist you shortly.' },
  open_ticket: { ar: 'افتح تذكرة', en: 'Open a Ticket' },
  
  // Applies & Quiz
  apply_now: { ar: 'قدم الآن', en: 'Apply Now' },
  application_closed: { ar: 'التقديم مغلق', en: 'Application Closed' },
  already_applied: { ar: 'تم التقديم', en: 'Already Applied' },
  no_applies_open: { ar: 'لا يوجد تقديمات مفتوحة حالياً.', en: 'No applications are open at this time.'},
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

  // Admin Page
  quiz_management: { ar: 'إدارة نماذج التقديم', en: 'Quiz Forms Management' },
  submission_management: { ar: 'إدارة طلبات التقديم', en: 'Application Submissions' },
  rules_management: { ar: 'إدارة القوانين', en: 'Rules Management' },
  store_management: { ar: 'إدارة المتجر', en: 'Store Management' },
  audit_log: { ar: 'سجل الإجراءات', en: 'Audit Log' },
  create_new_quiz: { ar: 'إنشاء تقديم جديد', en: 'Create New Quiz' },
  edit_quiz: { ar: 'تعديل التقديم', en: 'Edit Quiz' },
  quiz_title: { ar: 'عنوان التقديم (مفتاح الترجمة)', en: 'Quiz Title (Translation Key)' },
  quiz_description: { ar: 'وصف التقديم (مفتاح الترجمة)', en: 'Quiz Description (Translation Key)' },
  quiz_questions: { ar: 'أسئلة التقديم', en: 'Quiz Questions' },
  quiz_handler_roles: { ar: 'معرفات الرتب التي يمكنها الاستلام', en: 'Role IDs that can handle' },
  quiz_handler_roles_desc: { ar: 'ضع فاصلة (,) بين كل معرف. اتركه فارغاً للسماح لجميع المشرفين.', en: 'Comma-separated IDs. Leave blank to allow all admins.' },
  add_question: { ar: 'إضافة سؤال', en: 'Add Question' },
  question_text: { ar: 'نص السؤال (مفتاح الترجمة)', en: 'Question Text (Translation Key)' },
  time_limit_seconds: { ar: 'الوقت المحدد (بالثواني)', en: 'Time Limit (seconds)' },
  save_quiz: { ar: 'حفظ التقديم', en: 'Save Quiz' },
  delete_quiz: { ar: 'حذف التقديم', en: 'Delete Quiz' },
  status: { ar: 'الحالة', en: 'Status' },
  open: { ar: 'مفتوح', en: 'Open' },
  closed: { ar: 'مغلق', en: 'Closed' },
  actions: { ar: 'الإجراءات', en: 'Actions' },
  edit: { ar: 'تعديل', en: 'Edit' },
  applicant: { ar: 'المتقدم', en: 'Applicant' },
  submitted_on: { ar: 'تاريخ التقديم', en: 'Submitted On' },
  view_submission: { ar: 'عرض الطلب', en: 'View Submission' },
  take_order: { ar: 'استلام الطلب', en: 'Take Order' },
  take_order_forbidden: { ar: 'ليس لديك صلاحية', en: 'Not permitted' },
  taken_by: { ar: 'مستلم بواسطة', en: 'Taken by' },
  accept: { ar: 'قبول', en: 'Accept' },
  refuse: { ar: 'رفض', en: 'Refuse' },
  submission_details: { ar: 'تفاصيل الطلب', en: 'Submission Details' },
  close: { ar: 'إغلاق', en: 'Close' },
  no_pending_submissions: { ar: 'لا توجد طلبات تقديم معلقة حالياً.', en: 'There are no pending submissions.' },
  log_timestamp: { ar: 'الوقت', en: 'Timestamp' },
  log_admin: { ar: 'المشرف', en: 'Admin' },
  log_action: { ar: 'الإجراء', en: 'Action' },
  no_logs_found: { ar: 'لا توجد سجلات.', en: 'No logs found.' },
  category_title: { ar: 'عنوان الفئة (مفتاح الترجمة)', en: 'Category Title (Translation Key)' },
  rule_text: { ar: 'نص القانون (مفتاح الترجمة)', en: 'Rule Text (Translation Key)' },
  add_rule: { ar: 'إضافة قانون', en: 'Add Rule' },
  add_category: { ar: 'إضافة فئة', en: 'Add Category' },
  save_rules: { ar: 'حفظ القوانين', en: 'Save Rules' },
  delete_category_confirm: { ar: 'هل أنت متأكد من حذف هذه الفئة وجميع قوانينها؟', en: 'Are you sure you want to delete this category and all its rules?' },
  rules_updated_success: { ar: 'تم تحديث القوانين بنجاح!', en: 'Rules updated successfully!' },
  admin_session_error_warning: { ar: 'تعذر التحقق من الجلسة مع الخادم. يتم عرض البيانات المحلية وقد تفشل بعض الإجراءات.', en: 'Could not verify session with the server. Displaying cached data and some actions may fail.'},
  admin_permissions_error: { ar: 'جلستك غير صالحة أو أنك لا تملك الصلاحيات.', en: 'Your session is invalid or you lack permissions.' },
  new_submission_toast: { ar: 'تم استلام طلب تقديم جديد من {username}!', en: 'New application received from {username}!' },
  reset_user_application: { ar: 'إعادة تعيين تقديم مستخدم', en: 'Reset User Application' },
  reset_user_application_desc: { ar: 'إذا احتاج مستخدم للتقديم مرة أخرى، يمكنك حذف تقديمه القديم من هنا.', en: 'If a user needs to apply again, you can delete their old submission here.' },
  select_quiz_to_reset: { ar: 'اختر التقديم...', en: 'Select quiz...' },
  enter_user_id: { ar: 'أدخل معرف المستخدم (Discord ID)', en: 'Enter User ID' },
  reset_application_button: { ar: 'إعادة تعيين', en: 'Reset' },
  user_or_quiz_not_selected: { ar: 'الرجاء اختيار تقديم وإدخال معرف مستخدم.', en: 'Please select a quiz and enter a user ID.' },
  reset_submission_success: { ar: 'تم إعادة تعيين التقديم بنجاح للمستخدم {userId}!', en: 'Successfully reset application for user {userId}!' },
  reset_submission_error: { ar: 'فشل في إعادة تعيين التقديم. تحقق من المعرف أو أن المستخدم لديه تقديم.', en: 'Failed to reset application. Check the ID or that the user has a submission.' },

  // Submission Statuses
  status_pending: { ar: 'قيد الانتظار', en: 'Pending' },
  status_taken: { ar: 'قيد المراجعة', en: 'Under Review' },
  status_accepted: { ar: 'مقبول', en: 'Accepted' },
  status_refused: { ar: 'مرفوض', en: 'Refused' },

  // My Applications Page
  no_applications_submitted: { ar: 'لم تقم بتقديم أي طلبات بعد.', en: 'You have not submitted any applications yet.' },
  application_type: { ar: 'نوع التقديم', en: 'Application Type' },
  
  // Profile Page
  user_id: { ar: 'معرف المستخدم', en: 'User ID' },
  role: { ar: 'الرتبة', en: 'Role' },
  admin: { ar: 'مشرف', en: 'Admin' },
  member: { ar: 'عضو', en: 'Member' },
  recent_applications: { ar: 'آخر التقديمات', en: 'Recent Applications' },

  // Role Update Toasts
  role_updated: { ar: 'تم تحديث رتبتك إلى: {roleName}', en: 'Your role has been updated to: {roleName}' },
  admin_granted: { ar: 'لقد تم منحك صلاحيات المشرف!', en: 'You have been granted administrator privileges!' },
  admin_revoked: { ar: 'تم سحب صلاحيات المشرف منك.', en: 'Your administrator privileges have been revoked.' },

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

  // Rules
  rules_general_title: { ar: 'القوانين العامة', en: 'General Rules' },
  rule_general_1: { ar: 'يجب احترام جميع اللاعبين والمشرفين.', en: 'Respect all players and administrators.' },
  rule_general_2: { ar: 'يمنع استخدام أي برامج غش أو استغلال أخطاء اللعبة.', en: 'The use of cheats or exploitation of game bugs is forbidden.' },
  rules_rp_title: { ar: 'قوانين اللعب الأدوار', en: 'Roleplay Rules' },
  rule_rp_1: { ar: 'يجب أن تبقى في شخصيتك طوال الوقت (In-Character).', en: 'You must remain in character at all times.' },
  no_rules_yet: { ar: 'لم تتم إضافة القوانين بعد.', en: 'The rules have not been added yet.' },

  // Quizzes
  quiz_police_name: { ar: 'تقديم قسم الشرطة', en: 'Police Department Application' },
  quiz_police_desc: { ar: 'اقرأ القوانين جيداً. أي محاولة غش ستؤدي للرفض الفوري.', en: 'Read the rules carefully. Any attempt to cheat will result in immediate rejection.' },
  q_police_1: { ar: 'ما هو الإجراء الأول عند التعامل مع شخص مشتبه به؟', en: 'What is the first procedure when dealing with a suspect?' },
  q_police_2: { ar: 'متى يسمح لك باستخدام القوة المميتة؟', en: 'When are you permitted to use lethal force?' },
  
  quiz_medic_name: { ar: 'تقديم قسم الإسعاف', en: 'EMS Department Application' },
  quiz_medic_desc: { ar: 'مطلوب منك الهدوء والاحترافية في جميع الأوقات.', en: 'You are required to be calm and professional at all times.' },
  q_medic_1: { ar: 'ما هي أولويتك القصوى عند الوصول إلى مكان الحادث؟', en: 'What is your top priority when arriving at an accident scene?' },
};
