/**
 * External dependencies
 */
import videojs from 'video.js';

/**
 * Resolve with a video's Video.js player once GoDAM has finished setting it up.
 *
 * `VideoPlayer` marks the `<video>` with `data-godam-ready="1"` right before it
 * dispatches `godamPlayerReady`, so this works whether the player is already
 * ready or is still starting.
 *
 * @param {HTMLVideoElement} video - The GoDAM `<video>` element.
 * @return {Promise<Object>} The Video.js player.
 */
export function whenPlayerReady( video ) {
	if ( video?.dataset?.godamReady === '1' ) {
		const player = videojs.getPlayer( video );
		if ( player ) {
			return Promise.resolve( player );
		}
	}

	return new Promise( ( resolve ) => {
		const onReady = ( event ) => {
			if ( event.detail?.videoElement !== video ) {
				return;
			}
			document.removeEventListener( 'godamPlayerReady', onReady );
			resolve( event.detail.player );
		};
		document.addEventListener( 'godamPlayerReady', onReady );
	} );
}
