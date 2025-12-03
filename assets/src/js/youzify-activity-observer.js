( function( window, document ) {
	if ( window.godamYouzifyObserverInitialized ) {
		return;
	}
	window.godamYouzifyObserverInitialized = true;

	const boot = function() {
		const hasMutationObserver = 'MutationObserver' in window;

		const initializePlayer = function( container ) {
			if ( ! container || container.dataset.godamPlayerBootstrapped === '1' ) {
				return;
			}

			const video = container.querySelector( '.easydam-player.video-js' );
			if ( ! video || typeof window.GODAMPlayer !== 'function' ) {
				return;
			}

			container.dataset.godamPlayerBootstrapped = '1';
			window.GODAMPlayer( container );
		};

		const discoverContainers = function( root ) {
			if ( ! root || typeof root.querySelectorAll !== 'function' ) {
				return;
			}

			root.querySelectorAll( '.easydam-video-container' ).forEach( initializePlayer );
		};

		// Initialize existing containers on page load
		discoverContainers( document );

		// If MutationObserver is not available, we've already initialized existing containers
		if ( ! hasMutationObserver ) {
			return;
		}

		// Watch for new containers being added to the DOM
		const mutationObserver = new MutationObserver( ( mutationList ) => {
			mutationList.forEach( ( mutation ) => {
				mutation.addedNodes.forEach( ( node ) => {
					if ( ! ( node instanceof HTMLElement ) ) {
						return;
					}

					// If the added node itself is a video container, initialize it
					if ( node.classList.contains( 'easydam-video-container' ) ) {
						initializePlayer( node );
					}

					// Also check for containers within the added node
					discoverContainers( node );
				} );
			} );
		} );

		if ( document.body ) {
			mutationObserver.observe( document.body, { childList: true, subtree: true } );
		}
	};

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', boot );
	} else {
		boot();
	}
}( window, document ) );
