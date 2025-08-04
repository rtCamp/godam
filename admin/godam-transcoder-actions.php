<?php
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

		$easydam_settings = get_option( 'rtgodam-settings', array() );

		$adaptive_bitrate_enabled = ! empty( $easydam_settings['video']['adaptive_bitrate'] );

		// Determine if the site has a valid API key (i.e., Premium user).
		$api_key = get_option( 'rtgodam-api-key', '' );

		if ( ! empty( $api_key ) ) {
			// Add the transcoded URL field.
			$form_fields['transcoded_url'] = array(
				'label' => __( 'Transcoded CDN URL', 'godam' ),
				'input' => 'html',
				'html'  => sprintf(
					'<input type="text" name="attachments[%d][transcoded_url]" id="attachments-%d-transcoded_url" value="%s" readonly>',
					(int) $post->ID,
					(int) $post->ID,
					esc_url( $transcoded_url )
				),
				'value' => esc_url( $transcoded_url ),
				'helps' => __( 'The URL of the transcoded file is generated automatically and cannot be edited.', 'godam' ),
			);
		} else {
			// Display locked field with upsell message for free users.
			$form_fields['transcoded_url'] = array(
				'label' => __( 'Transcoded CDN URL ', 'godam' ),
				'input' => 'html',
				'html'  => sprintf(
					// translators: %s Message for the locked field.
					'<div class="godam-locked-input-wrapper">
						<input id="attachments-transcoded-url" type="text" value="%s" readonly disabled>
						<span class="godam-lock-icon dashicons dashicons-lock"></span>
					</div>',
					esc_attr__( 'Available in Premium version', 'godam' )
				),
				'value' => '',
				'helps' => sprintf(
					// translators: %1$s URL to the settings page, %2$s API key label.
					__( 'Activate the <a href="%1$s" target="_blank" rel="noopener noreferrer">%2$s</a> to enable transcoding and adaptive bitrate streaming.', 'godam' ),
					esc_url( admin_url( 'admin.php?page=rtgodam_settings#video-settings' ) ),
					esc_html__( 'API key', 'godam' )
				),
			);
		}

		return $form_fields;
	}
}

if ( ! function_exists( 'rtgodam_ab_testing_fields' ) ) {
	
	/**
	 * Add A/B testing fields to the media attachment edit screen.
	 *
	 * @param array  $form_fields An array of attachment form fields.
	 * @param object $post The attachment post object.
	 * @return array The modified array of attachment form fields.
	 */
	function rtgodam_ab_testing_fields( $form_fields, $post ) {
		if ( 'attachment' !== $post->post_type ) {
			return $form_fields;
		}

		if ( ! current_user_can( 'edit_post', $post->ID ) ) {
			return $form_fields;
		}

		// Check if attachment is of type video.
		$mime_type = get_post_mime_type( $post->ID );

		if ( ! preg_match( '/^(video|audio)\//', $mime_type ) ) {
			return $form_fields;
		}

		$enabled = get_post_meta( $post->ID, 'godam_ab_test_enabled', true );
		$enabled = ! empty( $enabled ) && $enabled === '1' ? '1' : '0';

		$api_key = get_option( 'rtgodam-api-key', '' );

		if ( ! empty( $api_key ) ) {
			$form_fields['ab_testing'] = array(
				'label' => __( 'A/B Testing', 'godam' ),
				'input' => 'html',
				'html'  => sprintf(
					'
					<label class="switch">
						<input type="checkbox" name="attachments[%1$d][ab_testing]" value="1" %2$s id="ab-toggle">
						<span class="slider round"></span>
					</label>
					<style>
						.switch {
						position: relative;
						display: inline-block;
						width: 50px;
						height: 24px;
						}
						.switch input { 
						opacity: 0;
						width: 0;
						height: 0;
						}
						.slider {
						position: absolute;
						cursor: pointer;
						top: 0; left: 0; right: 0; bottom: 0;
						background-color: #ccc;
						transition: .4s;
						border-radius: 24px;
						}
						.slider:before {
						position: absolute;
						content: "";
						height: 18px;
						width: 18px;
						left: 3px;
						bottom: 6px;
						background-color: white;
						transition: .4s;
						border-radius: 50%%;
						}
						input:checked + .slider {
						background-color: #2196F3;
						}
						input:checked + .slider:before {
						transform: translateX(26px);
						}
					</style>
					',
					(int) $post->ID,
					checked( $enabled, '1', false )
				),
				'value' => $enabled, // or '0' for off, depending on default
				'helps' => __( 'Starts A/B testing for thumbnails', 'godam' ),
			);
			
		}

		if ( ! empty( $api_key ) && '1' === $enabled ) {
			$duration = get_post_meta( $post->ID, 'godam_ab_test_duration', true );

			$form_fields['ab_testing_duration'] = array(
				'label' => __( 'A/B Testing Duration', 'godam' ),
				'input' => 'html',
				'html'  => sprintf(
					'<div>
						<select name="attachments[%d][ab_testing_duration]" id="attachments-%d-ab_testing_duration">
							<option value="5"%s>5 days</option>
							<option value="7"%s>7 days</option>
							<option value="15"%s>15 days</option>
							<option value="30"%s>30 days</option>
							<option value="60"%s>60 days</option>
							<option value="90"%s>90 days</option>
						</select>
					</div>',
					(int) $post->ID,
					(int) $post->ID,
					selected( $duration, '5', false ),
					selected( $duration, '7', false ),
					selected( $duration, '15', false ),
					selected( $duration, '30', false ),
					selected( $duration, '60', false ),
					selected( $duration, '90', false )
				),
				'value' => $duration,
				'helps' => __( 'Starts A/B testing for thumbnails', 'godam' ),
			);
		}

		return $form_fields;
	}
}

