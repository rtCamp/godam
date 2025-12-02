<?php
/**
 * Render template for the GoDAM Audio Block.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$godam_attachment_id = ! empty( $attributes['id'] ) ? intval( $attributes['id'] ) : null;
$godam_src           = ! empty( $attributes['src'] ) ? esc_url( $attributes['src'] ) : '';
$godam_caption       = ! empty( $attributes['caption'] ) ? $attributes['caption'] : '';
$godam_autoplay      = ! empty( $attributes['autoplay'] ) ? 'autoplay' : '';
$godam_loop          = ! empty( $attributes['loop'] ) ? 'loop' : '';
$godam_preload       = ! empty( $attributes['preload'] ) ? esc_attr( $attributes['preload'] ) : 'metadata';


if ( ! $godam_attachment_id && empty( $godam_src ) ) {
	return;
}

if ( ! $godam_attachment_id && ! empty( $godam_src ) ) {
	// Virtual attachment scenario.
	$godam_primary_audio = $godam_src;
	$godam_backup_audio  = '';
} else {
	$godam_primary_audio = get_post_meta( $godam_attachment_id, 'rtgodam_transcoded_url', true );
	$godam_backup_audio  = wp_get_attachment_url( $godam_attachment_id );

	if ( empty( $godam_primary_audio ) && empty( $godam_backup_audio ) ) {
		return;
	}
}

?>

<figure <?php echo wp_kses_data( get_block_wrapper_attributes() ); ?>>
	<audio controls <?php echo esc_attr( $godam_autoplay ); ?> <?php echo esc_attr( $godam_loop ); ?> preload="<?php echo esc_attr( $godam_preload ); ?>">
		<?php if ( ! empty( $godam_primary_audio ) ) : ?>
			<source src="<?php echo esc_url( $godam_primary_audio ); ?>" type="audio/mpeg" />
		<?php endif; ?>

		<?php if ( ! empty( $godam_backup_audio ) ) : ?>
			<source src="<?php echo esc_url( $godam_backup_audio ); ?>" type="audio/mpeg" />
		<?php endif; ?>

		<?php esc_html_e( 'Your browser does not support the audio element.', 'godam' ); ?>
	</audio>

	<?php if ( $godam_caption ) : ?>
		<figcaption class="wp-element-caption">
			<?php echo wp_kses_post( $godam_caption ); ?>
		</figcaption>
	<?php endif; ?>
</figure>