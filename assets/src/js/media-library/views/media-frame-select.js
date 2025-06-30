
const MediaFrameSelect = wp?.media?.view?.MediaFrame?.Select;
const l10n = wp?.media?.view?.l10n;

wp.media.editor.send.attachment = function( props, attachment ) {
	console.log( props );
};

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

		// Attaches callback to create attachment entry in WordPress.
		state.off( 'select', this.onGoDAMSelect, this );
		state.on( 'select', this.onGoDAMSelect, this );
	},

	onGoDAMSelect() {
		const tab = this.state().get( 'content' );
		const selection = this.state().get( 'selection' );
		const selected = selection?.first();
		const data = selected.attributes;

		console.log( data );

		// TODO: Implement API call to website to create the attachment.
		fetch( '/wp-json/godam/v1/media-library/create-media-entry', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': window.wpApiSettings?.nonce, // Assumes wpApiSettings is localized
			},
			body: JSON.stringify( {
				id: data.id,
				title: data.title,
				filename: data.filename,
				name: data.title,
				url: data.url,
				mime: 'video/mp4',
				type: data.type,
				subtype: data.subtype,
				status: data.status,
				date: data.date,
				modified: data.modified,
				filesizeInBytes: data.filesizeInBytes,
				filesizeHumanReadable: data.filesizeHumanReadable,
				owner: data.owner,
				label: data.label,
				icon: data.icon,
				caption: data.caption,
				description: data.description,
			} ),
		} )
			.then( ( res ) => res.json() )
			.then( ( response ) => {
				console.log( 'Created attachment response:', response );
			} )
			.finally( () => {
				// this.$el.find( '.godam-spinner' ).remove();
			} );
	},
} );
