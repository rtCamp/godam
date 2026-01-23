<?php
/**
 * Custom functions.
 *
 * @package GoDAM
 */

defined( 'ABSPATH' ) || exit;

/**
 * This method is an improved version of PHP's filter_input() and
 * works well on PHP CLI as well which PHP default method does not.
 *
 * Reference:
 * - https://bugs.php.net/bug.php?id=49184
 * - https://bugs.php.net/bug.php?id=54672
 *
 * @param int    $type One of INPUT_GET, INPUT_POST, INPUT_COOKIE, INPUT_SERVER, or INPUT_ENV.
 * @param string $variable_name Name of a variable to get.
 * @param int    $filter The ID of the filter to apply.
 * @param mixed  $options filter to apply.
 *
 * @return mixed Value of the requested variable on success, FALSE if the filter fails, or NULL if the
 *               variable_name variable is not set.
 */
function rtgodam_filter_input( $type, $variable_name, $filter = FILTER_DEFAULT, $options = 0 ) {

	if ( php_sapi_name() !== 'cli' ) {

		/**
		 * We can not have code coverage since.
		 * Since this will only execute when sapi is "fpm-fcgi".
		 * While Unit test case run on "cli"
		 */
		// @codeCoverageIgnoreStart

		$sanitized_variable = filter_input( $type, $variable_name, $filter, $options );

		/**
		 * Code is not running on PHP Cli and we are in clear.
		 * Use the PHP method and bail out.
		 */
		if ( ! empty( $sanitized_variable ) && FILTER_SANITIZE_FULL_SPECIAL_CHARS === $filter ) {
			$sanitized_variable = sanitize_text_field( $sanitized_variable );
		}

		return $sanitized_variable;
		// @codeCoverageIgnoreEnd
	}

	/**
	 * Code is running on PHP Cli and INPUT_SERVER returns NULL
	 * even for set vars when run on Cli
	 * See: https://bugs.php.net/bug.php?id=49184
	 *
	 * This is a workaround for that bug till its resolved in PHP binary
	 * which doesn't look to be anytime soon. This is a friggin' 10 year old bug.
	 */

	$input = '';

	$allowed_html_tags = wp_kses_allowed_html( 'post' );

	/**
	 * Marking the switch() block below to be ignored by PHPCS
	 * because PHPCS squawks on using superglobals like $_POST or $_GET
	 * directly but it can't be helped in this case as this code
	 * is running on Cli.
	 */

	// phpcs:disable WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing, WordPressVIPMinimum.Variables.RestrictedVariables.cache_constraints___COOKIE,  WordPress.Security.ValidatedSanitizedInput.MissingUnslash

	switch ( $type ) {

		case INPUT_GET:
			if ( ! isset( $_GET[ $variable_name ] ) ) {
				return null;
			}

			$input = wp_kses( $_GET[ $variable_name ], $allowed_html_tags );
			break;

		case INPUT_POST:
			if ( ! isset( $_POST[ $variable_name ] ) ) {
				return null;
			}

			$input = wp_kses( $_POST[ $variable_name ], $allowed_html_tags );
			break;

		case INPUT_COOKIE:
			if ( ! isset( $_COOKIE[ $variable_name ] ) ) {
				return null;
			}

			$input = wp_kses( $_COOKIE[ $variable_name ], $allowed_html_tags );
			break;

		case INPUT_SERVER:
			if ( ! isset( $_SERVER[ $variable_name ] ) ) {
				return null;
			}

			$input = wp_kses( $_SERVER[ $variable_name ], $allowed_html_tags );
			break;

		case INPUT_ENV:
			if ( ! isset( $_ENV[ $variable_name ] ) ) {
				return null;
			}

			$input = wp_kses( $_ENV[ $variable_name ], $allowed_html_tags );
			break;

		default:
			return null;

	}

	// phpcs:enable WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing, WordPressVIPMinimum.Variables.RestrictedVariables.cache_constraints___COOKIE

	return filter_var( $input, $filter );
}

/**
 * Fetch the URL of a media file by its ID.
 *
 * This function retrieves the URL of a media attachment in WordPress based on the provided media ID.
 * It validates the ID, ensures the media exists, and is of the correct type (attachment).
 *
 * @param int $media_id The ID of the media attachment.
 *
 * @return string The URL of the media file, or an empty string if invalid or not found.
 */
function rtgodam_fetch_overlay_media_url( $media_id ) {
	if ( empty( $media_id ) || 0 === intval( $media_id ) ) {
		return '';
	}

	$media = get_post( $media_id );

	if ( ! $media || 'attachment' !== $media->post_type ) {
		return '';
	}

	$media_url = wp_get_attachment_url( $media_id );

	return $media_url ? $media_url : '';
}

