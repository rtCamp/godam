<?php
/**
 * Template/View which is render on the WPForms View Entry page for the GoDAM Video Recorder field.
 *
 * @package GoDAM
 *
 * @since 1.3.0
 */

use RTGODAM\Inc\WPForms\WPForms_Integration_Helper;

$form_id  = absint( $form_data['id'] );
$entry_id = isset( $_GET['entry_id'] ) ? absint( $_GET['entry_id'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
$field_id = absint( $field['id'] );

$attachment_url     = $value; // URL of the saved file, which is under /uploads/godam/wpforms.
$attachment_name    = basename( $value );
$transcoded_url     = WPForms_Integration_Helper::get_transcoded_url( $form_id, $entry_id, $field_id );
$hls_transcoded_url = WPForms_Integration_Helper::get_hls_transcoded_url( $form_id, $entry_id, $field_id );
$transcoded_status  = WPForms_Integration_Helper::get_transcoded_status( $form_id, $entry_id, $field_id );


$recorder_url = add_query_arg(
	array(
		'form_id'  => $form_id,
		'entry_id' => $entry_id,
		'field_id' => $field_id,
	),
	site_url( '/godam-recorder/' )
);
?>

<div class="godam-video-preview">
	<div class="godam-video-link-wrapper">
		<span><?php esc_html_e( 'URL: ', 'godam' ); ?></span>
		<a
			href="<?php echo esc_url( $recorder_url ); ?>"
			target="_blank"
			class="godam-video-link <?php echo ( empty( $value ) ? 'hidden' : '' ); ?>"
		>
			<div class="godam-video-name"><?php echo esc_html( $attachment_name ); ?></div>
		</a>
	</div>

	<div class="godam-transcoded-url-info">
		<?php if ( 'not_started' === $transcoded_status ) : ?>
			<span class='dashicons dashicons-controls-play'></span><strong><?php esc_html_e( 'Video transcoding process has not started.', 'godam' ); ?></strong>
		<?php elseif ( 'transcoded' === $transcoded_status ) : ?>
			<span class='dashicons dashicons-yes-alt'></span><strong><?php esc_html_e( 'Video saved and transcoded successfully on GoDAM', 'godam' ); ?></strong>
		<?php else : ?>
			<span class='dashicons dashicons-hourglass'></span><strong><?php esc_html_e( 'Video transcoding process is in-progress.', 'godam' ); ?></strong>
		<?php endif; ?>
	</div>

	<?php
		// No need to escape here, the entire template will be returned as strings,
		// which will be later on escaped using wp_kses_post() by WPForms before rendering the field.
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo force_balance_tags( do_shortcode( "[godam_video poster='{$thumbnail_url}' src='{$attachment_url}' transcoded_url='{$transcoded_url}']" ) );
	?>
</div>
