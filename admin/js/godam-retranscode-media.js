/* global jQuery */

const { __ } = wp.i18n;

jQuery( document ).ready( function( $ ) {
	$( 'select[name^="action"] option:last-child' ).before( '<option value="bulk_retranscode_media">' + __( 'Retranscode Media', 'godam' ) + '</option>' );
} );
