/**
 * "Use GoDAM Video" switch and video picker in the LearnDash lesson and topic settings.
 *
 * While the switch is on, the progression video is a GoDAM video, so the Video
 * URL field is hidden and the GoDAM Video picker is shown: on save GoDAM stores
 * its own marker in the Video URL (see inc/classes/learndash/class-learndash.php).
 * Turning the switch off clears that marker from the field so a real video URL
 * can go in.
 *
 * @since 2.11.0
 */

/**
 * Decode the HTML entities LearnDash may leave in the saved Video URL.
 *
 * Only the entities WordPress escaping produces are decoded, by plain string
 * replacement, so the value is never reinterpreted as HTML. `&amp;` is decoded
 * last so an already-escaped ampersand (`&amp;lt;`) is not decoded twice.
 *
 * @since 2.11.0
 *
 * @param {string} value Field value.
 * @return {string} Decoded value.
 */
const decode = ( value ) =>
	String( value )
		.replace( /&lt;/g, '<' )
		.replace( /&gt;/g, '>' )
		.replace( /&quot;/g, '"' )
		.replace( /&#0*39;/g, "'" )
		.replace( /&#x0*27;/gi, "'" )
		.replace( /&amp;/g, '&' );

/**
 * Whether a Video URL value is the GoDAM marker, with or without a picked video.
 *
 * @since 2.11.0
 *
 * @param {string} value Decoded Video URL value.
 * @param {string} tag   Marker shortcode tag.
 * @return {boolean} Whether it is the marker.
 */
export const isMarker = ( value, tag ) =>
	new RegExp( `^\\[${ tag }(?:\\s+id=(["']?)\\d+\\1)?\\s*\\]$` ).test( value.trim() );

/**
 * Wire up the switch in each LearnDash settings metabox on the page.
 *
 * @since 2.11.0
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

		toggle.setAttribute( 'data-test-id', 'godam-learndash-use-godam-switch' );

		const urlInput = doc.getElementById( `${ metaboxKey }_lesson_video_url` );
		const pickerRow = doc.getElementById( `${ metaboxKey }_${ config.videoField }_field` );

		const sync = () => {
			urlRow.style.display = toggle.checked ? 'none' : '';

			if ( pickerRow ) {
				pickerRow.style.display = toggle.checked ? '' : 'none';
			}

			if ( ! toggle.checked && urlInput && isMarker( decode( urlInput.value ), config.markerTag ) ) {
				urlInput.value = '';
			}
		};

		toggle.addEventListener( 'change', sync );
		sync();
		count++;
	} );

	return count;
}

/**
 * Show a video in a picker: its title, a preview player and the buttons.
 *
 * @since 2.11.0
 *
 * @param {HTMLElement} picker     The `.rtgodam-ld-video-picker` element.
 * @param {Object|null} attachment Media attachment, or null for none.
 * @param {Object}      i18n       Button labels.
 */
export function renderPicked( picker, attachment, i18n ) {
	const doc = picker.ownerDocument;
	const input = picker.querySelector( 'input[type="hidden"]' );
	const title = picker.querySelector( '.rtgodam-ld-video-picker__title' );
	const preview = picker.querySelector( '.rtgodam-ld-video-picker__preview' );
	const select = picker.querySelector( '.rtgodam-ld-video-picker__select' );
	const remove = picker.querySelector( '.rtgodam-ld-video-picker__remove' );

	const id = attachment ? String( attachment.id ) : '';

	/*
	 * A video picked from the GoDAM tab has a GoDAM ID until its WordPress
	 * attachment exists. Keep it out of the form so a save in the meantime
	 * cannot store it: the server would read `88o035h31e` as attachment 88.
	 */
	const isAttachmentId = /^\d+$/.test( id );
	input.value = isAttachmentId ? id : '';
	if ( attachment && ! isAttachmentId ) {
		picker.dataset.pendingId = id;
	} else {
		delete picker.dataset.pendingId;
	}

	picker.classList.toggle( 'is-picked', !! attachment );

	title.textContent = attachment ? attachment.title || attachment.filename || `#${ attachment.id }` : '';
	title.title = title.textContent;
	title.hidden = ! attachment;

	preview.replaceChildren();
	if ( attachment?.url ) {
		const video = doc.createElement( 'video' );
		video.src = attachment.url;
		video.controls = true;
		video.preload = 'metadata';
		video.setAttribute( 'data-test-id', 'godam-learndash-video-preview-player' );
		preview.appendChild( video );
	}

	select.textContent = attachment ? i18n.replace : i18n.select;
	remove.hidden = ! attachment;
}

/**
 * Wire up the video picker in each LearnDash settings metabox on the page.
 *
 * @since 2.11.0
 *
 * @param {Document} doc    Document.
 * @param {Object}   config `rtgodamLearnDashAdmin`.
 * @param {Object}   wp     The `wp` global, for `wp.media`.
 * @return {number} How many pickers it wired up.
 */
export function setupVideoPicker( doc, config, wp ) {
	if ( ! config || ! Array.isArray( config.metaboxKeys ) || ! wp?.media ) {
		return 0;
	}

	const i18n = config.i18n || {};
	const pickers = [];

	config.metaboxKeys.forEach( ( metaboxKey ) => {
		const picker = doc.getElementById( `${ metaboxKey }_${ config.videoField }_picker` );
		if ( ! picker ) {
			return;
		}

		const input = picker.querySelector( 'input[type="hidden"]' );
		let frame = null;

		picker.querySelector( '.rtgodam-ld-video-picker__select' ).addEventListener( 'click', ( event ) => {
			event.preventDefault();

			if ( ! frame ) {
				frame = wp.media( {
					title: i18n.frameTitle,
					button: { text: i18n.frameButton },
					library: { type: 'video' },
					multiple: false,
				} );

				frame.on( 'select', () => {
					const attachment = frame.state().get( 'selection' ).first().toJSON();
					const type = ( attachment.mime || attachment.type || '' ).split( '/' )[ 0 ];

					if ( type && 'video' !== type ) {
						return;
					}

					renderPicked( picker, attachment, i18n );
				} );
			}

			frame.open();
		} );

		picker.querySelector( '.rtgodam-ld-video-picker__remove' ).addEventListener( 'click', ( event ) => {
			event.preventDefault();
			renderPicked( picker, null, i18n );
		} );

		// The saved video: the title comes from the server, the preview from the media library.
		if ( input.value && wp.media.attachment ) {
			const model = wp.media.attachment( input.value );
			const fetched = model.fetch ? model.fetch() : null;
			const show = () => {
				if ( input.value === String( model.get( 'id' ) ) ) {
					renderPicked( picker, model.toJSON(), i18n );
				}
			};

			if ( fetched?.then ) {
				fetched.then( show, () => {} );
			} else if ( fetched?.done ) {
				fetched.done( show );
			}
		}

		pickers.push( picker );
	} );

	// A video picked from the GoDAM tab gets its WordPress attachment ID a moment later.
	if ( pickers.length ) {
		doc.addEventListener( 'godam-virtual-attachment-created', ( event ) => {
			const { attachment, virtualMediaId } = event?.detail || {};
			if ( ! attachment?.id || undefined === virtualMediaId ) {
				return;
			}

			pickers.forEach( ( picker ) => {
				if ( picker.dataset.pendingId === String( virtualMediaId ) ) {
					renderPicked( picker, attachment, i18n );
				}
			} );
		} );
	}

	return pickers.length;
}

if ( typeof window !== 'undefined' && window.document ) {
	const run = () => {
		setupUseGoDAMSwitch( window.document, window.rtgodamLearnDashAdmin );
		setupVideoPicker( window.document, window.rtgodamLearnDashAdmin, window.wp );
	};

	if ( 'loading' === window.document.readyState ) {
		window.document.addEventListener( 'DOMContentLoaded', run );
	} else {
		run();
	}
}
