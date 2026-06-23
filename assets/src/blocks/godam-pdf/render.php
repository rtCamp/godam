<?php
/**
 * Render template for the GoDAM PDF Block.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$godam_attachment_id = ! empty( $attributes['id'] ) ? ( is_numeric( $attributes['id'] ) ? intval( $attributes['id'] ) : sanitize_text_field( $attributes['id'] ) ) : null;
$godam_caption       = ! empty( $attributes['caption'] ) ? $attributes['caption'] : '';
$godam_height        = ! empty( $attributes['height'] ) ? intval( $attributes['height'] ) : 600;
$godam_src           = ! empty( $attributes['src'] ) ? esc_url( $attributes['src'] ) : '';

if ( ! $godam_attachment_id && empty( $godam_src ) ) {
	return;
}

$godam_sources = array();
if ( ! empty( $godam_attachment_id ) && is_numeric( $godam_attachment_id ) ) { 
	$godam_pdf_url            = wp_get_attachment_url( $godam_attachment_id );
	$godam_pdf_transcoded_url = get_post_meta( $godam_attachment_id, 'rtgodam_transcoded_url', true );
	if ( ! empty( $godam_pdf_transcoded_url ) ) {
		$godam_sources[] = $godam_pdf_transcoded_url;
	}
	if ( ! empty( $godam_pdf_url ) ) {
		$godam_sources[] = $godam_pdf_url;
	}
} else {
	$godam_sources[] = $godam_src;
}

if ( empty( $godam_sources ) ) {
	return;
}

require RTGODAM_PATH . 'inc/templates/godam-pdf.php';
