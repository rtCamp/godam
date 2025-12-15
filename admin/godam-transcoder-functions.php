<?php
/**
 * Transcoder functions.
 *
 * @since      1.0.0
 *
 * @package GoDAM
 * @subpackage GoDAM/Functions
 */

defined( 'ABSPATH' ) || exit;

/**
 * Check whether the file is sent to the transcoder or not.
 *
 * @since   1.0.0
 *
 * @param  number $attachment_id    ID of attachment.
 * @return boolean
 */
function rtgodam_is_file_being_transcoded( $attachment_id ) {
	$job_id = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );
	if ( ! empty( $job_id ) ) {
		$transcoded_files  = get_post_meta( $attachment_id, 'rtgodam_transcoded_url', true );
		$transcoded_thumbs = get_post_meta( $attachment_id, 'rtgodam_media_thumbnails', true );
		if ( empty( $transcoded_files ) && empty( $transcoded_thumbs ) ) {
			return true;
		}
	}
	return false;
}

/**
 * Retrieve edit posts link for post. Derived from WordPress core
 *
 * Can be used within the WordPress loop or outside of it. Can be used with
 * pages, posts, attachments, and revisions.
 *
 * @since 1.0.0
 *
 * @param int    $id      Optional. Post ID.
 * @param string $context Optional, defaults to display.
 * @return string|null The edit post link for the given post. null if the post type is invalid or does
 *                     not allow an editing UI.
 */
function rtgodam_get_edit_post_link( $id = 0, $context = 'display' ) {
	$_post = get_post( $id );
	if ( empty( $_post ) ) {
		return;
	}

	if ( 'revision' === $_post->post_type ) {
		$action = '';
	} elseif ( 'display' === $context ) {
		$action = '&amp;action=edit';
	} else {
		$action = '&action=edit';
	}

	$post_type_object = get_post_type_object( $_post->post_type );
	if ( ! $post_type_object ) {
		return;
	}

	if ( $post_type_object->_edit_link ) {
		$link = admin_url( sprintf( $post_type_object->_edit_link . $action, $_post->ID ) );
	} else {
		$link = '';
	}

	return $link;
}

/**
 * Get the job id of attachment
 *
 * @since 1.0.0
 *
 * @param number $attachment_id Attachment id.
 *
 * @return number On success it returns the job id otherwise it returns the false.
 */
function rtgodam_get_job_id_by_attachment_id( $attachment_id ) {

	if ( empty( $attachment_id ) ) {
		return 0;
	}

	$job_id = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );

	return $job_id ? $job_id : 0;
}

/**
 * Check if track status setting is enabled.
 *
 * This function retrieves the EasyDAM settings and checks the `track_status` value under the `general` section.
 *
 * @since 1.0.0
 *
 * @return boolean TRUE if track status is enabled, FALSE otherwise.
 */
function rtgodam_is_track_status_enabled() {
	// Fetch EasyDAM settings from the database.
	$easydam_settings = get_option( 'rtgodam-settings', array() );

	// Check and return the track_status value, defaulting to false if not set.
	return ! empty( $easydam_settings['general']['track_status'] ) && $easydam_settings['general']['track_status'];
}

/**
 * Deletes the transcoded files related to the attachment
 *
 * @since 1.0.5
 *
 * @param  int $post_id Attachment ID.
 */
function rtgodam_delete_related_transcoded_files( $post_id ) {
	if ( empty( $post_id ) ) {
		return false;
	}

	$transcoded_files = get_post_meta( $post_id, 'rtgodam_media_transcoded_files', true );

	if ( ! empty( $transcoded_files ) && is_array( $transcoded_files ) ) {
		foreach ( $transcoded_files as $files ) {
			if ( ! empty( $files ) && is_array( $files ) ) {
				rtgodam_delete_transcoded_files( $files );
			}
		}
	}
	delete_post_meta( $post_id, 'rtgodam_media_transcoded_files' );

	$thumbnails = get_post_meta( $post_id, 'rtgodam_media_thumbnails', true );
	if ( ! empty( $thumbnails ) && is_array( $thumbnails ) ) {
		rtgodam_delete_transcoded_files( $thumbnails );
	}
	delete_post_meta( $post_id, 'rtgodam_media_thumbnails' );
}