/**
 * Generate the HTML for an image-based call-to-action (CTA) overlay.
 *
 * This function creates a dynamic HTML structure for displaying an image CTA overlay.
 * It uses the provided `$layer` data to populate the content, including image, text, and links.
 *
 * @param array $layer Associative array containing CTA details:
 *     - 'image' (int): Media ID for the image.
 *     - 'imageUrlExt' (string): External URL for the image (GoDAM hosted).
 *     - 'imageCtaOrientation' (string): Orientation of the CTA ('portrait' or other).
 *     - 'imageOpacity' (float): Opacity of the image (default is 1).
 *     - 'imageText' (string): Heading text for the CTA.
 *     - 'imageDescription' (string): Description text for the CTA.
 *     - 'imageLink' (string): URL for the CTA link.
 *     - 'imageCtaButtonText' (string): Text for the CTA button.
 *     - 'imageCtaButtonColor' (string): Background color for the CTA button.
 *
 * @return string The generated HTML string for the image CTA overlay.
 */
function rtgodam_image_cta_html( $layer ) {
	// Determine if the image is a GoDAM hosted media.
	$is_godam_media = is_string( $layer['image'] ) && strpos( $layer['image'], 'godam_' ) === 0;

	if ( $is_godam_media && ! empty( $layer['imageUrlExt'] ) ) {
		$image_url = $layer['imageUrlExt'];
	} else {
		$image_url = rtgodam_fetch_overlay_media_url( $layer['image'] );
	}

	// Ensure $layer is an associative array and has required fields.
	$orientation_class = isset( $layer['imageCtaOrientation'] ) && 'portrait' === $layer['imageCtaOrientation']
		? 'vertical-image-cta-container'
		: 'image-cta-container';

	$image_opacity        = isset( $layer['imageOpacity'] ) ? $layer['imageOpacity'] : 1;
	$image_text           = isset( $layer['imageText'] ) ? $layer['imageText'] : '';
	$image_description    = isset( $layer['imageDescription'] ) ? $layer['imageDescription'] : '';
	$image_link           = isset( $layer['imageLink'] ) ? $layer['imageLink'] : '/';
	$cta_background_color = isset( $layer['imageCtaButtonColor'] ) ? $layer['imageCtaButtonColor'] : '#eeab95';
	$cta_button_text      = ! empty( $layer['imageCtaButtonText'] ) ? $layer['imageCtaButtonText'] : 'Buy Now'; // Null coalescing with empty check.
	$image_box            = "<div class=\"image-cta-no-image\" style=\"opacity: {$image_opacity};\"> " . __( 'No Image', 'godam' ) . '</div>';

	if ( ! empty( $image_url ) ) {
		$image_box = "<img 
						src=\"{$image_url}\" 
						alt=\"CTA ad\" 
						height=\"300\" 
						width=\"250\" 
						style=\"opacity: {$image_opacity};\" 
					/>";
	}

	return "
	<div class= \"image-cta-overlay-container\">
		<div class=\"image-cta-parent-container\">
			<div class=\"{$orientation_class}\">
				{$image_box}
				<div class=\"image-cta-description\">
					" . ( ! empty( $image_text ) ? "<h2>{$image_text}</h2>" : '' ) . '
					' . ( ! empty( $image_description ) ? "<p>{$image_description}</p>" : '' ) . "
					<a class=\"image-cta-btn\" href=\"{$image_link}\" target=\"_blank\" style=\"background-color: {$cta_background_color};\">
						{$cta_button_text}
					</a>
				</div>
			</div>
		</div>
	</div>
    ";
}

/**
 * Verify the api key for the plugin and return user data.
 *
 * @param bool $use_for_localize_array Whether to use the data for localizing scripts. Defaults to false.
 * @param int  $timeout                The time in seconds after which the user data should be refreshed.
 * @param bool $force_refresh          Whether to force refresh the API key verification bypassing grace period checks.
 */
