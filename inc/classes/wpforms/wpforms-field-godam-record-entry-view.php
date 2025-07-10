<?php
/**
 * Template/View which is render on the WPForms View Entry page for the GoDAM Video Recorder field.
 *
 * @package GoDAM
 *
 * @since n.e.x.t
 */

$attachment_url                  = wp_get_attachment_url( $value );
$attachment_name                 = $attachment->post_title;
$thumbnail_url                   = wp_get_attachment_thumb_url( $attachment );
$transcoded_url                  = rtgodam_get_transcoded_url_from_attachment( $attachment );
$transcoded_status               = rtgodam_get_transcoded_status_from_attachment( $attachment );
$transcoded_status_error_message = rtgodam_get_transcoded_error_message_from_attachment( $attachment );
?>

<div class="godam-video-preview">
	<?php
		// No need to escape here, the entire template will be returned as strings,
		// which will be later on escaped using wp_kses_post() by WPForms before rendering the field.
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo force_balance_tags( do_shortcode( "[godam_video poster='{$thumbnail_url}' src='{$attachment_url}' transcoded_url='{$transcoded_url}']" ) );
	?>
	<div class="godam-video-link-wrapper">
		<span><?php esc_html_e( 'URL: ', 'godam' ); ?></span>
		<a
			href="<?php echo esc_url( $attachment_url ); ?>"
			target="_blank"
			class="godam-video-link <?php echo ( empty( $value ) ? 'hidden' : '' ); ?>"
		>
			<div class="godam-video-name"><?php echo esc_html( $attachment_name ); ?></div>
		</a>
	</div>
	<div class="godam-transcoded-url-info">
	<?php if ( empty( $transcoded_status_error_message ) ) : ?>
		<?php if ( 'not_started' === $transcoded_status ) : ?>
			<span class='dashicons dashicons-controls-play'></span><strong><?php esc_html_e( 'Video transcoding process has not started.', 'godam' ); ?></strong>
		<?php elseif ( 'transcoded' === $transcoded_status ) : ?>
			<span class='dashicons dashicons-yes-alt'></span><strong><?php esc_html_e( 'Video saved and transcoded successfully on GoDAM', 'godam' ); ?></strong>
		<?php else : ?>
			<span class='dashicons dashicons-hourglass'></span><strong><?php esc_html_e( 'Video transcoding process is in-progress.', 'godam' ); ?></strong>
		<?php endif; ?>
	<?php else : ?>
		<span class='dashicons dashicons-controls-play'></span><strong><?php echo esc_html( $transcoded_status_error_message ); ?></strong>
	<?php endif; ?>
	</div>
</div>
