/**
 * Internal dependencies
 */
import './controls/godam-media';

/**
 * Make specific SEO fields read-only in the GoDAM Video widget.
 */
window.addEventListener( 'load', function() {
	if ( typeof elementor === 'undefined' ) {
		return;
	}

	const readonlyFields = [
		'seo_content_url',
		'seo_content_upload_date',
		'seo_content_duration',
		'seo_content_video_thumbnail_url',
	];

	const makeFieldsReadonly = function() {
		readonlyFields.forEach( function( fieldName ) {
			const fields = document.querySelectorAll(
				'[data-setting="' + fieldName + '"]',
			);
			fields.forEach( function( field ) {
				field.setAttribute( 'readonly', 'readonly' );
				field.classList.add( 'godam-readonly-field' );
			} );
		} );
	};

	// Run when panel is opened or widget is selected
	window?.elementor.hooks.addAction(
		'panel/open_editor/widget/godam-video',
		function() {
			setTimeout( makeFieldsReadonly, 100 );
		},
	);

	// Also run on popover toggle changes
	document.addEventListener( 'click', function( event ) {
		if ( event.target.closest( '.elementor-control-seo_settings_popover_toggle' ) ) {
			setTimeout( makeFieldsReadonly, 200 );
		}
	} );
} );
