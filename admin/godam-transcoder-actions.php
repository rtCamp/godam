<?php
/**
 * Transcoder actions.
 *
 * @since      1.0.7
 *
 * @package    Transcoder
 * @subpackage Transcoder/Actions
 */

defined( 'ABSPATH' ) || exit;


/**
 * Add a field for the transcoded URL to the media attachment edit screen.
 *
 * @param array  $form_fields An array of attachment form fields.
 * @param object $post The attachment post object.
 * @return array The modified array of attachment form fields.
 */
function rtgodam_add_transcoded_url_field( $form_fields, $post ) {

	// Check if post is of type attachment.
	if ( 'attachment' !== $post->post_type ) {
		return $form_fields;
	}

	// Check if attachment is of type video.
	$mime_type = get_post_mime_type( $post->ID );

	if ( ! preg_match( '/^video\//', $mime_type ) ) {
		return $form_fields;
	}

	$transcoded_url = get_post_meta( $post->ID, 'rtgodam_transcoded_url', true );

	$easydam_settings = get_option( 'rtgodam-settings', array() );

	$adaptive_bitrate_enabled = ! empty( $easydam_settings['video']['adaptive_bitrate'] );

	// Add the transcoded URL field.
	$form_fields['transcoded_url'] = array(
		'label' => __( 'Transcoded CDN URL', 'godam' ),
		'input' => 'html',
		'html'  => '<input type="text" name="attachments[' . $post->ID . '][transcoded_url]" id="attachments-' . $post->ID . '-transcoded_url" value="' . esc_url( $transcoded_url ) . '" readonly>',
		'value' => esc_url( $transcoded_url ),
		'helps' => __( 'The URL of the transcoded file is generated automatically and cannot be edited.', 'godam' ),
	);

	return $form_fields;
}

add_filter( 'attachment_fields_to_edit', 'rtgodam_add_transcoded_url_field', 10, 2 );

/**
 * Save the transcoded URL field when the attachment is saved.
 *
 * @param array $post The post data for the attachment.
 * @param array $attachment The attachment data.
 * @return array The post data for the attachment.
 */
function rtgodam_save_transcoded_url_field( $post, $attachment ) {
	// Check if adaptive bitrate streaming is enabled.
	$easydam_settings = get_option( 'rtgodam-settings', array() );

	$adaptive_bitrate_enabled = ! empty( $easydam_settings['video']['adaptive_bitrate'] );

	if ( ! $adaptive_bitrate_enabled ) {
		return $post;
	}

	if ( isset( $attachment['transcoded_url'] ) ) {
		// Check the user's permissions.
		if ( ! current_user_can( 'edit_post', $post['ID'] ) ) {
			return $post;
		}
		// Update the post meta with the new value.
		update_post_meta( $post['ID'], 'rtgodam_transcoded_url', esc_url_raw( $attachment['transcoded_url'] ) );
	}

	return $post;
}

add_filter( 'attachment_fields_to_save', 'rtgodam_save_transcoded_url_field', 10, 2 );

/**
 * Register the transcoded URL meta field.
 */
function rtgodam_register_transcoded_url_meta() {
	register_post_meta(
		'attachment',
		'rtgodam_transcoded_url',
		array(
			'type'          => 'string',
			'single'        => true,
			'show_in_rest'  => true,
			'auth_callback' => function () {
				return current_user_can( 'edit_posts' );
			},
		)
	);
}

add_action( 'init', 'rtgodam_register_transcoded_url_meta' );