add_action( 'delete_attachment', 'rtgodam_delete_related_transcoded_files', 99, 1 );

/**
 * Deletes/Unlinks the files given in the array
 *
 * @since 1.0.5
 *
 * @param mixed $files Files array or file path string.
 *
 * @return void
 */
function rtgodam_delete_transcoded_files( $files ) {

	if ( empty( $files ) ) {
		return;
	}

	if ( ! empty( $files ) && ! is_array( $files ) ) {
		$files = array( $files );
	}

	$uploadpath = rtgodam_get_upload_dir();

	foreach ( $files as $file ) {
		if ( ! empty( $file ) ) {
			$file_path = path_join( $uploadpath['basedir'], $file );
			\RTGODAM\Inc\FileSystem::delete_file( $file_path );
		}
	}
}

/**
 * Gets the information about the upload directory
 *
 * On success, the returned array will have many indices:
 * 'path' - base directory and sub directory or full path to upload directory.
 * 'url' - base url and sub directory or absolute URL to upload directory.
 * 'subdir' - sub directory if uploads use year/month folders option is on.
 * 'basedir' - path without subdir.
 * 'baseurl' - URL path without subdir.
 * 'error' - false or error message.
 *
 * @since 1.0.5
 *
 * @return array See above for description.
 */
function rtgodam_get_upload_dir() {
	// for WordPress backward compatibility.
	if ( function_exists( 'wp_get_upload_dir' ) ) {
		$uploads = wp_get_upload_dir();
	} else {
		$uploads = wp_upload_dir();
	}

	return $uploads;
}

/**
 * Check if override media thumbnail setting is ON or OFF.
 *
 * @since 1.1.0
 *
 * @param int|string $attachment_id ID of attachment.
 *
 * @return boolean TRUE if override is ON, FALSE is OFF
 */
function rtgodam_is_override_thumbnail( $attachment_id = '' ) {

	// Fetch EasyDAM settings directly.
	$easydam_settings = get_option( 'rtgodam-settings', array() );

	// Return the 'overwrite_thumbnails' value, defaulting to false if not set.
	$rtgodam_override_thumbnail = ! empty( $easydam_settings['video']['overwrite_thumbnails'] );

	/**
	 * Allow user to override the setting.
	 *
	 * @since 1.1.0
	 *
	 * @param boolean   $rtgodam_override_thumbnail     Number of thumbnails set in setting.
	 * @param int       $attachment_id              ID of attachment.
	 */
	$rtgodam_override_thumbnail = apply_filters( 'rtgodam_is_override_thumbnail', $rtgodam_override_thumbnail, $attachment_id );

	return $rtgodam_override_thumbnail;
}

/**
 * Get remote IP address
 *
 * @return string Remote IP address
 */
function rtgodam_get_remote_ip_address() {
	$client_ip = rtgodam_get_server_var( 'HTTP_CLIENT_IP' );
	$xff       = rtgodam_get_server_var( 'HTTP_X_FORWARDED_FOR' );
	if ( ! empty( $client_ip ) ) {
		return $client_ip;
	} elseif ( ! empty( $xff ) ) {
		return $xff;
	}

	$remote_addr = rtgodam_get_server_var( 'REMOTE_ADDR' );
	return $remote_addr;
}

/**
 * Set status column head in media admin page
 *
 * @since 1.2
 *
 * @param array $defaults columns list.
 *
 * @return array columns list
 */
function rtgodam_add_status_columns_head( $defaults ) {

	$defaults['convert_status'] = __( 'Transcode Status', 'godam' );
	return $defaults;
}

/**
 * Set status column content in media admin page
 *
 * @since 1.2
 *
 * @param string $column_name column name.
 * @param int    $post_id Post ID.
 */
