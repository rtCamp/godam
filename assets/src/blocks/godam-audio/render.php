<?php
/**
 * Render template for the GoDAM Audio Block.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$attachment_id = ! empty( $attributes['id'] ) ? intval( $attributes['id'] ) : null;
$caption       = ! empty( $attributes['caption'] ) ? $attributes['caption'] : '';
$autoplay      = ! empty( $attributes['autoplay'] ) ? 'autoplay' : '';
$loop          = ! empty( $attributes['loop'] ) ? 'loop' : '';
$preload       = ! empty( $attributes['preload'] ) ? esc_attr( $attributes['preload'] ) : 'metadata';

if ( ! $attachment_id ) {
	return;
}

$primary_audio = get_post_meta( $attachment_id, 'rtgodam_transcoded_url', true );
$backup_audio  = wp_get_attachment_url( $attachment_id );

if ( empty( $primary_audio ) && empty( $backup_audio ) ) {
	return;
}

?>

<figure <?php echo wp_kses_data( get_block_wrapper_attributes() ); ?>>
	<audio controls <?php echo esc_attr( $autoplay ); ?> <?php echo esc_attr( $loop ); ?> preload="<?php echo esc_attr( $preload ); ?>">
		<?php if ( ! empty( $primary_audio ) ) : ?>
			<source src="<?php echo esc_url( $primary_audio ); ?>" type="audio/mpeg" />
		<?php endif; ?>
		
		<?php if ( ! empty( $backup_audio ) ) : ?>
			<source src="<?php echo esc_url( $backup_audio ); ?>" type="audio/mpeg" />
		<?php endif; ?>
		
		<?php __( 'Your browser does not support the audio element.', 'godam' ); ?>
	</audio>

	<?php if ( $caption ) : ?>
		<figcaption class="wp-element-caption">
			<?php echo wp_kses_post( $caption ); ?>
		</figcaption>
	<?php endif; ?>
</figure>