function rtgodam_get_user_data( $use_for_localize_array = false, $timeout = HOUR_IN_SECONDS, $force_refresh = false ) {
	$rtgodam_user_data = get_option( 'rtgodam_user_data', false );
	$api_key           = get_option( 'rtgodam-api-key', '' );
	$api_key_status    = rtgodam_get_api_key_status();

	// Check if we should skip verification.
	// Skip only for expired keys that are past their grace period.
	$skip_verification = false;
	if ( ! $force_refresh && RTGODAM_API_KEY_STATUS_EXPIRED === $api_key_status && ! rtgodam_is_api_key_in_grace_period() ) {
		// Grace period expired for expired key, pause automatic checks until manual refresh.
		$skip_verification = true;
	}

	$should_verify = (
		empty( $rtgodam_user_data ) ||
		( empty( $rtgodam_user_data ) && ! empty( $api_key ) ) ||
		( isset( $rtgodam_user_data['timestamp'] ) && ( time() - $rtgodam_user_data['timestamp'] ) > $timeout )
	) && ! $skip_verification;

	// Allow force refresh to bypass timeout and skip checks.
	if ( $force_refresh ) {
		$should_verify = true;
	}

	if ( $should_verify ) {
		// Verify the user's API Key.
		$result = rtgodam_verify_api_key( $api_key );

		$valid_api_key    = false;
		$user_data        = array();
		$transient_status = null; // For temporary verification_failed state.

		if ( is_wp_error( $result ) ) {
			// API Key shouldn't be invalid if there is a server error.
			$error_data  = $result->get_error_data();
			$status_code = is_array( $error_data ) && isset( $error_data['status'] ) ? $error_data['status'] : 500;
			
			if ( 500 === $status_code && ! empty( $api_key ) ) {
				// Server error with existing API key - DON'T change DB status, just show verification_failed to user.
				// DON'T set error timestamp - this is temporary and we should keep checking.
				$transient_status = RTGODAM_API_KEY_STATUS_VERIFICATION_FAILED;
				$valid_api_key    = false;
			} elseif ( 500 !== $status_code ) {
				$valid_api_key = false;
			}
		} else {
			$valid_api_key = true;
			$user_data     = $result['data'] ?? array();
		}

		$user_data['masked_api_key'] = rtgodam_mask_string( $api_key );

		// Get updated status after verification.
		$api_key_status = rtgodam_get_api_key_status();
		
		// If there's a transient status (verification_failed), use it instead of DB status.
		if ( ! is_null( $transient_status ) ) {
			$api_key_status = $transient_status;
		}

		$rtgodam_user_data = array(
			'currentUserId'  => get_current_user_id(),
			'valid_api_key'  => $valid_api_key,
			'api_key_status' => $api_key_status,
			'user_data'      => $user_data,
		);

		$usage_data = rtgodam_get_usage_data();

		if ( ! is_wp_error( $usage_data ) ) {
			$rtgodam_user_data = array_merge( $rtgodam_user_data, $usage_data );

			// Check for exceeded limits and set error messages.
			$bandwidth_exceeded = isset( $usage_data['bandwidth_used'], $usage_data['total_bandwidth'] )
				&& $usage_data['bandwidth_used'] > $usage_data['total_bandwidth'];
			$storage_exceeded   = isset( $usage_data['storage_used'], $usage_data['total_storage'] )
				&& $usage_data['storage_used'] > $usage_data['total_storage'];

			if ( $storage_exceeded ) {
				$storage_percentage                         = $usage_data['total_storage'] > 0
					? number_format( ( $usage_data['storage_used'] / $usage_data['total_storage'] ) * 100, 1 )
					: '0';
				$rtgodam_user_data['storageBandwidthError'] = sprintf(
					/* translators: %s: storage usage percentage */
					__( 'Storage limit exceeded (%s%%). Please upgrade your plan to continue.', 'godam' ),
					$storage_percentage
				);
			} elseif ( $bandwidth_exceeded ) {
				$bandwidth_percentage                       = $usage_data['total_bandwidth'] > 0
					? number_format( ( $usage_data['bandwidth_used'] / $usage_data['total_bandwidth'] ) * 100, 1 )
					: '0';
				$rtgodam_user_data['storageBandwidthError'] = sprintf(
					/* translators: %s: bandwidth usage percentage */
					__( 'Bandwidth limit exceeded (%s%%). Please upgrade your plan to continue.', 'godam' ),
					$bandwidth_percentage
				);
			}
		} elseif ( is_wp_error( $usage_data ) && $valid_api_key ) {
			// Only show usage data fetch error if API key is valid.
			// API key errors are handled separately via apiKeyStatus.
			$rtgodam_user_data['storageBandwidthError'] = $usage_data->get_error_message();
		}

		$rtgodam_user_data['timestamp'] = time();

		// Save the userData in wp_options.
		update_option( 'rtgodam_user_data', $rtgodam_user_data );
	}

	// Ensure api_key_status is always present in the data.
	if ( ! isset( $rtgodam_user_data['api_key_status'] ) ) {
		$rtgodam_user_data['api_key_status'] = rtgodam_get_api_key_status();
	}

	if ( $use_for_localize_array ) {
		// Prepare the data for localizing scripts.
		$localized_array_data = array(
			'currentUserId' => $rtgodam_user_data['currentUserId'],
			'validApiKey'   => $rtgodam_user_data['valid_api_key'],
			'apiKeyStatus'  => $rtgodam_user_data['api_key_status'],
			'userApiData'   => $rtgodam_user_data['user_data'],
			'timestamp'     => $rtgodam_user_data['timestamp'],
		);

		if ( isset( $rtgodam_user_data['storageBandwidthError'] ) && ! empty( $rtgodam_user_data['storageBandwidthError'] ) ) {
			$localized_array_data['storageBandwidthError'] = $rtgodam_user_data['storageBandwidthError'];
		}

		// Use isset() instead of !empty() to allow 0 values.
		if ( isset( $rtgodam_user_data['storage_used'] ) ) {
			$localized_array_data['storageUsed'] = $rtgodam_user_data['storage_used'];
		}

		if ( isset( $rtgodam_user_data['total_storage'] ) ) {
			$localized_array_data['totalStorage'] = $rtgodam_user_data['total_storage'];
		}

		if ( isset( $rtgodam_user_data['bandwidth_used'] ) ) {
			$localized_array_data['bandwidthUsed'] = $rtgodam_user_data['bandwidth_used'];
		}

		if ( isset( $rtgodam_user_data['total_bandwidth'] ) ) {
			$localized_array_data['totalBandwidth'] = $rtgodam_user_data['total_bandwidth'];
		}

		return $localized_array_data;
	}

	return $rtgodam_user_data;
}

