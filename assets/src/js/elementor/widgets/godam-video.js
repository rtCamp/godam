
/**
 * Internal dependencies
 */
import { getFirstNonEmpty, appendTimezoneOffsetToUTC } from '../../../blocks/godam-player/utils';

window.addEventListener( 'elementor/frontend/init', () => {
	function prepareVideoMeta( attachmentData ) {
		const initialVideoData = {
			contentUrl: getFirstNonEmpty( attachmentData?.meta?.rtgodam_transcoded_url, attachmentData?.source_url ),
			headline: getFirstNonEmpty( attachmentData?.title?.rendered ),
			description: getFirstNonEmpty( attachmentData?.description?.rendered ),
			uploadDate: getFirstNonEmpty( appendTimezoneOffsetToUTC( attachmentData?.date_gmt ) ),
			duration: getFirstNonEmpty( attachmentData?.video_duration_iso8601 ),
			thumbnailUrl: getFirstNonEmpty( attachmentData?.meta?.rtgodam_media_video_thumbnail ),
			isFamilyFriendly: getFirstNonEmpty( true ),
		};

		return initialVideoData;
	}

	// eslint-disable-next-line no-undef
	if ( window.elementorFrontend && window.GODAMPlayer ) {
		// eslint-disable-next-line no-undef
		elementorFrontend.hooks.addAction(
			'frontend/element_ready/godam-video.default',
			( ) => {
				window.GODAMPlayer();
			},
		);
	}

	if ( window.elementor ) {
		// eslint-disable-next-line no-undef
		elementor.hooks.addAction(
			'panel/open_editor/widget',
			( panel, model ) => {
				if ( model.get( 'widgetType' ) !== 'godam-video' ) {
					return;
				}

				/**
				 * Automatically populates the SEO fields.
				 */
				model.get( 'settings' ).on( 'change:video-file', async () => {
					const videoFile = model.get( 'settings' ).get( 'video-file' );

					if ( ! videoFile.url ) {
						return;
					}

					// Check if ID is purely numeric
					const isNumericId = /^\d+$/.test( String( videoFile.id ) );

					if ( ! isNumericId ) {
						getVideoDuration( videoFile.url ).then( ( duration ) => {
							// Set default SEO metadata for non-numeric IDs
							const defaultSeoData = {
								seo_content_url: videoFile.url,
								seo_content_headline: videoFile.title || videoFile.name,
								seo_content_upload_date: new Date().toISOString(),
								seo_content_video_thumbnail_url: videoFile.icon || '', // use empty string or placeholder
								seo_content_duration: formatDurationISO( duration ), // can be set later via video metadata
							};

							model.get( 'settings' ).set( defaultSeoData );
							panel.currentPageView.render();
						} );

						return;
					}

					// Numeric ID: fetch from API
					const apiURL = `/wp-json/wp/v2/media/${ videoFile.id }`;
					fetch( apiURL )
						.then( ( response ) => {
							if ( response.ok ) {
								return response.json();
							}
							return false;
						} )
						.then( ( data ) => {
							if ( ! data ) {
								return;
							}
							const seoData = prepareVideoMeta( data );
							model.get( 'settings' ).set( {
								seo_content_url: seoData.contentUrl,
								seo_content_headline: seoData.headline,
								seo_content_upload_date: seoData.uploadDate,
								seo_content_video_thumbnail_url: seoData.thumbnailUrl,
								seo_content_duration: seoData.duration,
							} );
							panel.currentPageView.render();
						} );
				} );

				/**
				 * Updates the poster url field when the poster image is updated.
				 */
				model.get( 'settings' ).on( 'change:poster', async () => {
					const posterFile = model.get( 'settings' ).get( 'video-file' );
					if ( ! posterFile.url ) {
						return;
					}
					model.get( 'settings' ).set( { seo_content_video_thumbnail_url: posterFile.url } );
					panel.currentPageView.render();
				} );
			},
		);
	}
} );

/**
 * Fetches the duration of a video file.
 *
 * @param {string} videoUrl - The URL of the video file.
 *
 * @return {Promise<number>} - A promise that resolves to the duration of the video in seconds.
 */
