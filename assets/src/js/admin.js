/**
 * Write your JS code here for admin.
 */
/* eslint-disable no-console */
console.log( 'Hello from Features Plugin Admin' );
/* eslint-enable no-console */

/**
 * Internal dependencies
 */
import '../libs/jquery-ui-1.14.1/jquery-ui';

const attachDragevent = () => {
	jQuery( 'li.attachment' ).draggable( {
		cursor: 'move',
		helper( event ) {
			// Get the hovered element
			const hoveredElement = jQuery( event.currentTarget );

			// Get all selected elements
			const selectedElements = jQuery( '.attachments-wrapper li.attachment.selected' );

			// Combine hovered and selected elements
			const elementsToDrag = selectedElements.add( hoveredElement );

			const elementsData = elementsToDrag.map( function() {
				return jQuery( this ).data( 'id' );
			} ).get();

			// Attach data to the helper for use in `drop` event
			hoveredElement.data( 'draggedItems', elementsData );

			// Create the helper div with a custom text
			return jQuery( '<div>' )
				.text( `Moving ${ elementsToDrag.length } item${ elementsToDrag.length > 1 ? 's' : '' }` )
				.css( {
					background: '#333',
					color: '#fff',
					padding: '8px 12px',
					'border-radius': '4px',
					'font-size': '14px',
					'font-weight': 'bold',
					'box-shadow': '0 2px 5px rgba(0,0,0,0.3)',
					'z-index': '1000',
				} );
		},
		opacity: 0.7,
		zIndex: 1000,
		appendTo: 'body',
	} );

	// Make tree items droppable
	jQuery( '.tree-item' ).droppable( {
		accept: 'li.attachment',
		hoverClass: 'droppable-hover',
		tolerance: 'pointer',
		drop( event, ui ) {
			// Retrieve all dragged items
			const draggedItems = ui.draggable.data( 'draggedItems' );

			if ( draggedItems ) {
				const draggedItem = jQuery( this );
				const targetItem = jQuery( event.target );

				assignToFolder( draggedItems, targetItem.data( 'id' ) );

				console.log( 'Dropped on:', targetItem.data( 'id' ) );
			} else {
				console.log( 'No items to drop' );
			}
		},
	} );

	// Add CSS for the hover effect
	jQuery( '<style>' )
		.text( `
			.droppable-hover {
				background: #e0f7fa !important;
				border: 2px dashed #00796b;
			}
		` )
		.appendTo( 'head' );
};

async function assignToFolder( attachmentIds, folderTermId ) {
	const response = await fetch( '/wp-json/media-folders/v1/assign-folder', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-WP-Nonce': wpApiSettings.nonce, // Use wpApiSettings.nonce for authentication
		},
		body: JSON.stringify( {
			attachment_ids: attachmentIds,
			folder_term_id: folderTermId,
		} ),
	} );

	if ( response.ok ) {
		const data = await response.json();
		console.log( 'Success:', data.message );
	} else {
		const error = await response.json();
		console.error( 'Error:', error.message );
	}
}

// Intercept all jQuery Ajax requests
jQuery( document ).ajaxComplete( function( event, jqXHR, ajaxOptions ) {
	// Check the URL or other options if needed
	if ( ajaxOptions.url === '/wp-admin/admin-ajax.php' ) {
		// Handle the response
		const response = jqXHR.responseText; // The raw response as a string
		try {
			// Parse JSON if the response is JSON
			const jsonResponse = JSON.parse( response );
			console.log( 'API Response:', jsonResponse );
			attachDragevent();
		} catch ( e ) {
			console.log( 'Non-JSON Response:', response );
		}
	}
} );

setTimeout( attachDragevent, 500 );

( function() {
	/**
	 * Create a new MediaLibraryTaxonomyFilter we later will instantiate
	 */
	const MediaLibraryTaxonomyFilter = wp.media.view.AttachmentFilters.extend( {
		id: 'media-attachment-taxonomy-filter',

		createFilters() {
			const filters = {};
			// Formats the 'terms' we've included via wp_localize_script()
			_.each( MediaLibraryTaxonomyFilterData.terms || {}, function( value, index ) {
				filters[ value.term_id ] = {
					text: value.name,
					props: {
						// Change this: key needs to be the WP_Query var for the taxonomy
						'media-folder': value.term_id,
					},
				};
			} );
			filters.all = {
				// Change this: use whatever default label you'd like
				text: 'All collections',
				props: {
					// Change this: key needs to be the WP_Query var for the taxonomy
					'media-folder': '',
				},
				priority: 10,
			};
			this.filters = filters;
		},
	} );
	/**
	 * Extend and override wp.media.view.AttachmentsBrowser to include our new filter
	 */
	const AttachmentsBrowser = wp.media.view.AttachmentsBrowser;
	wp.media.view.AttachmentsBrowser = wp.media.view.AttachmentsBrowser.extend( {
		createToolbar() {
			// Make sure to load the original toolbar
			AttachmentsBrowser.prototype.createToolbar.call( this );
			this.toolbar.set( 'MediaLibraryTaxonomyFilter', new MediaLibraryTaxonomyFilter( {
				controller: this.controller,
				model: this.collection.props,
				priority: -75,
			} ).render() );
		},
	} );
}() );

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
