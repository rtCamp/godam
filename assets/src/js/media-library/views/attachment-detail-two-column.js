/* global Backbone */

/**
 * External dependencies
 */
import DOMPurify from 'isomorphic-dompurify';
import videojs from 'video.js';
/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { addIcon, trashIcon } from '../media-library-icons';
import { canManageAttachment } from '../utility';

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
	 *
	 * @param {Function} renderMethod - The method to render the fetched data.
	 */
	async fetchAndRender( fetchPromise, renderMethod ) {
		const data = await fetchPromise;

		const actionsEl = this.$el.find( '.attachment-actions' );

		// If there's no data remove the spinner and show message.
		if ( ! data ) {
			const thumbnailContainer = actionsEl?.find( '.attachment-video-thumbnails' );

			thumbnailContainer?.find( '.thumbnail-spinner' )?.remove();
			const container = thumbnailContainer?.find( '.thumbnail-spinner-container' )?.get( 0 );
			if ( container ) {
				container.className = '';
				container.innerText = __( 'No thumbnails found', 'godam' );
			}

			return;
		}

		renderMethod.call( this, data.data );
	},

	/**
	 * Fetches data from a given URL with the provided attachment ID.
	 *
	 * @param {string} url          - The API endpoint URL.
	 *
	 * @param {number} attachmentId - The ID of the attachment.
	 *
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
	 *
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
	 *
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

	/**
	 * Sets up click handlers for removing custom video thumbnails.
	 */
	setupThumbnailActions() {
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

	/**
	 * Removes a custom video thumbnail image.
	 *
	 * @param {string} thumbnailURL - The URL of the thumbnail to remove.
	 */
	removeThumbnailImage( thumbnailURL ) {
		const formData = new FormData();
		formData.append( 'attachment_id', this.model.get( 'id' ) );
		formData.append( 'thumbnail_url', thumbnailURL );

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
				}
			} )
			.catch( () => {
				// silent fail
			} );
	},

	showGodamSnackbar( message ) {
		let snackbar = document.getElementById( 'godam-snackbar' );
		if ( ! snackbar ) {
			snackbar = document.createElement( 'div' );
			snackbar.id = 'godam-snackbar';
			document.body.appendChild( snackbar );
		}
		snackbar.textContent = message;
		snackbar.className = 'show';
		setTimeout( () => {
			snackbar.className = snackbar.className.replace( 'show', '' );
		}, 3000 ); // 3 seconds
	},

	/**
	 * Opens the media uploader to select a custom thumbnail.
	 *
	 * @param {Function} onSelect - Callback function to handle the selected attachment.
	 */
	openMediaUploader( onSelect ) {
		if ( ! window.wp || ! window.wp.media ) {
			return;
		}

		const uploader = wp.media( {
			title: __( 'Select Custom Thumbnail', 'godam' ),
			button: { text: __( 'Use this image', 'godam' ) },
			multiple: false,
			library: { type: [ 'image' ] },
		} );

		uploader.on( 'select', () => {
			const attachment = uploader.state().get( 'selection' ).first().toJSON();
			if ( attachment && attachment.url && attachment.id ) {
				// Double-check it's actually an image
				if ( attachment.type === 'image' ) {
					onSelect( attachment );
				} else {
					this.showGodamSnackbar( __( 'Please select a valid image file (JPEG, PNG, GIF, etc.).', 'godam' ) );
				}
			}
		} );

		uploader.open();
	},

	/**
	 * Creates a tile for uploading custom thumbnails.
	 *
	 * @param {boolean} uploadDisabled - Whether the upload button should be disabled.
	 *
	 * @return {HTMLElement} - The created upload tile element.
	 */
	createUploadTile( uploadDisabled ) {
		const sanitizedIcon = DOMPurify.sanitize( addIcon );

		const li = document.createElement( 'li' );
		li.className = 'upload-thumbnail-tile';
		li.title = uploadDisabled
			? __( 'Only 3 custom thumbnails allowed', 'godam' )
			: __( 'Upload Custom Thumbnail', 'godam' );

		const button = document.createElement( 'button' );
		button.type = 'button';
		button.className = 'custom-thumbnail-media-upload';

		if ( uploadDisabled ) {
			button.disabled = true;
			button.style.opacity = '0.5';
			button.style.cursor = 'not-allowed';
		}

		const span = document.createElement( 'span' );
		span.className = 'plus-icon';

		if ( uploadDisabled ) {
			span.style.cursor = 'not-allowed';
		}

		span.innerHTML = sanitizedIcon;

		button.appendChild( span );
		li.appendChild( button );

		return li;
	},

	/**
	 * Creates a custom thumbnail tile with controls.
	 *
	 * @param {string} thumbnailURL  - The URL of the thumbnail image.
	 *
	 * @param {string} selectedURL   - The URL of the currently selected thumbnail.
	 *
	 * @param {string} trashIconHTML - The HTML for the trash icon.
	 *
	 * @return {HTMLElement} - The created custom thumbnail tile element.
	 */
	createCustomThumbnailTile( thumbnailURL, selectedURL, trashIconHTML ) {
		const li = document.createElement( 'li' );
		li.className = 'custom-thumbnail-container';
		if ( thumbnailURL === selectedURL ) {
			li.classList.add( 'selected' );
		}

		const img = document.createElement( 'img' );
		img.src = DOMPurify.sanitize( thumbnailURL );
		img.alt = __( 'Custom Video Thumbnail', 'godam' );

		const controls = document.createElement( 'div' );
		controls.className = 'controls';

		const tooltip = document.createElement( 'div' );
		tooltip.className = 'tooltip mt-1';
		tooltip.title = __( 'Remove Image', 'godam' );

		const button = document.createElement( 'button' );
		button.className = 'custom-thumbnail-control remove-thumbnail';
		button.setAttribute( 'aria-label', __( 'Remove Image', 'godam' ) );
		button.dataset.thumbnail = thumbnailURL;

		const sanitizedTrashIcon = DOMPurify.sanitize( trashIconHTML );
		button.innerHTML = sanitizedTrashIcon;

		tooltip.appendChild( button );
		controls.appendChild( tooltip );

		li.appendChild( img );
		li.appendChild( controls );

		return li;
	},

	/**
	 * Creates a default thumbnail tile.
	 *
	 * @param {string} thumbnailURL - The URL of the thumbnail image.
	 *
	 * @param {string} selectedURL  - The URL of the currently selected thumbnail.
	 *
	 * @return {HTMLElement} - The created default thumbnail tile element.
	 */
	createDefaultThumbnailTile( thumbnailURL, selectedURL ) {
		const li = document.createElement( 'li' );
		if ( thumbnailURL === selectedURL ) {
			li.classList.add( 'selected' );
		}
		const img = document.createElement( 'img' );
		img.src = DOMPurify.sanitize( thumbnailURL );
		img.alt = __( 'Video Thumbnail', 'godam' );
		li.appendChild( img );
		return li;
	},

	/**
	 * Renders video thumbnails in the attachment details view.
	 *
	 * @param {Object} data - The video thumbnail data to render.
	 */
	renderThumbnail( data ) {
		if ( ! canManageAttachment( this.model.get( 'author' ) ) ) {
			return;
		}

		const { thumbnails, selected, customThumbnails } = data;
		const attachmentID = this.model.get( 'id' );

		const selector = `.transcoding-status--completed[data-id="${ attachmentID }"]`;
		const status = document.querySelector( selector );

		if ( status ) {
			const statusImg = status.querySelector( 'img' );

			if ( statusImg && statusImg.src !== selected ) {
				statusImg.src = selected;
			}
		}

		const virtual = this.model.get( 'virtual' );

		// If the attachment is virtual (e.g. a GoDAM proxy video), override default preview.
		if ( undefined !== virtual && virtual ) {
			const videoPlayer = videojs( 'videojs-player-' + this.model.get( 'id' ) );
			videoPlayer.poster( selected );
		}

		setTimeout( () => {
			// Sometimes helps if .mejs-poster is rendered asynchronously
			const posterDiv = document.querySelector( '.mejs-poster' );
			if ( posterDiv && selected ) {
				posterDiv.style.backgroundImage = `url('${ selected }')`;
				posterDiv.style.backgroundSize = 'contain';

				const posterImg = posterDiv.querySelector( 'img' );
				if ( posterImg ) {
					posterImg.setAttribute( 'src', selected );
					posterImg.style.opacity = '1';
				}
			}
		}, 20 );

		const customThumbnailsArray = Array.isArray( customThumbnails )
			? customThumbnails
			: Object.values( customThumbnails || {} );

		// Disable upload button if limit is reached
		const uploadDisabled = customThumbnailsArray.length >= 3;

		const ul = document.createElement( 'ul' );
		ul.appendChild( this.createUploadTile( uploadDisabled ) );

		customThumbnailsArray.forEach( ( thumbnail ) =>
			ul.appendChild(
				this.createCustomThumbnailTile( thumbnail, selected, trashIcon ),
			),
		);

		const thumbnailArray = Array.isArray( thumbnails ) ? thumbnails : Object.values( thumbnails || {} );
		thumbnailArray.forEach( ( thumbnail ) =>
			ul.appendChild( this.createDefaultThumbnailTile( thumbnail, selected ) ),
		);

		// Compose full container
		const div = document.createElement( 'div' );
		div.className = 'attachment-video-thumbnails';

		const containerDiv = document.createElement( 'div' );
		containerDiv.className = 'attachment-video-title';

		const heading = document.createElement( 'h4' );
		heading.textContent = __( 'Video Thumbnails', 'godam' );

		containerDiv.appendChild( heading );
		div.appendChild( containerDiv );

		div.appendChild( ul );

		// Remove old and append new
		const actionsEl = this.$el.find( '.attachment-actions' );
		actionsEl.find( '.attachment-video-thumbnails' ).remove(); // Remove old thumbnails if any
		actionsEl.append( div );

		this.setupThumbnailClickHandler( attachmentID );
		this.setupThumbnailActions();

		// Set upload click after DOM added
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
	},

	/**
	 * Handles the upload of a custom video thumbnail from a URL.
	 *
	 * @param {string} url - The URL of the thumbnail to upload.
	 */
	handleThumbnailUploadFromUrl( url ) {
		const formData = new FormData();
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
				}
			} )
			.catch( () => {
				// silent fail
			} );
	},

	/**
	 * Sets up click event handlers for selecting video thumbnails.
	 *
	 * @param {number} attachmentID - The ID of the attachment.
	 */
	setupThumbnailClickHandler( attachmentID ) {
		const model = this.model;
		document.querySelectorAll( '.attachment-video-thumbnails li' ).forEach( ( li ) => {
			if ( li.classList.contains( 'upload-thumbnail-tile' ) ) {
				// Skip the upload tile
				return;
			}
			li.addEventListener( 'click', function() {
				// Remove the selected class from all thumbnails
				document.querySelectorAll( '.attachment-video-thumbnails li' ).forEach( ( item ) => item.classList.remove( 'selected' ) );

				// Add selected class to the clicked thumbnail image
				this.classList.add( 'selected' );

				const img = this.querySelector( 'img' );

				const thumbnailURL = img?.src;

				const posterDiv = document.querySelector( '.mejs-poster' );
				if ( posterDiv ) {
					posterDiv.style.backgroundImage = `url('${ thumbnailURL }')`;

					const posterImg = posterDiv.querySelector( 'img' );
					if ( posterImg ) {
						posterImg.setAttribute( 'src', thumbnailURL );
						posterImg.style.opacity = '1';
					}
				}

				const selector = `.transcoding-status--completed[data-id="${ attachmentID }"]`;
				const status = document.querySelector( selector );

				if ( status ) {
					const statusImg = status.querySelector( 'img' );

					if ( statusImg && statusImg.src !== thumbnailURL ) {
						statusImg.src = thumbnailURL;
					}
				}

				const virtual = model.get( 'virtual' );

				// If the attachment is virtual (e.g. a GoDAM proxy video), override default preview.
				if ( undefined !== virtual && virtual ) {
					const videoPlayer = videojs( 'videojs-player-' + model.get( 'id' ) );
					videoPlayer.poster( thumbnailURL );
				}

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

		const editVideoButtonHTML = `<a href="${ editVideoURL }" class="button button-primary" target="_blank">Edit Video</a>`;
		const analyticsButtonHTML = `<a href="${ analyticsURL }" class="button button-secondary" target="_blank">Analytics</a>`;

		const buttons = [];

		// If the user can manage the attachment, show the Edit Video button, else show only Analytics.
		if ( canManageAttachment( this.model.get( 'author' ) ) ) {
			buttons.push( editVideoButtonHTML );
		}

		buttons.push( analyticsButtonHTML );

		return buttons.join( '' );
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
							fluid: true,
							width: '100%',
							aspectRatio: '16:9',
							poster: this.model.get( 'image' )?.src || '',
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
							// VHS (HLS/DASH) initial configuration to prefer a ~14 Mbps start.
							// This only affects the initial bandwidth guess; VHS will continue to measure actual throughput and adapt.
							html5: {
								vhs: {
									bandwidth: 14_000_000, // Pretend network can do ~14 Mbps at startup
									bandwidthVariance: 1.0, // allow renditions close to estimate
									limitRenditionByPlayerDimensions: false, // don't cap by video element size
								},
							},
						} );
					}
				}, 100 ); // Slight delay to ensure DOM update.
			}

			this.renderVideoActions();
			const attachmentId = this.model.get( 'id' );

			this.showLoading();

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

	showLoading() {
		const actionsEl = this.$el.find( '.attachment-actions' );
		const ul = document.createElement( 'ul' );

		const li = document.createElement( 'li' );
		li.className = 'thumbnail-spinner-container';
		const spinner = document.createElement( 'div' );
		spinner.className = 'thumbnail-spinner';
		li.appendChild( spinner );
		ul.appendChild( li );

		const div = document.createElement( 'div' );
		div.className = 'attachment-video-thumbnails';

		const containerDiv = document.createElement( 'div' );
		containerDiv.className = 'attachment-video-title';

		const heading = document.createElement( 'h4' );
		heading.textContent = __( 'Video Thumbnails', 'godam' );

		containerDiv.appendChild( heading );
		div.appendChild( containerDiv );

		div.appendChild( ul );

		actionsEl.append( div );
	},
} );
