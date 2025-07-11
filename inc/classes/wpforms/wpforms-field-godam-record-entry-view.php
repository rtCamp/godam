<?php
/**
 * Template/View which is render on the WPForms View Entry page for the GoDAM Video Recorder field.
 *
 * @package GoDAM
 *
 * @since n.e.x.t
 */

$attachment_url                  = $value; // URL of the saved file, which is under /uploads/godam/wpforms
$attachment_name                 = basename( $value );
$transcoded_url                  = '';
$transcoded_status               = '';
$transcoded_status_error_message = '';
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
