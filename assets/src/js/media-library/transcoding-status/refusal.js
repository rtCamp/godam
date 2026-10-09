/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Error codes for a job GoDAM Central refused (see rtgodam_record_job_refusal()): the
 * source file failed its checks, or the licence, storage or site isn't allowed.
 */
const REFUSAL_CODES = [ 'preflight_failed', 'job_refused' ];

/**
 * Whether a failure is Central refusing the job.
 *
 * @param {string} errorCode The attachment's transcoding error code.
 *
 * @return {boolean} True for a refusal.
 */
export const isRefusal = ( errorCode ) => REFUSAL_CODES.includes( errorCode );

/**
 * Show why Central refused a job on a grid tile.
 *
 * The tile clips the CSS tooltip, so it carries a short label and the full reason goes
 * in the native tooltip, followed by Central's own wording for support. The icon is
 * focusable and labelled, so keyboard and screen-reader users get the reason too.
 *
 * @param {HTMLElement} tile           The attachment tile.
 * @param {HTMLElement} loader         The tile's status icon.
 * @param {Object}      failure
 * @param {string}      failure.code   `preflight_failed` or `job_refused`.
 * @param {string}      failure.reason Plain reason for the site owner.
 * @param {string}      failure.detail Central's own wording, if any.
 */
export const markRefused = ( tile, loader, { code, reason = '', detail = '' } ) => {
	tile.classList.add( `transcoding-status--${ code.replace( '_', '-' ) }` );

	loader.setAttribute(
		'title',
		/* translators: %s: GoDAM Central's own wording of why it refused the file. */
		detail ? `${ reason }\n\n${ sprintf( __( 'GoDAM said: %s', 'godam' ), detail ) }` : reason,
	);
	loader.setAttribute( 'tabindex', '0' );
	loader.setAttribute( 'role', 'img' );
	loader.setAttribute( 'aria-label', reason );
};
