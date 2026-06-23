/**
 * Pure, framework-free input validators for the onboarding forms.
 *
 * Kept side-effect free so they can be unit-tested without React/WP.
 */

/**
 * Basic email shape check (intentionally permissive — godam-core is the
 * authority; this only catches obvious typos before a network round-trip).
 *
 * @param {string} email Email address.
 * @return {boolean} Whether the email looks valid.
 */
export const isValidEmail = ( email ) =>
	typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( email.trim() );

/**
 * Password policy: at least 8 chars. (godam-core enforces the real policy;
 * this is just a fast client-side guard.)
 *
 * @param {string} password Password.
 * @return {boolean} Whether the password meets the minimum length.
 */
export const isValidPassword = ( password ) =>
	typeof password === 'string' && password.length >= 8;

/**
 * Confirm-password match.
 *
 * @param {string} password Password.
 * @param {string} confirm  Confirmation.
 * @return {boolean} Whether the two match (and are non-empty).
 */
export const passwordsMatch = ( password, confirm ) =>
	!! password && password === confirm;

/**
 * GoDAM license-key shape: `GODAM-XXXX-XXXX-XXXX` (case-insensitive, the
 * grouping is a hint — godam-core validates the real key).
 *
 * @param {string} key License key.
 * @return {boolean} Whether the key matches the expected mask.
 */
export const isValidLicenseKey = ( key ) =>
	typeof key === 'string' && /^GODAM-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test( key.trim() );

/**
 * Validate the whole signup form, returning a field→error map ({} when valid).
 *
 * @param {Object}  fields           Signup fields.
 * @param {string}  fields.firstName First name.
 * @param {string}  fields.email     Email.
 * @param {string}  fields.password  Password.
 * @param {string}  fields.confirm   Password confirmation.
 * @param {boolean} fields.tnc       Terms accepted.
 * @return {Object} Map of field name → error message.
 */
export const validateSignup = ( { firstName, email, password, confirm, tnc } ) => {
	const errors = {};
	if ( ! firstName || ! firstName.trim() ) {
		errors.firstName = 'First name is required.';
	}
	if ( ! isValidEmail( email ) ) {
		errors.email = 'Enter a valid email address.';
	}
	if ( ! isValidPassword( password ) ) {
		errors.password = 'Password must be at least 8 characters.';
	}
	if ( ! passwordsMatch( password, confirm ) ) {
		errors.confirm = 'Passwords do not match.';
	}
	if ( ! tnc ) {
		errors.tnc = 'Please accept the Terms to continue.';
	}
	return errors;
};
