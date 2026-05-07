const fs = require('fs');

const extractKeys = () => {
  const keys = new Set([
'nav_home', 'nav_about', 'nav_rules', 'nav_store', 'nav_applies', 'nav_admin', 'nav_login', 'nav_logout', 'nav_hello',
'2fa_backup_codes', '2fa_backup_desc', '2fa_desc', '2fa_disable', '2fa_enable', '2fa_invalid_code', '2fa_qr_help', '2fa_title', '2fa_verify_code',
'about_us', 'accept', 'accepted_apps', 'actions', 'add_balance', 'add_category', 'add_new_product', 'add_question', 'add_staff_member', 'add_to_cart', 'add_to_staff',
'admin_gate_enter', 'admin_gate_incorrect', 'admin_gate_prompt', 'admin_gate_title', 'admin_granted', 'admin_health_check_promo', 'admin_health_check_promo_link', 'admin_panel', 'admin_permissions_bootstrap_instructions_body', 'admin_permissions_instructions', 'admin_revoked',
'age', 'all_items', 'all_rights_reserved', 'already_applied', 'amount', 'amount_to_pay', 'answer_placeholder', 'answers', 'applicant', 'application_closed', 'application_submitted', 'application_submitted_desc', 'application_type', 'applications_history', 'applies', 'apply_now', 'are_you_staff', 'available_permissions', 'available_placeholders', 'balance_added_success', 'ban', 'ban_expired_msg', 'ban_expires', 'ban_permanent', 'ban_reason', 'bank', 'banned_page_message', 'banner_image_url', 'begin_quiz',
'cash', 'category_name_ar', 'category_name_en', 'channel_id_desc', 'characters', 'cheat_attempt_detected', 'checkout', 'checkout_instructions', 'checkout_via_discord', 'closed', 'complete_captcha_msg', 'confirm_ban', 'confirm_invoice', 'confirm_unlink', 'connect_mta', 'connecting', 'create_invoice', 'create_new_quiz', 'critical_threats', 'current_balance', 'current_configuration',
'dangerous_area', 'db_conn_error_desc', 'db_connection_error', 'delete_submission', 'description_ar', 'description_en', 'discord_id_placeholder', 'discord_id_to_add', 'discord_members', 'discord_online', 'discord_profile', 'discord_roles', 'dob', 'draft_restored_msg', 'duration',
'edit_branding', 'empty_cart', 'event', 'expected_back', 'expected_back_desc',
'faction', 'female', 'filter_accepted', 'filter_all', 'filter_pending', 'filter_refused', 'filter_search_placeholder', 'filter_taken', 'find_user', 'fix_step_1', 'fix_step_2', 'fix_step_3', 'fix_step_4', 'fix_step_5', 'follow_updates', 'follow_updates_desc',
'gender', 'general_stats', 'go_to_health_check_page',
'health_check_arch_desc', 'health_check_banner_link', 'health_check_desc', 'health_check_discord_id_input', 'health_check_result_404', 'health_check_result_503', 'health_check_result_interpretation', 'health_check_result_other', 'health_check_run_sync_test', 'health_check_run_test', 'health_check_step4_desc', 'health_check_test_result', 'health_check_test_running', 'health_check_title', 'hero_subtitle', 'hero_title', 'highest_level', 'highest_role', 'home', 'hours', 'how_to_fix',
'image_url', 'invoice_created_success', 'invoice_history', 'ip_client',
'job', 'job_and_faction', 'join_community', 'join_discord', 'join_modal_title', 'join_us',
'level', 'link', 'link_account', 'link_mta_description', 'link_mta_title', 'link_now', 'loading_community_hub', 'loading_mta_data', 'log_action', 'log_admin', 'log_admin_panel_access_title', 'log_settings_updated_title', 'log_timestamp', 'login', 'login_error_api_key_intro', 'login_error_api_key_title', 'login_error_step_fetch', 'login_error_step_intent', 'login_error_step_not_found', 'login_error_step_url', 'login_sync_failed_desc', 'login_sync_failed_title', 'logo_image_url', 'logout',
'maintenance_in_progress', 'maintenance_title', 'male', 'management_panel', 'meet_the_team', 'member', 'meta', 'missing_env_desc', 'mta_account', 'mta_error_title', 'mta_profile', 'mta_unlink_error', 'mta_unlink_success', 'mta_unlink_warning', 'my_applications', 'my_profile',
'name_ar', 'name_en', 'new_application', 'next_question', 'no_applications_submitted', 'no_applies_open', 'no_category', 'no_cheat_attempts', 'no_invoices_yet', 'no_logs_found', 'no_pending_submissions', 'no_properties', 'no_reason_provided', 'no_rules_yet', 'no_security_logs', 'no_submissions', 'no_vehicles', 'not_set',
'open', 'open_ticket', 'our_servers',
'page_title_applies', 'page_title_my_applications', 'pay_from_balance', 'permissions', 'permissions_load_error', 'permissions_saved_success', 'personal_info', 'playtime', 'please_wait', 'price', 'primary_color', 'product_categories_management', 'product_category', 'product_not_found', 'products_in_invoice', 'products_management', 'profile_refresh_error', 'profile_refresh_success', 'properties', 'purchase_failed', 'purchase_success_body', 'purchase_success_title',
'question', 'questions', 'quiz_handler_roles', 'quiz_handler_roles_desc', 'quiz_instructions', 'quiz_questions', 'quiz_rules', 'quiz_title',
'reason', 'refuse', 'remaining_balance', 'remove', 'result_date', 'resume_application', 'retry', 'retry_connection', 'rules', 'rules_load_failed', 'rules_subtitle', 'rules_title', 'rules_updated_success',
'save_changes', 'save_permissions', 'save_product', 'save_quiz', 'save_rules', 'save_settings', 'save_translations', 'search', 'search_logs', 'secondary_color', 'security_status', 'select_products', 'select_role_to_manage', 'server_management', 'session_expired_not_in_guild', 'setup_incomplete', 'severity', 'site_description', 'site_logo', 'site_name', 'site_settings', 'staff_login', 'staff_only_access', 'staff_role_ar', 'staff_role_en', 'stats', 'status', 'status_accepted', 'status_pending', 'status_refused', 'status_taken', 'store', 'store_empty', 'store_empty_desc', 'store_load_failed', 'store_subtitle', 'store_title', 'submission_deleted_success', 'submit_application', 'submitted_on', 'submitting_msg', 'subtotal', 'success', 'sync_profile', 'syncing',
'tab', 'take_order', 'taken_by', 'target_id', 'text_ar', 'text_en', 'time_limit_seconds', 'time_taken', 'title_ar', 'title_en', 'total_amount', 'total_apps', 'total_events', 'total_wealth', 'troubleshooting_steps',
'unban', 'unlink_mta_account', 'value', 'vehicles', 'view_my_applications', 'view_submission',
'welcome', 'year', 'you_are_banned', 'your_balance', 'your_cart'
  ]);
  const processFiles = (dir) => {
    try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const p = dir + '/' + file;
            if (fs.statSync(p).isDirectory()) {
                processFiles(p);
            } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
                const text = fs.readFileSync(p, 'utf8');
                const matches = text.match(/t\(['"]([^'"]+)['"]/g);
                if (matches) {
                    for (const m of matches) {
                        const kw = m.replace(/t\(['"]/, '').replace(/['"]$/, '');
                        keys.add(kw);
                    }
                }
            }
        }
    } catch {}
  };
  processFiles('src');
  return Array.from(keys);
}

const keys = extractKeys();

const dict = {
  about_us: { ar: 'من نحن', en: 'About Us' },
  home: { ar: 'الرئيسية', en: 'Home' },
  store: {ar: 'المتجر', en: 'Store'},
  rules: {ar: 'القوانين', en: 'Rules'},
  applies: {ar: 'التقديمات', en: 'Applies'},
  admin_panel: {ar: 'لوحة التحكم', en: 'Admin Panel'},
  login: {ar: 'تسجيل الدخول', en: 'Login'},
  logout: {ar: 'تسجيل الخروج', en: 'Logout'},
  my_profile: {ar: 'الملف الشخصي', en: 'My Profile'},
  my_account: {ar: 'حسابي', en: 'My Account'},
  welcome: {ar: 'مرحباً', en: 'Welcome'},
  rules_title: {ar: 'قوانين الخادم', en: 'Server Rules'},
  add_to_cart: {ar: 'إضافة للسلة', en: 'Add to Cart'},
  checkout: {ar: 'إتمام الطلب', en: 'Checkout'},
  store_title: {ar: 'المتجر', en: 'Store'},
  apply_now: {ar: 'قدم الان', en: 'Apply Now'},
  submit_application: {ar: 'إرسال التقديم', en: 'Submit Application'},
  loading_community_hub: {ar: 'جاري التحميل...', en: 'Loading...'},
  please_wait: {ar: 'الرجاء الانتظار...', en: 'Please wait...'},
  dashboard: {ar: 'لوحة التحكم', en: 'Dashboard'},
  nav_home: { ar: "الرئيسية", en: "Home" },
  nav_about: { ar: "من نحن", en: "About Us" },
  nav_rules: { ar: "القوانين", en: "Rules" },
  nav_store: { ar: "المتجر", en: "Store" },
  nav_applies: { ar: "التقديمات", en: "Applies" },
  nav_admin: { ar: "لوحة التحكم", en: "Admin Panel" },
  nav_login: { ar: "تسجيل الدخول", en: "Login" },
  nav_logout: { ar: "تسجيل الخروج", en: "Logout" },
  nav_hello: { ar: "مرحباً", en: "Hello" },
  store_desc: { ar: "ادعم الخادم واحصل على مميزات حصرية", en: "Support the server and get exclusive perks" },
  buy_now: { ar: "شراء الان", en: "Buy Now" },
  price: { ar: "السعر", en: "Price" },
  category_all: { ar: "الكل", en: "All" },
  cart_empty: { ar: "السلة فارغة", en: "Cart is empty" },
  cart_total: { ar: "المجموع", en: "Total" },
  open_applies: { ar: "التقديمات المفتوحة", en: "Open Applications" },
  closed_applies: { ar: "التقديمات المغلقة", en: "Closed Applications" },
  questions: { ar: "أسئلة", en: "Questions" },
  begin_quiz: { ar: "بدء التقديم", en: "Start Application" },
  admin_dashboard: { ar: "لوحة التحكم", en: "Dashboard" },
  admin_users: { ar: "الأعضاء", en: "Users" },
  admin_store: { ar: "المتجر", en: "Store" },
  admin_rules: { ar: "القوانين", en: "Rules" },
  admin_applies: { ar: "نماذج التقديم", en: "Applications" },
  admin_staff: { ar: "الإدارة", en: "Staff" },
  admin_translations: { ar: "الترجمات", en: "Translations" },
  admin_settings: { ar: "الإعدادات", en: "Settings" }
};

let sql = `-- Insert all translations into the database\n`;
sql += `INSERT INTO translations (key, ar, en) VALUES\n`;

const values = [];

for (const key of keys) {
  let en = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  let ar = en;
  
  if (dict[key]) {
     en = dict[key].en;
     ar = dict[key].ar;
  }
  
  // Escape quotes
  en = en.replace(/'/g, "''");
  ar = ar.replace(/'/g, "''");
  
  values.push(`('${key}', '${ar}', '${en}')`);
}

sql += values.join(',\n');
sql += `\nON CONFLICT (key) DO UPDATE SET ar = EXCLUDED.ar, en = EXCLUDED.en;\n`;

let txt = `import type { Translations } from '../types';\nexport const fallbackTranslations: Translations = {\n`;
for (const key of keys) {
    let en = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    let ar = en;
    if (dict[key]) { en = dict[key].en; ar = dict[key].ar; }
    txt += `  "${key}": { ar: "${ar.replace(/"/g, '\\"')}", en: "${en.replace(/"/g, '\\"')}" },\n`;
}
txt += `};\n`;

fs.writeFileSync('ALL_TRANSLATIONS_SETUP.sql', sql);
fs.writeFileSync('src/fallback_translations.ts', txt);
