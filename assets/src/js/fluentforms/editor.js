/**
 * To observe the video div and call the frontend scripts.
 */
const videoDivObserver = new MutationObserver( ( mutationsList, observerInstance ) => {
	const targetDiv = document.querySelector( '.godam-player.video-js' );
	if ( targetDiv && 'function' === typeof window.GODAMPlayer ) {
		window.GODAMPlayer();
		observerInstance.disconnect();
	}
} );

/**
 * Observe the video div to call frontend player.
 */
videoDivObserver.observe( document.body, { childList: true, subtree: true } );
