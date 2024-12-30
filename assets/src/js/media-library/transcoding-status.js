/**
 * External dependencies
 */
import DOMPurify from 'isomorphic-dompurify';

( function() {
	document.addEventListener( 'DOMContentLoaded', function() {
		if ( typeof wp === 'undefined' || typeof wp.Uploader === 'undefined' ) {
			return;
		}

		const progressBars = new Map();

		// Check for existing video files in the media library.
		setTimeout( checkExistingVideoProgress, 500 );

		// Listen for new files added to the queue.
		wp.Uploader.queue.on( 'add', function( file ) {
			wp.Uploader.queue.on( 'reset', function() {
				// Only show progress bar for video files.
				if ( file.attributes.type === 'video' ) {
					const attachmentId = file.id;
					initializeProgressBar( attachmentId );
				}

				progressBars.clear();
				checkExistingVideoProgress();
			} );
		} );

		/**
		 * Initialize progress bar for the given attachment.
		 *
		 * @param {number} attachmentId
		 */
		function initializeProgressBar( attachmentId ) {
			const mediaItemPreview = document.querySelector( `.attachments .attachment[data-id="${ attachmentId }"] .attachment-preview` );

			if ( ! mediaItemPreview ) {
				return;
			}

			const progressBarTemplate =
				`<div class="transcoder-progress-bar" style="display: none;">
					<div class="progress" style="width: 0%;">
						<span class="progress-text">0%</span>
					</div>
				</div>`;

			const progressBar = DOMPurify.sanitize( progressBarTemplate );

			mediaItemPreview.insertAdjacentHTML( 'beforeend', progressBar );
			const progressBarElement = mediaItemPreview.querySelector( '.transcoder-progress-bar' );
			progressBars.set( attachmentId, progressBarElement );
			monitorProgress( attachmentId );
		}

		/**
		 * Check for existing video files in the media.
		 */
		function checkExistingVideoProgress() {
			const videoQuery = wp.media.query( {
				type: 'video',
				posts_per_page: -1,
			} );

			videoQuery.more().done( function() {
				const videoAttachments = videoQuery.models;
				videoAttachments.forEach( function( attachment ) {
					const attachmentId = attachment.id;
					initializeProgressBar( attachmentId );
				} );
			} ).fail( function() {
				console.error( 'Failed to load video attachments.' );
			} );
		}

		/**
		 * Monitor the transcoding progress of the given attachment.
		 *
		 * @param {number} attachmentId
		 */
		function monitorProgress( attachmentId ) {
			const progressBar = progressBars.get( attachmentId );
			if ( ! progressBar ) {
				return;
			}

			fetch( `${ transcoderSettings.restUrl }/${ attachmentId }`, {
				method: 'GET',
				headers: {
					'X-WP-Nonce': transcoderSettings.nonce,
				},
			} )
				.then( ( response ) => response.json() )
				.then( ( data ) => {
					const progress = parseFloat( data.progress ) || 0;
					progressBar.style.display = 'block';
					const progressBarElement = progressBar.querySelector( '.progress' );
					const progressText = progressBar.querySelector( '.progress-text' );

					progressBarElement.style.width = `${ progress }%`;

					// Hide the text if progress is less than 30 to avoid overlapping with the progress bar.
					if ( progress < 30 ) {
						progressText.textContent = '';
					} else {
						progressText.textContent = `${ progress }%`;
					}

					if ( progress < 100 ) {
						setTimeout( () => monitorProgress( attachmentId ), 1000 );
					} else {
						progressBar.remove();
						progressBars.delete( attachmentId );
					}
				} )
				.catch( ( error ) => {
					console.error( 'Error monitoring progress:', error );
					setTimeout( () => monitorProgress( attachmentId ), 1000 );
				} );
		}
	} );
}() );

/**
 * Js for sending the REST API request on the button click.
 */
( function() {
	document.addEventListener( 'DOMContentLoaded', function() {
		const checkStatusBtns = document.querySelectorAll( '[name="check_status_btn"]' );

		checkStatusBtns.forEach( function( btn ) {
			btn.addEventListener( 'click', function() {
				const postId = btn.dataset.value;
				const btnText = document.querySelector( `#btn_check_status${ postId }` ).textContent;
				const spanStatusElement = document.querySelector( `#span_status${ postId }` );
				const checkStatusElement = document.querySelector( `#btn_check_status${ postId }` );

				spanStatusElement.textContent = '';
				checkStatusElement.textContent = 'Checking...';
				spanStatusElement.style.display = 'none';
				checkStatusElement.disabled = true;

				fetch( `${ transcoderSettings.restUrl }/${ postId }`, {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': transcoderSettings.nonce,
					},
				} )
					.then( ( response ) => response.json() )
					.then( ( data ) => {
						if ( data.status === 'Success' ) {
							checkStatusElement.style.display = 'none';
						}

						spanStatusElement.textContent = data.message;
						spanStatusElement.style.display = 'block';
						checkStatusElement.textContent = btnText;
						checkStatusElement.disabled = false;
					} )
					.catch( ( error ) => {
						console.error( 'Error:', error );
						checkStatusElement.textContent = btnText;
						checkStatusElement.disabled = false;
					} );
			} );
		} );
	} );
}() );
