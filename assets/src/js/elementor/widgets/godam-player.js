
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
			'frontend/element_ready/godam-player.default',
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
				if ( model.get( 'widgetType' ) !== 'godam-player' ) {
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

					const apiURL = `/wp-json/wp/v2/media/${ videoFile.id }`;
					fetch( apiURL ).then(
						( response ) => {
							if ( response.ok ) {
								return response.json();
							}

							return false;
						},
					).then( ( data ) => {
						if ( ! data ) {
							return;
						}
						const seoData = prepareVideoMeta( data );
						model.get( 'settings' ).set( { seo_content_url: seoData.contentUrl } );
						model.get( 'settings' ).set( { seo_content_headline: seoData.headline } );
						model.get( 'settings' ).set( { seo_content_upload_date: seoData.uploadDate } );
						model.get( 'settings' ).set( { seo_content_video_thumbnail_url: seoData.thumbnailUrl } );
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
