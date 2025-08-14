/**
 * MediaUploaderHandler - Handles media upload folder parameter injection
 *
 * @class MediaUploaderHandler
 */
class MediaUploaderHandler {
	/**
	 * Initialize the media uploader handler
	 *
	 * @param {string} folderSelector - CSS selector for folder input (default: '#media-folder')
	 */
	constructor( folderSelector = '#media-folder' ) {
		this.uploader = window.uploader;
		this.folderSelector = folderSelector;

		if ( this.isValidUploader() ) {
			this.bindEvents();
		}
	}

	/**
	 * Check if uploader instance is valid
	 *
	 * @return {boolean} boolean value if uploader is valid
	 */
	isValidUploader() {
		return this.uploader &&
				typeof this.uploader.bind === 'function' &&
				this.uploader.hasOwnProperty( 'settings' );
	}

	/**
	 * Bind the BeforeUpload event
	 */
	bindEvents() {
		this.uploader.bind( 'BeforeUpload', ( up, file ) => {
			this.handleBeforeUpload( up, file );
		} );
	}

	/**
	 * Handle before upload - inject folder parameter
	 *
	 * @param {Object} up   - Uploader instance
	 * @param {Object} file - File object
	 */
	handleBeforeUpload( up, file ) {
		void file; // Not being used anywhere but file Object might still be important in future.
		const folderElement = document.querySelector( this.folderSelector );

		if ( folderElement && folderElement.value ) {
			up.settings.multipart_params[ 'media-folder' ] = folderElement.value;
		}
	}
}

export default MediaUploaderHandler;
