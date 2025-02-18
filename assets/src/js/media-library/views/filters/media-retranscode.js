
let MediaRetranscode = wp?.media?.view?.Button;

MediaRetranscode = MediaRetranscode?.extend( {

	events: {
		click: 'ReTranscodeMedia',
	},

	initialize() {
		wp.media.view.Button.prototype.initialize.apply( this, arguments );

		if ( this.options.filters ) {
			this.options.filters.model.on( 'change', this.filterChange, this );
		}
		this.controller.on( 'selection:toggle', this.toggleDisabled, this );
		this.controller.on( 'select:activate', this.toggleDisabled, this );

		this.controller.on( 'select:activate select:deactivate', this.toggleButtonSelectClass, this );

		this.model.set( 'text', 'Retranscode Media' );
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

	ReTranscodeMedia() {
		const selection = this.controller.state().get( 'selection' );

		const attachmentIds = selection.map( ( model ) => model.get( 'id' ) );

		if ( attachmentIds.length === 0 ) {
			return;
		}

		const nonce = window.easydamMediaLibrary?.godamToolsNonce;

		// Redirect to the retranscode page.
		window.location.href = `${ window.location.origin }/wp-admin/admin.php?page=godam-tools&ids=${ attachmentIds.join( ',' ) }&goback=1&_wpnonce=${ nonce }`;
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

export default MediaRetranscode;
