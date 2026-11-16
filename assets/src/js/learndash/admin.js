/**
 * "Use GoDAM Video" switch in the LearnDash lesson and topic settings.
 *
 * While the switch is on, the progression video is the GoDAM Video block in
 * the content, so the Video URL field is hidden: on save GoDAM stores its own
 * marker there (see inc/classes/learndash/class-learndash.php). Turning the
 * switch off clears that marker from the field so a real video URL can go in.
 *
 * @since n.e.x.t
 */

/**
 * Decode the HTML entities LearnDash may leave in the saved Video URL.
 *
 * @since n.e.x.t
 *
 * @param {string}   value Field value.
 * @param {Document} doc   Document.
 * @return {string} Decoded value.
 */
const decode = ( value, doc ) => {
	const textarea = doc.createElement( 'textarea' );
	textarea.innerHTML = value;
	return textarea.value;
};

/**
 * Wire up the switch in each LearnDash settings metabox on the page.
 *
 * @since n.e.x.t
 *
 * @param {Document} doc    Document.
 * @param {Object}   config `rtgodamLearnDashAdmin`.
 * @return {number} How many switches it wired up.
 */
export function setupUseGoDAMSwitch( doc, config ) {
	if ( ! config || ! Array.isArray( config.metaboxKeys ) ) {
		return 0;
	}

	let count = 0;

	config.metaboxKeys.forEach( ( metaboxKey ) => {
		const toggle = doc.getElementById( `${ metaboxKey }_${ config.field }` );
		const urlRow = doc.getElementById( `${ metaboxKey }_lesson_video_url_field` );

		if ( ! toggle || ! urlRow ) {
			return;
		}

		const urlInput = doc.getElementById( `${ metaboxKey }_lesson_video_url` );
		const sync = () => {
			urlRow.style.display = toggle.checked ? 'none' : '';

			if ( ! toggle.checked && urlInput && decode( urlInput.value, doc ).trim() === config.blockMarker ) {
				urlInput.value = '';
			}
		};

		toggle.addEventListener( 'change', sync );
		sync();
		count++;
	} );

	return count;
}

if ( typeof window !== 'undefined' && window.document ) {
	const run = () => setupUseGoDAMSwitch( window.document, window.rtgodamLearnDashAdmin );

	if ( 'loading' === window.document.readyState ) {
		window.document.addEventListener( 'DOMContentLoaded', run );
	} else {
		run();
	}
}
