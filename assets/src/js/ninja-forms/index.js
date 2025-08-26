/* global Backbone, jQuery, Marionette */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

( function( $ ) {
	// Initialize Backbone.Radio
	const gnfRadio = Backbone.Radio;
	const radioChannel = gnfRadio.channel( 'godam_recorder' );

	// File model, extend Backbone.Model.
	const fileModel = Backbone.Model.extend( {
		id: 0,
		name: '',
		path: '',
		fieldID: 0,
	} );

	// Extend Backbone.Collection for file uploads.
	const FileCollection = Backbone.Collection.extend( {
		model: fileModel,
	} );

	// Upload Controller for the file.
	const uploadController = Marionette.Object.extend( {

		ajaxUrl: window.nfGodamRecorderUpload.ajaxUrl,
		nfGodamRecorderUpload: window.nfGodamRecorderUpload,

		// Initialize the upload controller with channels.
		initialize() {
			this.listenTo( radioChannel, 'init:model', this.initFile );
			this.listenTo( radioChannel, 'render:view', this.initFileUpload );
			radioChannel.reply( 'validate:required', this.validateRequired );
			radioChannel.reply( 'get:submitData', this.getSubmitData );
		},

		/**
		 * Show error message for file upload.
		 *
		 * @param {string} error Error message.
		 * @param {Object} view  View instance.
		 */
		showError( error, view ) {
			gnfRadio
				.channel( 'fields' )
				.request(
					'add:error',
					view.model.id,
					'godam-recorder-file-error',
					error,
				);
		},

		/**
		 * Reset error message for file upload.
		 *
		 * @param {Object} view    View instance.
		 * @param {number} fieldID Field ID.
		 */
		resetError( view, fieldID ) {
			gnfRadio
				.channel( 'fields' )
				.request( 'remove:error', fieldID, 'godam-recorder-file-error' );
			const formID = view.model.get( 'formID' );
			gnfRadio
				.channel( 'form-' + formID )
				.trigger( 'enable:submit', view.model );
		},

		/**
		 * Initialize file upload for the view.
		 *
		 * @param {Object} view View instance.
		 */
		initFileUpload( view ) {
			const fieldID = view.model.id;
			const formID = view.model.get( 'formID' );
			const nonce = view.model.get( 'recorder_nonce' );

			const $file = $( view.el ).find( '.nf-element' );

			// Get files from view.
			let files = view.model.get( 'files' );
			files = files || [];

			/*
			 * If "files" isn't a collection, turn it into one.
			 */
			if ( ! ( files instanceof FileCollection ) ) {
				files = new FileCollection( files );
				view.model.set( 'files', files );
			}

			$file[ 0 ].addEventListener( 'godamFormInputchange', ( event ) => {
				this.resetError( view, fieldID );
				this.handleFileUpload( event, view, fieldID, formID, nonce );
			} );
		},

		/**
		 * Validate the uploaded file.
		 *
		 * @param {*} event Event object.
		 * @param {*} view  View instance.
		 */
		validateFile( event, view ) {
			const file = event.target.files[ 0 ];
			const fileSize = file.size;

			const maxFileSizeString = this.nfGodamRecorderUpload.maxFileSizeError.replace( '%n', view.model.get( 'max_file_size_mb' ) );
			const maxFileSize = view.model.get( 'max_file_size' );

			if ( maxFileSize < fileSize ) {
				this.showError( maxFileSizeString, view );
				return false;
			}

			return true;
		},

		/**
		 * Handle file upload events.
		 *
		 * @param {*} event   Event object.
		 * @param {*} view    View instance.
		 * @param {*} fieldID Field ID.
		 * @param {*} formID  Form ID.
		 * @param {*} nonce   Nonce value.
		 */
		handleFileUpload( event, view, fieldID, formID, nonce ) {
			const file = event.target.files[ 0 ];

			/**
			 * If we have clear action, remove from local storage as well.
			 */
			if ( 'clear' === event?.detail?.action ) {
				localStorage.removeItem( 'godam-nf-recorder-data' );
			}

			if ( ! file ) {
				return;
			}

			// Check for validation.
			const validatedFileData = this.validateFile( event, view );

			if ( ! validatedFileData ) {
				return;
			}

			this.showUploading( view );

			/**
			 * If restored use local storage data.
			 */
			if ( 'restored' === event?.detail?.action ) {
				const localStorageItem = localStorage.getItem( 'godam-nf-recorder-data' );
				if ( localStorageItem ) {
					const parsedData = JSON.parse( localStorageItem ?? {} );

					if ( parsedData?.data !== '' && Date.now() < parsedData?.expiresAt ) {
						const files = view.model.get( 'files' );
						const dataTosubmit = JSON.parse( parsedData.data );
						files.add( new fileModel( {
							name: dataTosubmit.file_name,
							path: dataTosubmit.file_path,
							fieldID,
						} ) );
						view.model.set( 'files', files );
						view.model.trigger( 'change:files', view.model );
						view.model.set( 'value', 1 );

						gnfRadio.channel( 'fields' ).trigger( 'change:field', view.el, view.model );
						gnfRadio.channel( 'form-' + formID ).trigger( 'enable:submit', view.model );

						this.removeUploading( view );
						return;
					}

					// Remove local storage if not used from restored or expired.
					localStorage.removeItem( 'godam-nf-recorder-data' );
				}
			}

			const formId = event.target.dataset.formId;

			if ( ! formId ) {
				return;
			}

			const formData = new FormData();

			// Add the file.
			formData.append( 'form_id', formID );
			formData.append( 'field_id', fieldID );
			formData.append( 'files-' + fieldID, file );

			// Add nonce or action if needed for WordPress
			formData.append( 'action', 'nf_godam_upload' );
			formData.append( 'nonce', nonce );

			this.sendAjax( formData, view, fieldID, formID );
		},

		/**
		 * Show uploading status.
		 *
		 * @param {*} view View instance.
		 */
		showUploading( view ) {
			const $progress = view.$el.find( '.godam-nf-upload-progress' );
			$progress.show();
			$progress.html( __( 'File upload in progress…', 'godam' ) );
			const formID = view.model.get( 'formID' );
			gnfRadio
				.channel( 'form-' + formID )
				.trigger( 'disable:submit', view.model );
		},

		/**
		 * Remove uploading status.
		 *
		 * @param {*} view View instance.
		 */
		removeUploading( view ) {
			const $progress = view.$el.find( '.godam-nf-upload-progress' );
			$progress.hide();
			$progress.html( '' );
			const formID = view.model.get( 'formID' );
			gnfRadio
				.channel( 'form-' + formID )
				.trigger( 'enable:submit', view.model );
		},

		/**
		 * Send AJAX request for file upload.
		 *
		 * @param {*} formData Form data object.
		 * @param {*} view     View instance.
		 * @param {*} fieldID  Field ID.
		 * @param {*} formID   Form ID.
		 */
		sendAjax( formData, view, fieldID, formID ) {
			const files = view.model.get( 'files' );

			fetch( this.ajaxUrl, {
				method: 'POST',
				body: formData,
			} )
				.then( ( response ) => response.json() )
				.then( ( responseData ) => {
					if ( responseData.success && responseData.data ) {
						// Remove upload status.
						this.removeUploading( view );
						files.add(
							new fileModel( {
								name: responseData.data.file_name,
								path: responseData.data.file_path,
								fieldID,
							} ),
						);

						this.storeInLocalStorage( JSON.stringify( responseData.data ) );

						view.model.set( 'files', files );
						view.model.trigger( 'change:files', view.model );
						view.model.set( 'value', 1 );

						gnfRadio.channel( 'fields' ).trigger( 'change:field', view.el, view.model );
						gnfRadio.channel( 'form-' + formID ).trigger( 'enable:submit', view.model );
					} else if ( ! responseData.success && responseData.data ) {
						this.showError( responseData.data, view );
						this.removeUploading( view );
					}
				} )
				.catch( () => {
					this.showError( __( 'Upload failed. Please try again.', 'godam' ), view );
					this.removeUploading( view );
				} );
		},

		/**
		 * Get submit data for the file upload.
		 *
		 * @param {Object} fieldData Field data object.
		 * @param {Object} field     Field model.
		 *
		 * @return {Object} Updated field data object.
		 */
		getSubmitData( fieldData, field ) {
			fieldData.files = field.get( 'files' );

			return fieldData;
		},

		/**
		 * Check files have been submitted successfully for required field check
		 *
		 * @param {*} el    Element reference.
		 * @param {*} model Field model.
		 *
		 * @return {boolean} Boolean indicating if the field is valid
		 */
		validateRequired( el, model ) {
			const files = model.get( 'files' );
			if ( typeof files === 'undefined' || ! files.length ) {
				model.set( 'value', '' );
				return false;
			}

			return true;
		},

		/**
		 * Store the data in local storage for 10 min.
		 *
		 * @param {string} data File URL.
		 */
		storeInLocalStorage( data ) {
			const key = 'godam-nf-recorder-data';
			const dataToStore = {
				data,
				expiresAt: Date.now() + ( 10 * 60 * 1000 ),
			};
			localStorage.setItem( key, JSON.stringify( dataToStore ) );
		},
	} );
	new uploadController();

	/**
	 * Submission Controller.
	 */
	const SubmissionController = Marionette.Object.extend( {
		initialize() {
			this.listenTo(
				Backbone.Radio.channel( 'forms' ),
				'submit:response',
				this.actionSubmit,
			);
		},

		// Remove the uppy storage on successful submission.
		actionSubmit() {
			Object.keys( localStorage )
				.filter( ( key ) => key.startsWith( 'uppyState:' ) )
				.forEach( ( key ) => localStorage.removeItem( key ) );

			localStorage.removeItem( 'godam-nf-recorder-data' );
		},
	} );
	new SubmissionController();
}( jQuery ) );