function rtgodam_add_status_columns_content( $column_name, $post_id ) {
	if ( 'convert_status' !== $column_name ) {
		return;
	}

	$transcoded_files = get_post_meta( $post_id, 'rtgodam_transcoded_url', true );

	// only display the check status button for media that are transcoding.
	$transcoding_status = get_post_meta( $post_id, 'rtgodam_transcoding_status', true );

	if ( empty( $transcoding_status ) && empty( $transcoded_files ) ) {
		return;
	}

	if ( empty( $transcoded_files ) && rtgodam_is_file_being_transcoded( $post_id ) ) {
		$check_button_text = __( 'Check Status', 'godam' );

		/**
		 * Filters the text of transcoding process status check button.
		 *
		 * @since 1.2
		 *
		 * @param string $check_button_text Default text of transcoding process status check button.
		 */
		$check_button_text = apply_filters( 'rtgodam_check_status_button_text', $check_button_text );

		?>
		<div id="list-transcoder-status-<?php echo esc_attr( $post_id ); ?>" class="transcoding-status transcoding-status-list" data-id="<?php echo esc_attr( $post_id ); ?>">
			<div class="transcoding-status__loader">
				<svg class="transcoding-status__loader__progress" viewBox="0 0 36 36">
					<circle class="background" cx="18" cy="18" r="16" />
					<circle class="progress" cx="18" cy="18" r="16" />
				</svg>
			</div>
			<span class="status-text"><?php echo esc_html( $transcoding_status ); ?></span>
		</div>
		<?php

	} elseif ( ! empty( $transcoded_files ) ) {
		?>
		<div id="list-transcoder-status-<?php echo esc_attr( $post_id ); ?>" class="transcoding-status transcoding-status--completed transcoding-status-list" data-id="<?php echo esc_attr( $post_id ); ?>">
			<div class="transcoding-status__loader">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
					<path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clip-rule="evenodd" />
				</svg>
			</div>
			<span class="status-text"><?php echo esc_html__( 'File is transcoded.', 'godam' ); ?></span>
		</div>
		<?php
	}
}

$godam_user_data           = rtgodam_get_user_data();
$godam_is_api_key_verified = isset( $godam_user_data['valid_api_key'] ) ? $godam_user_data['valid_api_key'] : false;

if ( $godam_is_api_key_verified ) {
	add_filter( 'manage_media_columns', 'rtgodam_add_status_columns_head' );
	add_action( 'manage_media_custom_column', 'rtgodam_add_status_columns_content', 10, 2 );
}

/**
 * Set sortable status column in media admin page
 *
 * @since 1.2
 *
 * @param array $columns columns list.
 *
 * @return array columns list
 */
function rtgodam_status_column_register_sortable( $columns ) {

	$columns['convert_status'] = 'convert_status';
	return $columns;
}

add_filter( 'manage_upload_sortable_columns', 'rtgodam_status_column_register_sortable' );

/**
 * To get sanitized server variables.
 *
 * @param string $server_key Key of the $_SERVER superglobal variable.
 * @param int    $filter_type The ID of the filter to apply.
 *
 * @return string Filtered value if supports.
 */
function rtgodam_get_server_var( $server_key, $filter_type = FILTER_SANITIZE_FULL_SPECIAL_CHARS ) {
	$server_val = '';

	if ( function_exists( 'filter_input' ) && filter_has_var( INPUT_SERVER, $server_key ) ) {
		$server_val = rtgodam_filter_input( INPUT_SERVER, $server_key, $filter_type );
	}

	return $server_val;
}

/**
 * Helper function to verify the api key.
 *
 * @param string $api_key The api key to verify.
 * @param bool   $save        Whether to save the API key in the site options.
 *
 * @return array|WP_Error Array with status and data on success, WP_Error on failure.
 */
