class MideaVersionAdmin {
	init() {
		this.addMediaVersion();
	}

	showGodamSnackbar( message, callback = false ) {
		let snackbar = document.getElementById( 'godam-snackbar' );
		if ( ! snackbar ) {
			snackbar = document.createElement( 'div' );
			snackbar.id = 'godam-snackbar';
			snackbar.style.cssText = `
                min-width: 250px;
                background: #cc1818;
                color: #fff;
                text-align: center;
                border-radius: 4px;
                padding: 16px;
                position: fixed;
                right: 40px;
                bottom: 35px;
                z-index: 999999;
                font-size: 14px;
            `;
			document.body.appendChild( snackbar );
		}
		snackbar.textContent = message;
		snackbar.className = 'show';
		setTimeout( () => {
			snackbar.remove();
			if ( callback && typeof callback === 'function' ) {
				callback();
			}
		}, 3000 );
	}

	addMediaVersion() {
		const self = this;
		const addMediaBtn = document.querySelector( '#rtgodam-add-media-button' );
		addMediaBtn.addEventListener( 'click', ( event ) => {
			event.preventDefault();
			event.stopPropagation();
			const [ fileFrame, postId ] = this.initializemediaFrame( event );
			fileFrame.on( 'ready', function() {
				const mediaUploader = fileFrame.uploader;

				if ( mediaUploader && mediaUploader.uploader ) {
					const mu = mediaUploader.uploader.uploader;
					mu.bind( 'BeforeUpload', function( up ) {
						up.settings.multipart_params = {
							...up.settings.multipart_params,
							origin_post_id: postId,
						};
					} );
					mu.bind( 'FileUploaded', function( up, file, response ) {
						try {
							const json = JSON.parse( response.response );
							if ( json && json.success ) {
								fileFrame.$el.parent().parent().css( 'pointer-events', 'none' );
								this.showGodamSnackbar( window.rtgodamMediaVersionAdmin.uploadSuccessMessage, () => {
									window.location.reload();
								} );
							} else {
								self.showGodamSnackbar( `${ window.rtgodamMediaVersionAdmin.uploadFailedMessage } ${ json?.data?.message }` );
								fileFrame.close();
							}
						} catch ( e ) {}
					} );
				}
			} );
			fileFrame.on( 'open', function() {
				const elm = fileFrame.$el;
				elm.find( '.media-frame-router .media-router' ).find( ':not(#menu-item-upload)' ).remove();
				elm.find( '.media-frame-toolbar' ).remove();
				elm.find( '.media-frame-menu' ).remove();
				elm.parent().addClass( 'hide-sidebar' );
				elm.find( '#menu-item-upload' ).click();
			} );
			fileFrame.open();
		} );
	}

	initializemediaFrame( event ) {
		const postId = event.currentTarget.getAttribute( 'data-post-id' );
		if ( ! postId ) {
			return;
		}

		const config = {
			title: 'Upload Media',
			multiple: false,
			contentUserSetting: false,
		};
		return [ wp.media( config ), postId ];
	}
}

MideaVersionAdmin = new MideaVersionAdmin();

/* global jQuery */

jQuery( document ).ready( function() {
	MideaVersionAdmin.init();
} );
