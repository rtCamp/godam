/*global rtMediaHook, rtTranscoder, get_parameter, bp_template_pack*/

const mediaThumbnails = {};
let isCommentMedia = false;
let isIntervalSet = false;

( function( $ ) {
	/**
	 * Document ready method.
	 */
	$( document ).ready( () => {
		/**
		 * Event after activity is loaded on BuddyPress' activity page.
		 */
		$( document ).ajaxComplete( ( event, xhr, settings ) => {
			if ( 'undefined' !== typeof bp_template_pack && 'legacy' !== bp_template_pack && bp_template_pack && 'function' === typeof get_parameter ) {
				const getAction = get_parameter( 'action', settings.data );
				if ( 'activity_filter' === getAction ) {
					setTimeout( () => {
						$( '#activity-stream > .activity-list > li .media-type-video > .rtmedia-item-thumbnail video' ).each( ( i, elem ) => {
							elem = $( elem );
							if ( ( 'undefined' !== typeof elem.attr( 'poster' ) && elem.attr( 'poster' ).length > 0 ) || 'undefined' === typeof elem.attr( 'id' ) || ! elem.attr( 'id' ).length ) {
								return;
							}

							const id = parseInt( elem.attr( 'id' ).replace( /^\D+/g, '' ) );
							addToMediaThumbnailQueue( id );
						} );
						// Request thumbnails if mediaThumbnails has any elements.
						setRequestInterval();
					}, 1000 );
				}
			}
		} );

		/**
		 * Code for media page.
		 */
		$( '.rtmedia-container ul.rtmedia-list.rtmedia-list-media.rtm-gallery-list > li.rtmedia-list-item' ).each( ( i, elem ) => {
			elem = $( elem );
			const img = elem.find( 'a.rtmedia-list-item-a > .rtmedia-item-thumbnail > img' );
			if ( ! img.length || 'undefined' === typeof img.attr( 'src' ) || -1 === img.attr( 'src' ).search( 'video_thumb.png' ) ) {
				return;
			}

			addToMediaThumbnailQueue( parseInt( elem.attr( 'id' ) ) );
		} );
		// Request thumbnails if mediaThumbnails has any elements.
		setRequestInterval();

		if ( 'undefined' !== typeof rtMediaHook ) {
			/**
			 * Check if uploaded media is comment media.
			 */
			rtMediaHook.register( 'rtmedia_js_file_added', ( data ) => {
				if ( 'undefined' === typeof data || 'undefined' === typeof data[ 2 ] ) {
					return true;
				}

				if ( -1 === data[ 2 ].search( '#rtmedia_uploader_filelist-activity-' ) ) {
					return true;
				}
				isCommentMedia = true;

				return true;
			} );

			/**
			 * Code for media page when a media is uploaded.
			 */
			rtMediaHook.register( 'rtmedia_js_after_file_upload', ( data ) => {
				if ( 'undefined' === typeof data || 'undefined' === typeof data[ 1 ] || 'undefined' === typeof data[ 2 ] ) {
					return true;
				}

				const type = data[ 1 ].type.split( '/' );
				if ( 'video' !== type[ 0 ] ) {
					return true;
				}

				const rtMediaObj = JSON.parse( data[ 2 ] );
				if ( true === Array.isArray( rtMediaObj ) && 'undefined' !== typeof rtMediaObj[ 0 ] ) {
					addToMediaThumbnailQueue( rtMediaObj[ 0 ] );

					if ( true === isCommentMedia ) {
						requestThumbnails();
						isCommentMedia = false;
					}
					return true;
				}
				if ( 'undefined' !== typeof rtMediaObj.media_id ) {
					addToMediaThumbnailQueue( rtMediaObj.media_id );
					return true;
				}

				return true;
			} );

			rtMediaHook.register( 'rtmedia_js_after_files_uploaded', () => {
				setRequestInterval();
				return true;
			} );

			rtMediaHook.register( 'rtmedia_js_after_activity_added', () => {
				setRequestInterval();
				return true;
			} );
		}
	} );

	/**
	 * Add media ID to mediaThumbnails array.
	 *
	 * @param {int} mediaID Media ID.
	 *
	 * @return {void}
	 */
	const addToMediaThumbnailQueue = ( mediaID ) => {
		if ( 'undefined' !== typeof mediaThumbnails[ mediaID ] ) {
			return;
		}
		mediaThumbnails[ mediaID ] = {};
	};

	/**
	 * Make ajax request to get thumbnail URL.
	 *
	 * @return {void}
	 */
	const requestThumbnails = () => {
		if ( ! Object.entries( mediaThumbnails ).length ) {
			return;
		}

		let mediaIDsToRequest = [];
		for ( const [ mediaID, obj ] of Object.entries( mediaThumbnails ) ) {
			if ( 'undefined' === typeof mediaID || 'undefined' === typeof obj ) {
				continue;
			}

			if ( false === isValidObject( obj ) ) {
				mediaIDsToRequest.push( mediaID );
			}
		}

		if ( ! mediaIDsToRequest.length ) {
			return;
		}
		mediaIDsToRequest = mediaIDsToRequest.join();

		$.get( rtTranscoder.restURLPrefix + '/transcoder/v1/amp-rtmedia?media_ids=' + mediaIDsToRequest, ( data ) => {
			checkResponse( data );
		} );
	};

	/**
	 * Check response received from ajax request.
	 *
	 * @param {object|boolean} data Response object or false.
	 *
	 * @return {void}
	 */
	const checkResponse = ( data = false ) => {
		if ( 'object' === typeof data ) {
			for ( const [ mediaIDStr, obj ] of Object.entries( data ) ) {
				if ( 'undefined' === typeof mediaIDStr || 'undefined' === typeof obj ) {
					continue;
				}
				const mediaID = parseInt( mediaIDStr );

				if ( 'invalid' === obj ) {
					if ( 'undefined' !== typeof mediaThumbnails[ mediaID ] ) {
						delete mediaThumbnails[ mediaID ];
					}
					continue;
				}

				if ( false !== isValidObject( obj ) ) {
					mediaThumbnails[ mediaID ] = obj;
					updateVideoThumbnail( mediaID );
				}
			}
		}

		setRequestInterval();
	};

	/**
	 * Sets interval to request thumbnails.
	 *
	 * @return {void}
	 */
	const setRequestInterval = () => {
		if ( true === isIntervalSet ) {
			return;
		}

		isIntervalSet = true;
		setTimeout( () => {
			requestThumbnails();
			isIntervalSet = false;
		}, 5000 );
	};

	/**
	 * Update video thumbnail in DOM.
	 *
	 * @param {int} mediaID Media ID.
	 *
	 * @return {void}
	 */
	const updateVideoThumbnail = ( mediaID ) => {
		if ( 'undefined' === typeof mediaThumbnails[ mediaID ] || ! isValidObject( mediaThumbnails[ mediaID ] ) ) {
			return;
		}

		const li = $( 'li#' + mediaID );
		if ( li.length > 0 ) {
			const img = li.find( 'div.rtmedia-item-thumbnail > img' );
			if ( ! img.length ) {
				return;
			}

			img.attr( 'src', mediaThumbnails[ mediaID ].poster );
			return;
		}

		const video = $( 'video#rt_media_video_' + mediaID );
		if ( video.length > 0 ) {
			video.attr( 'poster', mediaThumbnails[ mediaID ].poster );
			return;
		}

		const video1 = $( 'video#rt_media_video_' + mediaID + '_from_mejs' );
		if ( video1.length > 0 ) {
			video1.attr( 'poster', mediaThumbnails[ mediaID ].poster );

		}
	};

	/**
	 * Check whether an object is valid or not.
	 *
	 * @param {object} obj Object contains thumbnails details.
	 *
	 * @return {boolean} Whether the object is valid or not.
	 */
	const isValidObject = ( obj ) => {
		return ( 'undefined' !== typeof obj.poster );
	};
}( jQuery ) );
