/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

class MideaVersion {
	initializemediaFrame( event ) {
		const postId = event.currentTarget.getAttribute( 'data-post-id' );
		if ( ! postId ) {
			return;
		}

		const config = {
			title: __( 'Upload Media', 'godam' ),
			multiple: false,
			contentUserSetting: false,
		};
		return [ wp.media( config ), postId ];
	}

	addMediaVersionFromMediaLibrary( context ) {
		const addMediaBtn = context.$el.find( '.compat-field-replace_media #rtgodam-add-media-button' );
		if ( ! addMediaBtn.length ) {
			return;
		}

		addMediaBtn.on( 'click', ( event ) => {
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
						window.rtcontext = context;
						const editModal = context.$el.parent().parent().find( '.media-modal-close' );
						try {
							const json = JSON.parse( response.response );
							if ( json && json.success ) {
								fileFrame.$el.parent().parent().css( 'pointer-events', 'none' );
								context.showGodamSnackbar( __( 'Media version uploaded successfully.', 'godam' ), () => {
									window.location.reload();
								} );
							} else {
								context.showGodamSnackbar( `Upload failed: ${ json?.data?.message }` );
								fileFrame.close();
								editModal.trigger( 'click' );
							}
						} catch ( e ) {}
					} );
				}
			} );
			fileFrame.on( 'open', function() {
				fileFrame.$el.find( '.media-frame-router .media-router' ).find( ':not(#menu-item-upload)' ).remove();
				fileFrame.$el.find( '.media-frame-toolbar' ).remove();
				fileFrame.$el.find( '#menu-item-upload' ).click();
			} );
			fileFrame.open();
		} );
	}

	updateAttachmentVersionPreviewFromMediaLibrary( context ) {
		if ( ! context.model ) {
			return;
		}

		context.listenTo(
			context.model,
			'change',
			function() {
				const attachmentUrl = context.model.get( 'url' );
				const attachmentType = context.model.get( 'type' );
				// document.querySelectorAll( 'img' ).forEach( ( img ) => {
				// 	if ( img.src === attachmentUrl ) {
				// 		img.src = attachmentUrl + '?t=' + new Date().getTime(); // Cache busting
				// 	}
				// } );
				console.log( 'attachmentUrl - ', attachmentUrl );
				console.log( 'attachmentType - ', attachmentType );
				console.log( 'attachmentType - ', context.model );
			},
		);
	}
}
export default MideaVersion;
