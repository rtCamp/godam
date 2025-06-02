/* global GODAMPlayer */

document.querySelectorAll( '.godam-video-thumbnail' ).forEach( ( thumbnail ) => {
	thumbnail.addEventListener( 'click', async () => {
		const videoId = thumbnail.getAttribute( 'data-video-id' );
		if ( ! videoId ) {
			return;
		}

		// Check if modal exists or create it
		let modal = document.getElementById( 'godam-video-modal' );
		if ( ! modal ) {
			modal = document.createElement( 'div' );
			modal.id = 'godam-video-modal';
			modal.className = 'godam-modal';
			document.body.appendChild( modal );
		}

		// Show modal immediately with the player
		modal.innerHTML = `
			<div class="godam-modal-overlay"></div>
			<div class="godam-modal-content">
				<span class="godam-modal-close">&times;</span>
				<div class="easydam-video-container animate-video-loading">
					<div class="animate-play-btn">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
							<path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
						</svg>
					</div>
				</div>
			</div>
		`;

		modal.classList.remove( 'hidden' );

		// Initialize the video player
		if ( typeof GODAMPlayer === 'function' ) {
			GODAMPlayer( modal );
		}

		// Close handlers
		const close = () => {
			// Find and dispose any video players in the modal
			const players = modal.querySelectorAll( '.video-js' );
			players.forEach( ( player ) => {
				if ( player.player ) {
					player.player.dispose();
				}
			} );
			modal.classList.add( 'hidden' );
		};

		modal.querySelector( '.godam-modal-close' )?.addEventListener( 'click', close );
		modal.addEventListener( 'click', ( e ) => {
			if ( ! e.target.closest( '.godam-modal-content' ) ) {
				close();
			}
		} );

		// Fetch video data in the background
		try {
			const response = await fetch( `/wp-json/godam/v1/video-shortcode?id=${ videoId }` );
			const data = await response.json();

			if ( data.status === 'success' && data.html ) {
				// Update the video element with the fetched data
				const videoContainer = modal.querySelector( '.easydam-video-container' );
				if ( videoContainer ) {
					videoContainer.innerHTML = data.html;
					videoContainer.classList.remove( 'animate-video-loading' );
					// Reinitialize the player with the new content
					if ( typeof GODAMPlayer === 'function' ) {
						GODAMPlayer( modal );
					}
				}
			}
		} catch ( error ) {
			const videoContainer = modal.querySelector( '.easydam-video-container' );
			if ( videoContainer ) {
				videoContainer.innerHTML = `<div class="godam-error-message">${ wp.i18n.__( 'Unable to load video. Please try again later.', 'godam' ) }</div>`;
				videoContainer.classList.remove( 'animate-video-loading' );
			}
		}
	} );
} );
