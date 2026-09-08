/**
 * Current user's folder-management permissions.
 *
 * These are resolved server-side from real WordPress capabilities (see the `MediaLibrary`
 * localize in inc/classes/class-pages.php) and mirror exactly what the REST layer
 * authorizes on. Gating the UI on these — rather than on hardcoded role slugs — keeps the
 * interface in lockstep with the server, so custom roles (WooCommerce's `shop_manager`,
 * membership-plugin roles, sites that add/remove `upload_files`, etc.) show only the
 * actions that will actually succeed instead of buttons that then 403.
 */

const capabilities = window.MediaLibrary?.capabilities || {};

// Create + rename folders (server: manage_terms / edit_terms = upload_files).
export const canManageFolders = Boolean( capabilities.manageFolders );

// Lock + bookmark folders (server: Editors and above / manage_categories).
export const canLockFolders = Boolean( capabilities.lockFolders );

// Delete folders (server: administrators only / manage_options).
export const canDeleteFolders = Boolean( capabilities.deleteFolders );