function rtgodam_verify_api_key( $api_key, $save = false ) {
	if ( empty( $api_key ) ) {
		return new \WP_Error( 'missing_api_key', __( 'API key is required.', 'godam' ), array( 'status' => 400 ) );
	}

	// Check if request should be blocked due to HTTP or localhost environment.
	if ( rtgodam_is_local_environment() ) {
		// Check if RTGODAM_API_KEY constant is defined in wp-config.php.
		if ( ! defined( 'RTGODAM_API_KEY' ) ) {
			return new \WP_Error(
				'localhost_blocked',
				__( 'API key verification is blocked for HTTP connections or localhost environments. To use production API keys on localhost, please add the following constant to your wp-config.php file: define(\'RTGODAM_API_KEY\', \'your-api-key-here\');', 'godam' ),
				array( 'status' => 403 )
			);
		}

		// Match the provided API key with the RTGODAM_API_KEY constant.
		if ( RTGODAM_API_KEY !== $api_key ) {
			return new \WP_Error(
				'api_key_mismatch',
				__( 'The provided API key does not match the RTGODAM_API_KEY constant defined in wp-config.php.', 'godam' ),
				array( 'status' => 403 )
			);
		}
	}

	$api_url = RTGODAM_API_BASE . '/api/method/godam_core.api.verification.verify_api_key';

	// Prepare request body with site title.
	$site_url   = get_site_url();
	$site_title = get_bloginfo( 'name' ); // Get site title from WordPress options.

	$request_body = array(
		'api_key'    => $api_key,
		'site_url'   => $site_url,
		'site_title' => $site_title, // Add site title to request.
	);

	$args = array(
		'body'    => wp_json_encode( $request_body ),
		'headers' => array(
			'Content-Type' => 'application/json',
		),
	);

	// Use vip_safe_wp_remote_post as primary and wp_safe_remote_post as fallback.
	if ( function_exists( 'vip_safe_wp_remote_post' ) ) {
		$response = vip_safe_wp_remote_post( $api_url, $args, 3, 3 );
	} else {
		$response = wp_safe_remote_post( $api_url, $args );
	}

	// Check for existing API key and user data to preserve on unexpected errors.
	$existing_api_key = get_option( 'rtgodam-api-key', '' );
	$existing_usage   = get_option( 'rtgodam-usage', array() );
	$user_data        = ! empty( $existing_usage ) && isset( $existing_usage[ $existing_api_key ] ) ? $existing_usage[ $existing_api_key ] : array();
	$preserved_data   = is_object( $user_data ) ? (array) $user_data : $user_data;

	$status_code = wp_remote_retrieve_response_code( $response );
	$body        = json_decode( wp_remote_retrieve_body( $response ), true );

	// Central sends 200 status code with error if API Key is invalid.
	if ( isset( $body['message']['error'] ) ) {
		return new \WP_Error( 'invalid_api_key', $body['message']['error'], array( 'status' => 400 ) );
	}

	// Handle 200 Success - Save the API key.
	if ( 200 === $status_code && isset( $body['message']['account_token'] ) ) {

		$account_token = $body['message']['account_token'];
		if ( $save ) {
			// Save the API key in the site options only if it is verified.
			update_option( 'rtgodam-api-key', $api_key );
			update_option( 'rtgodam-api-key-stored', $api_key );
			update_option( 'rtgodam-account-token', $account_token );
			delete_option( 'rtgodam_user_data' );

			// Update usage data.
			$handler = new \RTGODAM_Transcoder_Handler( false );
			$handler->update_usage( $api_key );
		}

		return array(
			'status'  => 'success',
			'message' => __( 'API key verified and stored successfully!', 'godam' ),
			'data'    => $body['message'],
		);
	}

	// Handle other errors - Preserve existing API key and user data.
	// If existing API key exists, preserve it. If not, don't save new key.
	if ( ! empty( $existing_api_key ) ) {
		return array(
			'status'  => 'success',
			'message' => __( 'API key verification temporarily unavailable.', 'godam' ),
			'data'    => $preserved_data,
		);
	}

	return new \WP_Error( 'unexpected_error', __( 'An unexpected error occurred. Please try again later.', 'godam' ), array( 'status' => 500 ) );
}

/**
 * Mask string.
 *
 * @param string $input  Input string.
 * @param int    $offset Offset.
 *
 * @return string
 */
function rtgodam_mask_string( $input, $offset = 4 ) {
	$length = strlen( $input );
	if ( $length <= $offset ) {
		return $input; // If string length is equal or less than $offset, return as is.
	}

	$masked = str_repeat( '*', $length - $offset ) . substr( $input, -$offset );
	return $masked;
}

/**
 * Get the List of Categories for the post.
 *
 * @param int $post_id Current Post Id.
 *
 * @return array|string List of Categories or empty string on failure.
 */
function rtgodam_get_categories_list( $post_id ) {

	$categories     = get_the_category( $post_id );
	$category_names = array();

	if ( is_array( $categories ) && ! empty( $categories ) ) {

		foreach ( $categories as $category ) {
			$category_names[] = $category->name;
		}

		$comma_separated = implode( ', ', $category_names );

		return $comma_separated;
	}

	return '';
}

