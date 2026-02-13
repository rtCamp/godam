/**
 * Internal dependencies
 */
import { canEditPages } from '../../utility';

let MediaRetranscode = wp?.media?.view?.Button;
const homeUrl = window.godamRestRoute.homeUrl || window.location.origin; // eslint-disable-line no-unused-vars

MediaRetranscode = MediaRetranscode?.extend( {

	events: {
		click: 'ReTranscodeMedia',
	},

	initialize() {
		// If user cannot manage options we don't render the button.
		if ( ! canEditPages() ) {
			return;
		}

		wp.media.view.Button.prototype.initialize.apply( this, arguments );

		if ( this.options.filters ) {
			this.options.filters.model.on( 'change', this.filterChange, this );
		}
		this.controller.on( 'selection:toggle', this.toggleDisabled, this );
		this.controller.on( 'select:activate', this.toggleDisabled, this );

		this.controller.on( 'select:activate select:deactivate', this.toggleButtonSelectClass, this );

		this.model.set( 'text', 'Transcode Media' );
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
		window.location.href = `${ window?.pluginInfo?.adminUrl }admin.php?page=rtgodam_tools&media_ids=${ attachmentIds.join( ',' ) }&goback=1&_wpnonce=${ nonce }`;
	},

	render() {
		wp.media.view.Button.prototype.render.apply( this, arguments );

		if ( this.controller.isModeActive( 'select' ) ) {
			this.$el.addClass( 'media-library-bulk-actions' );
		} else {
			this.$el.addClass( 'media-library-bulk-actions hidden' );
		}

		this.toggleDisabled();
		return this;
	},
} );

export default MediaRetranscode;
