/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { getFirstNonEmpty, appendTimezoneOffsetToUTC, stripHtmlTags } from '../../../blocks/godam-player/utils';

window.addEventListener( 'elementor/frontend/init', () => {
	const SEO_FIELD_NAMES = [
		'seo_content_url',
		'seo_content_headline',
		'seo_content_description',
		'seo_content_upload_date',
		'seo_content_duration',
		'seo_content_video_thumbnail_url',
		'seo_content_family_friendly',
	];

	const SEO_EDITABLE_FIELD_NAMES = [
		'seo_content_headline',
		'seo_content_description',
		'seo_content_family_friendly',
	];

	function getPosterUrl( settings ) {
		const poster = settings.get( 'poster' );
		return getFirstNonEmpty( poster?.url, '' );
	}

	function isSeoOverrideEnabled( settings ) {
		return settings.get( 'seo_override' ) === 'yes';
	}

	function applyPosterThumbnailOverride( settings ) {
		if ( ! isSeoOverrideEnabled( settings ) ) {
			return;
		}

		const posterUrl = getPosterUrl( settings );
		if ( ! posterUrl ) {
			return;
		}

		settings.set( { seo_content_video_thumbnail_url: posterUrl } );
	}

	function prepareVideoMeta( attachmentData ) {
		const initialVideoData = {
			contentUrl: getFirstNonEmpty( attachmentData?.meta?.rtgodam_transcoded_url, attachmentData?.source_url ),
			headline: getFirstNonEmpty( attachmentData?.title?.rendered ),
			description: stripHtmlTags( getFirstNonEmpty( attachmentData?.description?.rendered ) || '' ),
			uploadDate: getFirstNonEmpty( appendTimezoneOffsetToUTC( attachmentData?.date_gmt ) ),
			duration: getFirstNonEmpty( attachmentData?.video_duration_iso8601 ),
			thumbnailUrl: getFirstNonEmpty( attachmentData?.meta?.rtgodam_media_video_thumbnail ),
			isFamilyFriendly: getFirstNonEmpty( true ),
		};

		return initialVideoData;
	}

	function isNumericAttachmentId( attachmentId ) {
		return /^\d+$/.test( String( attachmentId ) );
	}

	async function fetchVideoSeoMeta( videoFile ) {
		if ( isNumericAttachmentId( videoFile.id ) ) {
			try {
				const data = await apiFetch( {
					path: `/wp/v2/media/${ videoFile.id }`,
				} );
				return prepareVideoMeta( data );
			} catch {
				return null;
			}
		}

		if ( ! videoFile?.url ) {
			return null;
		}

		let duration = '';
		try {
			const videoDuration = await getVideoDuration( videoFile.url );
			if ( Number.isFinite( videoDuration ) ) {
				duration = formatDurationISO( videoDuration );
			}
		} catch {
			duration = '';
		}

		return {
			contentUrl: videoFile.url,
			headline: getFirstNonEmpty( videoFile.title, videoFile.name ),
			description: '',
			uploadDate: new Date().toISOString(),
			thumbnailUrl: getFirstNonEmpty( videoFile.icon ),
			duration,
			isFamilyFriendly: true,
		};
	}

	function getSeoPayload( seoData, includeEditableFields = true ) {
		const payload = {
			seo_content_url: seoData.contentUrl,
			seo_content_upload_date: seoData.uploadDate,
			seo_content_video_thumbnail_url: seoData.thumbnailUrl,
			seo_content_duration: seoData.duration,
		};

		if ( includeEditableFields ) {
			payload.seo_content_headline = seoData.headline;
			payload.seo_content_description = seoData.description;
			payload.seo_content_family_friendly = seoData.isFamilyFriendly === false ? '' : 'yes';
		}

		return payload;
	}

	/**
	 * Update SEO fields disabled state based on seo_override toggle.
	 *
	 * @param {Object}  panel              - Elementor panel object.
	 * @param {boolean} seoOverrideEnabled - Whether SEO override is enabled.
	 */
	function updateSEOFieldsDisabledState( panel, seoOverrideEnabled ) {
		SEO_FIELD_NAMES.forEach( ( fieldName ) => {
			const $field = panel.$el.find( `.elementor-control-${ fieldName }` );
			if ( ! $field.length ) {
				return;
			}

			const shouldEnable = seoOverrideEnabled && SEO_EDITABLE_FIELD_NAMES.includes( fieldName );
			const $textInputs = $field.find( 'input[type="text"], input[type="url"], input:not([type]), textarea' );
			const $switcher = $field.find( '.elementor-switch' );
			const $inputWrapper = $field.find( '.elementor-control-input-wrapper' );

			if ( shouldEnable ) {
				$textInputs.removeAttr( 'readonly' );
				$switcher.css( 'pointer-events', '' );
				$inputWrapper.css( 'pointer-events', '' );
				$field.css( 'opacity', '' );
				return;
			}

			$textInputs.attr( 'readonly', 'readonly' );
			$switcher.css( 'pointer-events', 'none' );
			$inputWrapper.css( 'pointer-events', 'none' );
			$field.css( 'opacity', '0.6' );
		} );
	}

	// eslint-disable-next-line no-undef
	if ( window.elementorFrontend && window.GODAMPlayer ) {
		// eslint-disable-next-line no-undef
		elementorFrontend.hooks.addAction(
			'frontend/element_ready/godam-video.default',
			() => {
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

				const settings = model.get( 'settings' );

				/**
				 * Replace temporary virtual media ID with the newly created real attachment ID.
				 *
				 * This mirrors Gutenberg behavior for virtual media uploads.
				 *
				 * @param {CustomEvent} event - Event detail contains `virtualMediaId` and `attachment`.
				 */
				const handleVirtualAttachmentCreated = ( event ) => {
					const { attachment, virtualMediaId } = event?.detail || {};
					const currentVideoFile = settings.get( 'video-file' ) || {};
					const currentId = currentVideoFile?.id;

					if ( ! attachment?.id ) {
						return;
					}

					// Update only when current ID is empty or still points to this virtual media placeholder.
					const shouldReplaceId = currentId === undefined || currentId === null || currentId === '' || String( currentId ) === String( virtualMediaId );
					if ( ! shouldReplaceId ) {
						return;
					}

					settings.set( {
						'video-file': {
							...currentVideoFile,
							id: attachment.id,
							url: attachment.url || currentVideoFile.url,
							name: attachment.filename || currentVideoFile.name,
							title: attachment.title || currentVideoFile.title,
						},
					} );

					panel.currentPageView.render();
				};

				// Prevent duplicate listeners if panel is opened multiple times.
				if ( model._godamVirtualAttachmentCreatedHandler ) {
					document.removeEventListener( 'godam-virtual-attachment-created', model._godamVirtualAttachmentCreatedHandler );
				}
				model._godamVirtualAttachmentCreatedHandler = handleVirtualAttachmentCreated;
				document.addEventListener( 'godam-virtual-attachment-created', handleVirtualAttachmentCreated );

				/**
				 * Handle seo_override toggle changes.
				 */
				const handleSeoOverrideChange = () => {
					const seoOverride = isSeoOverrideEnabled( settings );
					// Delay to ensure DOM is updated
					setTimeout( () => {
						updateSEOFieldsDisabledState( panel, seoOverride );
						applyPosterThumbnailOverride( settings );
					}, 100 );
				};

				const syncSeoFromAttachment = async ( includeEditableFields = true ) => {
					const videoFile = settings.get( 'video-file' ) || {};
					const seoData = await fetchVideoSeoMeta( videoFile );

					if ( ! seoData ) {
						return;
					}

					const payload = getSeoPayload( seoData, includeEditableFields );
					settings.set( payload );

					// Directly update the popover fields if open
					if ( panel && panel.$el ) {
						Object.entries( payload ).forEach( ( [ key, value ] ) => {
							const $field = panel.$el.find( `.elementor-control-${ key }` );
							if ( $field.length ) {
								const $input = $field.find( 'input[type="text"], input[type="url"], input:not([type]), textarea' );
								if ( $input.length ) {
									$input.val( value );
								}
								// For switchers (e.g., family friendly yes/no)
								if ( $field.hasClass( 'elementor-control-type-switcher' ) ) {
									const $switch = $field.find( '.elementor-switch' );
									if ( $switch.length ) {
										if ( value === 'yes' ) {
											$switch.addClass( 'elementor-active' );
										} else {
											$switch.removeClass( 'elementor-active' );
										}
									}
								}
							}
						} );
					}

					applyPosterThumbnailOverride( settings );
				};

				// Listen for seo_override changes
				model.get( 'settings' ).on( 'change:seo_override', handleSeoOverrideChange );

				// Initial state update when panel opens
				panel.currentPageView.on( 'render', () => {
					setTimeout( handleSeoOverrideChange, 100 );
				} );

				/**
				 * Automatically populates the SEO fields.
				 */
				model.get( 'settings' ).on( 'change:video-file', async () => {
					await syncSeoFromAttachment( true );
					panel.currentPageView.render();
				} );

				const handleSeoSettingsPopoverToggle = async () => {
					// Wait for popover controls to mount before syncing and enforcing field state.
					setTimeout( async () => {
						await syncSeoFromAttachment( ! isSeoOverrideEnabled( settings ) );
						handleSeoOverrideChange();
					}, 120 );
				};

				if ( model._godamSeoPopoverToggleHandler ) {
					panel.$el.off( 'click', '.elementor-control-seo_settings_popover_toggle', model._godamSeoPopoverToggleHandler );
				}
				model._godamSeoPopoverToggleHandler = handleSeoSettingsPopoverToggle;
				panel.$el.on( 'click', '.elementor-control-seo_settings_popover_toggle', handleSeoSettingsPopoverToggle );

				/**
				 * Updates the poster url field when the poster image is updated.
				 */
				model.get( 'settings' ).on( 'change:poster', async () => {
					const posterUrl = getPosterUrl( settings );

					if ( ! posterUrl || ! isSeoOverrideEnabled( settings ) ) {
						return;
					}

					settings.set( { seo_content_video_thumbnail_url: posterUrl } );
					panel.currentPageView.render();
				} );

				/**
				 * Updates the SEO description help text based on field value.
				 */
				const updateDescriptionHelp = () => {
					const description = model.get( 'settings' ).get( 'seo_content_description' ) || '';
					const helpElement = panel.$el.find( '.godam-seo-description-help' );

					if ( helpElement.length ) {
						if ( ! description.trim() ) {
							helpElement.text( __( 'It is recommended to add a description for better video SEO.', 'godam' ) );
							helpElement.css( 'color', '#996800' );
						} else {
							helpElement.text( __( 'Description of the video', 'godam' ) );
							helpElement.css( 'color', '' );
						}
					}
				};

				// Delay to ensure the Elementor panel DOM has finished rendering
				// before querying and updating the SEO description help element.
				const DESCRIPTION_HELP_UPDATE_DELAY_MS = 100;

				// Update help text when description changes
				model.get( 'settings' ).on( 'change:seo_content_description', updateDescriptionHelp );

				// Update help text when panel renders
				panel.currentPageView.on( 'render', () => {
					setTimeout( updateDescriptionHelp, DESCRIPTION_HELP_UPDATE_DELAY_MS );
				} );

				panel.currentPageView.on( 'destroy', () => {
					if ( model._godamVirtualAttachmentCreatedHandler ) {
						document.removeEventListener( 'godam-virtual-attachment-created', model._godamVirtualAttachmentCreatedHandler );
						delete model._godamVirtualAttachmentCreatedHandler;
					}

					if ( model._godamSeoPopoverToggleHandler ) {
						panel.$el.off( 'click', '.elementor-control-seo_settings_popover_toggle', model._godamSeoPopoverToggleHandler );
						delete model._godamSeoPopoverToggleHandler;
					}
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
