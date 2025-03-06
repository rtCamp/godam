/**
 * External dependencies
 */
import DOMPurify from 'isomorphic-dompurify';

const AttachmentDetailsTwoColumn = wp?.media?.view?.Attachment?.Details?.TwoColumn;

const restURL = window.godamRestRoute.url || '';

const pathJoin = ( parts, sep = '/' ) => parts.join( sep ).replace( new RegExp( sep + '{1,}', 'g' ), sep );

export default AttachmentDetailsTwoColumn?.extend( {

	/**
	 * Initializes the AttachmentDetailsTwoColumn.
	 */
	initialize() {
		AttachmentDetailsTwoColumn.prototype.initialize.apply( this, arguments );
		const attachmentId = this.model.get( 'id' );

		if ( this.model.get( 'type' ) === 'video' ) {
			this.fetchAndRender( this.getVideoThumbnails( attachmentId ), this.renderThumbnail );
		}

		this.fetchAndRender( this.getExifDetails( attachmentId ), this.renderExifDetails );
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
		return this.fetchData( pathJoin( restURL, '/godam/v1/media-library/get-video-thumbnail' ), attachmentId );
	},

	/**
	 * Retrieves EXIF details for the given attachment ID.
	 *
	 * @param {number} attachmentId - The ID of the attachment.
	 * @return {Promise<Object|null>} - The fetched EXIF data or null.
	 */
	getExifDetails( attachmentId ) {
		return this.fetchData( pathJoin( restURL, '/godam/v1/media-library/get-exif-data' ), attachmentId );
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
	 * Renders video thumbnails in the attachment details view.
	 *
	 * @param {Object} data - The video thumbnail data to render.
	 */
	renderThumbnail( data ) {
		const { thumbnails, selected } = data;
		const attachmentID = this.model.get( 'id' );

		const thumbnailsHTML = thumbnails.map( ( thumbnail ) =>
			`<li class="${ thumbnail === selected ? 'selected' : '' }">
			<img src="${ thumbnail }" alt="Video Thumbnail" />
		</li>` ).join( '' );

		const thumbnailDiv = `
		<div class="attachment-video-thumbnails">
			<div class="attachment-video-title"><h4>Video Thumbnails</h4></div>
			<ul>${ thumbnailsHTML }</ul>
		</div>`;

		this.$el.find( '.attachment-actions' ).append( DOMPurify.sanitize( thumbnailDiv ) );
		this.setupThumbnailClickHandler( attachmentID );
	},

	/**
	 * Sets up click event handlers for selecting video thumbnails.
	 *
	 * @param {number} attachmentID - The ID of the attachment.
	 */
	setupThumbnailClickHandler( attachmentID ) {
		document.querySelectorAll( '.attachment-video-thumbnails li' ).forEach( ( li ) => {
			li.addEventListener( 'click', function() {
				// Remove the selected class from all thumbnails and add it to the clicked thumbnail.
				document.querySelectorAll( '.attachment-video-thumbnails li' ).forEach( ( item ) => item.classList.remove( 'selected' ) );
				this.classList.add( 'selected' );

				const thumbnailURL = this.querySelector( 'img' ).src;

				/**
				 * Send a POST request to the server to set the selected thumbnail for the video.
				 */
				fetch( pathJoin( restURL, '/godam/v1/media-library/set-video-thumbnail' ), {
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
		const editVideoURL = `admin.php?page=video_editor&id=${ this.model.get( 'id' ) }`;
		const analyticsURL = `admin.php?page=analytics&id=${ this.model.get( 'id' ) }`;

		return `
		<a href="${ editVideoURL }" class="button button-primary" target="_blank">Edit Video</a>
		<a href="${ analyticsURL }" class="button button-secondary" target="_blank">Analytics</a>
		`;
	},

	render() {
		// Call the parent render method.
		AttachmentDetailsTwoColumn.prototype.render.apply( this, arguments );

		// Check if the attachment is a video and render the edit buttons.
		if ( this.model.get( 'type' ) === 'video' ) {
			this.renderVideoActions();
		}

		// Return this view.
		return this;
	},
} );
