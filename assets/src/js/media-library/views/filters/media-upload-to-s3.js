
let MediaUploadToS3 = wp?.media?.view?.Button;

MediaUploadToS3 = MediaUploadToS3?.extend( {

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
