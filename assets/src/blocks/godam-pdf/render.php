<?php
/**
 * Render template for the GoDAM PDF Block.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$attachment_id = ! empty( $attributes['id'] ) ? intval( $attributes['id'] ) : null;
$caption       = ! empty( $attributes['caption'] ) ? $attributes['caption'] : '';
$height        = ! empty( $attributes['height'] ) ? intval( $attributes['height'] ) : 600;

if ( ! $attachment_id ) {
	return;
}

$pdf_url            = wp_get_attachment_url( $attachment_id );
$pdf_transcoded_url = get_post_meta( $attachment_id, 'rtgodam_transcoded_url', true );

$sources = array();
if ( ! empty( $pdf_transcoded_url ) ) {
	$sources[] = $pdf_transcoded_url;
}
if ( ! empty( $pdf_url ) ) {
	$sources[] = $pdf_url;
}

?>

<figure <?php echo wp_kses_data( get_block_wrapper_attributes() ); ?>>
	<div class="godam-pdf-wrapper" style="height: <?php echo esc_attr( $height ); ?>px;">
		<object
			id="pdfObject"
			type="application/pdf"
			width="100%"
			height="100%"
			data="<?php echo esc_url( $sources[0] ); ?>"
			data-sources="<?php echo esc_attr( wp_json_encode( $sources ) ); ?>"
		>
			<p>
				<?php
				echo wp_kses_post(
					sprintf(
						/* translators: %s: PDF download URL */
						__( 'Your browser does not support PDFs. <a href="%s">Download the PDF</a>.', 'godam' ),
						esc_url( $sources[0] )
					)
				);
				?>
			</p>
		</object>
	</div>

	<?php if ( $caption ) : ?>
		<figcaption class="wp-element-caption">
			<?php echo wp_kses_post( $caption ); ?>
		</figcaption>
	<?php endif; ?>
</figure>
