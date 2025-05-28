document.addEventListener( 'DOMContentLoaded', function() {
	const modal = document.getElementById( 'godam-video-modal' );
	const modalVideo = document.getElementById( 'godam-modal-video' );
	const closeModal = document.querySelector( '.godam-modal-close' );

	document.querySelectorAll( '.godam-video-thumbnail' ).forEach( ( thumbnail ) => {
		thumbnail.addEventListener( 'click', () => {
			const videoUrl = thumbnail.getAttribute( 'data-video-url' );
			if ( videoUrl ) {
				modalVideo.src = videoUrl;
				modal.classList.remove( 'hidden' );
				modalVideo.play();
			}
		} );
	} );

	function close() {
		modalVideo.pause();
		modalVideo.src = '';
		modal.classList.add( 'hidden' );
	}

	closeModal.addEventListener( 'click', close );

	modal.addEventListener( 'click', function( e ) {
		if ( ! e.target.closest( '.godam-modal-content' ) ) {
			close();
		}
	} );
} );
