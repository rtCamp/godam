/**
 * Seek a Video.js player to a timestamp, however early it is asked.
 *
 * Shared by the deep-link handler and the lightbox, both of which can be handed
 * a `?t=` before the media has any duration to seek within.
 *
 * @param {Object} player  - Video.js player instance.
 * @param {number} seconds - Target time in seconds.
 */
export function seekPlayer( player, seconds ) {
	if ( ! player || ! ( seconds > 0 ) ) {
		return;
	}

	const seekToTime = () => player.currentTime( seconds );

	// Metadata already loaded — the duration is known, so this sticks.
	if ( player.readyState() >= 1 ) {
		seekToTime();
		return;
	}

	player.one( 'loadedmetadata', seekToTime );

	// Also seek on the first play event, which covers both the race where
	// loadedmetadata fired before the listener above was bound, and HLS streams
	// where currentTime only holds once playback has started.
	player.one( 'play', () => {
		if ( player.currentTime() < seconds ) {
			seekToTime();
		}
		player.off( 'loadedmetadata', seekToTime );
	} );
}