/**
 * Get the List of Categories for the post.
 *
 * @param int $post_id Current Post Id.
 *
 * @return array|string List of Tags or empty string on failure.
 */
function rtgodam_get_tags_list( $post_id ) {

	$tags      = get_the_tags( $post_id );
	$tag_names = array();

	if ( ! is_array( $tags ) && ! empty( $tags ) ) {

		foreach ( $tags as $tag ) {
			$tag_names[] = $tag->name;
		}

		$comma_separated = implode( ', ', $tag_names );
		return $comma_separated;
	}

	return '';
}

/**
 * Utility function to get the array to localize.
 *
 * @return array The array to localize
 */
function rtgodam_get_localize_array() {

	$localize_array = array();

	$localize_array['endpoint']   = RTGODAM_ANALYTICS_BASE;
	$localize_array['isPost']     = empty( is_single() ) ? 0 : is_single();
	$localize_array['isPage']     = empty( is_page() ) ? 0 : is_page();
	$localize_array['isArchive']  = empty( is_archive() ) ? 0 : is_archive();
	$localize_array['postTitle']  = get_the_title();
	$localize_array['locationIP'] = rtgodam_get_user_ip();

	/**
	 * Get Current User.
	 */
	$current_user = wp_get_current_user();
	$email_id     = '';

	$localize_array['userId'] = $current_user->ID;

	if ( ! empty( (array) $current_user->data ) ) {

		$email_id                  = $current_user->data->user_email;
		$localize_array['emailId'] = $email_id;
	}

	$localize_array['siteId'] = get_current_blog_id();

	if ( get_post_type() ) {

		$localize_array['postType'] = get_post_type();
	}

	$post_id = get_the_ID();

	if ( $post_id ) {

		$localize_array['postId']     = $post_id;
		$localize_array['categories'] = rtgodam_get_categories_list( $post_id );
		$localize_array['tags']       = rtgodam_get_tags_list( $post_id );

	}

	if ( null !== get_the_author() ) {

		$localize_array['author'] = get_the_author();
	}

	$localize_array['token'] = get_option( 'rtgodam-account-token', 'unverified' );

	// Admin page detection.
	$localize_array['isAdminPage'] = is_admin();

	return $localize_array;
}

/**
 * Get the user's IP address.
 *
 * @return string The user's IP address.
 */
function rtgodam_get_user_ip() {
	$ip_address = '';

	$ip_address = filter_var( rtgodam_get_server_var( 'HTTP_CLIENT_IP' ), FILTER_VALIDATE_IP );

	if ( empty( $ip_address ) ) {
		$forwarded_for = rtgodam_get_server_var( 'HTTP_X_FORWARDED_FOR' );
		$ip_address    = ! empty( $forwarded_for ) ? filter_var( explode( ',', $forwarded_for )[0], FILTER_VALIDATE_IP ) : false;
	}

	if ( empty( $ip_address ) ) {
		$ip_address = filter_var( rtgodam_get_server_var( 'REMOTE_ADDR' ), FILTER_VALIDATE_IP );
	}

	return $ip_address; // Return an empty string if invalid.
}

/**
 * Return transcoded url from attachment.
 *
 * @since 1.3.0
 *
 * @param int|\WP_Post $attachment Attachment.
 *
 * @return string|false
 */
function rtgodam_get_transcoded_url_from_attachment( $attachment ) {
	$attachment_id = 0;

	if ( $attachment instanceof \WP_Post ) {
		$attachment_id = $attachment->ID;
	} elseif ( is_numeric( $attachment ) ) {
		$attachment_id = $attachment;
	}

	if ( $attachment_id <= 0 ) {
		return '';
	}

	$attachment_obj = get_post( $attachment_id );

	if ( empty( $attachment_obj ) || ! is_a( $attachment_obj, 'WP_Post' ) ) {
		return '';
	}

	if ( 'attachment' !== $attachment_obj->post_type ) {
		return '';
	}

	return get_post_meta( $attachment_id, 'rtgodam_transcoded_url', true );
}

/**
 * Return hls transcoded url from attachment.
 *
 * @since 1.3.1
 *
 * @param int|\WP_Post $attachment Attachment.
 *
 * @return string|false
 */
