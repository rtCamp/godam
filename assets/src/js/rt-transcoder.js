/**
 * Transcoding status
 *
 * @package transcoder
 */

/* global ajaxurl, transcoding_status */

( function ( $ ) {
	$( document ).ready(
		function () {
			if ( transcoding_status.load_flag ) {
				$( '[name="check_status_btn"]' ).click( function ( e ) {

					var post_id = $( this ).data( 'value' );
					var btn_text = $( '#btn_check_status' + post_id ).text();
					var span_status_element = $( '#span_status' + post_id );
					var check_status_element = $( '#btn_check_status' + post_id );

					span_status_element.text( '' );
					check_status_element.text( 'Checking...' );
					span_status_element.hide();
					check_status_element.prop( 'disabled', true );

					var data = {
						action: 'checkstatus',
						postid: post_id,
						security: transcoding_status.security_nonce
					};

					jQuery.post( ajaxurl, data, function ( response ) {

						var obj = jQuery.parseJSON( response.replace( /&quot;/g, '"' ) );

						if ( 'Success' === obj.status ) {
							check_status_element.hide();
						}

						span_status_element.text( obj.message );
						span_status_element.show();
						check_status_element.text( btn_text );
						check_status_element.prop( 'disabled', false );
					} );
				} );
			}
		} );
} )( jQuery );
