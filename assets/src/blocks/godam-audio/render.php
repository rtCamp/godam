<?php
/**
 * Render template for the GoDAM Audio Block.
 *
 * @since 1.0.4
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
$godam_audio_title   = ! empty( $attributes['audioTitle'] ) ? $attributes['audioTitle'] : '';
$godam_description   = ! empty( $attributes['description'] ) ? $attributes['description'] : '';
$godam_thumbnail     = ! empty( $attributes['thumbnail'] ) ? esc_url( $attributes['thumbnail'] ) : '';

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

<figure data-test-id="godam-audio-render" <?php echo wp_kses_data( get_block_wrapper_attributes() ); ?>>
	<div class="godam-audio-card">

		<?php /* Thumbnail */ ?>
		<div class="godam-audio-card__cover" data-test-id="godam-audio-render-cover">
			<?php if ( $godam_thumbnail ) : ?>
				<img
					src="<?php echo esc_url( $godam_thumbnail ); ?>"
					alt="<?php echo esc_attr( $godam_audio_title ? $godam_audio_title : __( 'Audio thumbnail', 'godam' ) ); ?>"
				/>
			<?php else : ?>
				<div class="godam-audio-card__cover-placeholder">
					<span class="dashicons dashicons-media-audio"></span>
				</div>
			<?php endif; ?>
		</div>

		<?php /* Info + player */ ?>
		<div class="godam-audio-card__body">
			<?php if ( $godam_audio_title ) : ?>
				<p class="godam-audio-card__title" data-test-id="godam-audio-render-title"><?php echo esc_html( $godam_audio_title ); ?></p>
			<?php endif; ?>

			<?php if ( $godam_description ) : ?>
				<p class="godam-audio-card__description" data-test-id="godam-audio-render-description"><?php echo esc_html( $godam_description ); ?></p>
			<?php endif; ?>

			<audio
				class="godam-audio-card__player"
				data-test-id="godam-audio-render-player"
				controls
				<?php echo esc_attr( $godam_autoplay ); ?>
				<?php echo esc_attr( $godam_loop ); ?>
				preload="<?php echo esc_attr( $godam_preload ); ?>"
			>
				<?php if ( ! empty( $godam_primary_audio ) ) : ?>
					<source src="<?php echo esc_url( $godam_primary_audio ); ?>" type="audio/mpeg" />
				<?php endif; ?>

				<?php if ( ! empty( $godam_backup_audio ) ) : ?>
					<source src="<?php echo esc_url( $godam_backup_audio ); ?>" type="audio/mpeg" />
				<?php endif; ?>

				<?php esc_html_e( 'Your browser does not support the audio element.', 'godam' ); ?>
			</audio>
		</div>

	</div>

	<?php if ( $godam_caption ) : ?>
		<figcaption class="wp-element-caption">
			<?php echo wp_kses_post( $godam_caption ); ?>
		</figcaption>
	<?php endif; ?>
</figure>