function rtgodam_get_hls_transcoded_url_from_attachment( $attachment ) {
	$attachment_id = 0;

	if ( $attachment instanceof \WP_Post ) {
		$attachment_id = $attachment->ID;
	} elseif ( is_numeric( $attachment ) ) {
		$attachment_id = $attachment;
	}

	if ( $attachment_id <= 0 ) {
		return '';
	}

	$attachment_obj = get_post( $attachment_id );

	if ( empty( $attachment_obj ) || ! is_a( $attachment_obj, 'WP_Post' ) ) {
		return '';
	}

	if ( 'attachment' !== $attachment_obj->post_type ) {
		return '';
	}

	return get_post_meta( $attachment_id, 'rtgodam_hls_transcoded_url', true );
}

/**
 * Return transcoded status from attachment.
 *
 * @since 1.3.0
 *
 * @param int|\WP_Post $attachment Attachment.
 *
 * @return string
 */
function rtgodam_get_transcoded_status_from_attachment( $attachment ) {
	$attachment_id = 0;

	if ( $attachment instanceof \WP_Post ) {
		$attachment_id = $attachment->ID;
	} elseif ( is_numeric( $attachment ) ) {
		$attachment_id = $attachment;
	}

	if ( $attachment_id <= 0 ) {
		return '';
	}

	$attachment_obj = get_post( $attachment_id );

	if ( 'attachment' !== $attachment_obj->post_type ) {
		return '';
	}

	$status = strval( get_post_meta( $attachment_id, 'rtgodam_transcoding_status', true ) );
	$status = function_exists( 'mb_strtolower' ) ? mb_strtolower( $status ) : strtolower( $status );
	$status = empty( trim( $status ) ) ? 'not_started' : $status;

	return $status;
}

/**
 * Return transcoded error message from attachment.
 *
 * @since 1.3.0
 *
 * @param int|\WP_Post $attachment Attachment.
 *
 * @return string|false
 */
function rtgodam_get_transcoded_error_message_from_attachment( $attachment ) {
	$attachment_id = 0;

	if ( $attachment instanceof \WP_Post ) {
		$attachment_id = $attachment->ID;
	} elseif ( is_numeric( $attachment ) ) {
		$attachment_id = $attachment;
	}

	if ( $attachment_id <= 0 ) {
		return '';
	}

	$attachment_obj = get_post( $attachment_id );

	if ( 'attachment' !== $attachment_obj->post_type ) {
		return '';
	}

	return strval( get_post_meta( $attachment_id, 'rtgodam_transcoding_error_msg', true ) );
}

/**
 * Get transcript path for a video attachment.
 *
 * Fetches AI Generated video tracks from stored transcript path.
 * Constructs transcript path for backward compatibility if not already stored.
 *
 * @since 1.0.0
 *
 * @param string|int $attachment_id Attachment ID (can be numeric WordPress ID or virtual media ID).
 * @param array      $tracks        Existing tracks array to append to.
 *
 * @return array Array of track data with 'src', 'kind', 'label', and 'srclang' keys.
 */
