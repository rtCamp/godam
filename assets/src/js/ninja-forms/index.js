/* global Backbone, jQuery, Marionette */
( function( $ ) {
	const nfRadio = Backbone.Radio;
	const radioChannel = nfRadio.channel( 'godam_recorder' );

	const fileModel = Backbone.Model.extend( {
		id: 0,
		name: '',
		tmpName: '',
		fieldID: 0,
	} );

	const FileCollection = Backbone.Collection.extend( {
		model: fileModel,
	} );

	const uploadController = Marionette.Object.extend( {
		jqXHR: [],
		$progress_bars: [],

		initialize() {
			this.listenTo( radioChannel, 'init:model', this.initFile );
			this.listenTo( radioChannel, 'render:view', this.initFileUpload );
			radioChannel.reply( 'validate:required', this.validateRequired );
			radioChannel.reply( 'get:submitData', this.getSubmitData );
		},

		showError( error, view ) {
			nfRadio
				.channel( 'fields' )
				.request(
					'add:error',
					view.model.id,
					'upload-file-error',
					error,
				);
		},

		resetError( view, fieldID ) {
			nfRadio
				.channel( 'fields' )
				.request( 'remove:error', fieldID, 'upload-file-error' );
			const formID = view.model.get( 'formID' );
			nfRadio
				.channel( 'form-' + formID )
				.trigger( 'enable:submit', view.model );
		},

		initFileUpload( view ) {
			const fieldID = view.model.id;
			const formID = view.model.get( 'formID' );
			const nonce = view.model.get( 'recorder_nonce' );
			const $file = $( view.el ).find( '.nf-element' );
			let files = view.model.get( 'files' );
			console.log( files );
			/*
			 * Make sure that our files array isn't undefined.
			 * If it is, set it to an empty array.
			 */
			files = files || [];

			/*
			 * If "files" isn't a collection, turn it into one.
			 */
			if ( ! ( files instanceof FileCollection ) ) {
				files = new FileCollection( files );
				view.model.set( 'files', files );
			}

			const formData = {
				form_id: formID,
				field_id: fieldID,
				nonce,
			};
			console.log( formData );
		},

		getSubmitData( fieldData, field ) {
			fieldData.files = field.get( 'files' );

			return fieldData;
		},

		/**
		 * Check files have been submitted successfully for required field check
		 *
		 * @param  el
		 * @param  model
		 * @return {boolean}
		 */
		validateRequired( el, model ) {
			if ( ! model.get( 'firstTouch' ) ) {
				model.set( 'firstTouch', true );
				return true;
			}

			const files = model.get( 'files' );
			if ( typeof files === 'undefined' || ! files.length ) {
				model.set( 'value', '' );
				return false;
			}

			return true;
		},
	} );

	new uploadController();
}( jQuery ) );
