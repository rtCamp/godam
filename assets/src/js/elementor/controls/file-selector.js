if ( window.elementor ) {
	// eslint-disable-next-line no-undef
	const ControlMultiUnitItemView = elementor.modules.controls.BaseMultiple.extend( {

		ui() {
			// eslint-disable-next-line no-undef
			const ui = elementor.modules.controls.BaseMultiple.prototype.ui.apply( this, arguments );
			ui.controlMedia = '.elementor-control-media';
			ui.frameOpeners = '.elementor-control-media__file__controls__upload-button';
			ui.removeButton = '.elementor-control-media__remove';
			ui.fileName = '.elementor-control-media__file__content__info__name';

			return ui;
		},

		events() {
			// eslint-disable-next-line no-undef
			return _.extend( elementor.modules.controls.BaseMultiple.prototype.events.apply( this, arguments ), {
				'click @ui.frameOpeners': 'openFrame',
				'click @ui.removeButton': 'clearMedia',
			} );
		},

		initialize() {
			// eslint-disable-next-line no-undef
			elementor.modules.controls.BaseMultiple.prototype.initialize.apply( this, arguments );
		},

		applySavedValue() {
			const fileName = this.getControlValue( 'title' );

			if ( 'object' !== typeof fileName ) {
				this.ui.fileName.text( fileName );
				this.ui.controlMedia.toggleClass( 'e-media-empty', '' === fileName );
			}
		},

		clearMedia() {
			this.setValue( {
				id: '',
				url: '',
				title: '',
				name: '',
				icon: 'text',
			} );
			this.applySavedValue();
		},

		async openFrame() {
			const control = this;
			const mediaType = this.model.get( 'media_type' );
			const currentId = this.getControlValue( 'id' );

			const frame = wp.media( {
				title: 'Select File',
				button: {
					text: 'Insert File',
				},
				library: {
					type: [ mediaType ] || [ '' ],
				},
				multiple: false,
			} );

			// Preselect current file if any
			frame.on( 'open', function() {
				if ( currentId ) {
					const selection = frame.state().get( 'selection' );
					const attachment = wp.media.attachment( currentId );
					attachment.fetch();
					selection.add( attachment );
				}
			} );

			frame.on( 'select', function() {
				const attachment = frame.state().get( 'selection' ).first().toJSON();
				control.setValue( {
					id: attachment.id,
					url: attachment.url,
					title: attachment.title,
					name: attachment.filename,
					icon: attachment.icon || 'text',
				} );
				control.applySavedValue();
			} );

			await frame.open();
		},
	} );

	// eslint-disable-next-line no-undef
	elementor.addControlView( 'media-custom', ControlMultiUnitItemView );
}
