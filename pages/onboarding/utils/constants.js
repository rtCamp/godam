/**
 * Onboarding step state-machine constants.
 *
 * The SPA is a single-page step machine (no router) — `step` in the
 * onboarding slice decides which screen renders. Kept here so screens and
 * the reducer share one source of truth.
 */
export const STEPS = {
	ENTRY: 'entry',
	SIGNUP: 'signup',
	VERIFY_EMAIL: 'verify_email',
	LOGIN: 'login',
	FORGOT_PASSWORD: 'forgot_password',
	LICENSE: 'license',
	WORKSPACE: 'workspace',
	WELCOME: 'welcome',
};

/**
 * Auth methods, mirrored from the godam-core `auth_method` field.
 */
export const AUTH_METHOD = {
	PASSWORD: 'password',
	GOOGLE: 'google',
	LICENSE: 'license',
};

/**
 * Runtime config localized from PHP (see class-pages.php → `godamOnboarding`).
 * Falls back to sane defaults so the bundle is safe to load standalone.
 */
export const config = window.godamOnboarding || {};
