/**
 * Blur-up poster placeholders.
 *
 * Kept free of Video.js and of the player managers so the small loader
 * (`frontend.js`) can reveal posters before the player runtime has loaded.
 * Without this, a blurred poster stays at `opacity: 0` until a player starts.
 */

/**
 * Initialize blur-up LQIP placeholders.
 *
 * For each `.godam-blurred-img` div, wait for the inner full-quality poster
 * image to finish loading, then add the `loaded` class so CSS fades it in over
 * the blurry background placeholder. Idempotent: each placeholder is bound once.
 *
 * @param {Document|HTMLElement} [root=document] - Where to look for placeholders.
 */
export function initBlurUpPlaceholders( root = document ) {
	root.querySelectorAll( '.godam-blurred-img' ).forEach( ( div ) => {
		if ( div.dataset.godamBlurInit === '1' ) {
			return;
		}
		div.dataset.godamBlurInit = '1';

		const img = div.querySelector( '.godam-player-poster-image' );
		if ( ! img ) {
			return;
		}
		const markLoaded = () => div.classList.add( 'loaded' );
		const markError = () => {
			// On error, remove the blurry background so nothing is broken.
			div.style.backgroundImage = '';
			div.classList.add( 'loaded' );
		};
		if ( img.complete && img.naturalWidth > 0 ) {
			markLoaded();
		} else {
			img.addEventListener( 'load', markLoaded, { once: true } );
			img.addEventListener( 'error', markError, { once: true } );
		}
	} );
}
