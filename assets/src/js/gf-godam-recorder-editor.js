/* global jQuery */

jQuery( document ).on( 'gform_load_field_settings', function( event, field ) {
	// Hide or show the video field settings based on field type.
	const isGodamVideoField = field.type === 'godam_record';
	jQuery( '.godam-video-field-setting' ).toggle( isGodamVideoField );

	if ( isGodamVideoField ) {
		// Set the checkbox values based on field settings.
		const fileSelectors = field.godamVideoFileSelectors || [ 'webcam', 'screen_capture' ];

		// Reset all checkboxes first.
		jQuery( 'input[name="field_godam_video_file_selector"]' ).prop( 'checked', false );

		// Check the appropriate boxes.
		jQuery.each( fileSelectors, function( index, value ) {
			jQuery( '#field_godam_video_file_selector_' + value ).prop( 'checked', true );
		} );
	}
} );

// Save the settings when changed.
jQuery( document ).ready( function() {
	jQuery( 'input[name="field_godam_video_file_selector"]' ).on( 'change', function() {
		let selectedSelectors = [];

		jQuery( 'input[name="field_godam_video_file_selector"]:checked' ).each( function() {
			selectedSelectors.push( jQuery( this ).val() );
		} );

		// Ensure at least one selector is selected.
		if ( selectedSelectors.length === 0 ) {
			jQuery( '#field_godam_video_file_selector_webcam' ).prop( 'checked', true );
			jQuery( '#field_godam_video_file_selector_screen_capture' ).prop( 'checked', true );
			selectedSelectors = [ 'webcam', 'screen_capture' ];
		}

		// Save to the field.
		if ( typeof SetFieldProperty === 'function' ) {
			// eslint-disable-next-line no-undef
			SetFieldProperty( 'godamVideoFileSelectors', selectedSelectors );
		}
	} );
} );
