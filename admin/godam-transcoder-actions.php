<?php

declare(strict_types = 1);

/**
 * Transcoder actions.
 *
 * @since      1.0.7
 *
 * @package GoDAM
 * @subpackage GoDAM/Actions
 */

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'rtgodam_add_transcoded_url_field' ) ) {

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

		if ( ! preg_match( '/^(video|audio)\//', $mime_type ) ) {
			return $form_fields;
		}

		$transcoded_url = get_post_meta( $post->ID, 'rtgodam_transcoded_url', true );

		$easydam_settings = get_option( 'rtgodam-settings', [] );

		$adaptive_bitrate_enabled = ! empty( $easydam_settings['video']['adaptive_bitrate'] );

		// Add the transcoded URL field.
		$form_fields['transcoded_url'] = [
			'label' => __( 'Transcoded CDN URL', 'godam' ),
			'input' => 'html',
			'html'  => '<input type="text" name="attachments[' . $post->ID . '][transcoded_url]" id="attachments-' . $post->ID . '-transcoded_url" value="' . esc_url( $transcoded_url ) . '" readonly>',
			'value' => esc_url( $transcoded_url ),
			'helps' => __( 'The URL of the transcoded file is generated automatically and cannot be edited.', 'godam' ),
		];

		return $form_fields;
	}
}

add_filter( 'attachment_fields_to_edit', 'rtgodam_add_transcoded_url_field', 10, 2 );


if ( ! function_exists( 'rtgodam_save_transcoded_url_field' ) ) {

	/**
	 * Save the transcoded URL field when the attachment is saved.
	 *
	 * @param array $post The post data for the attachment.
	 * @param array $attachment The attachment data.
	 * @return array The post data for the attachment.
	 */
	function rtgodam_save_transcoded_url_field( $post, $attachment ) {
		// Check if adaptive bitrate streaming is enabled.
		$easydam_settings = get_option( 'rtgodam-settings', [] );

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
}

add_filter( 'attachment_fields_to_save', 'rtgodam_save_transcoded_url_field', 10, 2 );


if ( ! function_exists( 'rtgodam_register_transcoded_url_meta' ) ) {

	/**
	 * Register the transcoded URL meta field.
	 */
	function rtgodam_register_transcoded_url_meta() {
		register_post_meta(
			'attachment',
			'rtgodam_transcoded_url',
			[
				'type'          => 'string',
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => static function () {
					return current_user_can( 'edit_posts' );
				},
			]
		);
	}
}

add_action( 'init', 'rtgodam_register_transcoded_url_meta' );



if ( ! function_exists( 'rtgodam_rtt_set_video_thumbnail' ) ) {

	/**
	 * Set the video thumbnail
	 *
	 * @since   1.0.0
	 *
	 * @param \number $id rtMedia activity ID.
	 */
	function rtgodam_rtt_set_video_thumbnail( $id ) {
		$media_type    = rtmedia_type( $id );
		$attachment_id = rtmedia_media_id( $id );      // Get the wp attachment ID.
		$thumbnail     = rtgodam_filter_input( INPUT_POST, 'rtmedia-thumbnail', FILTER_SANITIZE_URL );
		if ( 'video' === $media_type && ! empty( $thumbnail ) ) {
			if ( ! is_numeric( $thumbnail ) ) {
				$file_url = $thumbnail;
				/* for WordPress backward compatibility */
				if ( function_exists( 'wp_get_upload_dir' ) ) {
					$uploads = wp_get_upload_dir();
				} else {
					$uploads = wp_upload_dir();
				}
				if ( 0 === strpos( $file_url, $uploads['baseurl'] ) ) {
					$final_file_url = $file_url;
				} else {
					$final_file_url = $uploads['baseurl'] . '/' . $file_url;
				}

				$final_file_url = apply_filters( 'transcoded_file_url', $final_file_url, $attachment_id );

				update_post_meta( $attachment_id, '_rt_media_video_thumbnail', $thumbnail );
			}

			$model = new RTMediaModel();
			$model->update( [ 'cover_art' => $final_file_url ], [ 'id' => intval( $id ) ] );
			rtt_update_activity_after_thumb_set( $id );
		}
	}
}

add_action( 'rtmedia_after_update_media', 'rtgodam_rtt_set_video_thumbnail', 12 );


if ( ! function_exists( 'rtgodam_rtt_update_wp_media_thumbnail' ) ) {

	/**
	 * Set the cover art/video thumbnail for the videos which are not uploaded from the rtMedia activity
	 *
	 * @since 1.0.7
	 * @param string $thumb_url     Video thumbnail URL.
	 * @param int    $attachment_id Attachment ID of the media/video for which thumbnail has to be set.
	 */
	function rtgodam_rtt_update_wp_media_thumbnail( $thumb_url, $attachment_id ) {
		if ( class_exists( 'RTMediaModel' ) ) {
			$model = new RTMediaModel();
			$media = $model->get( [ 'media_id' => $attachment_id ] );

			if ( ! empty( $media ) && ! empty( $media[0] ) ) {
				$attachment_id = $media[0]->media_id;
				$media_type    = $media[0]->media_type;
				$cover_art     = $media[0]->cover_art;

				if ( 'video' === $media_type && empty( $cover_art ) && ! empty( $thumb_url ) ) {
					$model->update( [ 'cover_art' => $thumb_url ], [ 'media_id' => $attachment_id ] );
				}
			}
		}
	}
}

add_action( 'rtgodam_transcoded_thumb_added', 'rtgodam_rtt_update_wp_media_thumbnail', 10, 2 );
