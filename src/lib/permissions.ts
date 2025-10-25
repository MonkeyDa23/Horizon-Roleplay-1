
// src/lib/permissions.ts

import type { PermissionKey } from "../types";

// This object defines all available permissions in the application.
// The keys are used internally for checks (e.g., hasPermission('admin_quizzes')).
// The values are used as user-friendly descriptions in the admin panel.
export const PERMISSIONS: Record<PermissionKey, string> = {
  // Special super admin permission
  _super_admin: 'Grants all other permissions automatically.',

  // Page access permissions
  page_store: 'Allow user to see and access the Store page.',
  page_rules: 'Allow user to see and access the Rules page.',
  page_applies: 'Allow user to see and access the Applies page.',
  
  // Admin panel access
  admin_panel: 'Allow user to see the "Admin Panel" button and access the /admin route.',

  // Granular admin permissions
  admin_submissions: 'Allow user to view and handle all application submissions.',
  admin_quizzes: 'Allow user to create, edit, and delete application forms (quizzes).',
  admin_rules: 'Allow user to edit the server rules.',
  admin_store: 'Allow user to manage items in the store.',
  admin_translations: 'Allow user to edit all website text and translations.',
  admin_appearance: 'Allow user to change site-wide settings like name, logo, and theme.',
  admin_audit_log: 'Allow user to view the log of all admin actions.',
  admin_permissions: 'Allow user to change permissions for other Discord roles.',
  admin_lookup: 'Allow user to look up user profiles by Discord ID.',
} as const;
