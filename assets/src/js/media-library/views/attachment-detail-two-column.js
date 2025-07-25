/* global Backbone */

/**
 * External dependencies
 */
import DOMPurify from 'isomorphic-dompurify';
import videojs from 'video.js';
/**
 * WordPress dependencies
 */
// import { replace, trash } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

const AttachmentDetailsTwoColumn = wp?.media?.view?.Attachment?.Details?.TwoColumn;

const restURL = window.godamRestRoute.url || '';

export default AttachmentDetailsTwoColumn?.extend( {

	/**
	 * Initializes the AttachmentDetailsTwoColumn.
	 */
	initialize() {
		AttachmentDetailsTwoColumn.prototype.initialize.apply( this, arguments );
	},

	/**
	 * Fetches data from an API and renders it using the provided render method.
	 *
	 * @param {Promise}  fetchPromise - The promise that resolves to the fetched data.
	 * @param {Function} renderMethod - The method to render the fetched data.
	 */
	async fetchAndRender( fetchPromise, renderMethod ) {
		const data = await fetchPromise;
		if ( data ) {
			renderMethod.call( this, data.data );
		}
	},

	/**
	 * Fetches data from a given URL with the provided attachment ID.
	 *
	 * @param {string} url          - The API endpoint URL.
	 * @param {number} attachmentId - The ID of the attachment.
	 * @return {Promise<Object|null>} - The fetched data or null on failure.
	 */
	async fetchData( url, attachmentId ) {
		if ( ! attachmentId ) {
			return null;
		}
		try {
			const response = await fetch( `${ url }?attachment_id=${ attachmentId }`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpApiSettings?.nonce || '',
				},
			} );

			// Check if the response is anything else than 200, then return null.
			if ( response.status !== 200 ) {
				return null;
			}

			return response.ok ? response.json() : null;
		} catch {
			return null;
		}
	},

	/**
	 * Retrieves video thumbnails for the given attachment ID.
	 *
	 * @param {number} attachmentId - The ID of the attachment.
	 * @return {Promise<Object|null>} - The fetched thumbnails data or null.
	 */
	getVideoThumbnails( attachmentId ) {
		const attachment = wp.media.attachment( attachmentId );
		if ( attachment?.attributes?.type !== 'video' ) {
			return null;
		}
		return this.fetchData( window.pathJoin( [ restURL, '/godam/v1/media-library/get-video-thumbnail' ] ), attachmentId );
	},

	/**
	 * Retrieves EXIF details for the given attachment ID.
	 *
	 * @param {number} attachmentId - The ID of the attachment.
	 * @return {Promise<Object|null>} - The fetched EXIF data or null.
	 */
	getExifDetails( attachmentId ) {
		return this.fetchData( window.pathJoin( [ restURL, '/godam/v1/media-library/get-exif-data' ] ), attachmentId );
	},

	/**
	 * Renders EXIF details in the attachment details view.
	 *
	 * @param {Object} data - The EXIF data to render.
	 */
	renderExifDetails( data ) {
		const exifList = Object.entries( data )
			.map( ( [ key, value ] ) => `<li><strong>${ key }: </strong>${ value }</li>` )
			.join( '' );

		const exifDiv = `<div class="exif-details"><h4>EXIF Data Details</h4><ul>${ exifList }</ul></div>`;
		this.$el.find( '.details' ).append( DOMPurify.sanitize( exifDiv ) );
	},

	setupThumbnailActions() {
		// Replace handler
		document.querySelectorAll( '.replace-thumbnail' ).forEach( ( btn ) => {
			btn.addEventListener( 'click', ( event ) => {
				event.preventDefault();
				event.stopPropagation();
				const existingThumb = btn.dataset.thumbnail;
				this.openMediaUploader( ( attachment ) => {
					this.replaceCustomThumbnail( existingThumb, attachment.url );
				} );
			} );
		} );

		// Remove handler
		document.querySelectorAll( '.remove-thumbnail' ).forEach( ( btn ) => {
			btn.addEventListener( 'click', ( event ) => {
				event.preventDefault();
        		event.stopPropagation();
				const thumbnail = btn.dataset.thumbnail;
				this.removeThumbnailImage( thumbnail );
			} );
		} );
	},

	replaceCustomThumbnail( oldThumbnail, newThumbnail ) {
		const formData = new FormData();
		// formData.append( 'file', file );
		formData.append( 'attachment_id', this.model.get( 'id' ) );
		formData.append( 'old_thumbnail', oldThumbnail );
		formData.append( 'thumbnail_url', newThumbnail );

		fetch(
			window.pathJoin( [
				restURL,
				'/godam/v1/media-library/replace-custom-video-thumbnail',
			] ),
			{
				method: 'POST',
				body: formData,
				headers: {
					'X-WP-Nonce': window.wpApiSettings?.nonce || '',
				},
			},
		)
			.then( ( response ) => response.json() )
			.then( ( data ) => {
				if ( data.success ) {
					document.querySelector( '.attachment-video-thumbnails' ).remove();
					this.render(); // full re-render
				} else {
					alert( 'Failed to upload thumbnail.' );
				}
			} )
			.catch( () => alert( 'An error occurred while uploading the thumbnail.' ) );
	},

	removeThumbnailImage( thumbnailURL ) {
		const formData = new FormData();
		// formData.append( 'file', file );
		formData.append( 'attachment_id', this.model.get( 'id' ) );
		formData.append( 'thumbnail_url', thumbnailURL );

		console.log( 'deleting thumbnail:', thumbnailURL );

		fetch(
			window.pathJoin( [
				restURL,
				'/godam/v1/media-library/delete-custom-video-thumbnail',
			] ),
			{
				method: 'POST',
				body: formData,
				headers: {
					'X-WP-Nonce': window.wpApiSettings?.nonce || '',
				},
			},
		)
			.then( ( response ) => response.json() )
			.then( ( data ) => {
				if ( data.success ) {
					document.querySelector( '.attachment-video-thumbnails' ).remove();
					this.render(); // full re-render
				} else {
					alert( 'Failed to upload thumbnail.' );
				}
			} )
			.catch( () => alert( 'An error occurred while uploading the thumbnail.' ) );
	},

	openMediaUploader( onSelect ) {
		if ( ! window.wp || ! window.wp.media ) {
			return;
		}

		const uploader = wp.media( {
			title: 'Select Custom Thumbnail',
			button: { text: 'Use this image' },
			multiple: false,
			library: { type: [ 'image' ] },
		} );

		uploader.on( 'select', () => {
			const attachment = uploader.state().get( 'selection' ).first().toJSON();
			if ( attachment && attachment.url && attachment.id ) {
				onSelect( attachment ); // Use callback for custom behavior
			}
		} );

		uploader.open();
	},

	/**
	 * Renders video thumbnails in the attachment details view.
	 *
	 * @param {Object} data - The video thumbnail data to render.
	 */
	renderThumbnail( data ) {
		const { thumbnails, selected, customThumbnails } = data;
		const attachmentID = this.model.get( 'id' );

		const replaceIcon = `
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
			<path d="M16 10h4c.6 0 1-.4 1-1V5c0-.6-.4-1-1-1h-4c-.6 0-1 .4-1 1v4c0 .6.4 1 1 1zm-8 4H4c-.6 0-1 .4-1 1v4c0 .6.4 1 1 1h4c.6 0 1-.4 1-1v-4c0-.6-.4-1-1-1zm10-2.6L14.5 15l1.1 1.1 1.7-1.7c-.1 1.1-.3 2.3-.9 2.9-.3.3-.7.5-1.3.5h-4.5v1.5H15c.9 0 1.7-.3 2.3-.9 1-1 1.3-2.7 1.4-4l1.8 1.8 1.1-1.1-3.6-3.7zM6.8 9.7c.1-1.1.3-2.3.9-2.9.4-.4.8-.6 1.3-.6h4.5V4.8H9c-.9 0-1.7.3-2.3.9-1 1-1.3 2.7-1.4 4L3.5 8l-1 1L6 12.6 9.5 9l-1-1-1.7 1.7z"></path>
		</svg>`;

		const trashIcon = `
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
			<path fill-rule="evenodd" clip-rule="evenodd" d="M12 5.5A2.25 2.25 0 0 0 9.878 7h4.244A2.251 2.251 0 0 0 12 5.5ZM12 4a3.751 3.751 0 0 0-3.675 3H5v1.5h1.27l.818 8.997a2.75 2.75 0 0 0 2.739 2.501h4.347a2.75 2.75 0 0 0 2.738-2.5L17.73 8.5H19V7h-3.325A3.751 3.751 0 0 0 12 4Zm4.224 4.5H7.776l.806 8.861a1.25 1.25 0 0 0 1.245 1.137h4.347a1.25 1.25 0 0 0 1.245-1.137l.805-8.861Z"></path>
		</svg>`;

		// Use WordPress media uploader for custom thumbnail upload
		const uploadTileHTML = `
			<li class="upload-thumbnail-tile" title="Upload Custom Thumbnail">
				<button type="button" class="custom-thumbnail-media-upload">
					<span class="plus-icon">➕</span>
					<span class="upload-label">Upload Custom Thumbnail</span>
				</button>
			</li>`;

		// Attach click handler after rendering
		setTimeout( () => {
			const $btn = this.$el.find( '.custom-thumbnail-media-upload' );
			if ( $btn.length ) {
				$btn.off( 'click' ).on( 'click', () => {
					this.openMediaUploader( ( attachment ) => {
						this.handleThumbnailUploadFromUrl( attachment.url );
					} );
				} );
			}
		}, 0 );

		const thumbnailArray = Object.values( thumbnails || {} );

		const thumbnailsHTML = thumbnailArray
			?.map(
				( thumbnail ) =>
					`<li>
				<img class="${ thumbnail === selected ? 'selected' : '' }" src="${ thumbnail }" alt="Video Thumbnail" />
			</li>`,
			)
			.join( '' );

		const customThumbnailsArray = Object.values( customThumbnails || {} );
		const customThumbnailsHTML = customThumbnailsArray
			?.map(
				( thumbnail ) =>
					`<li class="custom-thumbnail-container">
				<img class="${ thumbnail === selected ? 'selected' : '' }" src="${ thumbnail }" alt="Custom Video Thumbnail" />
				<div class="controls">
					<div class="tooltip" title="${ __( 'Replace Image', 'godam' ) }">
						<button class="custom-thumbnail-control replace-thumbnail" aria-label="Replace Image" data-thumbnail="${ thumbnail }">
							${ replaceIcon }
						</button>
					</div>
					<div class="tooltip mt-1" title="${ __( 'Remove Image', 'godam' ) }">
						<button class="custom-thumbnail-control remove-thumbnail" aria-label="Remove Image" data-thumbnail="${ thumbnail }">
							${ trashIcon }
						</button>
					</div>
				</div>
			</li>`,
			)
			.join( '' );

		const thumbnailDiv = `
			<div class="attachment-video-thumbnails">
				<div class="attachment-video-title"><h4>Video Thumbnails</h4></div>
				<ul>
					${ uploadTileHTML }
					${ customThumbnailsHTML }
					${ thumbnailsHTML }
				</ul>
			</div>`;

		this.$el
			.find( '.attachment-actions' )
			.append( DOMPurify.sanitize( thumbnailDiv ) );
		this.setupThumbnailClickHandler( attachmentID );

		this.setupThumbnailActions();

		// Handle file upload interaction
		// this.$el.find( '#custom-thumbnail-upload' ).on( 'change', ( e ) => {
		// 	const file = e.target.files[ 0 ];
		// 	if ( file ) {
		// 		this.handleThumbnailUpload( file );
		// 	}
		// } );
	},

	handleThumbnailUploadFromUrl( url ) {
		const formData = new FormData();
		// formData.append( 'file', file );
		formData.append( 'attachment_id', this.model.get( 'id' ) );

		formData.append( 'thumbnail_url', url );

		fetch( window.pathJoin( [ restURL, '/godam/v1/media-library/upload-custom-video-thumbnail' ] ), {
			method: 'POST',
			body: formData,
			headers: {
				'X-WP-Nonce': window.wpApiSettings?.nonce || '',
			},
		} )
			.then( ( response ) => response.json() )
			.then( ( data ) => {
				if ( data.success ) {
					document.querySelector( '.attachment-video-thumbnails' ).remove();
					this.render(); // full re-render
				} else {
					alert( 'Failed to upload thumbnail.' );
				}
			} )
			.catch( () => alert( 'An error occurred while uploading the thumbnail.' ) );
	},

	/**
	 * Sets up click event handlers for selecting video thumbnails.
	 *
	 * @param {number} attachmentID - The ID of the attachment.
	 */
	setupThumbnailClickHandler( attachmentID ) {
		document.querySelectorAll( '.attachment-video-thumbnails li' ).forEach( ( li ) => {
			if ( li.classList.contains( 'upload-thumbnail-tile' ) ) {
				// Skip the upload tile
				return;
			}
			li.addEventListener( 'click', function() {
				// Remove the selected class from all thumbnails
				document.querySelectorAll( '.attachment-video-thumbnails li img' ).forEach( ( item ) => item.classList.remove( 'selected' ) );

				// Add selected class to the clicked thumbnail image
				const img = this.querySelector( 'img' );
				if ( img ) {
					img.classList.add( 'selected' );
				}

				const thumbnailURL = img?.src;

				/**
				 * Send a POST request to the server to set the selected thumbnail for the video.
				 */
				fetch( window.pathJoin( [ restURL, '/godam/v1/media-library/set-video-thumbnail' ] ), {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': window.wpApiSettings?.nonce || '',
					},
					body: JSON.stringify( { attachment_id: attachmentID, thumbnail_url: thumbnailURL } ),
				} );
			} );
		} );
	},

	/**
	 * Renders the Edit Video and Analytics buttons in the attachment details view.
	 */
	renderVideoActions() {
		const buttonsHTML = this.getButtonsHTML();
		this.$el.find( '.attachment-actions' ).append( DOMPurify.sanitize( `<div class="attachment-video-actions">${ buttonsHTML }</div>` ) );
	},

	/**
	 * Generates HTML for the Edit Video and Analytics buttons.
	 *
	 * @return {string} - The generated button HTML.
	 */
	getButtonsHTML() {
		const editVideoURL = `admin.php?page=rtgodam_video_editor&id=${ this.model.get( 'id' ) }`;
		const analyticsURL = `admin.php?page=rtgodam_analytics&id=${ this.model.get( 'id' ) }`;

		const activeUser = window?.MediaLibrary?.userData?.validApiKey;

		if ( ! activeUser ) {
			return `
			<a href="${ editVideoURL }" class="button button-primary" target="_blank">Edit Video</a>
			<div class="paid-feature" title="This feature is only available for paid users.">
				<a href="${ analyticsURL }" class="button button-secondary" target="_blank">Analytics</a>
				<span>$</span>
			</div>
			`;
		}

		return `
		<a href="${ editVideoURL }" class="button button-primary" target="_blank">Edit Video</a>
		<a href="${ analyticsURL }" class="button button-secondary" target="_blank">Analytics</a>
		`;
	},

	/**
	 * Renders the custom attachment details view.
	 *
	 * - Calls the parent `AttachmentDetailsTwoColumn.render()` method to ensure core UI is in place.
	 * - If the attachment is a video, renders custom action buttons (Edit Video, Analytics).
	 * - If the video is marked as a "virtual" entry:
	 * -- Injects a `<video>` player into the UI using video.js.
	 * -- Applies a custom player configuration with minimal controls and responsive layout.
	 * -- Ensures dynamic rendering via timeout to guarantee DOM readiness.
	 *
	 * @return {Backbone.View} The updated view instance for chaining.
	 */
	render() {
		// Call the parent render method.
		AttachmentDetailsTwoColumn.prototype.render.apply( this, arguments );

		// Check if the attachment is a video and render the edit buttons.
		if ( this.model.get( 'type' ) === 'video' ) {
			const virtual = this.model.get( 'virtual' );

			// If the attachment is virtual (e.g. a GoDAM proxy video), override default preview.
			if ( undefined !== virtual && virtual ) {
				const videoUrl = this.model.get( 'transcoded_url' ); // Ensure it's a valid .mp4
				const $container = this.$el.find( '.wp-video' );
				const videoId = 'videojs-player-' + this.model.get( 'id' ); // Unique ID

				// Clear default preview, Create a <video> element to be used by Video.js.
				$container.empty().append( `
					<video
						id="${ videoId }"
						class="video-js vjs-default-skin"
						controls
						preload="auto"
						width="100%"
						height="auto"
					>
						<source src="${ videoUrl }" type="application/dash+xml" />
					</video>
				` );

				// Wait for DOM to fully render the core preview container.
				setTimeout( () => {
					const videoElement = document.getElementById( videoId );
					if ( videoElement && typeof videojs !== 'undefined' ) {
						// Initialize the player with minimal controls.
						videojs( videoElement, {
							width: '100%',
							aspectRatio: '16:9',
							controlBar: {
								volumePanel: false,
								fullscreenToggle: true,
								currentTimeDisplay: true,
								timeDivider: true,
								durationDisplay: true,
								remainingTimeDisplay: true,
								progressControl: true,
								playToggle: true,
								captionsButton: false,
								chaptersButton: false,
								pictureInPictureToggle: false,
							},
						} );
					}
				}, 100 ); // Slight delay to ensure DOM update.
			}

			this.renderVideoActions();
			const attachmentId = this.model.get( 'id' );
			this.fetchAndRender(
				this.getVideoThumbnails( attachmentId ),
				this.renderThumbnail,
			);
			this.fetchAndRender(
				this.getExifDetails( attachmentId ),
				this.renderExifDetails,
			);
		}

		// Return this view.
		return this;
	},
} );