function rtgodam_get_video_transcript_tracks( $attachment_id, $tracks = array() ) {
	if ( empty( $attachment_id ) ) {
		return $tracks;
	}

	$is_virtual = ! is_numeric( $attachment_id );
	$storage_id = $attachment_id;

	// For virtual media, check if there's a WordPress attachment ID we can use for storage.
	if ( $is_virtual ) {
		// Use existing built-in function to get post ID by meta key and value from wp_postmeta table.
		if ( class_exists( 'RTGODAM_Transcoder_Handler' ) ) {
			$transcoder_handler = new \RTGODAM_Transcoder_Handler( false );
			if ( method_exists( $transcoder_handler, 'get_post_id_by_meta_key_and_value' ) ) {
				// For virtual media, the attachment_id is the job_id, search by rtgodam_transcoding_job_id.
				$found_attachment_id = $transcoder_handler->get_post_id_by_meta_key_and_value( 'rtgodam_transcoding_job_id', $attachment_id );

				if ( ! empty( $found_attachment_id ) ) {
					// Use WordPress attachment ID for storage.
					$storage_id = $found_attachment_id;
				}
			}
		}
	}

	// Retrieve transcript path from post meta.
	$transcript_path = get_post_meta( $storage_id, 'rtgodam_transcript_path', true );

	// If transcript path is not stored, construct it ONLY ONCE and then store it.
	if ( empty( $transcript_path ) ) {
		// Get the account token.
		$account_token = get_option( 'rtgodam-account-token', '' );

		if ( ! empty( $account_token ) ) {
			$filename       = '';
			$current_job_id = '';

			if ( is_numeric( $attachment_id ) ) {
				// Original media - get job_id from post meta and filename from attachment.
				$current_job_id = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );

				if ( empty( $current_job_id ) ) {
					$current_job_id = get_post_meta( $attachment_id, '_godam_original_id', true );
				}

				// Get filename from attached file.
				$attached_file = get_attached_file( $attachment_id );
				if ( $attached_file ) {
					$filename = pathinfo( $attached_file, PATHINFO_FILENAME );
				}
			} else {
				// Virtual media - attachment_id is the job_id, get filename via API.
				$current_job_id = $attachment_id;

				// Call get_file API to get the exact filename from file_origin ONLY ONCE.
				$api_key = get_option( 'rtgodam-api-key', '' );

				if ( ! empty( $api_key ) ) {
					$rest_url = add_query_arg(
						array(
							'file_id' => rawurlencode( $current_job_id ),
							'api_key' => rawurlencode( $api_key ),
						),
						RTGODAM_API_BASE . '/api/method/godam_core.api.file.get_file'
					);

					$args = array(
						'headers' => array(
							'User-Agent' => 'WordPress/' . get_bloginfo( 'version' ) . '; ' . home_url(),
							'Accept'     => 'application/json',
						),
					);

					$response = wp_remote_get( $rest_url, $args );

					if ( ! is_wp_error( $response ) && 200 === wp_remote_retrieve_response_code( $response ) ) {
						$body     = wp_remote_retrieve_body( $response );
						$api_data = json_decode( $body, true );

						if (
							is_array( $api_data ) &&
							isset( $api_data['message']['file_origin'] )
						) {
							$file_origin = $api_data['message']['file_origin'];
							$filename    = pathinfo( $file_origin, PATHINFO_FILENAME );
						}
					}
				}
			}

			// Construct the VTT URL if we have both job_id and filename.
			if ( ! empty( $current_job_id ) && ! empty( $filename ) ) {
				$transcript_path = 'https://' . $account_token . '.gdcdn.us/' . $current_job_id . '/' . $filename . '.vtt';

				// Store the constructed VTT URL in post meta for future use (only if we have a valid WordPress attachment ID).
				if ( ! empty( $storage_id ) && is_numeric( $storage_id ) ) {
					update_post_meta( $storage_id, 'rtgodam_transcript_path', $transcript_path );
				}
			}
		}
	}

	if ( ! empty( $transcript_path ) ) {
		// For virtual media, skip verification and directly add the track.
		if ( $is_virtual ) {
			$tracks[] = array(
				'src'     => esc_url( $transcript_path ),
				'kind'    => 'subtitles',
				'label'   => 'English',
				'srclang' => 'en',
			);
		} else {
			// For original media, verify the transcript file exists.
			$transcript_verified = get_post_meta( $attachment_id, 'rtgodam_transcript_exists', true );

			if ( '1' !== $transcript_verified ) { // Only check if we haven't confirmed it exists.
				// Verify the transcript file actually exists by making a HEAD request.
				$response            = wp_remote_head( $transcript_path );
				$transcript_verified = ( ! is_wp_error( $response ) && wp_remote_retrieve_response_code( $response ) === 200 ) ? '1' : '0';

				// Only store '1' permanently (confirmed existence), never store '0' so we can re-check later.
				if ( '1' === $transcript_verified ) {
					update_post_meta( $attachment_id, 'rtgodam_transcript_exists', $transcript_verified );
				}
			}

			if ( '1' === $transcript_verified ) {
				$tracks[] = array(
					'src'     => esc_url( $transcript_path ),
					'kind'    => 'subtitles',
					'label'   => 'English',
					'srclang' => 'en',
				);
			}
		}
	}

	return $tracks;
}
