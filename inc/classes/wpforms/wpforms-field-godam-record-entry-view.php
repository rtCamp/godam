<?php
/**
 * Template/View which is render on the WPForms View Entry page for the GoDAM Video Recorder field.
 *
 * @package GoDAM
 *
 * @since 1.3.0
 */

use RTGODAM\Inc\WPForms\WPForms_Integration_Helper;

$godam_form_id  = absint( $form_data['id'] );
$godam_entry_id = isset( $_GET['entry_id'] ) ? absint( $_GET['entry_id'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
$godam_field_id = absint( $field['id'] );

$godam_attachment_url     = $value; // URL of the saved file, which is under /uploads/godam/wpforms.
$godam_attachment_name    = basename( $value );
$godam_transcoded_url     = WPForms_Integration_Helper::get_transcoded_url( $godam_form_id, $godam_entry_id, $godam_field_id );
$godam_hls_transcoded_url = WPForms_Integration_Helper::get_hls_transcoded_url( $godam_form_id, $godam_entry_id, $godam_field_id );
$godam_transcoded_status  = WPForms_Integration_Helper::get_transcoded_status( $godam_form_id, $godam_entry_id, $godam_field_id );

// Detect if this is an audio file.
$file_type = wp_check_filetype( $godam_attachment_url );
$is_audio  = strpos( $file_type['type'], 'audio' ) !== false;

// Handle .webm audio files.
if ( 'webm' === $file_type['ext'] && godam_is_audio_file_by_name( $godam_attachment_url ) ) {
	$is_audio = true;
}
?>

<div class="godam-video-preview">
	<div class="godam-video-link-wrapper">
		<span><?php esc_html_e( 'URL: ', 'godam' ); ?></span>
		<a
			href="<?php echo esc_url( $godam_attachment_url ); ?>"
			target="_blank"
			class="godam-video-link <?php echo ( empty( $value ) ? 'hidden' : '' ); ?>"
		>
			<div class="godam-video-name"><?php echo esc_html( $godam_attachment_name ); ?></div>
		</a>
	</div>

	<div class="godam-transcoded-url-info">
		<?php if ( 'not_started' === $godam_transcoded_status ) : ?>
			<span class='dashicons dashicons-controls-play'></span><strong><?php esc_html_e( 'Video transcoding process has not started.', 'godam' ); ?></strong>
		<?php elseif ( 'transcoded' === $godam_transcoded_status ) : ?>
			<span class='dashicons dashicons-yes-alt'></span><strong><?php esc_html_e( 'Video saved and transcoded successfully on GoDAM', 'godam' ); ?></strong>
		<?php else : ?>
			<span class='dashicons dashicons-hourglass'></span><strong><?php esc_html_e( 'Video transcoding process is in-progress.', 'godam' ); ?></strong>
		<?php endif; ?>
	</div>

	<?php if ( $is_audio ) : ?>
		<audio controls>
			<?php if ( $godam_transcoded_url ) : ?>
				<source src="<?php echo esc_url( $godam_transcoded_url ); ?>" type="audio/mpeg">
			<?php endif; ?>
			<source src="<?php echo esc_url( $godam_attachment_url ); ?>" type="<?php echo esc_attr( $file_type['type'] ); ?>">
			<?php esc_html_e( 'Your browser does not support the audio element.', 'godam' ); ?>
		</audio>
	<?php else : ?>
		<?php
			$godam_thumbnail_url = ''; // Default empty thumbnail.
			// No need to escape here, the entire template will be returned as strings,
			// which will be later on escaped using wp_kses_post() by WPForms before rendering the field.
			// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			echo force_balance_tags( do_shortcode( "[godam_video poster='{$godam_thumbnail_url}' src='{$godam_attachment_url}' transcoded_url='{$godam_transcoded_url}']" ) );
		?>
	<?php endif; ?>
</div>
