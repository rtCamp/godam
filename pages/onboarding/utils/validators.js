/**
 * Input validators for the onboarding forms.
 *
 * Side-effect free (no React, no DOM) so they can be unit-tested in isolation.
 * The only dependency is @wordpress/i18n, so the user-facing error messages are
 * translatable (extracted into the .pot like the rest of the SPA).
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

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
		errors.firstName = __( 'First name is required.', 'godam' );
	}
	if ( ! isValidEmail( email ) ) {
		errors.email = __( 'Enter a valid email address.', 'godam' );
	}
	if ( ! isValidPassword( password ) ) {
		errors.password = __( 'Password must be at least 8 characters.', 'godam' );
	}
	if ( ! passwordsMatch( password, confirm ) ) {
		errors.confirm = __( 'Passwords do not match.', 'godam' );
	}
	if ( ! tnc ) {
		errors.tnc = __( 'Please accept the Terms to continue.', 'godam' );
	}
	return errors;
};
