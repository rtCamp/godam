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

const AttachmentDetailsTwoColumn = wp?.media?.view?.Attachment?.Details?.TwoColumn;

const restURL = window.godamRestRoute.url || '';

export default AttachmentDetailsTwoColumn?.extend( {

	/**
	 * Initializes the AttachmentDetailsTwoColumn.
	 */
	initialize() {
		this.abTestingEnabled = '0';
		this.abTestDuration = '60';
		this.abTestingSelection = [];
		AttachmentDetailsTwoColumn.prototype.initialize.apply( this, arguments );
		this.initializeValues().then( () => {
			this.render();
		} );
	},

	async initializeValues() {
		const settings = await this.getABTestingSettings( this.model.get( 'id' ) );

		this.abTestingEnabled = settings?.data?.ab_testing_enabled === '1' ? '1' : '0';
		this.abTestDuration = settings?.data?.ab_testing_duration; // default to 60 days
		this.abTestingSelection = settings?.data?.ab_testing_thumbnails || [];
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
		if ( data ) {
			renderMethod.call( this, data.data );
		}
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
				onSelect( attachment ); // Use callback for custom behavior
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

		const abTestingFeatureDiv = document.createElement( 'div' );
		abTestingFeatureDiv.className = 'ab-testing-feature';

		// Create the button
		const abTestingButton = document.createElement( 'button' );
		abTestingButton.type = 'button';
		abTestingButton.className = 'ab-test-action';

		abTestingButton.textContent = this.abTestingSelection.includes( thumbnailURL )
			? 'Unselect for A/B Testing'
			: 'Select for A/B Testing';
		abTestingButton.dataset.thumbnail = thumbnailURL;

		abTestingFeatureDiv.appendChild( abTestingButton );

		abTestingButton.addEventListener( 'click', ( event ) => {
			this.handleAbTestButtonClick( event, thumbnailURL );
		} );

		li.appendChild( abTestingFeatureDiv );

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

		const abTestingFeatureDiv = document.createElement( 'div' );
		abTestingFeatureDiv.className = 'ab-testing-feature';

		// Create the button
		const abTestingButton = document.createElement( 'button' );
		abTestingButton.type = 'button';
		abTestingButton.className = 'ab-test-action';
		// abTestingButton.textContent = 'Select for A/B Testing';
		abTestingButton.textContent = this.abTestingSelection.includes( thumbnailURL )
			? 'Unselect for A/B Testing'
			: 'Select for A/B Testing';
		abTestingButton.dataset.thumbnail = thumbnailURL;
		abTestingButton.style.display = '1' === this.abTestingEnabled ? 'block' : 'none'; // Hide if A/B testing is disabled

		abTestingFeatureDiv.appendChild( abTestingButton );

		abTestingButton.addEventListener( 'click', ( event ) => {
			this.handleAbTestButtonClick( event );
		} );

		li.appendChild( abTestingFeatureDiv );

		return li;
	},

	handleAbTestButtonClick( event ) {
		event.preventDefault();
		event.stopPropagation();
		const button = event.currentTarget;
		button.textContent = 'Unselect for A/B Testing';

		if ( this.abTestingSelection.includes( button.dataset.thumbnail ) ) {
			// If already selected, remove it from the selection
			this.abTestingSelection = this.abTestingSelection.filter(
				( thumbnail ) => thumbnail !== button.dataset.thumbnail,
			);
			button.textContent = 'Select for A/B Testing';
			this.updateAbTestingButtonsState();
			return;
		}

		if ( this.abTestingSelection.length < 2 ) {
			this.abTestingSelection.push( button.dataset.thumbnail );
			this.updateAbTestingButtonsState();
		}
	},

	updateAbTestingButtonsState() {
		const abActionButtons = document.querySelectorAll( '.ab-test-action' );
		const abTestStartButton = document.querySelector( '.start-ab-test-button' );

		if ( '0' === this.abTestingEnabled ) {
			abActionButtons?.forEach( ( btn ) => {
				btn.style.display = 'none';
			} );

			if ( abTestStartButton ) {
				abTestStartButton.style.display = 'none';
			}
		} else {
			abActionButtons?.forEach( ( btn ) => {
				if ( ! this.abTestingSelection.includes( btn.dataset.thumbnail ) ) {
					btn.disabled = this.abTestingSelection.length >= 2;
				}
				btn.style.display = 'block';
			} );

			if ( abTestStartButton ) {
				abTestStartButton.disabled = 2 !== this.abTestingSelection.length;
				abTestStartButton.style.display = 'block';
			}
		}
	},

	renderABTestButton() {
		// Create a container div for styling if needed
		const container = document.createElement( 'div' );
		container.className = 'start-ab-test-button-container';

		// Create the Start A/B Test button
		const startButton = document.createElement( 'button' );
		startButton.type = 'button';
		startButton.className = 'start-ab-test-button';
		startButton.textContent = 'Start A/B Test';
		startButton.disabled = true; // Initially disabled until 2 thumbnails are selected
		startButton.style.display = '1' === this.abTestingEnabled ? 'block' : 'none'; // Hide if A/B testing is disabled

		// Add an event listener for the button
		startButton.addEventListener( 'click', () => {
			const formData = new FormData();
			formData.append( 'attachment_id', this.model.get( 'id' ) );

			formData.append( 'ab_testing_enabled', this.abTestingEnabled );
			formData.append( 'ab_testing_duration', this.abTestDuration );
			formData.append( 'ab_testing_thumbnails', this.abTestingSelection );

			fetch( window.pathJoin( [ restURL, '/godam/v1/media-library/set-ab-testing-settings' ] ), {
				method: 'POST',
				body: formData,
				headers: {
					'X-WP-Nonce': window.wpApiSettings?.nonce || '',
				},
			} )
				.then( ( response ) => response.json() )
				.then( ( data ) => {
					if ( data.success ) {
						//logic
						const abTestStartButton = document.querySelector(
							'.start-ab-test-button',
						);
						abTestStartButton.textContent = 'In Progress';
						abTestStartButton.disabled = true;
					}
				} )
				.catch( () => {
					// silent fail
					// ADD AN ERROR SNACKBAR HERE.
				} );
		} );

		const reportsButton = document.createElement( 'button' );
		reportsButton.type = 'button';
		reportsButton.className = 'reports-ab-test-button';
		reportsButton.textContent = 'Check reports';

		reportsButton.addEventListener( 'click', () => {
			//open link in new tab
			window.open(
				`admin.php?page=rtgodam_analytics&id=${ this.model.get( 'id' ) }#ab-reports-container`,
				'_blank',
			);
		} );

		container.appendChild( startButton );
		container.appendChild( reportsButton );

		return container;
	},

	async renderABTestOptions() {
		// Container for the settings
		const container = document.createElement( 'div' );
		container.className = 'ab-testing-controls';

		// toggleWrapper.appendChild(toggleLabel);

		const toggleWrapper = document.createElement( 'div' );
		toggleWrapper.className = 'ab-test-toggle-row';
		toggleWrapper.style.marginBottom = '16px';

		// Add a title/label for accessibility and clarity
		const titleLabel = document.createElement( 'label' );
		titleLabel.textContent = 'A/B Testing';
		titleLabel.setAttribute( 'for', 'ab-toggle' );

		// Label with "switch" class for styling (the actual toggle)
		const switchLabel = document.createElement( 'label' );
		switchLabel.className = 'switch';

		// The checkbox input
		const toggleInput = document.createElement( 'input' );
		toggleInput.type = 'checkbox';
		toggleInput.name = 'ab_testing'; // Adjust as needed
		toggleInput.value = this.abTestingEnabled;
		toggleInput.id = 'ab-toggle';
		toggleInput.className = 'ab-test-toggle';
		toggleInput.checked = this.abTestingEnabled === '1'; // Set initial state

		// The slider span
		const toggleSlider = document.createElement( 'span' );
		toggleSlider.className = 'slider round';

		// Build the toggle markup
		switchLabel.appendChild( toggleInput );
		switchLabel.appendChild( toggleSlider );

		// Optional: Associate visible toggle and label for a11y
		toggleInput.setAttribute( 'aria-labelledby', 'ab-testing-label' );

		// Helper text below toggle
		const helperText = document.createElement( 'div' );
		helperText.className = 'ab-test-helper-text';
		helperText.textContent = 'Starts A/B testing for thumbnails';

		const toggleInputContainer = document.createElement( 'div' );
		toggleInputContainer.className = 'ab-test-toggle-input-container';

		// Put it all together
		toggleWrapper.appendChild( titleLabel );
		toggleInputContainer.appendChild( switchLabel );
		toggleInputContainer.appendChild( helperText );
		toggleWrapper.appendChild( toggleInputContainer );

		toggleInput.addEventListener( 'change', () => {
			this.abTestingEnabled = toggleInput.checked ? '1' : '0';
			this.updateAbTestingButtonsState();

			if ( '0' === this.abTestingEnabled ) {
				const formData = new FormData();
				formData.append( 'attachment_id', this.model.get( 'id' ) );
				formData.append( 'ab_testing_enabled', '0' );
				formData.append( 'ab_testing_duration', '5' ); //dummy values
				formData.append( 'ab_testing_thumbnails', [] );

				fetch(
					window.pathJoin( [
						restURL,
						'/godam/v1/media-library/set-ab-testing-settings',
					] ),
					{
						method: 'POST',
						body: formData,
						headers: {
							'X-WP-Nonce': window.wpApiSettings?.nonce || '',
						},
					},
				)
					.then( ( response ) => response.json() );
			}
		} );

		// --- A/B Testing Duration ---
		const durationWrapper = document.createElement( 'div' );
		durationWrapper.className = 'ab-test-duration-row';

		const durationLabel = document.createElement( 'label' );
		durationLabel.textContent = 'A/B Testing Duration';
		durationLabel.style.display = 'inline-block';
		titleLabel.style.fontWeight = 'bold';
		titleLabel.style.marginBottom = '4px';

		const durationSelect = document.createElement( 'select' );
		durationSelect.className = 'ab-test-duration';
		durationSelect.id = 'abTestDuration';
		durationSelect.value = this.abTestDuration; // Set initial value

		const durationInputWrapper = document.createElement( 'div' );
		durationInputWrapper.className = 'ab-test-duration-input';

		[
			'5 days',
			'7 days',
			'15 days',
			'30 days',
			'60 days',
			'90 days',
		].forEach( ( text ) => {
			const option = document.createElement( 'option' );
			option.value = text.split( ' ' )[ 0 ];
			option.textContent = text;
			option.selected = text.split( ' ' )[ 0 ] === this.abTestDuration;
			durationSelect.appendChild( option );
		} );

		// // Toggle switch
		// toggleInput.checked = this.abTestingEnabled;

		// // Dropdown
		// durationSelect.value = this.abTestDuration;

		durationSelect.addEventListener( 'change', () => {
			this.abTestDuration = durationSelect.value;
		} );

		const durationHelper = document.createElement( 'span' );
		durationHelper.textContent = 'Starts A/B testing for thumbnails';
		durationHelper.style.marginLeft = '8px';
		durationHelper.style.fontSize = '14px';

		durationWrapper.appendChild( durationLabel );
		durationInputWrapper.appendChild( durationSelect );
		durationInputWrapper.appendChild( durationHelper );
		durationWrapper.appendChild( durationInputWrapper );

		// Attach all to main container
		container.appendChild( toggleWrapper );
		container.appendChild( durationWrapper );

		// Append the settings to a place in your UI (example: after .attachment-video-thumbnails)
		this.$el.find( '.attachment-actions' ).append( container );
	},

	/**
	 * Renders video thumbnails in the attachment details view.
	 *
	 * @param {Object} data - The video thumbnail data to render.
	 */
	renderThumbnail( data ) {
		const { thumbnails, selected, customThumbnails } = data;
		const attachmentID = this.model.get( 'id' );

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

		div.appendChild( this.renderABTestButton() );

		// Remove old and append new
		const actionsEl = this.$el.find( '.attachment-actions' );
		actionsEl.find( '.attachment-video-thumbnails' ).remove(); // Remove old thumbnails if any
		actionsEl.append( div );

		this.setupThumbnailClickHandler( attachmentID );
		this.setupThumbnailActions();
		this.updateAbTestingButtonsState();

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

	getABTestingSettings( attachmentId ) {
		return this.fetchData(
			window.pathJoin( [ restURL, '/godam/v1/media-library/get-ab-testing-settings' ] ),
			attachmentId,
		);
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
			this.renderABTestOptions();
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
