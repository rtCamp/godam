if ( window.elementor ) {
	// eslint-disable-next-line no-undef
	const ControlMultiUnitItemView = elementor.modules.controls.BaseMultiple.extend( {

		ui() {
			// eslint-disable-next-line no-undef
			const ui = elementor.modules.controls.BaseMultiple.prototype.ui.apply( this, arguments );
			ui.controlMedia = '.elementor-control-media';
			ui.mediaImage = '.elementor-control-media__preview';
			ui.mediaVideo = '.elementor-control-media-video';
			ui.frameOpeners = '.elementor-control-preview-area';
			ui.removeButton = '.elementor-control-media__remove';
			// eslint-disable-next-line capitalized-comments
			// ui.warnings = '.elementor-control-media__warnings';
			ui.promotions = '.elementor-control-media__promotions';
			ui.promotions_dismiss = '.elementor-control-media__promotions .elementor-control-notice-dismiss';
			ui.promotions_action = '.elementor-control-media__promotions .elementor-control-notice-main-actions button';
			ui.fileName = '.elementor-control-media__file__content__info__name';
			ui.mediaInputImageSize = '.e-image-size-select';

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
			const value = this.getControlValue( 'url' ),
				url = value || this.getControlPlaceholder()?.url,
				icon = this.getControlValue( 'icon' ),
				isPlaceholder = ( ! value && url ),
				mediaType = this.getMediaType();

			if ( [ 'image', 'svg' ].includes( mediaType ) ) {
				this.ui.mediaImage.css( 'background-image', url ? 'url(' + url + ')' : '' );

				if ( isPlaceholder ) {
					this.ui.mediaImage.css( 'opacity', 0.5 );
				}
			} else if ( 'video' === mediaType ) {
				this.ui.mediaVideo.attr( 'poster', icon ?? '' );
				this.ui.mediaVideo.attr( 'src', url );
			} else {
				const fileName = url ? url.split( '/' ).pop() : '';
				this.ui.fileName.text( fileName );
			}

			if ( this.ui.mediaInputImageSize ) {
				let imageSize = this.getControlValue( 'size' );

				if ( isPlaceholder ) {
					imageSize = this.getControlPlaceholder()?.size;
				}

				this.ui.mediaInputImageSize
					.val( imageSize )
					.toggleClass( 'e-select-placeholder', isPlaceholder );
			}

			this.ui.controlMedia
				.toggleClass( 'e-media-empty', ! value )
				.toggleClass( 'e-media-empty-placeholder', ( ! value && ! isPlaceholder ) );
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

		getMediaType() {
			return this.mediaType || this.model.get( 'media_type' ) || this.model.get( 'media_types' )[ 0 ];
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
				if ( attachment?.mime && 'application/dash+xml' === attachment?.mime ) {
					control.setValue( {
						id: attachment.id,
						url: attachment.url,
						title: attachment.title,
						name: attachment.filename,
						icon: attachment.icon || '',
					} );
				} else {
					control.setValue( {
						id: attachment.id,
						url: attachment.url,
						title: attachment.title,
						name: attachment.filename,
						icon: '',
					} );
				}

				control.applySavedValue();
			} );

			await frame.open();
		},
	} );

	// eslint-disable-next-line no-undef
	elementor.addControlView( 'godam-media', ControlMultiUnitItemView );
}
