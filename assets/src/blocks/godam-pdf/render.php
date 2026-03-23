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

?>

<figure <?php echo wp_kses_data( get_block_wrapper_attributes() ); ?>>
	<div class="godam-pdf-wrapper" style="height: <?php echo esc_attr( $godam_height ); ?>px;">
		<object
			id="pdfObject"
			type="application/pdf"
			width="100%"
			height="100%"
			data="<?php echo esc_url( $godam_sources[0] ); ?>"
			data-sources="<?php echo esc_attr( wp_json_encode( $godam_sources ) ); ?>"
		>
			<p>
				<?php
				echo wp_kses_post(
					sprintf(
						/* translators: %s: PDF download URL */
						__( 'Your browser does not support PDFs. <a href="%s">Download the PDF</a>.', 'godam' ),
						esc_url( $godam_sources[0] )
					)
				);
				?>
			</p>
		</object>
	</div>

	<?php if ( $godam_caption ) : ?>
		<figcaption class="wp-element-caption">
			<?php echo wp_kses_post( $godam_caption ); ?>
		</figcaption>
	<?php endif; ?>
</figure>
