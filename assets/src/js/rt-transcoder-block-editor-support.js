/**
 * Gutenberg support for transcoder.
 *
 * @package transcoder
 */

import apiFetch from '@wordpress/api-fetch';

const { rtTranscoderBlockEditorSupport } = window;

const updateAMPStoryMedia = ( BlockEdit ) => {
	return ( props ) => {
		const mediaAttributes = props.attributes;
		const isAMPStory = 'amp/amp-story-page' === props.name;
		const isVideoBlock = 'core/video' === props.name;
		const mediaId = isAMPStory ? mediaAttributes.mediaId : mediaAttributes.id;
		if ( typeof mediaId !== 'undefined' ) {
			if ( typeof mediaAttributes.poster === 'undefined' ) {
				if ( isAMPStory && typeof mediaAttributes.mediaType !== 'undefined' &&
					'video' === mediaAttributes.mediaType && ! mediaAttributes.mediaUrl.endsWith( 'mp4' ) ) {
					props.setAttributes( { poster: rtTranscoderBlockEditorSupport.amp_story_fallback_poster } );
				} else if ( isVideoBlock && typeof mediaAttributes.src !== 'undefined' &&
					mediaAttributes.src.indexOf( 'blob:' ) !== 0 && ! mediaAttributes.src.endsWith( 'mp4' ) ) {
					props.setAttributes( { poster: rtTranscoderBlockEditorSupport.amp_video_fallback_poster } );
				}
			} else if ( mediaAttributes.poster.endsWith( '-fallback-poster.png' ) ) {
				const restBase = '/wp-json/transcoder/v1/amp-media';
				apiFetch(
					{
						path: `${ restBase } / ${ mediaId }`
					}
				).then(
					data => {
						if ( false !== data && null !== data ) {
							if ( data.poster.length && data.transcodedMedia.length ) {
								if ( isAMPStory && typeof mediaAttributes.mediaType !== 'undefined' && 'video' === mediaAttributes.mediaType ) {
									props.setAttributes(
										{
											poster: data.poster,
											mediaUrl: data.transcodedMedia,
										}
									);
								} else if ( isVideoBlock ) {
									props.setAttributes(
										{
											poster: data.poster,
											src: data.transcodedMedia,
										}
									);
								}
							}
						}
					}
				);
			}
		}

		return (
			<BlockEdit { ...props } />
		);
	};
};

wp.hooks.addFilter( 'editor.BlockEdit', 'rt-transcoder-amp/set-media-attributes', updateAMPStoryMedia );
