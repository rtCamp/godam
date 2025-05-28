document.querySelectorAll( '.godam-video-thumbnail' ).forEach( ( thumbnail ) => {
	thumbnail.addEventListener( 'click', async () => {
		const videoId = thumbnail.getAttribute( 'data-video-id' );
		if ( ! videoId ) {
			return;
		}

		try {
			const response = await fetch( `/wp-json/godam/v1/video-shortcode?id=${ videoId }` );
			const data = await response.json();

			if ( data.status === 'success' && data.html ) {
				// Check if modal exists or create it
				let modal = document.getElementById( 'godam-video-modal' );
				if ( ! modal ) {
					modal = document.createElement( 'div' );
					modal.id = 'godam-video-modal';
					modal.className = 'godam-modal';
					document.body.appendChild( modal );
				}

				modal.innerHTML = `
					<div class="godam-modal-overlay"></div>
					<div class="godam-modal-content">
						<span class="godam-modal-close">&times;</span>
						${ data.html }
					</div>
				`;

				modal.classList.remove( 'hidden' );

				// Auto-play the rendered video
				const newVideo = modal.querySelector( 'video' );
				if ( newVideo ) {
					newVideo.play();
				}

				// Close handlers
				const close = () => {
					if ( newVideo ) {
						newVideo.pause();
						newVideo.src = '';
					}
					modal.classList.add( 'hidden' );
				};

				modal.querySelector( '.godam-modal-close' )?.addEventListener( 'click', close );
				modal.addEventListener( 'click', ( e ) => {
					if ( ! e.target.closest( '.godam-modal-content' ) ) {
						close();
					}
				} );
			}
		} catch ( error ) {
		}
	} );
} );