function getVideoDuration( videoUrl ) {
	return new Promise( ( resolve, reject ) => {
		// Check if it's an MPD file
		if ( videoUrl.endsWith( '.mpd' ) ) {
			// For MPD files, try to fetch and parse the manifest
			fetch( videoUrl )
				.then( ( response ) => response.text() )
				.then( ( manifestText ) => {
					// Parse the MPD XML to extract duration
					const parser = new DOMParser();
					const xmlDoc = parser.parseFromString( manifestText, 'text/xml' );

					// Look for mediaPresentationDuration attribute
					const mpdElement = xmlDoc.querySelector( 'MPD' );
					if ( mpdElement && mpdElement.getAttribute( 'mediaPresentationDuration' ) ) {
						const duration = parsePT( mpdElement.getAttribute( 'mediaPresentationDuration' ) );
						resolve( duration );
						return;
					}

					// Fallback: try to create video element with MSE if available
					if ( window.MediaSource ) {
						createVideoElementForDash( videoUrl ).then( resolve ).catch( reject );
					} else {
						reject( 'Unable to determine video duration from MPD file' );
					}
				} )
				.catch( () => {
					// Fallback to video element approach
					createVideoElementForDash( videoUrl ).then( resolve ).catch( reject );
				} );
		} else {
			// Standard video file handling
			const video = document.createElement( 'video' );
			video.preload = 'metadata';
			video.src = videoUrl;

			video.onloadedmetadata = () => {
				resolve( video.duration );
			};

			video.onerror = () => {
				reject( 'Failed to load video metadata.' );
			};
		}
	} );
}

/**
 * Helper function to create video element for DASH streams
 *
 * @param {string} videoUrl - The URL of the DASH video file.
 *
 * @return {Promise<number>} - A promise that resolves to the duration of the video in seconds.
 */
function createVideoElementForDash( videoUrl ) {
	return new Promise( ( resolve, reject ) => {
		const video = document.createElement( 'video' );
		video.preload = 'metadata';

		// Try setting source directly first
		video.src = videoUrl;

		video.onloadedmetadata = () => {
			if ( video.duration && video.duration !== Infinity ) {
				resolve( video.duration );
			} else {
				reject( 'Unable to determine video duration' );
			}
		};

		video.onerror = () => {
			reject( 'Failed to load DASH video metadata.' );
		};

		// Set a timeout to avoid hanging
		setTimeout( () => {
			reject( 'Timeout loading video metadata' );
		}, 10000 );
	} );
}

/**
 * Parse ISO 8601 duration format (PT1H2M3S) to seconds
 *
 * @param {string} duration - The ISO 8601 duration string.
 *
 * @return {number} - The duration in seconds.
 */
function parsePT( duration ) {
	/**
	 * Regex to match ISO 8601 duration strings in the format PT#H#M#S.
	 * Captures hours, minutes, and seconds as optional groups.
	 * Example matches: PT1H2M3S, PT2M, PT45S, PT1H, etc.
	 * Group 1: hours, Group 2: minutes, Group 3: seconds (may be decimal)
	 */
	const ISO8601_DURATION_REGEX = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/;

	const matches = duration.match( ISO8601_DURATION_REGEX );
	if ( ! matches ) {
		return 0;
	}

	const hours = parseInt( matches[ 1 ] ) || 0;
	const minutes = parseInt( matches[ 2 ] ) || 0;
	const seconds = parseFloat( matches[ 3 ] ) || 0;

	return ( hours * 3600 ) + ( minutes * 60 ) + seconds;
}

/**
 * Formats a duration in seconds to ISO 8601 format.
 *
 * @param {number} seconds - The duration in seconds.
 *
 * @return {string} - The formatted duration in ISO 8601 format (e.g., PT5M30S).
 */
function formatDurationISO( seconds ) {
	const mins = Math.floor( seconds / 60 );
	const secs = Math.floor( seconds % 60 );
	return `PT${ mins > 0 ? mins + 'M' : '' }${ secs }S`;
}
