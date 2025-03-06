
let MediaUploadToS3 = wp?.media?.view?.Button;

const restURL = window.godamRestRoute.url || '';
const pathJoin = ( parts, sep = '/' ) => parts.join( sep ).replace( new RegExp( sep + '{1,}', 'g' ), sep );

MediaUploadToS3 = MediaUploadToS3?.extend( {

	events: {
		click: 'uploadToS3',
	},

	initialize() {
		wp.media.view.Button.prototype.initialize.apply( this, arguments );

		if ( this.options.filters ) {
			this.options.filters.model.on( 'change', this.filterChange, this );
		}
		this.controller.on( 'selection:toggle', this.toggleDisabled, this );
		this.controller.on( 'select:activate', this.toggleDisabled, this );

		this.controller.on( 'select:activate select:deactivate', this.toggleButtonSelectClass, this );

		this.model.set( 'text', 'Upload to S3' );
	},

	toggleButtonSelectClass() {
		if ( this.controller.isModeActive( 'select' ) ) {
			this.$el.removeClass( 'hidden' );
		} else {
			this.$el.addClass( 'hidden' );
		}
	},

	toggleDisabled() {
		this.model.set( 'disabled', ! this.controller.state().get( 'selection' ).length );
	},

	uploadToS3() {
		const selection = this.controller.state().get( 'selection' );

		const attachmentIds = selection.map( ( model ) => model.get( 'id' ) );

		if ( attachmentIds.length === 0 ) {
			return;
		}

		this.restRequestToS3( attachmentIds ).then( ( data ) => {
			this.refreshAttachments( data.uploaded );
		} );
	},

	async restRequestToS3( attachmentIds ) {
		if ( ! attachmentIds || ! Array.isArray( attachmentIds ) || attachmentIds.length === 0 ) {
			return null;
		}

		try {
			const response = await fetch(
				pathJoin( restURL, '/godam/v1/media-library/upload-to-s3' ),
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': window.wpApiSettings?.nonce || '',
					},
					body: JSON.stringify( { attachment_ids: attachmentIds } ),
				} );

			if ( ! response.ok ) {
				throw new Error( `HTTP error! Status: ${ response.status }` );
			}

			const data = await response.json();

			return data;
		} catch ( error ) {
			return null;
		}
	},

	refreshAttachments( attachmentIds ) {
		attachmentIds.forEach( ( id ) => {
			const attachment = wp.media.attachment( id );

			// refetch the attachment so that the new URL of S3 is fetched.
			attachment.fetch().then( () => {
				// Remove the selection globally.
				this.controller.state().get( 'selection' ).remove( attachment );
			} );
		} );
	},

	render() {
		wp.media.view.Button.prototype.render.apply( this, arguments );
		if ( this.controller.isModeActive( 'select' ) ) {
			this.$el.addClass( 'media-library-upload-to-s3' );
		} else {
			this.$el.addClass( 'media-library-upload-to-s3 hidden' );
		}
		this.toggleDisabled();
		return this;
	},
} );

export default MediaUploadToS3;