/**
 * Get the storage and bandwidth usage data.
 *
 * @return array|WP_Error
 */
function rtgodam_get_usage_data() {

	$api_key = get_option( 'rtgodam-api-key', '' );

	if ( empty( $api_key ) ) {
		return new \WP_Error( 'rtgodam_api_error', __( 'API key not found ( try refreshing the page )', 'godam' ) );
	}

	$endpoint = RTGODAM_API_BASE . '/api/method/godam_core.api.stats.get_bandwidth_and_storage';

	// Prepare request body with API key.
	$request_body = array(
		'api_key' => $api_key,
	);

	$args = array(
		'body'    => wp_json_encode( $request_body ),
		'headers' => array(
			'Content-Type' => 'application/json',
		),
	);

	// Use vip_safe_wp_remote_post as primary and wp_safe_remote_post as fallback.
	if ( function_exists( 'vip_safe_wp_remote_post' ) ) {
		$response = vip_safe_wp_remote_post( $endpoint, $args, 3, 3 );
	} else {
		$response = wp_safe_remote_post( $endpoint, $args );
	}

	if ( is_wp_error( $response ) ) {
		return $response;
	}

	$body = wp_remote_retrieve_body( $response );

	$data = json_decode( $body, true );

	// Validate response structure.
	if ( ! isset( $data['message'] ) || ! isset( $data['message']['storage_used'] ) || ! isset( $data['message']['bandwidth_used'] ) ) {
		return new \WP_Error( 'rtgodam_api_error', __( 'Error fetching data for storage and bandwidth ( remove and add again the API key to get usage analytics )', 'godam' ) );
	}

	return array(
		'storage_used'    => floatval( $data['message']['storage_used'] ?? 0 ),
		'total_storage'   => floatval( $data['message']['total_storage'] ?? 0 ),
		'bandwidth_used'  => floatval( $data['message']['bandwidth_used'] ?? 0 ),
		'total_bandwidth' => floatval( $data['message']['total_bandwidth'] ?? 0 ),
	);
}

/**
 * Check if the api key is valid.
 *
 * @return bool
 */
function rtgodam_is_api_key_valid() {
	$user_data = rtgodam_get_user_data();

	return ! empty( $user_data['valid_api_key'] ) ? true : false;
}

/**
 * Checks if the given filename is an audio file based on its name.
 *
 * Note: The files created by uppy webcam, screen capture, and audio plugin are in the same format. So we are checking the filename to determine if it's an audio file.
 *
 * @since 1.4.1
 *
 * @param string $filename The name of the file to check.
 *
 * @return bool True if the file is an audio file, false otherwise.
 */
function godam_is_audio_file_by_name( $filename ) {
	// Extract only the basename (ignores full path).
	$basename = basename( $filename );

	// Check if 'audio' appears in the filename (case-insensitive).
	return stripos( $basename, 'audio' ) !== false;
}

