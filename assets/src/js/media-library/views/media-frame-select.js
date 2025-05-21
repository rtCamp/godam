
const MediaFrameSelect = wp?.media?.view?.MediaFrame?.Select;
const l10n = wp?.media?.view?.l10n;

export default MediaFrameSelect?.extend( {
	initialize() {
		// Call the parent initialize method
		MediaFrameSelect.prototype.initialize.apply( this, arguments );

		this.on( 'content:render:godam', this.GoDAMCreate, this );
	},

	browseRouter( routerView ) {
		routerView.set( {
			upload: {
				text: l10n.uploadFilesTitle,
				priority: 20,
			},
			browse: {
				text: l10n.mediaLibraryTitle,
				priority: 40,
			},
			godam: {
				text: 'GoDAM',
				priority: 60,
			},
		} );
	},

	GoDAMCreate() {
		const state = this.state();

		let mimeTypes = state.get( 'library' )?.props?.get( 'type' );

		if ( ! mimeTypes ) {
			mimeTypes = 'all';
		} else {
			mimeTypes = mimeTypes.join( '-' );
		}

		this.$el.removeClass( 'hide-toolbar' );

		// Browse our library of attachments.
		const RenderedContent = new wp.media.view.AttachmentsBrowser( {
			controller: this,
			collection: wp.media.query( { type: [ 'godam/' + mimeTypes ] } ),
			selection: state.get( 'selection' ),
			model: state,
		} );

		this.content.set( RenderedContent );
	},
} );
