<?php
/**
 * The transcoder-specific functionality of the plugin.
 *
 * @since   1.0.0
 *
 * @package GoDAM
 * @subpackage GoDAM/TranscoderHandler
 */

defined( 'ABSPATH' ) || exit;

/**
 * Handle request/response with trancoder api.
 *
 * @since   1.0.0
 *
 * @package GoDAM
 * @subpackage GoDAM/TranscoderHandler
 */
class RTGODAM_Media_Version {
	/**
	 * Constructor.
	 *
	 * @since 1.0.0
	 */
	public function __construct() {
		add_filter( 'attachment_fields_to_edit', array( $this, 'rtgodam_add_attachment_version_field' ), 10, 2 );
		add_filter( 'wp_prepare_attachment_for_js', array( $this, 'rtgodam_update_media_versions' ), 10, 3 );
		add_action( 'add_attachment', array( $this, 'rtgodam_create_media_versions' ), 10 );
	}

	public function rtgodam_add_attachment_version_field( $form_fields, $post ) {
		$form_fields['replace_media'] = array(
			'label'        => __( 'Replace Media', 'godam' ),
			'input'        => 'html',
			'html'         => sprintf(
				'<a href="#" data-post-id="%1$s" class="button button-secondary" id="rtgodam-replace-media-button">%2$s</a>',
				esc_attr( $post->ID ),
				__( 'Replace Media', 'godam' )
			),
			'value'        => '',
			'show_in_edit' => false,
		);
		return $form_fields;
	}

	public function rtgodam_create_media_versions( $attachment_id ) {

		$origin_post_id = filter_input( INPUT_POST, 'origin_post_id', FILTER_VALIDATE_INT );
		$origin_post_id = wp_unslash( sanitize_text_field( $origin_post_id ) );

		if ( empty( $origin_post_id ) ) {
			return;
		}

		add_post_meta( $attachment_id, 'rtgodam_is_attachment_version', 'yes' );
		$origin_post_versions = get_post_meta( $origin_post_id, 'rtgodam_media_versions', true );
		$origin_post_versions = is_array( $origin_post_versions ) ? $origin_post_versions : array();
		if ( in_array( $attachment_id, $origin_post_versions, true ) ) {
			return;
		}

		$origin_post_versions[] = $attachment_id;
		update_post_meta( $origin_post_id, 'rtgodam_media_versions', $origin_post_versions );
	}

	public function rtgodam_update_media_versions( $response, $attachment, $meta ) {

		$rtgodam_is_attachment_version = get_post_meta( $attachment->ID, 'rtgodam_is_attachment_version', true );
		if ( empty( $rtgodam_is_attachment_version ) || 'yes' !== $rtgodam_is_attachment_version ) {
			return $response;
		}

		$attachment_id = wp_update_post(
			array(
				'ID'        => $attachment->ID,
				'post_type' => 'attachment-version',
			)
		);

		if ( is_wp_error( $attachment_id ) ) {
			return new WP_Error( 'failed_to_create_attachment_version', __( 'Failed to create attachment version', 'godam' ) );
		}

		return $response;
	}
}