/**
 * Send Video file to GoDAM for transcoding.
 *
 * @param string  $form_type  Form Type.
 * @param string  $form_title Form Title.
 * @param string  $file_url   File URL.
 * @param integer $entry_id   Entry Id.
 * @param string  $job_type   Job type Default is 'stream'.
 *
 * @return array|WP_Error
 */
function rtgodam_send_video_to_godam_for_transcoding( $form_type = '', $form_title = '', $file_url = '', $entry_id = 0, $job_type = 'stream' ) {

	/**
	 * Filter to allow external developers to disable automatic transcoding for form uploads.
	 * This allows clients to have manual control over when form-recorded videos get transcoded.
	 *
	 * This is the same filter used for media library uploads, providing unified control.
	 * When disabled, form submissions will fail with an error message indicating transcoding is disabled.
	 * Manual retranscoding via the admin interface will still work regardless of this setting.
	 *
	 * Example usage:
	 * add_filter( 'godam_auto_transcode_on_upload', '__return_false' ); // Disable globally
	 *
	 * @since 1.5.0
	 *
	 * @param bool $auto_transcode_on_upload Whether to automatically transcode form uploads. Default true.
	 */
	if ( ! apply_filters( 'godam_auto_transcode_on_upload', true ) ) {
		return new WP_Error(
			'transcoding_disabled',
			__( 'Form transcoding has been disabled by the site administrator.', 'godam' )
		);
	}

	/**
	 * Extract file extension.
	 */
	$file_extension = pathinfo( $file_url, PATHINFO_EXTENSION );

	/**
	 * Set the default settings.
	 */
	$default_settings = array(
		'video' => array(
			'adaptive_bitrate'     => true,
			'watermark'            => false,
			'watermark_text'       => '',
			'watermark_url'        => '',
			'video_thumbnails'     => 0,
			'overwrite_thumbnails' => false,
			'use_watermark_image'  => false,
		),
	);

	/**
	 * Fetch Godam site settings.
	 */
	$godam_settings = get_option( 'rtgodam-settings', $default_settings );

	/**
	 * Fetch stored API Key.
	 */
	$api_key = get_option( 'rtgodam-api-key', '' );

	/**
	 * Watermark settings.
	 */
	$rtgodam_watermark           = $godam_settings['video']['watermark'];
	$rtgodam_use_watermark_image = $godam_settings['video']['use_watermark_image'];
	$rtgodam_watermark_text      = sanitize_text_field( $godam_settings['video']['watermark_text'] );
	$rtgodam_watermark_url       = esc_url( $godam_settings['video']['watermark_url'] );

	$watermark_to_use = array();

	/**
	 * Include watermark if set.
	 */
	if ( $rtgodam_watermark && $rtgodam_use_watermark_image ) {

		if ( ! empty( $rtgodam_watermark_url ) ) {
			$watermark_to_use['watermark_url'] = $rtgodam_watermark_url;
		}

		if ( ! empty( $rtgodam_watermark_text ) ) {
			$watermark_to_use['watermark_text'] = $rtgodam_watermark_text;
		}
	}

	/**
	 * Callback URL from CMM to plugin for transcoding.
	 */
	$callback_url = rest_url( 'godam/v1/transcoder-callback' );

	/**
	 * Manually setting the rest api endpoint, we can refactor that later to use similar functionality as callback_url.
	 */
	$status_callback_url = get_rest_url( get_current_blog_id(), '/godam/v1/transcoding/transcoding-status' );

	/**
	 * Prepare data to send as post request to CMM.
	 */
	// Get current user information for form submissions (since no specific attachment).
	$current_user = wp_get_current_user();
	$site_url     = get_site_url();

	// Get author name with fallback to username.
	$author_first_name = $current_user->first_name ?? '';
	$author_last_name  = $current_user->last_name ?? '';
	$author_email      = $current_user->user_email ?? '';

	// If first and last names are empty, use username as fallback.
	if ( empty( $author_first_name ) && empty( $author_last_name ) ) {
		$author_first_name = $current_user->user_login ?? '';
	}

	$body = array_merge(
		array(
			'api_token'            => $api_key,
			'job_type'             => $job_type ?? 'stream',
			'job_for'              => ! empty( $form_type ) ? $form_type . '-godam-recorder' : 'gf-godam-recorder',
			'file_origin'          => rawurlencode( $file_url ),
			'callback_url'         => rawurlencode( $callback_url ),
			'status_callback'      => rawurlencode( $status_callback_url ),
			'force'                => 0,
			'formats'              => $file_extension,
			'thumbnail_count'      => 0,
			'stream'               => true,
			'watermark'            => boolval( $rtgodam_watermark ),
			'resolutions'          => array( 'auto' ),
			'folder_name'          => ! empty( $form_title ) ? $form_title : __( 'Gravity forms', 'godam' ),
			'wp_author_email'      => apply_filters( 'godam_author_email_to_send', $author_email, 0 ),
			'wp_site'              => $site_url,
			'wp_author_first_name' => apply_filters( 'godam_author_first_name_to_send', $author_first_name, 0 ),
			'wp_author_last_name'  => apply_filters( 'godam_author_last_name_to_send', $author_last_name, 0 ),
			'public'               => 1,
		),
		$watermark_to_use
	);

	/**
	 * Prepare the args to pass to request.
	 */
	$args = array(
		'method'    => 'POST',
		'sslverify' => false,
		'timeout'   => 60, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
		'body'      => $body,
	);

	/**
	 * CMM Api key construction.
	 */
	$transcoding_api_url = RTGODAM_API_BASE . '/api/';
	$transcoding_url     = $transcoding_api_url . 'resource/Transcoder Job';

	/**
	 * Response from post request.
	 */
	$response = wp_remote_post( $transcoding_url, $args );

	if ( is_wp_error( $response ) || empty( $response['response']['code'] ) || 200 !== intval( $response['response']['code'] ) ) {
		return new WP_Error(
			400,
			sprintf(
				/* translators: %s: Entry ID for which transcoding failed */
				__( 'Transcoding failed | entry Id: %s', 'godam' ),
				$entry_id
			)
		);
	}

	return json_decode( $response['body'] );
}

