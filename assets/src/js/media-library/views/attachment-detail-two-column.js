/* global Backbone */

/**
 * External dependencies
 */
import DOMPurify from 'isomorphic-dompurify';
import videojs from 'video.js';
/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { addIcon, trashIcon, editIcon, barChartIcon } from '../media-library-icons';
import { canManageAttachment } from '../utility';

const AttachmentDetailsTwoColumn = wp?.media?.view?.Attachment?.Details?.TwoColumn;

const restURL = window.godamRestRoute?.url || window.wpApiSettings?.root || '/wp-json/';

export default AttachmentDetailsTwoColumn?.extend( {

	/**
	 * Initializes the AttachmentDetailsTwoColumn.
	 */
	initialize() {
		AttachmentDetailsTwoColumn.prototype.initialize.apply( this, arguments );
	},

	/**
	 * Cleans up event listeners and player instances.
	 */
	dispose() {
		this.closeManageVersionsModal();

		// Clean up native player observer timeout
		if ( this._nativeObserverTimeout ) {
			clearTimeout( this._nativeObserverTimeout );
			this._nativeObserverTimeout = null;
		}

		// Clean up native player observer
		if ( this._nativePlayerObserver ) {
			this._nativePlayerObserver.disconnect();
			this._nativePlayerObserver = null;
		}

		// Clean up native player polling interval
		if ( this._nativeResizePollInterval ) {
			clearInterval( this._nativeResizePollInterval );
			this._nativeResizePollInterval = null;
		}

		// Clean up virtual player
		if ( this._virtualPlayer ) {
			try {
				// Check if player hasn't already been disposed and DOM element still exists
				if ( typeof this._virtualPlayer.isDisposed === 'function' && ! this._virtualPlayer.isDisposed() ) {
					// Verify that the player's DOM element still exists before disposal
					const playerEl = this._virtualPlayer.el();
					if ( playerEl && playerEl.parentNode ) {
						this._virtualPlayer.dispose();
					}
				}
			} catch ( error ) {
				// Silently handle disposal errors that may occur if DOM is already removed
				// eslint-disable-next-line no-console
				console.warn( 'Video.js player disposal warning:', error.message );
			} finally {
				this._virtualPlayer = null;
			}
		}

		// Clean up resize handler
		if ( this._virtualResizeHandler ) {
			window.removeEventListener( 'resize', this._virtualResizeHandler );
			this._virtualResizeHandler = null;
		}

		// Call parent dispose if available
		if ( AttachmentDetailsTwoColumn.prototype.dispose ) {
			AttachmentDetailsTwoColumn.prototype.dispose.apply( this, arguments );
		}
	},

	/**
	 * Fetches data from an API and renders it using the provided render method.
	 *
	 * @param {Promise}  fetchPromise - The promise that resolves to the fetched data.
	 *
	 * @param {Function} renderMethod - The method to render the fetched data.
	 *
	 * @param {string}   type         - The type of data being fetched. Defaults to empty string.
	 */
	async fetchAndRender( fetchPromise, renderMethod, type = '' ) {
		const data = await fetchPromise;

		// If there's no data remove the spinner and show message.
		if ( ! data ) {
			if ( 'thumbnails' === type ) {
				const actionsEl = this.$el.find( '.attachment-actions' );
				const thumbnailContainer = actionsEl?.find( '.attachment-video-thumbnails' );

				thumbnailContainer?.find( '.thumbnail-spinner' )?.remove();
				const container = thumbnailContainer?.find( '.thumbnail-spinner-container' )?.get( 0 );
				if ( container ) {
					container.className = '';
					container.innerText = __( 'No thumbnails found', 'godam' );
				}
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

	showGodamSnackbar( message, type = 'error' ) {
		let snackbar = document.getElementById( 'godam-snackbar' );
		if ( ! snackbar ) {
			snackbar = document.createElement( 'div' );
			snackbar.id = 'godam-snackbar';
			snackbar.className = 'godam-snackbar';
			document.body.appendChild( snackbar );
		}

		const allowedTypes = [ 'success', 'error' ];
		const variant = allowedTypes.includes( type ) ? type : 'error';

		snackbar.textContent = message;
		snackbar.className = `godam-snackbar godam-snackbar-${ variant } show`;

		if ( this._snackbarTimeout ) {
			clearTimeout( this._snackbarTimeout );
			this._snackbarTimeout = null;
		}

		this._snackbarTimeout = setTimeout( () => {
			snackbar.classList.remove( 'show' );
			this._snackbarTimeout = null;
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
	 * @param {number}  aspectRatio    - The aspect ratio of the video (width/height).
	 *
	 * @return {HTMLElement} - The created upload tile element.
	 */
	createUploadTile( uploadDisabled, aspectRatio = 16 / 9 ) {
		const sanitizedIcon = DOMPurify.sanitize( addIcon );

		const li = document.createElement( 'li' );
		li.className = 'upload-thumbnail-tile';

		// Apply aspect ratio: height is fixed, calculate width
		const { width, height } = this.getThumbnailDimensions( aspectRatio );
		li.style.width = width + 'px';
		li.style.height = height + 'px';

		const button = document.createElement( 'button' );
		button.type = 'button';
		button.className = 'custom-thumbnail-media-upload';

		if ( uploadDisabled ) {
			button.setAttribute( 'aria-disabled', 'true' );
			button.style.opacity = '0.5';
			button.style.cursor = 'not-allowed';
			button.tabIndex = 0; // Make disabled button keyboard-focusable for tooltip
			button.setAttribute( 'data-tooltip', __( 'Only 3 custom thumbnails allowed', 'godam' ) );
			button.setAttribute( 'aria-label', __( 'Only 3 custom thumbnails allowed', 'godam' ) );
		} else {
			button.setAttribute( 'data-tooltip', __( 'Upload Custom Thumbnail', 'godam' ) );
			button.setAttribute( 'aria-label', __( 'Upload Custom Thumbnail', 'godam' ) );
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
	 * @param {number} aspectRatio   - The aspect ratio of the video (width/height).
	 *
	 * @return {HTMLElement} - The created custom thumbnail tile element.
	 */
	createCustomThumbnailTile( thumbnailURL, selectedURL, trashIconHTML, aspectRatio = 16 / 9 ) {
		const li = document.createElement( 'li' );
		li.className = 'custom-thumbnail-container';
		if ( thumbnailURL === selectedURL ) {
			li.classList.add( 'selected' );
		}

		// Apply aspect ratio: height is fixed, calculate width
		const { width, height } = this.getThumbnailDimensions( aspectRatio );
		li.style.width = width + 'px';
		li.style.height = height + 'px';

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
	 * @param {number} aspectRatio  - The aspect ratio of the video (width/height).
	 *
	 * @return {HTMLElement} - The created default thumbnail tile element.
	 */
	createDefaultThumbnailTile( thumbnailURL, selectedURL, aspectRatio = 16 / 9 ) {
		const li = document.createElement( 'li' );
		if ( thumbnailURL === selectedURL ) {
			li.classList.add( 'selected' );
		}

		// Apply aspect ratio: height is fixed, calculate width
		const { width, height } = this.getThumbnailDimensions( aspectRatio );
		li.style.width = width + 'px';
		li.style.height = height + 'px';

		const img = document.createElement( 'img' );
		img.src = DOMPurify.sanitize( thumbnailURL );
		img.alt = __( 'Video Thumbnail', 'godam' );
		li.appendChild( img );
		return li;
	},

	/**
	 * Returns the pixel dimensions for a thumbnail tile based on aspect ratio.
	 *
	 * @param {number} aspectRatio - Width divided by height for the video.
	 * @return {{width: number, height: number}} - The calculated width and height for the thumbnail tile.
	 */
	getThumbnailDimensions( aspectRatio = 16 / 9 ) {
		const baseHeight = 72;
		let height = baseHeight;
		if ( aspectRatio < 1 ) {
			const portraitHeight = Math.floor( baseHeight / aspectRatio );
			height = Math.min( 140, Math.max( baseHeight, portraitHeight ) );
		}
		const width = Math.max( Math.floor( height * aspectRatio ), 48 );
		return { width, height };
	},

	/**
	 * Sets up custom tooltips for elements with data-tooltip attribute.
	 */
	setupCustomTooltips() {
		// Clean up any existing tooltips to prevent memory leaks
		document.querySelectorAll( '.godam-custom-tooltip' ).forEach( ( el ) => el.remove() );

		const elementsWithTooltip = this.$el.find( '[data-tooltip]' );

		elementsWithTooltip.each( ( index, element ) => {
			const $element = this.$( element );
			const tooltipText = $element.attr( 'data-tooltip' );

			if ( ! tooltipText ) {
				return;
			}

			// Create tooltip element
			const tooltip = document.createElement( 'div' );
			tooltip.className = 'godam-custom-tooltip';
			tooltip.textContent = tooltipText;

			// Append tooltip to body
			document.body.appendChild( tooltip );

			// Show handler (for both mouse and keyboard)
			const handleShow = () => {
				const rect = element.getBoundingClientRect();

				// Make tooltip visible but transparent to measure dimensions
				tooltip.style.visibility = 'visible';
				const tooltipRect = tooltip.getBoundingClientRect();

				// Calculate centered position below the element
				let left = rect.left + ( rect.width / 2 ) - ( tooltipRect.width / 2 ) + 32;
				const top = rect.bottom + 26;

				// Ensure tooltip stays within viewport horizontally
				const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
				const padding = 10; // Minimum padding from viewport edges

				if ( left < padding ) {
					left = padding; // Too far left, align to left edge with padding
				} else if ( left + tooltipRect.width > viewportWidth - padding ) {
					left = viewportWidth - tooltipRect.width - padding; // Too far right, align to right edge with padding
				}

				// Position tooltip
				tooltip.style.left = `${ left }px`;
				tooltip.style.top = `${ top }px`;

				// Show tooltip with transition
				tooltip.classList.add( 'show' );
			};

			// Hide handler
			const handleHide = () => {
				tooltip.classList.remove( 'show' );
			};

			// Add event listeners for both mouse and keyboard
			$element.on( 'mouseenter focus', handleShow );
			$element.on( 'mouseleave blur', handleHide );

			// Store cleanup function on the element
			$element.data( 'tooltip-cleanup', () => {
				tooltip.remove();
				$element.off( 'mouseenter focus', handleShow );
				$element.off( 'mouseleave blur', handleHide );
			} );
		} );
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

		// Calculate aspect ratio from video dimensions
		const meta = this.model.get( 'media_details' );
		const videoWidth = this.model.get( 'width' ) || meta?.width;
		const videoHeight = this.model.get( 'height' ) || meta?.height;
		const aspectRatio = ( videoWidth && videoHeight ) ? videoWidth / videoHeight : 16 / 9;

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
		ul.appendChild( this.createUploadTile( uploadDisabled, aspectRatio ) );

		customThumbnailsArray.forEach( ( thumbnail ) =>
			ul.appendChild(
				this.createCustomThumbnailTile( thumbnail, selected, trashIcon, aspectRatio ),
			),
		);

		const thumbnailArray = Array.isArray( thumbnails ) ? thumbnails : Object.values( thumbnails || {} );
		thumbnailArray.forEach( ( thumbnail ) =>
			ul.appendChild( this.createDefaultThumbnailTile( thumbnail, selected, aspectRatio ) ),
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

		// Clean up existing tooltips before re-rendering
		const existingTooltips = this.$el.find( '[data-tooltip]' );
		existingTooltips.each( ( index, element ) => {
			const cleanup = this.$( element ).data( 'tooltip-cleanup' );
			if ( cleanup ) {
				cleanup();
			}
		} );

		this.setupCustomTooltips();

		// Set upload click after DOM added
		setTimeout( () => {
			const $btn = this.$el.find( '.custom-thumbnail-media-upload' );
			if ( $btn.length ) {
				$btn.off( 'click' ).on( 'click', ( e ) => {
					// Prevent action if button is disabled
					if ( $btn.attr( 'aria-disabled' ) === 'true' ) {
						e.preventDefault();
						e.stopPropagation();
						return;
					}

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
	 * Renders Manage Versions action for all media types.
	 *
	 * If .attachment-video-actions exists, append Manage Versions there.
	 * Otherwise, append it inside a dedicated .manage-versions-container.
	 */
	renderManageVersionsAction() {
		const actionsEl = this.$el.find( '.attachment-actions' );

		if ( ! actionsEl.length ) {
			return;
		}

		const manageVersions = `<a href="#" class="button button-secondary manage-versions-button" id="rtgodam-manage-versions">${ __( 'Manage Versions', 'godam' ) }</a>`;
		const videoActionsEl = actionsEl.find( '.attachment-video-actions' ).first();

		if ( videoActionsEl.length ) {
			videoActionsEl.append( DOMPurify.sanitize( manageVersions ) );
			this.setupManageVersionsAction();
			return;
		}

		actionsEl.append( DOMPurify.sanitize( `<div class="manage-versions-container">${ manageVersions }</div>` ) );
		this.setupManageVersionsAction();
	},

	/**
	 * Sets up Manage Versions button interaction.
	 */
	setupManageVersionsAction() {
		const $button = this.$el.find( '#rtgodam-manage-versions' );

		$button.off( 'click' ).on( 'click', async ( event ) => {
			event.preventDefault();
			event.stopPropagation();
			this.openManageVersionsModal( { isLoading: true } );

			try {
				this.mediaVersions = await this.fetchVersionsData();
				this.openManageVersionsModal();
			} catch {
				this.closeManageVersionsModal();
				this.showGodamSnackbar( __( 'Unable to fetch media versions.', 'godam' ) );
			}
		} );
	},

	/**
	 * Fetches media versions data via ajax.
	 *
	 * @return {Promise<Object>} Manage versions API response.
	 */
	async fetchVersionsData() {
		const attachmentId = this.model.get( 'id' );

		if ( ! attachmentId ) {
			throw new Error( 'Missing attachment id' );
		}

		const nonce = window?.easydamMediaLibrary?.nonce || '';

		return new Promise( ( resolve, reject ) => {
			window.wp.ajax.post( 'godam_get_media_versions', {
				nonce,
				attachment_id: String( attachmentId ),
			} )
				.done( ( data ) => resolve( data ) )
				.fail( ( error ) => reject( new Error( error?.message || __( 'Failed to fetch versions.', 'godam' ) ) ) );
		} );
	},

	/**
	 * Switches active version for current media item.
	 *
	 * @param {number} versionNumber Version number to mark active.
	 * @param {number} maxVersions   Maximum versions available.
	 * @return {Promise<Object>} API response.
	 */
	async switchActiveVersion( versionNumber, maxVersions = 25 ) {
		const attachmentId = this.model.get( 'id' );
		const nonce = window?.easydamMediaLibrary?.nonce || '';

		return new Promise( ( resolve, reject ) => {
			window.wp.ajax.post( 'godam_switch_active_version', {
				nonce,
				attachment_id: String( attachmentId ),
				version_number: String( versionNumber ),
				max_versions: String( maxVersions ),
			} )
				.done( ( data ) => resolve( data ) )
				.fail( ( error ) => reject( new Error( error?.message || __( 'Failed to switch active version.', 'godam' ) ) ) );
		} );
	},

	/**
	 * Deletes a media version.
	 *
	 * @param {number} versionNumber Version number to delete.
	 * @return {Promise<Object>} API response.
	 */
	async deleteVersion( versionNumber ) {
		const attachmentId = this.model.get( 'id' );
		const nonce = window?.easydamMediaLibrary?.nonce || '';

		return new Promise( ( resolve, reject ) => {
			window.wp.ajax.post( 'godam_delete_version', {
				nonce,
				attachment_id: String( attachmentId ),
				version_number: String( versionNumber ),
			} )
				.done( ( data ) => resolve( data ) )
				.fail( ( error ) => reject( new Error( error?.message || __( 'Failed to delete version.', 'godam' ) ) ) );
		} );
	},

	/**
	 * Replaces media source and starts creation of a new version.
	 *
	 * @param {Object} selectedMedia Selected media object.
	 * @return {Promise<Object>} API response.
	 */
	async replaceMediaVersion( selectedMedia ) {
		const attachmentId = this.model.get( 'id' );
		const nonce = window?.easydamMediaLibrary?.nonce || '';
		const ajaxUrl =
			window?.ajaxurl ||
			window?.easydamMediaLibrary?.ajaxurl ||
			`${ window.location.origin }/wp-admin/admin-ajax.php`;

		const formData = new FormData();
		formData.append( 'action', 'godam_replace_media_version' );
		formData.append( 'nonce', nonce );
		formData.append( 'attachment_id', String( attachmentId ) );
		formData.append( 'version_attachment_id', String( selectedMedia?.id ) );
		formData.append( 'version_attachment_url', selectedMedia?.url );

		const response = await fetch( ajaxUrl, {
			method: 'POST',
			body: formData,
			credentials: 'same-origin',
			headers: {
				'X-Requested-With': 'XMLHttpRequest',
			},
		} );

		let payload = null;
		try {
			payload = await response.json();
		} catch {
			throw new Error( __( 'Failed to upload a new version.', 'godam' ) );
		}

		return payload.data;
	},

	/**
	 * Finalizes a pending media URL replacement after a new version appears.
	 *
	 * @return {Promise<Object>} API response.
	 */
	async finalizePendingVersionReplace() {
		const attachmentId = this.model.get( 'id' );
		const nonce = window?.easydamMediaLibrary?.nonce || '';

		return new Promise( ( resolve, reject ) => {
			window.wp.ajax.post( 'godam_finalize_media_version_replace', {
				nonce,
				attachment_id: String( attachmentId ),
			} )
				.done( ( data ) => resolve( data ) )
				.fail( ( error ) => reject( new Error( error?.message || __( 'Failed to finalize media version update.', 'godam' ) ) ) );
		} );
	},

	/**
	 * Refreshes current attachment model and library item from WP media API.
	 *
	 * @return {Promise<void>}
	 */
	async refreshCurrentAttachmentInFrame() {
		const attachmentId = Number( this.model?.get( 'id' ) || 0 );

		if ( attachmentId < 1 || ! window?.wp?.media?.attachment ) {
			return;
		}

		try {
			const attachment = wp.media.attachment( attachmentId );
			await attachment.fetch();

			const selectedAttachmentElement = document.querySelector( `[data-id="${ attachmentId }"]` );

			const newUrl = attachment.get( 'url' );

			// Update File URL input field manually.
			const urlInput = document.querySelector(
				'#attachment-details-two-column-copy-link' );

			// Also update the download link manually in case the URL has changed, to ensure users can still download the correct file.
			const downloadUrlLink = document.querySelector( '.attachment-info .actions a[download]' );

			if ( urlInput ) {
				urlInput.value = newUrl;
			}

			if ( downloadUrlLink ) {
				downloadUrlLink.href = newUrl;
			}

			if ( selectedAttachmentElement ) {
				// To trigger media refresh in attachment details view
				selectedAttachmentElement.click();
			}
		} catch {
			// Keep UX non-blocking; modal refresh already handles fallback UI updates.
		}
	},

	/**
	 * Returns whether more versions can be added from versions API response.
	 *
	 * @param {Object} mediaVersionsResponse API response from admin-ajax.
	 * @return {boolean} True when new versions can be added.
	 */
	isAddVersionAllowed( mediaVersionsResponse ) {
		return !! mediaVersionsResponse?.response?.message?.can_add_more;
	},

	/**
	 * Opens WordPress media uploader and resolves selected media for add-version action.
	 *
	 * @return {Promise<Object|null>} Selected media object or null.
	 */
	openAddVersionUploader() {
		if ( ! window?.wp?.media ) {
			return Promise.resolve( null );
		}

		const attachmentType = String( this.model.get( 'type' ) || '' ).toLowerCase();

		return new Promise( ( resolve ) => {
			const mediaFrame = wp.media( {
				title: __( 'Select or Upload Media Version', 'godam' ),
				button: { text: __( 'Use this media', 'godam' ) },
				multiple: false,
				library: attachmentType ? { type: [ attachmentType ] } : {},
			} );

			mediaFrame.on( 'select', () => {
				const selection = mediaFrame.state().get( 'selection' ).first();
				resolve( selection ? selection.toJSON() : null );
			} );

			mediaFrame.on( 'close', () => {
				const hasSelection = mediaFrame.state().get( 'selection' )?.length;
				if ( ! hasSelection ) {
					resolve( null );
				}
			} );

			mediaFrame.open();
		} );
	},

	/**
	 * Polls versions using setTimeout until a newly added version appears.
	 *
	 * @param {Object}      options                 Poll options.
	 * @param {number}      options.baseCount       Existing version count before replace.
	 * @param {number}      options.attempt         Current polling attempt.
	 * @param {number|null} options.expectedVersion Expected version number from replace API.
	 */
	pollForNewVersion( { baseCount = 0, attempt = 1, expectedVersion = null } = {} ) {
		const maxAttempts = 24;
		const pollDelay = 5000;

		setTimeout( async () => {
			try {
				const versionsData = await this.fetchVersionsData();
				const versions = Array.isArray( versionsData?.response?.message?.versions )
					? versionsData.response.message.versions
					: [];

				const matchedExpected = Number.isInteger( expectedVersion ) && expectedVersion > 0
					? versions.some( ( version ) => Number( version?.version ) === expectedVersion )
					: false;
				const detectedByCount = versions.length > baseCount;

				this.mediaVersions = versionsData;

				if ( matchedExpected || detectedByCount ) {
					const replaceResult = await this.finalizePendingVersionReplace();

					// Treat as completed if finalized, or if source URL was already cleaned up
					// by the GoDAM callback before this poll had a chance to finalize.
					if ( replaceResult?.completed || replaceResult?.reason === 'missing_source_url' ) {
						this.mediaVersions = await this.fetchVersionsData();
						await this.refreshCurrentAttachmentInFrame();
						this.openManageVersionsModal();
						this.showGodamSnackbar( __( 'New version added successfully.', 'godam' ), 'success' );
						return;
					}
				}
			} catch {
				// Keep polling until max attempts are reached.
			}

			if ( attempt >= maxAttempts ) {
				this.openManageVersionsModal();
				this.showGodamSnackbar( __( 'New version is still processing. Please check again in a few moments.', 'godam' ) );
				return;
			}

			this.pollForNewVersion( {
				baseCount,
				attempt: attempt + 1,
				expectedVersion,
			} );
		}, pollDelay );
	},

	/**
	 * Shows a confirmation dialog for deleting a version.
	 *
	 * @param {number} versionNumber Version number to confirm deletion for.
	 * @return {boolean} Whether user confirmed the deletion.
	 */
	showDeleteConfirmation( versionNumber ) {
		// eslint-disable-next-line no-alert
		const message = sprintf(
			// translators: %d is the version number being deleted.
			__( 'Are you sure you want to permanently delete Version %d?', 'godam' ),
			versionNumber,
		);
		// eslint-disable-next-line no-alert
		return confirm( message );
	},

	/**
	 * Disables or enables all Set Active buttons and delete buttons in the modal.
	 *
	 * @param {HTMLElement} modal    Manage versions modal element.
	 * @param {boolean}     disabled Whether buttons should be disabled.
	 */
	setManageVersionButtonsDisabled( modal, disabled ) {
		const buttons = modal.querySelectorAll( '.rtgodam-version-action, .rtgodam-version-delete' );
		buttons.forEach( ( actionButton ) => {
			actionButton.disabled = disabled;
		} );
	},

	/**
	 * Sets up actions inside Manage Versions modal.
	 */
	setupManageVersionActions() {
		const modal = document.getElementById( 'rtgodam-manage-versions-modal' );
		if ( ! modal ) {
			return;
		}

		// Check if modal is in loading state and disable action buttons accordingly
		const isLoading = modal.getAttribute( 'data-is-loading' ) === 'true';
		if ( isLoading ) {
			this.setManageVersionButtonsDisabled( modal, true );
		}

		const addVersionButton = modal.querySelector( '.rtgodam-add-version' );
		if ( addVersionButton ) {
			addVersionButton.addEventListener( 'click', async ( event ) => {
				event.preventDefault();
				event.stopPropagation();

				addVersionButton.disabled = true;

				try {
					const latestVersions = await this.fetchVersionsData();
					this.mediaVersions = latestVersions;
					const baseVersionsCount = Array.isArray( latestVersions?.response?.message?.versions )
						? latestVersions.response.message.versions.length
						: 0;

					if ( ! this.isAddVersionAllowed( latestVersions ) ) {
						this.showGodamSnackbar( __( 'Maximum version limit reached. Please delete an old version first.', 'godam' ) );
						this.openManageVersionsModal();
						return;
					}

					this.closeManageVersionsModal();
					const selectedMedia = await this.openAddVersionUploader();
					if ( ! selectedMedia ) {
						this.openManageVersionsModal();
						return;
					}

					if ( ! selectedMedia?.id ) {
						this.showGodamSnackbar( __( 'Please select a valid media file from the Media Library.', 'godam' ) );
						this.openManageVersionsModal();
						return;
					}

					const replaceResponse = await this.replaceMediaVersion( selectedMedia );
					const expectedVersion = Number(
						replaceResponse?.response?.new_version ??
						replaceResponse?.message?.new_version ??
						replaceResponse?.new_version,
					);
					const versionStartMessage = __( 'New version upload started. It will be updated in a few moments …', 'godam' );
					this.openManageVersionsModal( {
						isLoading: true,
						loadingMessage: versionStartMessage,
					} );
					this.showGodamSnackbar( versionStartMessage, 'success' );
					this.pollForNewVersion( {
						baseCount: baseVersionsCount,
						expectedVersion: Number.isInteger( expectedVersion ) && expectedVersion > 0 ? expectedVersion : null,
					} );
				} catch ( error ) {
					this.showGodamSnackbar( error?.message || __( 'Unable to add a new version.', 'godam' ) );
					try {
						this.mediaVersions = await this.fetchVersionsData();
						this.openManageVersionsModal();
					} catch {
						this.closeManageVersionsModal();
					}
				}
			} );
		}

		// Setup Set Active buttons
		const buttons = modal.querySelectorAll( '.rtgodam-version-action' );
		buttons.forEach( ( button ) => {
			button.addEventListener( 'click', async ( event ) => {
				event.preventDefault();
				event.stopPropagation();

				// Get version number from button's data attribute and validate it.
				const versionNumber = Number( button.getAttribute( 'data-version-number' ) );
				const maxVersions = this.getMaxVersions( this.mediaVersions );
				if ( ! Number.isInteger( versionNumber ) || versionNumber < 1 || versionNumber > maxVersions ) {
					this.showGodamSnackbar( __( 'Invalid version number.', 'godam' ) );
					return;
				}

				const switchingMessage = __( 'Switching active version …', 'godam' );
				this.openManageVersionsModal( {
					isLoading: true,
					loadingMessage: switchingMessage,
				} );

				try {
					await this.switchActiveVersion( versionNumber, maxVersions );
					this.mediaVersions = await this.fetchVersionsData();
					await this.refreshCurrentAttachmentInFrame();
					this.openManageVersionsModal();
					this.showGodamSnackbar( __( 'Active version updated successfully.', 'godam' ), 'success' );
				} catch {
					try {
						this.mediaVersions = await this.fetchVersionsData();
						this.openManageVersionsModal();
					} catch {
						this.closeManageVersionsModal();
					}

					this.showGodamSnackbar( __( 'Unable to set active version.', 'godam' ) );
				}
			} );
		} );

		// Setup Delete buttons
		const deleteButtons = modal.querySelectorAll( '.rtgodam-version-delete' );
		deleteButtons.forEach( ( deleteButton ) => {
			deleteButton.addEventListener( 'click', async ( event ) => {
				event.preventDefault();
				event.stopPropagation();

				const setActiveButton = deleteButton.previousElementSibling;
				const versionNumber = Number( setActiveButton?.getAttribute( 'data-version-number' ) );

				// Version 1 is the original file and cannot be deleted
				// so we check for version number to be at least 2.
				if ( ! Number.isInteger( versionNumber ) || versionNumber < 2 ) {
					this.showGodamSnackbar( __( 'Invalid version number.', 'godam' ) );
					return;
				}

				if ( ! this.showDeleteConfirmation( versionNumber ) ) {
					return;
				}

				this.setManageVersionButtonsDisabled( modal, true );

				try {
					await this.deleteVersion( versionNumber );
					this.mediaVersions = await this.fetchVersionsData();
					this.openManageVersionsModal();
					this.showGodamSnackbar( __( 'Version deleted successfully.', 'godam' ), 'success' );
				} catch ( error ) {
					try {
						this.mediaVersions = await this.fetchVersionsData();
						this.openManageVersionsModal();
					} catch {
						this.closeManageVersionsModal();
					}

					this.showGodamSnackbar( error?.message || __( 'Unable to delete version.', 'godam' ) );
				}
			} );
		} );
	},

	/**
	 * Extracts max versions count from list-all-versions response.
	 *
	 * @param {Object} mediaVersionsResponse API response from admin-ajax.
	 * @return {number} Maximum allowed versions.
	 */
	getMaxVersions( mediaVersionsResponse ) {
		const maxVersions = Number( mediaVersionsResponse?.response?.message?.max_versions );

		if ( Number.isInteger( maxVersions ) && maxVersions > 0 ) {
			return maxVersions;
		}

		return 25;
	},

	/**
	 * Formats bytes as a human-readable file size.
	 *
	 * @param {number|string} bytes File size in bytes.
	 * @return {string} Human-readable file size.
	 */
	formatVersionSize( bytes ) {
		const numericBytes = Number( bytes );
		if ( ! Number.isFinite( numericBytes ) || numericBytes <= 0 ) {
			return '--';
		}

		const units = [ 'B', 'KB', 'MB', 'GB', 'TB' ];
		const exponent = Math.min( Math.floor( Math.log( numericBytes ) / Math.log( 1024 ) ), units.length - 1 );
		const value = numericBytes / ( 1024 ** exponent );

		return `${ value.toFixed( exponent === 0 ? 0 : 2 ) } ${ units[ exponent ] }`;
	},

	/**
	 * Formats duration seconds as HH:MM:SS or MM:SS.
	 *
	 * @param {number|string} duration Duration in seconds.
	 * @return {string} Formatted duration.
	 */
	formatVersionDuration( duration ) {
		const seconds = Number( duration );
		if ( seconds <= 0 || ! Number.isFinite( seconds ) ) {
			return '--';
		}

		const totalSeconds = Math.round( seconds );
		const hrs = Math.floor( totalSeconds / 3600 );
		const mins = Math.floor( ( totalSeconds % 3600 ) / 60 );
		const secs = totalSeconds % 60;

		if ( hrs > 0 ) {
			return `${ String( hrs ).padStart( 2, '0' ) }:${ String( mins ).padStart( 2, '0' ) }:${ String( secs ).padStart( 2, '0' ) }`;
		}

		return `${ String( mins ).padStart( 2, '0' ) }:${ String( secs ).padStart( 2, '0' ) }`;
	},

	/**
	 * Formats ISO date/time into the local date string.
	 *
	 * @param {string} value Date value.
	 * @return {string} Formatted date.
	 */
	formatVersionDate( value ) {
		if ( ! value ) {
			return '--';
		}

		const parsed = new Date( value );
		return Number.isNaN( parsed.getTime() ) ? '--' : parsed.toLocaleDateString();
	},

	/**
	 * Normalizes API response into modal version rows.
	 *
	 * @param {Object} mediaVersionsResponse API response from admin-ajax.
	 * @param {string} fallbackTitle         Fallback title for version names.
	 * @return {Array<Object>} Normalized versions.
	 */
	normalizeMediaVersions( mediaVersionsResponse, fallbackTitle ) {
		const response = mediaVersionsResponse?.response ?? mediaVersionsResponse ?? {};
		const versions = response?.message?.versions;

		// Return empty array if versions data is not available
		if ( ! Array.isArray( versions ) ) {
			return [];
		}

		const mappedVersions = versions.map( ( version, index ) => {
			const versionNumber = version?.version ?? index + 1;
			const title = version?.orignal_file_name || `${ fallbackTitle } ${ index + 1 }`;
			const isActive = Boolean( version?.is_active );
			const isDefault = versionNumber === 1;
			const idUpper = Number.isFinite( Number( versionNumber ) ) ? `V${ versionNumber }` : versionNumber.toUpperCase();

			return {
				id: versionNumber,
				idUpper,
				versionNumber: Number( versionNumber ),
				name: title,
				size: this.formatVersionSize( version?.file_size ),
				duration: this.formatVersionDuration( version?.playtime ),
				date: this.formatVersionDate( version?.created_at ),
				isDefault,
				isActive,
			};
		} );

		if ( ! mappedVersions.length ) {
			return [];
		}

		return mappedVersions;
	},

	/**
	 * Opens the Manage Versions modal.
	 *
	 * @param {Object} options Modal options.
	 */
	openManageVersionsModal( options = {} ) {
		this.closeManageVersionsModal();

		if ( ! wp?.template ) {
			return;
		}

		const { isLoading = false, loadingMessage = '' } = options;
		const attachmentId = this.model.get( 'id' );
		const attachmentTitle = this.model.get( 'title' ) || this.model.get( 'filename' ) || __( 'Media File', 'godam' );
		const versions = this.normalizeMediaVersions( this.mediaVersions, attachmentTitle );

		const renderModalTemplate = wp.template( 'rtgodam-manage-versions-modal' );
		const modalHtml = renderModalTemplate( {
			attachmentId,
			versions,
			isLoading,
			loadingMessage,
			totalVersions: versions.length,
			maxVersions: this.getMaxVersions( this.mediaVersions ),
			trashIcon: DOMPurify.sanitize( trashIcon ),
		} );

		document.body.insertAdjacentHTML( 'beforeend', DOMPurify.sanitize( modalHtml ) );

		this._onManageVersionsKeydown = ( event ) => {
			if ( event.key === 'Escape' ) {
				this.closeManageVersionsModal();
			}
		};

		document.addEventListener( 'keydown', this._onManageVersionsKeydown );

		const modal = document.getElementById( 'rtgodam-manage-versions-modal' );
		if ( isLoading ) {
			modal?.setAttribute( 'data-is-loading', 'true' );
		}
		modal?.querySelector( '.rtgodam-manage-versions-close' )?.addEventListener( 'click', () => this.closeManageVersionsModal() );
		modal?.querySelector( '.rtgodam-manage-versions-overlay' )?.addEventListener( 'click', () => this.closeManageVersionsModal() );
		this.setupManageVersionActions();
	},

	/**
	 * Closes the Manage Versions modal.
	 */
	closeManageVersionsModal() {
		const modal = document.getElementById( 'rtgodam-manage-versions-modal' );
		if ( modal ) {
			modal.remove();
		}

		if ( this._onManageVersionsKeydown ) {
			document.removeEventListener( 'keydown', this._onManageVersionsKeydown );
			this._onManageVersionsKeydown = null;
		}
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
			<a href="${ editVideoURL }" class="button button-primary" target="_blank">${ editIcon } ${ __( 'Edit Video', 'godam' ) }</a>
			<div class="paid-feature" title="This feature is only available for paid users.">
				<a href="${ analyticsURL }" class="button button-secondary" target="_blank">${ barChartIcon } ${ __( 'Analytics', 'godam' ) }</a>
				<span>$</span>
			</div>
			`;
		}

		const editVideoButtonHTML = `<a href="${ editVideoURL }" class="button button-primary" target="_blank">${ editIcon } ${ __( 'Edit Video', 'godam' ) }</a>`;
		const analyticsButtonHTML = `<a href="${ analyticsURL }" class="button button-secondary" target="_blank">${ barChartIcon } ${ __( 'Analytics', 'godam' ) }</a>`;

		const buttons = [];

		// If the user can manage the attachment, show the Edit Video button, else show only Analytics.
		if ( canManageAttachment( this.model.get( 'author' ) ) ) {
			buttons.push( editVideoButtonHTML );
		}

		buttons.push( analyticsButtonHTML );

		return buttons.join( '' );
	},

	/**
	 * Calculates the optimal dimensions for the video player.
	 *
	 * @param {number} videoWidth  - The original width of the video.
	 * @param {number} videoHeight - The original height of the video.
	 * @return {Object}            - The calculated width and height.
	 */
	calculatePlayerDimensions( videoWidth, videoHeight ) {
		// Validate input dimensions
		if ( ! videoWidth || ! videoHeight || videoWidth <= 0 || videoHeight <= 0 ) {
			// Return null to signal dimensions are not available yet
			return null;
		}

		// Detect available space in the attachment detail view
		const viewContainer = this.$el.closest( '.media-modal-content' ).find( '.attachment-media-view' );
		const availableWidth = viewContainer.length ? viewContainer.width() : window.innerWidth * 0.65;
		const availableHeight = window.innerHeight * 0.55; // Reduced from 0.6 to prevent overflow

		// Determine the scale needed to fit both width and height constraints
		const scale = Math.min(
			availableWidth / videoWidth,
			availableHeight / videoHeight,
			1, // Never scale up
		);

		return {
			width: Math.floor( videoWidth * scale ),
			height: Math.floor( videoHeight * scale ),
		};
	},

	/**
	 * Applies dimensions to a VideoJS player.
	 *
	 * @param {string} videoId - The ID of the video element.
	 * @param {number} width   - The width to apply.
	 * @param {number} height  - The height to apply.
	 */
	applyVideoJSDimensions( videoId, width, height ) {
		const $vjsPlayer = this.$el.find( `#${ videoId }` );
		$vjsPlayer.css( {
			width: width + 'px',
			height: height + 'px',
		} );

		// Center the wrapper
		const $wrapper = this.$el.find( '.wp-video' );
		$wrapper.css( {
			display: 'flex',
			'justify-content': 'center',
			'align-items': 'center',
			width: '100%',
			height: height + 'px',
		} );
	},

	/**
	 * Resizes the native video player element to fit within specific dimensions while maintaining aspect ratio.
	 * This is particularly for vertical videos to prevent them from taking up too much vertical space.
	 *
	 * @return {boolean} - Returns true if resizing was successful or dimensions are not available, false if player container is not ready yet.
	 */
	resizeNativePlayer() {
		// Find the native player container (MediaElement.js)
		// We target both the container and the video shortcode shim if present
		const container = this.$el.find( '.mejs-container, .wp-video-shortcode' ).first();
		if ( ! container.length ) {
			return false; // Not ready yet
		}

		// Try to get dimensions from model or metadata
		const meta = this.model.get( 'media_details' );
		const width = this.model.get( 'width' ) || meta?.width;
		const height = this.model.get( 'height' ) || meta?.height;

		if ( ! width || ! height ) {
			return true; // Stop polling if no dimensions
		}

		const { width: targetWidth, height: targetHeight } = this.calculatePlayerDimensions( width, height );

		// Apply dimensions directly to container to enforce aspect ratio and remove pillarboxing/letterboxing
		container.css( {
			width: targetWidth + 'px',
			height: targetHeight + 'px',
		} );

		// Also ensure the parent wrapper centers it
		this.$el.find( '.wp-video' ).css( {
			display: 'flex',
			'justify-content': 'center',
			width: '100%',
		} );

		return true; // Successfully resized
	},

	/**
	 * Sets up a MutationObserver to watch for dimension changes and reapply our sizing.
	 * This ensures our dimensions persist even if WordPress/MediaElement.js tries to reset them.
	 */
	setupNativePlayerObserver() {
		const container = this.$el.find( '.mejs-container, .wp-video-shortcode' ).first();
		if ( ! container.length ) {
			return;
		}

		// Get the target dimensions once
		const meta = this.model.get( 'media_details' );
		const width = this.model.get( 'width' ) || meta?.width;
		const height = this.model.get( 'height' ) || meta?.height;

		if ( ! width || ! height ) {
			return;
		}

		const { width: targetWidth, height: targetHeight } = this.calculatePlayerDimensions( width, height );

		// Create a MutationObserver to watch for style changes
		const observer = new MutationObserver( ( mutations ) => {
			for ( const mutation of mutations ) {
				if ( mutation.type === 'attributes' && mutation.attributeName === 'style' ) {
					const currentWidth = container.width();
					const currentHeight = container.height();

					// Check if dimensions have been changed away from our target
					if ( Math.abs( currentWidth - targetWidth ) > 2 || Math.abs( currentHeight - targetHeight ) > 2 ) {
						// Reapply our dimensions
						container.css( {
							width: targetWidth + 'px',
							height: targetHeight + 'px',
						} );
					}
				}
			}
		} );

		// Start observing the container for attribute changes
		observer.observe( container[ 0 ], {
			attributes: true,
			attributeFilter: [ 'style' ],
		} );

		// Store observer reference for cleanup
		this._nativePlayerObserver = observer;

		// Stop observing after 15 seconds (by then MediaElement.js should be done)
		this._nativeObserverTimeout = setTimeout( () => {
			if ( this._nativePlayerObserver ) {
				this._nativePlayerObserver.disconnect();
				this._nativePlayerObserver = null;
			}
			this._nativeObserverTimeout = null;
		}, 15000 );
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
			this.$el.find( '.attachment-video-actions, .attachment-video-thumbnails' ).remove();
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
						// Calculate initial dimensions using 16:9 aspect ratio as default
						const viewContainer = this.$el.closest( '.media-modal-content' ).find( '.attachment-media-view' );
						const availableWidth = viewContainer.length ? viewContainer.width() : window.innerWidth * 0.65;
						const availableHeight = window.innerHeight * 0.55;

						// Assume 16:9 aspect ratio for initial loading state
						const defaultAspectRatio = 16 / 9;
						const initialScale = Math.min(
							availableWidth / ( availableHeight * defaultAspectRatio ),
							1,
						);
						const initialWidth = Math.floor( availableHeight * defaultAspectRatio * initialScale );
						const initialHeight = Math.floor( availableHeight * initialScale );

						const playerOptions = {
							poster: this.model.get( 'image' )?.src || '',
							fluid: false, // Disable fluid to enforce exact dimensions
							width: initialWidth,
							height: initialHeight,
							controlBar: {
								volumePanel: true,
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
						};

						// Initialize the player with minimal controls.
						const player = videojs( videoElement, playerOptions );

						// Store player reference for cleanup
						this._virtualPlayer = player;
						this._virtualVideoId = videoId;

						// Apply initial dimensions immediately to show loading spinner properly
						player.ready( () => {
							this.applyVideoJSDimensions( videoId, initialWidth, initialHeight );
						} );

						// Apply dimensions after video metadata loads
						const applyDimensions = () => {
							// Get actual video dimensions from the loaded video element
							const videoWidth = videoElement.videoWidth;
							const videoHeight = videoElement.videoHeight;

							const dimensions = this.calculatePlayerDimensions( videoWidth, videoHeight );
							if ( dimensions ) {
								this.applyVideoJSDimensions( videoId, dimensions.width, dimensions.height );
							}
						};

						// Listen for metadata load event
						player.on( 'loadedmetadata', applyDimensions );

						// Also listen for window resize to recalculate dimensions
						const handleResize = () => {
							if ( videoElement.videoWidth && videoElement.videoHeight ) {
								const dimensions = this.calculatePlayerDimensions( videoElement.videoWidth, videoElement.videoHeight );
								if ( dimensions ) {
									this.applyVideoJSDimensions( videoId, dimensions.width, dimensions.height );
								}
							}
						};
						this._virtualResizeHandler = handleResize;
						window.addEventListener( 'resize', handleResize );

						// If metadata is already loaded (cached), apply immediately
						if ( videoElement.videoWidth && videoElement.videoHeight ) {
							applyDimensions();
						}
					}
				}, 100 ); // Slight delay to ensure DOM update.
			} else {
				// Handle Native Player sizing with early resize and persistent observer
				// Try to resize as soon as possible
				let attempts = 0;
				const maxAttempts = 10; // Try for 1 second
				this._nativeResizePollInterval = setInterval( () => {
					attempts++;
					const done = this.resizeNativePlayer();
					if ( done || attempts >= maxAttempts ) {
						clearInterval( this._nativeResizePollInterval );
						this._nativeResizePollInterval = null;
						// Once initial resize is done, set up observer to keep it persistent
						if ( done ) {
							this.setupNativePlayerObserver();
						}
					}
				}, 100 );
			}

			this.renderVideoActions();
			const attachmentId = this.model.get( 'id' );

			this.showLoading();

			this.fetchAndRender(
				this.getVideoThumbnails( attachmentId ),
				this.renderThumbnail,
				'thumbnails',
			);
			this.fetchAndRender(
				this.getExifDetails( attachmentId ),
				this.renderExifDetails,
				'exif',
			);
		}

		this.renderManageVersionsAction();

		if ( this.model.get( 'type' ) === 'application' && this.model.get( 'subtype' ) === 'pdf' ) {
			const imagePreview = this.model.get( 'image' );

			if ( imagePreview && imagePreview.src ) {
				// Find the thumbnail container and replace it with the full image preview
				const $thumbnail = this.$el.find( '.thumbnail' );

				if ( $thumbnail.length ) {
					$thumbnail.empty().append( `
						<img
							class="details-image"
							src="${ DOMPurify.sanitize( imagePreview.src ) }"
							alt="PDF Preview"
						/>
					` );
				}
			}
		}

		// Return this view.
		return this;
	},

	showLoading() {
		const actionsEl = this.$el.find( '.attachment-actions' );

		if ( actionsEl.find( '.attachment-video-thumbnails' ).length > 0 ) {
			return; // Stop loading if thumbnails are already present.
		}

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
