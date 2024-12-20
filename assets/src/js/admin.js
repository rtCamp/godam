/**
 * Write your JS code here for admin.
 */
/* eslint-disable no-console */
console.log( 'Hello from Features Plugin Admin' );
/* eslint-enable no-console */



// const TextAreaFilter = wp.media.View.extend( {
// 	tagName: 'textarea',
// 	className: 'attachment-textarea-filter',
// 	id: 'media-attachment-textarea-filter',

// 	events: {
// 		input: 'onInputChange',
// 	},

// 	initialize() {
// 		console.log( 'TextAreaFilter initialized' );
// 		// Set up an initial value for the textarea if it's provided in the model.
// 		const initialValue = this.model.get( 'customText' ) || '';
// 		this.$el.val( initialValue );

// 		// Listen to model changes and update the textarea value.
// 		this.listenTo( this.model, 'change:customText', this.updateValue );
// 	},

// 	/**
// 	 * Event handler for `input` event on the textarea.
// 	 */
// 	onInputChange() {
// 		console.log( 'Input changed' );
// 		const value = this.$el.val();

// 		// Update the model only if the value has changed to avoid recursion.
// 		if ( this.model.get( 'customText' ) !== value ) {
// 			this.model.set( 'customText', value );
// 		}
// 	},

// 	/**
// 	 * Updates the textarea value when the model changes.
// 	 */
// 	updateValue() {
// 		console.log( 'Model changed' );
// 		const value = this.model.get( 'customText' );

// 		// Update the textarea only if the value has changed to avoid recursion.
// 		if ( this.$el.val() !== value ) {
// 			this.$el.val( value );
// 		}
// 	},
// } );

// // Example usage: Attach the TextAreaFilter to the WordPress Media Library UI.
// wp.media.view.AttachmentsBrowser = wp.media.view.AttachmentsBrowser.extend( {
// 	createToolbar() {
// 		wp.media.view.AttachmentsBrowser.prototype.createToolbar.apply( this, arguments );

// 		// Add the textarea filter to the toolbar.
// 		this.toolbar.set( 'textareaFilter', new TextAreaFilter( {
// 			model: this.collection.props, // Attach the filter to the attachment query props.
// 		} ) );
// 	},
// } );