/**
 * Format video duration based on the selected format for GoDAM block.
 *
 * @param string $duration        The raw duration value in seconds.
 * @param string $duration_format The format to use (default, minutes, seconds).
 *
 * @return string The formatted duration string.
 */
function rtgodam_block_format_video_duration( $duration, $duration_format = 'default' ) {
	if ( empty( $duration ) ) {
		return '';
	}

	// Parse the duration - assuming it's stored in seconds.
	$total_seconds = intval( $duration );
	$hours         = floor( $total_seconds / 3600 );
	$minutes       = floor( ( $total_seconds % 3600 ) / 60 );
	$seconds       = $total_seconds % 60;

	switch ( $duration_format ) {
		case 'minutes':
			// Show as MM:SS.
			$total_minutes = floor( $total_seconds / 60 );
			return sprintf( '%02d:%02d', $total_minutes, $seconds );

		case 'seconds':
			// Show total seconds with 's' suffix.
			return $total_seconds . __( 's', 'godam' );

		case 'default':
		default:
			// Show as HH:MM:SS.
			return sprintf( '%02d:%02d:%02d', $hours, $minutes, $seconds );
	}
}

/**
 * Retrieves user data for the current session.
 *
 * This function checks if a user is logged in and returns their email and display name.
 * If no user is logged in, it checks for a guest user cookie and returns the guest user's
 * email and constructed name. If neither is available, it defaults to a bot email and
 * guest name.
 *
 * @return array An associative array containing 'email' and 'name' of the user or guest.
 */
function rtgodam_get_current_logged_in_user_data() {
	if ( is_user_logged_in() ) {
		$current_user = wp_get_current_user();
		return array(
			'email' => $current_user->user_email,
			'name'  => $current_user->display_name,
			'type'  => 'user',
		);
	}

	// @To-do: Check for guest user cookie when we introduce this feature.

	$domain = preg_replace( '/^www\./', '', wp_parse_url( home_url(), PHP_URL_HOST ) );
	return array(
		'email' => 'anonymous@' . $domain,
		'name'  => __( 'Anonymous', 'godam' ),
		'type'  => 'non-user',
	);
}

/**
 * Retrieves a cached value by key.
 *
 * This function checks if the external object cache is being used.
 * If so, it retrieves the cached value using the WordPress cache API.
 * Otherwise, it retrieves the value from the transient API.
 *
 * @param string $key The cache key to retrieve the value for.
 * @return mixed The cached value, or false if the value does not exist.
 */
function rtgodam_cache_get( $key ) {
	if ( wp_using_ext_object_cache() ) {
		return wp_cache_get( $key );
	} else {
		return get_transient( $key );
	}
}

/**
 * Sets a value in the cache for a given key.
 *
 * This function checks if the external object cache is being used.
 * If so, it sets the value using the WordPress cache API.
 * Otherwise, it sets the value using the transient API.
 *
 * @param string $key     The cache key to set the value for.
 * @param mixed  $value   The value to set.
 * @param int    $expiration Optional. The time until the value expires in seconds.
 *
 * @return bool True on success, false on failure.
 */