add_filter( 'attachment_fields_to_edit', 'rtgodam_add_transcoded_url_field', 10, 2 );


add_filter( 'attachment_fields_to_edit', 'rtgodam_ab_testing_fields', 10, 2 );


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
}

if ( ! function_exists( 'rtgodam_save_ab_testing_field' ) ) {

	/**
	 * Save the transcoded URL field when the attachment is saved.
	 *
	 * @param array $post The post data for the attachment.
	 * @param array $attachment The attachment data.
	 * @return array The post data for the attachment.
	 */
	function rtgodam_save_ab_testing_field( $post, $attachment ) {
		// Check if adaptive bitrate streaming is enabled.
		$easydam_settings = get_option( 'rtgodam-settings', array() );
	
		// $ab_testing_enabled = ! empty( $easydam_settings['video']['rtgodam_ab_testing'] );
	
		// if ( ! $ab_testing_enabled ) {
		// return $post;
		// }
	
		// Check the user's permissions.
		if ( ! current_user_can( 'edit_post', $post['ID'] ) ) {
			return $post;
		}

		static $is_saving = false;

		if ( $is_saving ) {
			return $post; // Prevent recursion.
		}

		$is_saving = true;

		if ( isset( $attachment['ab_testing'] ) ) {
			$enabled = ! empty( $attachment['ab_testing'] ) && $attachment['ab_testing'] === '1' ? '1' : '0';
			// Update the post meta with the new value.
			if ( get_post_meta( $post['ID'], 'godam_ab_test_enabled', true ) !== $enabled ) {
				update_post_meta( $post['ID'], 'godam_ab_test_enabled', '1' );
			}
		} else {
			delete_post_meta( $post['ID'], 'godam_ab_test_enabled' );
		}

		if ( isset( $attachment['ab_testing'] ) && $attachment['ab_testing'] && isset( $attachment['ab_testing_duration'] ) && '1' === $attachment['ab_testing_duration'] ) {
			// Update the post meta with the new value.
			update_post_meta( $post['ID'], 'godam_ab_test_duration', sanitize_text_field( $attachment['ab_testing_duration'] ) );
		}

		$is_saving = false;
	
		return $post;
	}
}

add_filter( 'attachment_fields_to_save', 'rtgodam_save_ab_testing_field', 10, 2 );

add_filter( 'attachment_fields_to_save', 'rtgodam_save_transcoded_url_field', 10, 2 );


if ( ! function_exists( 'rtgodam_register_transcoded_url_meta' ) ) {

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
}

add_action( 'init', 'rtgodam_register_transcoded_url_meta' );

if ( ! function_exists( 'godam_register_ab_test_meta' ) ) {

	function godam_register_ab_test_meta() {
		register_post_meta(
			'attachment',
			'godam_ab_test_enabled',
			array(
				'type'          => 'boolean',
				'show_in_rest'  => true,
				'single'        => true,
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
			) 
		);
	
		register_post_meta(
			'attachment',
			'godam_ab_test_thumbs',
			array(
				'type'          => 'array',
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
			) 
		);
	
		register_post_meta(
			'attachment',
			'godam_ab_test_duration',
			array(
				'type'          => 'integer',
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
			) 
		);
	}
}

add_action( 'init', 'godam_register_ab_test_meta' );



if ( ! function_exists( 'rtgodam_rtt_set_video_thumbnail' ) ) {

	/**
	 * Set the video thumbnail
	 *
	 * @since   1.0.0
	 *
	 * @param number $id rtMedia activity ID.
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
			$model->update( array( 'cover_art' => $final_file_url ), array( 'id' => intval( $id ) ) );
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
			$media = $model->get( array( 'media_id' => $attachment_id ) );
	
			if ( ! empty( $media ) && ! empty( $media[0] ) ) {
				$attachment_id = $media[0]->media_id;
				$media_type    = $media[0]->media_type;
				$cover_art     = $media[0]->cover_art;
	
				if ( 'video' === $media_type && empty( $cover_art ) && ! empty( $thumb_url ) ) {
					$model->update( array( 'cover_art' => $thumb_url ), array( 'media_id' => $attachment_id ) );
				}
			}
		}
	}
}

add_action( 'rtgodam_transcoded_thumb_added', 'rtgodam_rtt_update_wp_media_thumbnail', 10, 2 );
