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
$cmm_id        = ! empty( $attributes['cmmId'] ) ? $attributes['cmmId'] : '';
$godam_url     = ! empty( $attributes['godamUrl'] ) ? $attributes['godamUrl'] : '';
$caption       = ! empty( $attributes['caption'] ) ? $attributes['caption'] : '';
$autoplay      = ! empty( $attributes['autoplay'] ) ? 'autoplay' : '';
$loop          = ! empty( $attributes['loop'] ) ? 'loop' : '';
$preload       = ! empty( $attributes['preload'] ) ? esc_attr( $attributes['preload'] ) : 'metadata';

// Handle GoDAM audio directly.
if ( ! empty( $godam_url ) && ! empty( $cmm_id ) ) {
	$audio_src = esc_url( $godam_url );
} elseif ( $attachment_id ) {
	// Handle WordPress media library audio.
	$primary_audio = get_post_meta( $attachment_id, 'rtgodam_transcoded_url', true );
	$backup_audio  = wp_get_attachment_url( $attachment_id );

	if ( ! empty( $primary_audio ) ) {
		$audio_src = esc_url( $primary_audio );
	} elseif ( ! empty( $backup_audio ) ) {
		$audio_src = esc_url( $backup_audio );
	} else {
		return;
	}
} else {
	return;
}

if ( empty( $audio_src ) ) {
	return;
}

?>

<figure <?php echo wp_kses_data( get_block_wrapper_attributes() ); ?>>
	<audio controls src="<?php echo esc_url( $audio_src ); ?>" <?php echo esc_attr( $autoplay ); ?> <?php echo esc_attr( $loop ); ?> preload="<?php echo esc_attr( $preload ); ?>">
		<?php __( 'Your browser does not support the audio element.', 'godam' ); ?>
	</audio>

	<?php if ( $caption ) : ?>
		<figcaption class="wp-element-caption">
			<?php echo wp_kses_post( $caption ); ?>
		</figcaption>
	<?php endif; ?>
</figure>