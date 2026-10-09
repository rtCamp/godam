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
 * Show that Central refused a job on a grid tile.
 *
 * The hover label is a short, single line (set in CSS per code); the full reason is in
 * list view and the Tools log. The icon is focusable and labelled with the reason, so
 * keyboard and screen-reader users get it too.
 *
 * @param {HTMLElement} tile           The attachment tile.
 * @param {HTMLElement} loader         The tile's status icon.
 * @param {Object}      failure
 * @param {string}      failure.code   `preflight_failed` or `job_refused`.
 * @param {string}      failure.reason Plain reason for the site owner.
 */
export const markRefused = ( tile, loader, { code, reason = '' } ) => {
	tile.classList.add( `transcoding-status--${ code.replace( '_', '-' ) }` );

	loader.setAttribute( 'tabindex', '0' );
	loader.setAttribute( 'role', 'img' );
	loader.setAttribute( 'aria-label', reason );
};