function rtgodam_cache_set( $key, $value, $expiration = 900 ) {
	if ( is_string( $expiration ) || $expiration < 300 ) {
		$expiration = 300;
	}
	if ( wp_using_ext_object_cache() ) {
		return wp_cache_set( $key, $value, '', $expiration ); // phpcs:ignore
	} else {
		return set_transient( $key, $value, $expiration );
	}
}

/**
 * Deletes a cached value by key.
 *
 * This function checks if the external object cache is being used.
 * If so, it deletes the cached value using the WordPress cache API.
 * Otherwise, it deletes the value using the transient API.
 *
 * @param string $key The cache key to delete the value for.
 * @return bool True on success, false on failure.
 */
function rtgodam_cache_delete( $key ) {
	if ( wp_using_ext_object_cache() ) {
		return wp_cache_delete( $key );
	} else {
		return delete_transient( $key );
	}
}

/**
 * Check if the current environment is localhost.
 *
 * This function checks the server's remote address and host to determine if the site is running in a local development environment.
 * It checks against a whitelist of common localhost IPs and also looks for '.local' or '.test' in the host name.
 * Additionally, it respects the RTGODAM_IS_LOCAL constant if defined.
 *
 * @since 1.4.3
 *
 * @return bool True if the environment is localhost, false otherwise.
 */
function rtgodam_is_local_environment() {

	$whitelist = array( '127.0.0.1', '::1', 'localhost' );

	// phpcs:disable -- Disabling phpcs as its not manipulating any data, just reading server variables, and function is used for local environment check only.
	// We do NOT use REMOTE_ADDR because it can be 127.0.0.1 for loopback requests (Server processes) on hosted sites.
	// Instead, we rely on HTTP_HOST to detect if the site is actually hosted on localhost/local domains.
	$host = isset( $_SERVER['HTTP_HOST'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_HOST'] ) ) : '';
	// phpcs:enable

	$is_localhost = (
		in_array( $host, $whitelist, true ) ||
		strpos( $host, '.local' ) !== false ||
		strpos( $host, '.test' ) !== false
	);

	return ( $is_localhost || ( defined( 'RTGODAM_IS_LOCAL' ) && RTGODAM_IS_LOCAL ) );
}

/**
 * Fetch AI-generated video transcript path.
 *
 * @param int         $attachment_id The attachment ID (must be numeric).
 * @param string|null $job_id        Optional. The transcription job ID. If not provided, will be retrieved from post meta.
 * @return string|false Transcript path if available, false otherwise.
 */
function godam_get_transcript_path( $attachment_id, $job_id = null ) {
	if ( empty( $attachment_id ) || ! is_numeric( $attachment_id ) ) {
		return false;
	}

	// Check post meta first.
	$transcript_path = get_post_meta( $attachment_id, 'rtgodam_transcript_path', true );
	if ( ! empty( $transcript_path ) ) {
		return $transcript_path;
	}

	// Get job_id from parameter or post meta.
	if ( empty( $job_id ) ) {
		$job_id = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );
		if ( empty( $job_id ) ) {
			$job_id = get_post_meta( $attachment_id, '_godam_original_id', true );
		}
	}

	if ( empty( $job_id ) ) {
		return false;
	}

	// Get API key.
	$api_key = get_option( 'rtgodam-api-key', '' );
	if ( empty( $api_key ) ) {
		return false;
	}

	// Make POST request to Frappe API.
	$rest_url = RTGODAM_API_BASE . '/api/method/godam_core.api.process.get_transcription';

	$request_body = array(
		'job_name' => sanitize_text_field( $job_id ),
		'api_key'  => sanitize_text_field( $api_key ),
	);

	$args = array(
		'method'  => 'POST',
		'timeout' => 3,
		'headers' => array(
			'Content-Type' => 'application/json',
		),
		'body'    => wp_json_encode( $request_body ),
	);

	$response = wp_remote_post( $rest_url, $args );

	if ( is_wp_error( $response ) ) {
		return false;
	}

	$response_code = wp_remote_retrieve_response_code( $response );

	if ( 200 !== $response_code ) {
		return false;
	}

	$body = wp_remote_retrieve_body( $response );
	$data = json_decode( $body, true );

	if (
		is_array( $data ) &&
		isset( $data['message']['transcript_path'], $data['message']['transcription_status'] ) &&
		'Transcribed' === $data['message']['transcription_status']
	) {
		$transcript_path = esc_url_raw( $data['message']['transcript_path'] );

		// Save to post meta using the attachment ID.
		if ( ! empty( $transcript_path ) ) {
			update_post_meta( $attachment_id, 'rtgodam_transcript_path', $transcript_path );
		}

		return $transcript_path;
	}

	return false;
}

/**
 * Generate the HTML content for the video preview page.
 *
 * This function constructs the HTML structure for a video preview page based on the provided video ID.
 * It checks if the video exists and displays either the video player or an error message accordingly.
 *
 * @param int $video_id The ID of the video attachment to preview.
 * @return string The generated HTML content for the video preview page.
 */
function godam_preview_page_content( $video_id ) {
	ob_start();
	// Check if video ID is provided and if video attachment exists.
	$video_attachment = null;
	$show_video       = false;
	$video_id         = intval( $video_id );

	if ( ! empty( $video_id ) ) {
		$video_attachment = get_post( $video_id );
		$show_video       = $video_attachment && 'attachment' === $video_attachment->post_type;
	}

	if ( ! $show_video ) {
		// Display error message for missing or invalid video.
		?>
		<div class="godam-video-preview--container">
			<h1 class="godam-video-preview--title"><?php esc_html_e( 'Video Preview', 'godam' ); ?></h1>
			<p class="video-not-found"><?php esc_html_e( 'Oops! We could not locate your video', 'godam' ); ?></p>
		</div>
		<?php
	} else {
		// Display video content.
		?>
		<header class="godam-video-preview--container">
			<h1 class="godam-video-preview--title">
				<strong><?php esc_html_e( 'Video Preview: ', 'godam' ); ?></strong>
				<?php echo esc_html( get_the_title( $video_id ) ); ?>
			</h1>
		</header>

		<div class="godam-video-preview--container">
			<div class="godam-video-preview--notice">
				<?php esc_html_e( 'Note: This is a simple video preview. The video player may display differently when added to a page based on theme styles.', 'godam' ); ?>
			</div>
		</div>

		<div class="godam-video-preview">
			<?php echo do_shortcode( '[godam_video id="' . $video_id . '"]' ); ?>
		</div>
		<?php
	}
	return ob_get_clean();
}

/**
 * Get post id from meta key and value.
 * 
 * @since 1.5.0
 *
 * @param string $key   Meta key.
 * @param mixed  $value Meta value.
 *
 * @return int|bool     Return post id if found else false.
 */
function rtgodam_get_post_id_by_meta_key_and_value( $key, $value ) {
	global $wpdb;
	$cache_key = md5( 'meta_key_' . $key . '_meta_value_' . $value );

	$meta = rtgodam_cache_get( $cache_key );
	if ( empty( $meta ) ) {
		$meta = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$wpdb->postmeta} WHERE meta_key = %s AND meta_value = %s", $key, $value ) );  // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		rtgodam_cache_set( $cache_key, $meta, HOUR_IN_SECONDS );
	}

	if ( is_array( $meta ) && ! empty( $meta ) && isset( $meta[0] ) ) {
		$meta = $meta[0];
	}
	if ( is_object( $meta ) ) {
		return $meta->post_id;
	}
	return false;
}

