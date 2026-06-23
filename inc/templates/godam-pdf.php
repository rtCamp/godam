<?php
/**
 * Render template for the GoDAM PDF.
 *
 * Shared by Gutenberg block and Elementor widget.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( empty( $godam_sources ) ) {
	return;
}
?>

<figure <?php echo empty( $is_elementor_widget ) ? wp_kses_data( get_block_wrapper_attributes() ) : ''; ?>>
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