/**
 * Generate HTML content for the video embed page.
 *
 * This function produces the HTML markup for embedding a single video.
 * It displays the video player only, without any headers or notices,
 * making it suitable for embedding in iframes or modals.
 *
 * @param int  $video_id The ID of the video attachment to embed.
 * @param bool $show_engagements Whether to show engagements.
 *
 * @since 1.5.0
 *
 * @return string The generated HTML content for the video embed page.
 */
function godam_embed_page_content( $video_id, $show_engagements = false ) {
	ob_start();
	// Check if video ID is provided and if video attachment exists.
	$video_attachment = null;
	$show_video       = false;
	$video_id         = intval( $video_id );
	$show_engagements = $show_engagements ? 'show' : '';

	if ( ! empty( $video_id ) ) {
		$video_attachment = get_post( $video_id );
		$show_video       = $video_attachment && 'attachment' === $video_attachment->post_type && 'video/' === substr( $video_attachment->post_mime_type, 0, 6 );
	}

	if ( ! $show_video ) {
		// Display error message for missing or invalid video.
		?>
		<div class="godam-video-embed--container">
			<p class="video-not-found"><?php esc_html_e( 'Video not found', 'godam' ); ?></p>
		</div>
		<?php
	} else {
		// Display video content.
		?>
		<div class="godam-video-embed" data-show-engagements="<?php echo esc_attr( $show_engagements ? 'true' : 'false' ); ?>">
			<?php echo do_shortcode( '[godam_video id="' . $video_id . '" engagements="' . $show_engagements . '"]' ); ?>
		</div>
		<?php
	}
	return ob_get_clean();
}
