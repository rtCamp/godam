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

	/**
	 * Fires before resolving this attachment's URL, so integrations that
	 * centralize media on another site can switch context first.
	 *
	 * @since 2.2.0
	 */
	do_action( 'rtgodam_before_attachment_lookup' );
	try {
		$media = get_post( $media_id );

		if ( ! $media || 'attachment' !== $media->post_type ) {
			return '';
		}

		$media_url = wp_get_attachment_url( $media_id );

		return $media_url ? $media_url : '';
	} finally {
		do_action( 'rtgodam_after_attachment_lookup' );
	}
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
 *     - 'cardLayout' (string): Layout type for the CTA card.
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
	$is_godam_media = isset( $layer['image'] ) && is_string( $layer['image'] ) && str_starts_with( $layer['image'], 'godam_' );

	if ( $is_godam_media && ! empty( $layer['imageUrlExt'] ) ) {
		$image_url = $layer['imageUrlExt'];
	} else {
		$image_url = rtgodam_fetch_overlay_media_url( isset( $layer['image'] ) ? $layer['image'] : 0 );
	}

	// Define allowed layouts for validation.
	$allowed_layouts = array(
		'card-layout--text-imagecover',
		'card-layout--text-image',
		'card-layout--image-bottom',
		'card-layout--image-background',
		'card-layout--imagecover-text',
		'card-layout--image-text',
		'card-layout--image-top',
		'desktop-text-only',
	);

	// Backward compatibility: determine default layout based on imageCtaOrientation.
	$default_layout = 'card-layout--image-text';
	if ( isset( $layer['imageCtaOrientation'] ) && 'landscape' !== $layer['imageCtaOrientation'] ) {
		$default_layout = 'card-layout--image-top';
	}

	$layout = isset( $layer['cardLayout'] ) && in_array( $layer['cardLayout'], $allowed_layouts, true )
		? $layer['cardLayout']
		: $default_layout;

	$has_image            = ! empty( $image_url );
	$image_opacity        = isset( $layer['imageOpacity'] ) ? floatval( $layer['imageOpacity'] ) : 1;
	$image_width          = isset( $layer['imageWidth'] ) ? absint( $layer['imageWidth'] ) : 50;
	$image_text           = isset( $layer['imageText'] ) ? sanitize_text_field( $layer['imageText'] ) : '';
	$image_description    = isset( $layer['imageDescription'] ) ? sanitize_text_field( $layer['imageDescription'] ) : '';
	$image_link           = isset( $layer['imageLink'] ) ? $layer['imageLink'] : '#';
	$cta_background_color = isset( $layer['imageCtaButtonColor'] ) ? sanitize_hex_color( $layer['imageCtaButtonColor'] ) : '#111';
	$cta_text_color       = isset( $layer['imageCtaButtonTextColor'] ) ? sanitize_hex_color( $layer['imageCtaButtonTextColor'] ) : '#ffffff';
	$cta_button_text      = ! empty( $layer['imageCtaButtonText'] ) ? sanitize_text_field( $layer['imageCtaButtonText'] ) : __( 'Check now', 'godam' );

	// Ensure opacity is within valid range.
	$image_opacity = max( 0, min( 1, $image_opacity ) );

	// Ensure width is within valid range.
	$image_width = max( 0, min( 100, $image_width ) );

	// If no image is provided, force text-only layout on frontend.
	if ( ! $has_image ) {
		$layout = 'desktop-text-only';
	}

	// Generate image element.
	if ( $has_image ) {
		$image_element = sprintf(
			'<img src="%s" alt="%s" style="opacity: %s;" />',
			esc_url( $image_url ),
			esc_attr__( 'CTA Card Image', 'godam' ),
			esc_attr( $image_opacity )
		);
	} else {
		$image_element = sprintf(
			'<div class="godam-cta-card-image-placeholder" style="opacity: %s;">%s</div>',
			esc_attr( $image_opacity ),
			esc_html__( 'No Image', 'godam' )
		);
	}

	// Generate content element.
	$content_element = '<div class="godam-cta-card-content">';

	if ( ! empty( $image_text ) ) {
		$content_element .= sprintf( '<h2 class="card-title">%s</h2>', esc_html( $image_text ) );
	}

	if ( ! empty( $image_description ) ) {
		$content_element .= sprintf( '<p class="card-description">%s</p>', esc_html( $image_description ) );
	}

	if ( ! empty( $cta_button_text ) || ! empty( $image_link ) ) {
		$content_element .= sprintf(
			'<div class="btns"><a class="godam-cta-btn" href="%s" target="_blank" rel="noopener noreferrer" style="background-color: %s; color: %s; text-decoration: none;">%s</a></div>',
			esc_url( $image_link ),
			esc_attr( $cta_background_color ),
			esc_attr( $cta_text_color ),
			esc_html( $cta_button_text )
		);
	}

	$content_element .= '</div>';

	// Handle different layouts.
	$card_content = '';

	if ( 'desktop-text-only' === $layout ) {
		// Text only - no image.
		$card_content = $content_element;
	} elseif ( 'card-layout--image-background' === $layout ) {
		// Image background layout.
		$card_content = sprintf(
			'<div class="godam-cta-card-image-bg" style="background-image: url(\'%s\'); opacity: %s;"></div>%s',
			esc_url( $image_url ),
			esc_attr( $image_opacity ),
			$content_element
		);
	} else {
		// All other layouts with image element.
		$image_content = sprintf( '<div class="godam-cta-card-image">%s</div>', $image_element );

		// Return based on layout order.
		if ( in_array( $layout, array( 'card-layout--text-imagecover', 'card-layout--text-image', 'card-layout--image-bottom' ), true ) ) {
			$card_content = $content_element . $image_content;
		} else {
			$card_content = $image_content . $content_element;
		}
	}

	return sprintf(
		'<div class="godam-cta-overlay-container"><div class="godam-cta-card %s" style="--image-width: %s%%;">%s</div></div>',
		esc_attr( $layout ),
		esc_attr( $image_width ),
		$card_content
	);
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

	// If no API key is stored, skip all remote verification — there is nothing
	// to verify. Return (or persist) a clean NO_API_KEY state immediately.
	// This also handles the legacy backward-compat case: older plugin versions
	// never wrote the status option, so it defaulted to 'valid' even when no key
	// was present. With the new NO_API_KEY default in get_status() that edge case
	// is resolved for new installs; the early-return here is the safety net for
	// any sites that still have stale cached data.
	if ( empty( $api_key ) ) {
		$no_key_data = array(
			'currentUserId'  => get_current_user_id(),
			'valid_api_key'  => false,
			'api_key_status' => \RTGODAM\Inc\Enums\Api_Key_Status::NO_API_KEY,
			'user_data'      => array( 'masked_api_key' => '' ),
			'timestamp'      => time(),
		);

		// Persist only if the cache is missing or has an incorrect status.
		if (
			empty( $rtgodam_user_data ) ||
			! isset( $rtgodam_user_data['api_key_status'] ) ||
			\RTGODAM\Inc\Enums\Api_Key_Status::NO_API_KEY !== $rtgodam_user_data['api_key_status']
		) {
			update_option( 'rtgodam_user_data', $no_key_data );
		}

		if ( $use_for_localize_array ) {
			return array(
				'currentUserId' => $no_key_data['currentUserId'],
				'validApiKey'   => false,
				'apiKeyStatus'  => \RTGODAM\Inc\Enums\Api_Key_Status::NO_API_KEY,
				'userApiData'   => $no_key_data['user_data'],
				'timestamp'     => $no_key_data['timestamp'],
			);
		}

		return $no_key_data;
	}

	// Check if we should skip verification.
	// Skip only for expired keys that are past their grace period.
	$skip_verification = false;
	if ( ! $force_refresh && \RTGODAM\Inc\Enums\Api_Key_Status::EXPIRED === $api_key_status && ! rtgodam_is_api_key_in_grace_period() ) {
		// Grace period expired for expired key, pause automatic checks until manual refresh.
		$skip_verification = true;
	}

	$should_verify = (
		empty( $rtgodam_user_data ) ||
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
			$status_code = is_array( $error_data ) && isset( $error_data['status'] ) ? $error_data['status'] : \RTGODAM\Inc\Enums\HTTP_Status_Code::INTERNAL_SERVER_ERROR;

			if ( \RTGODAM\Inc\Enums\HTTP_Status_Code::INTERNAL_SERVER_ERROR === $status_code && ! empty( $api_key ) ) {
				// Server error with existing API key - DON'T change DB status, just show verification_failed to user.
				// DON'T set error timestamp - this is temporary and we should keep checking.
				$transient_status = \RTGODAM\Inc\Enums\Api_Key_Status::VERIFICATION_FAILED;
				$valid_api_key    = false;
			} elseif ( \RTGODAM\Inc\Enums\HTTP_Status_Code::INTERNAL_SERVER_ERROR !== $status_code ) {
				$valid_api_key = false;
				// Preserve existing user data for expired/invalid keys.
				$existing_usage = get_option( 'rtgodam-usage', array() );
				if ( ! empty( $existing_usage ) && isset( $existing_usage[ $api_key ] ) ) {
					$user_data = is_object( $existing_usage[ $api_key ] ) ? (array) $existing_usage[ $api_key ] : $existing_usage[ $api_key ];
				}
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
 * Resolve whether GoDAM's WordPress media-library admin UI is enabled.
 *
 * "Additive mode" lets GoDAM coexist with another DAM/media plugin by
 * suppressing GoDAM's media-library takeover (folder UI, "Manage Media"
 * button, search override, attachment-browser folder/date filters) while
 * leaving blocks, the front-end player, analytics, transcoding, REST, the
 * GoDAM media-modal tab, and GoDAM's own admin pages intact.
 *
 * The single "enable folder organization" toggle (`general.enable_folder_organization`)
 * is GoDAM's media-library integration master switch; turning it off runs GoDAM in
 * additive mode. This helper resolves that toggle with the code-level overrides.
 *
 * Resolution precedence (code-level is authoritative):
 *  1. A defined, truthy `RTGODAM_DISABLE_MEDIA_LIBRARY_UI` constant forces it
 *     off and cannot be overridden.
 *  2. Otherwise the `rtgodam-settings` → general → `enable_folder_organization`
 *     option (default `true`).
 *  3. The `rtgodam_enable_media_library_ui` filter can override the option value.
 *
 * @since 1.11.2
 *
 * @return bool True when the media-library UI should load (default), false in additive mode.
 */
function rtgodam_is_media_library_ui_enabled() {
	if ( defined( 'RTGODAM_DISABLE_MEDIA_LIBRARY_UI' ) && RTGODAM_DISABLE_MEDIA_LIBRARY_UI ) {
		return false;
	}

	$settings = get_option( 'rtgodam-settings', array() );
	if ( ! is_array( $settings ) ) {
		$settings = array();
	}

	$general_settings = $settings['general'] ?? array();
	if ( ! is_array( $general_settings ) ) {
		$general_settings = array();
	}

	$enabled = $general_settings['enable_folder_organization'] ?? true;

	/**
	 * Filters whether GoDAM's media-library admin UI is enabled.
	 *
	 * Code-level override for coexistence deployments when the disabling
	 * constant is not set. Return false to run GoDAM in additive mode
	 * (suppress the media-library takeover).
	 *
	 * @since 1.11.2
	 *
	 * @param bool $enabled Whether the media-library UI is enabled.
	 */
	return (bool) apply_filters( 'rtgodam_enable_media_library_ui', $enabled );
}

/**
 * Check whether the media-library UI value is forced from code.
 *
 * Used to render the dashboard toggle as locked ("managed in code") so an
 * admin can't fight a code-level value set via the constant or the
 * `rtgodam_enable_media_library_ui` filter.
 *
 * The filter only counts as "managing" the value when it actually overrides the
 * stored option — a passthrough or observe-only hook (e.g. logging) must not lock
 * the toggle for a setting no code really controls.
 *
 * @since 1.11.2
 *
 * @return bool True when the constant is defined-truthy, or a filter changes the stored value.
 */
function rtgodam_is_media_library_ui_code_managed() {
	if ( defined( 'RTGODAM_DISABLE_MEDIA_LIBRARY_UI' ) && RTGODAM_DISABLE_MEDIA_LIBRARY_UI ) {
		return true;
	}

	if ( ! has_filter( 'rtgodam_enable_media_library_ui' ) ) {
		return false;
	}

	$settings = get_option( 'rtgodam-settings', array() );
	$general  = is_array( $settings ) && isset( $settings['general'] ) && is_array( $settings['general'] )
		? $settings['general']
		: array();
	$stored   = (bool) ( $general['enable_folder_organization'] ?? true );

	// Locked only if the filter resolves to something other than the stored option.
	return rtgodam_is_media_library_ui_enabled() !== $stored;
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
 * Check if the given file is an audio file.
 *
 * @since 1.6.0
 *
 * @param string $file_path_or_url The file path or URL to check.
 *
 * @return bool True if the file is an audio file, false otherwise.
 */
function godam_is_audio_file( $file_path_or_url ) {
	if ( empty( $file_path_or_url ) || ! is_string( $file_path_or_url ) ) {
		return false;
	}

	$file_type = wp_check_filetype( $file_path_or_url );
	$mime_type = ! empty( $file_type['type'] ) ? $file_type['type'] : '';

	// Check if the MIME type indicates an audio file.
	if ( ! empty( $mime_type ) && str_starts_with( $mime_type, 'audio/' ) ) {
		return true;
	}

	// Container formats that can hold both audio and video.
	// These require filename-based detection to distinguish audio from video.
	$container_formats = array( 'webm', 'mp4' );

	// Handle ambiguous container formats that might be audio.
	// Browser-specific behavior:
	// - Chromium (Chrome, Edge): Saves both video and audio as .webm
	// - Firefox: Saves audio as .ogg, video as .webm
	// - Safari: Saves both audio and video as .mp4
	// We check the filename for 'audio' keyword to determine if it's an audio file.
	if ( in_array( $file_type['ext'], $container_formats, true ) && godam_is_audio_file_by_name( $file_path_or_url ) ) {
		return true;
	}

	return false;
}

/**
 * Document formats the Document block can display, as MIME type => primary extension.
 *
 * Mirrors GoDAM Central's own allowlist (`godam_core/api/media.py::OFFICE_DOCUMENT_MIMES`)
 * plus `application/pdf`. Central converts everything except PDF to a preview PDF, so the
 * block only ever renders a PDF whatever the author uploaded — but the *upload* has to be
 * accepted here first, and the transcoder has to label the job `document` rather than `pdf`.
 *
 * This is the single source of truth on the PHP side; the editor's copy lives in
 * assets/src/blocks/godam-pdf/constants.js and the two are asserted equal by
 * tests/php/DocumentSupportTest.php.
 *
 * @since n.e.x.t
 *
 * @return array<string, string> MIME type => primary file extension.
 */
function rtgodam_get_supported_document_types() {
	return array(
		'application/pdf'                                 => 'pdf',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
		'application/msword'                              => 'doc',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
		'application/vnd.ms-excel'                        => 'xls',
		'application/vnd.openxmlformats-officedocument.presentationml.presentation' => 'pptx',
		'application/vnd.ms-powerpoint'                   => 'ppt',
		'application/vnd.oasis.opendocument.text'         => 'odt',
		'application/vnd.oasis.opendocument.spreadsheet'  => 'ods',
		'application/vnd.oasis.opendocument.presentation' => 'odp',
		'text/plain'                                      => 'txt',
		'text/csv'                                        => 'csv',
		// Some servers report .csv as application/csv; Central accepts both.
		'application/csv'                                 => 'csv',
	);
}

/**
 * File extensions accepted by the Document block.
 *
 * Derived from rtgodam_get_supported_document_types(). Note this is intentionally
 * narrower than the MIME list: several extensions share a MIME type, and only the
 * ones named here are recognised when no attachment is available to ask.
 *
 * @since n.e.x.t
 *
 * @return string[] Lowercase extensions, without the leading dot.
 */
function rtgodam_get_supported_document_extensions() {
	return array_values( array_unique( rtgodam_get_supported_document_types() ) );
}

/**
 * Read the file extension out of a path or URL.
 *
 * Query strings and fragments are dropped first: CDN URLs routinely carry `?v=2` or
 * `#page=3`, and reading the extension off the raw string would see "pdf?v=2".
 *
 * @since n.e.x.t
 *
 * @param string $path_or_url File path or URL.
 *
 * @return string Lowercase extension without the leading dot, or an empty string.
 */
function rtgodam_get_extension_from_path( $path_or_url ) {
	if ( empty( $path_or_url ) || ! is_string( $path_or_url ) ) {
		return '';
	}

	$path = wp_parse_url( $path_or_url, PHP_URL_PATH );

	return strtolower( pathinfo( ! empty( $path ) ? $path : $path_or_url, PATHINFO_EXTENSION ) );
}

/**
 * The extension of the file an attachment actually points at.
 *
 * The stored path is preferred over the URL: it is what the file is called on disk, and it
 * avoids a second query for attachments whose URL is filtered to a CDN.
 *
 * @since n.e.x.t
 *
 * @param int $attachment_id Attachment ID.
 *
 * @return string Lowercase extension without the leading dot, or an empty string when the
 *                attachment has no resolvable file.
 */
function rtgodam_get_attachment_extension( $attachment_id ) {
	$attachment_id = absint( $attachment_id );

	if ( ! $attachment_id ) {
		return '';
	}

	$file = get_post_meta( $attachment_id, '_wp_attached_file', true );

	if ( empty( $file ) ) {
		$file = wp_get_attachment_url( $attachment_id );
	}

	return rtgodam_get_extension_from_path( $file );
}

/**
 * Check whether a document can be displayed by the Document block.
 *
 * The block renders a PDF: either the file itself, or — for Word / Excel / PowerPoint /
 * OpenDocument / text uploads — the preview PDF GoDAM Central generates for it. Anything
 * outside that set has no preview to show, so callers use this to skip front-end output
 * entirely and to show an "unsupported format" notice in the editors instead.
 *
 * The attachment's stored MIME type is authoritative. The URL extension is only a
 * fallback, for GoDAM tab media whose id is not a local numeric attachment and for
 * documents added by URL alone.
 *
 * WordPress maps .asc/.c/.h/.srt to text/plain exactly as it maps .txt, so the MIME type
 * alone would class every subtitle and source file in the library as a document. Those have
 * no conversion path — rtgodam_is_supported_document_attachment() keeps the transcoder from
 * dispatching them at all — so the extension has to agree with the MIME type whenever the
 * attachment's own file can be resolved. When it cannot (a deleted or virtual attachment),
 * the MIME type stands on its own rather than rejecting content that still renders.
 *
 * @since 2.1.0
 * @since n.e.x.t Widened beyond PDF to the formats in rtgodam_get_supported_document_types().
 *
 * @param int|string $attachment_id Attachment ID, or a non-numeric GoDAM media id.
 * @param string     $url           Document URL. Used when no local attachment is available.
 *
 * @return bool True when the document is a supported format, false otherwise.
 */
function godam_is_supported_document( $attachment_id = 0, $url = '' ) {
	// 0 for anything that cannot be an attachment id, which falls through to the URL check
	// below. See rtgodam_normalize_attachment_id() for why that is stricter than is_numeric().
	$attachment_id = rtgodam_normalize_attachment_id( $attachment_id );

	if ( $attachment_id ) {
		$mime_type = get_post_mime_type( $attachment_id );

		if ( ! empty( $mime_type ) ) {
			if ( ! array_key_exists( $mime_type, rtgodam_get_supported_document_types() ) ) {
				return false;
			}

			$extension = rtgodam_get_attachment_extension( $attachment_id );

			// No resolvable file (virtual GoDAM media, or a file already removed from disk):
			// there is no extension to confirm, so the MIME type is all there is to go on.
			return '' === $extension
				|| in_array( $extension, rtgodam_get_supported_document_extensions(), true );
		}

		// Attachment no longer exists; fall through to the URL check so content
		// that still carries a valid document URL keeps rendering.
	}

	if ( empty( $url ) || ! is_string( $url ) ) {
		return false;
	}

	return in_array( rtgodam_get_extension_from_path( $url ), rtgodam_get_supported_document_extensions(), true );
}

/**
 * Normalise a Document block's `id` attribute to a usable attachment ID.
 *
 * Attachment IDs are positive integers, so this requires digits rather than any
 * numeric-looking value. is_numeric() would also accept floats and scientific notation
 * ('12.5', '1e3'), which absint() then silently turns into a DIFFERENT id — a mistyped
 * shortcode would resolve somebody else's attachment and answer for that instead.
 *
 * Anything else returns 0, which callers treat as "no local attachment" and fall back to the
 * URL they were given. That is the safe direction.
 *
 * @since n.e.x.t
 *
 * @param int|string $attachment_id Attachment ID, or a non-numeric GoDAM media id.
 *
 * @return int Attachment ID, or 0 when the value cannot be one.
 */
function rtgodam_normalize_attachment_id( $attachment_id ) {
	if ( is_int( $attachment_id ) && $attachment_id > 0 ) {
		return $attachment_id;
	}

	if ( is_string( $attachment_id ) && ctype_digit( trim( $attachment_id ) ) ) {
		return absint( trim( $attachment_id ) );
	}

	return 0;
}

/**
 * Whether an attachment is a document GoDAM Central can convert.
 *
 * Stricter than a MIME-only test, and deliberately so: several of the supported MIME types
 * are shared with formats that have no conversion path. WordPress maps .srt, .asc, .c, .cc
 * and .h to text/plain exactly as it maps .txt, so a MIME-only check would classify every
 * subtitle and source file in the media library as a document — dispatching them for
 * transcoding and showing them a progress indicator that never resolves.
 *
 * Requiring the extension to match as well costs nothing for the real formats, since each
 * one carries its own extension anyway.
 *
 * @since n.e.x.t
 *
 * @param int $attachment_id Attachment ID.
 *
 * @return bool True when the attachment is a convertible document.
 */
function rtgodam_is_supported_document_attachment( $attachment_id ) {
	$attachment_id = absint( $attachment_id );

	if ( ! $attachment_id ) {
		return false;
	}

	$mime_type = get_post_mime_type( $attachment_id );

	if ( empty( $mime_type ) || ! array_key_exists( $mime_type, rtgodam_get_supported_document_types() ) ) {
		return false;
	}

	return in_array( rtgodam_get_attachment_extension( $attachment_id ), rtgodam_get_supported_document_extensions(), true );
}

/**
 * Resolve the PDF a Document block should render for an attachment.
 *
 * Always returns a PDF URL or an empty string, never the original Office/text file:
 *
 * 1. `rtgodam_preview_pdf_url` — set by the transcoder callback for every transcoded
 *    document (for a PDF it is the CDN copy; for anything else it is the preview PDF
 *    Central generated). This is the normal path.
 * 2. `rtgodam_transcoded_url` — the key used before document support landed. Only trusted for
 *    PDFs, because for a document it holds the *original* file, which is not renderable.
 * 3. The local attachment URL, again only for PDFs.
 *
 * Steps 2 and 3 are what keep already-published PDF blocks rendering without a migration.
 *
 * An empty return means "no preview available" — either transcoding has not finished or
 * the file is password protected, and the caller should show its download-only panel.
 *
 * @since n.e.x.t
 *
 * @param int|string $attachment_id Attachment ID, or a non-numeric GoDAM media id.
 * @param string     $fallback_src  URL to fall back to when there is no local attachment.
 *
 * @return string Preview PDF URL, or an empty string when none is available.
 */
function rtgodam_get_document_preview_url( $attachment_id = 0, $fallback_src = '' ) {
	$attachment_id = rtgodam_normalize_attachment_id( $attachment_id );

	if ( $attachment_id ) {
		$preview_url = get_post_meta( $attachment_id, 'rtgodam_preview_pdf_url', true );

		if ( ! empty( $preview_url ) ) {
			return $preview_url;
		}

		if ( 'application/pdf' === get_post_mime_type( $attachment_id ) ) {
			$transcoded_url = get_post_meta( $attachment_id, 'rtgodam_transcoded_url', true );

			if ( ! empty( $transcoded_url ) ) {
				return $transcoded_url;
			}

			$attachment_url = wp_get_attachment_url( $attachment_id );

			if ( ! empty( $attachment_url ) ) {
				return $attachment_url;
			}
		}

		return '';
	}

	// No local attachment: a URL-only document can only be previewed when it is
	// already a PDF, since there is nothing to look a generated preview up against.
	if ( empty( $fallback_src ) || ! is_string( $fallback_src ) ) {
		return '';
	}

	return 'pdf' === rtgodam_get_extension_from_path( $fallback_src ) ? $fallback_src : '';
}

/**
 * Resolve the URL a Document block should offer for download.
 *
 * This is always the file the author actually uploaded — never the generated preview.
 * Somebody who uploads report.xlsx and downloads preview.pdf will think something broke.
 *
 * wp_get_attachment_url() already resolves virtual GoDAM media to its CDN URL via
 * Media_Library_Ajax::filter_attachment_url_for_virtual_media(), so local and GoDAM-tab
 * attachments are both handled here — but see the note in the body on the one case where
 * that resolution silently produces a path nothing serves.
 *
 * Attachment access is bracketed by rtgodam_before_attachment_lookup /
 * rtgodam_after_attachment_lookup, as everywhere else that reads attachment data.
 *
 * @since n.e.x.t
 *
 * @param int|string $attachment_id Attachment ID, or a non-numeric GoDAM media id.
 * @param string     $fallback_src  URL to fall back to when there is no local attachment.
 *
 * @return string Original document URL, or an empty string when none is available.
 */
function rtgodam_get_document_download_url( $attachment_id = 0, $fallback_src = '' ) {
	$godam_post_id = rtgodam_normalize_attachment_id( $attachment_id );

	if ( $godam_post_id ) {
		/**
		 * Fires before reading this attachment's URL, its virtual-media marker and its
		 * transcoded-URL meta, so integrations that centralize media on another site can
		 * switch context first. Wrapped in try/finally because the block below returns from
		 * several points once it determines which URL to offer.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		try {
			$attachment_url = wp_get_attachment_url( $godam_post_id );

			/*
			 * Virtual media — a GoDAM tab import, marked by _godam_original_id — has no local
			 * file at all: `_wp_attached_file` holds a bare filename that stands for nothing
			 * on disk.
			 *
			 * filter_attachment_url_for_virtual_media() normally redirects such an attachment
			 * to the CDN, but it does so ONLY through the post guid, and returns WordPress's
			 * own value untouched when that guid is empty. WordPress then joins the bare
			 * filename onto the uploads base URL, so the caller gets a confident-looking
			 * /wp-content/uploads/report.docx that 404s.
			 *
			 * rtgodam_transcoded_url is written for these attachments at import time and
			 * points at the same file on the CDN, so it is the right answer whenever the
			 * resolved URL turns out to be that local dead end. This matters most for a
			 * document with no preview, where the download link is the only thing the block
			 * can offer a visitor.
			 */
			$godam_original_id = get_post_meta( $godam_post_id, '_godam_original_id', true );

			if ( ! empty( $godam_original_id ) ) {
				$godam_uploads     = wp_get_upload_dir();
				$godam_uploads_url = ! empty( $godam_uploads['baseurl'] ) ? $godam_uploads['baseurl'] : '';
				$godam_is_local    = empty( $attachment_url )
					|| ( ! empty( $godam_uploads_url ) && 0 === strpos( $attachment_url, $godam_uploads_url ) );

				if ( $godam_is_local ) {
					$godam_transcoded_url = get_post_meta( $godam_post_id, 'rtgodam_transcoded_url', true );

					if ( ! empty( $godam_transcoded_url ) ) {
						return $godam_transcoded_url;
					}
				}
			}

			if ( ! empty( $attachment_url ) ) {
				return $attachment_url;
			}
		} finally {
			do_action( 'rtgodam_after_attachment_lookup' );
		}
	}

	return is_string( $fallback_src ) ? $fallback_src : '';
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
	 * Get MIME type from file URL.
	 */
	$file_type_info = wp_check_filetype( $file_url );
	$content_type   = $file_type_info['type'] ?? '';

	/**
	 * Set the default settings.
	 */
	$default_settings = array(
		'video' => array(
			'adaptive_bitrate'    => true,
			'watermark'           => false,
			'watermark_text'      => '',
			'watermark_url'       => '',
			'video_thumbnails'    => 0,
			'use_watermark_image' => false,
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

	include_once RTGODAM_PATH . 'admin/class-rtgodam-transcoder-rest-routes.php';

	/**
	 * Callback URL from CMM to plugin for transcoding.
	 */
	$callback_url = \RTGODAM_Transcoder_Rest_Routes::get_callback_url();

	$status_callback_url = \RTGODAM_Transcoder_Rest_Routes::get_callback_url( 'status' );

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
			'mime_type'            => $content_type,
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

	// Strip port number if present (e.g., "localhost:8080" → "localhost").
	$host_without_port = preg_replace( '/:\d+$/', '', $host );

	$is_localhost = (
		in_array( $host_without_port, $whitelist, true ) ||
		preg_match( '/\.local$/', $host_without_port ) ||
		preg_match( '/\.test$/', $host_without_port )
	);

	return ( $is_localhost || ( defined( 'RTGODAM_IS_LOCAL' ) && RTGODAM_IS_LOCAL ) );
}

/**
 * Check if the site has HTTP authentication enabled.
 *
 * This function uses a result from JavaScript-based detection.
 * The JS detection runs in the browser and can accurately detect HTTP auth
 * by making a request without credentials, then stores the result in an option.
 * If no cached status exists, this function falls back to a default of "not enabled".
 *
 * @since 1.7.1
 *
 * @return bool True if HTTP auth is enforced, false otherwise.
 */
function rtgodam_has_http_auth(): bool {
	$has_http_auth = false;

	// Get detection result from JavaScript detector.
	$cached_status = get_option( 'rtgodam_http_auth_status', array() );

	// If we have a recent detection result, use it.
	if ( ! empty( $cached_status ) && isset( $cached_status['enabled'] ) ) {
		$has_http_auth = (bool) $cached_status['enabled'];
	}

	/**
	 * Filter to override HTTP auth detection.
	 *
	 * @since 1.7.1
	 *
	 * @param bool $has_http_auth Whether HTTP auth is enforced.
	 */
	return apply_filters( 'godam_has_http_auth', $has_http_auth );
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

	/**
	 * Fires before reading this attachment's transcript/job-id meta, so
	 * integrations that centralize media on another site can switch
	 * context first.
	 *
	 * @since 2.2.0
	 */
	do_action( 'rtgodam_before_attachment_lookup' );
	try {
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
	} finally {
		do_action( 'rtgodam_after_attachment_lookup' );
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
			/**
			 * Fires before writing this attachment's transcript-path meta, so
			 * integrations that centralize media on another site can switch
			 * context first.
			 *
			 * @since 2.2.0
			 */
			do_action( 'rtgodam_before_attachment_lookup' );
			update_post_meta( $attachment_id, 'rtgodam_transcript_path', $transcript_path );
			do_action( 'rtgodam_after_attachment_lookup' );
		}

		return $transcript_path;
	}

	return false;
}

/**
 * Generate the HTML content for the preview page.
 *
 * Constructs the HTML for the shared front-end preview page based on the given
 * attachment ID. It checks that the attachment exists and renders the markup for
 * its media type — video player, audio player, or the image block (with hotspot /
 * product layers) — or an error message when the attachment is missing.
 *
 * @param int $video_id The ID of the attachment to preview (video, audio or image).
 * @return string The generated HTML content for the preview page.
 */
function godam_preview_page_content( $video_id ) {
	ob_start();
	// Check if video ID is provided and if video attachment exists.
	$video_attachment = null;
	$show_video       = false;
	$video_id         = intval( $video_id );

	$godam_video_title = '';
	$godam_mime        = '';

	if ( ! empty( $video_id ) ) {
		/**
		 * Fires before resolving this attachment's post/mime/title data, so
		 * integrations that centralize media on another site can switch
		 * context first. Title and mime type are captured into variables here
		 * (not re-read later) since the shortcode/block render further down
		 * must run on the *current* site, after this bracket has closed.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		$video_attachment = get_post( $video_id );
		if ( $video_attachment && 'attachment' === $video_attachment->post_type ) {
			$godam_video_title = get_the_title( $video_id );
			$godam_mime        = (string) get_post_mime_type( $video_id );
		}
		do_action( 'rtgodam_after_attachment_lookup' );
		$show_video = $video_attachment && 'attachment' === $video_attachment->post_type;
	}

	if ( ! $show_video ) {
		// Display error message for missing or invalid video.
		?>
		<div class="godam-video-preview--container">
			<p class="video-not-found"><?php esc_html_e( 'Oops! We could not locate your video', 'godam' ); ?></p>
		</div>
		<?php
	} else {
		// Render the markup appropriate to the attachment's media type: audio
		// attachments use the audio shortcode, image attachments the image block
		// (hotspot / product layers), everything else the video player.
		$godam_is_audio = 0 === strpos( $godam_mime, 'audio/' );
		$godam_is_image = 0 === strpos( $godam_mime, 'image/' );

		if ( $godam_is_image ) {
			$godam_notice = __( 'Note: This is a simple image preview. The image and its layers may display differently when added to a page based on theme styles.', 'godam' );
		} elseif ( $godam_is_audio ) {
			$godam_notice = __( 'Note: This is a simple audio preview. The player may display differently when added to a page based on theme styles.', 'godam' );
		} else {
			$godam_notice = __( 'Note: This is a simple video preview. The video player may display differently when added to a page based on theme styles.', 'godam' );
		}

		// The image block is dynamic and has no shortcode, so render it directly
		// via do_blocks(); audio and video reuse their registered shortcodes. This
		// runs before wp_head() in the template, so the block's lazily-enqueued
		// styles / scripts are still printed.
		if ( $godam_is_image ) {
			$godam_media_output = do_blocks(
				'<!-- wp:godam/image ' . wp_json_encode(
					array(
						'id'              => $video_id,
						'showImageLayers' => true,
					)
				) . ' /-->'
			);
		} else {
			$godam_shortcode    = $godam_is_audio
				? '[godam_audio id="' . $video_id . '"]'
				: '[godam_video id="' . $video_id . '"]';
			$godam_media_output = do_shortcode( $godam_shortcode );
		}
		?>
		<div class="godam-video-preview--notice">
			<?php echo esc_html( $godam_notice ); ?>
		</div>
		<div class="godam-video-preview">
			<h1 class="godam-video-preview--title">
				<?php echo esc_html( $godam_video_title ); ?>
			</h1>
			<?php echo $godam_media_output; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Output is escaped inside the block / shortcode render templates. ?>
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
		$meta = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$wpdb->postmeta} WHERE meta_key = %s AND meta_value = %s", $key, $value ) );  // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, godam-coverage-ignore -- rtgodam_get_post_id_by_meta_key_and_value(): covered transitively — sole real caller (Media_Library::update_image_attachment_meta_after_lookup(), looking up 'rtgodam_transcoding_job_id') already runs inside its caller's try/finally before/after pair.
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
 * Check whether the engagement feature is available in GoDAM.
 *
 * Returning true enables engagement settings and runtime behavior for
 * GoDAM video, gallery, and embed experiences.
 *
 * @since 1.8.0
 *
 * @return bool Whether the engagement feature is enabled.
 */
function rtgodam_is_engagement_feature_enabled() {
	/**
	 * Filters whether the GoDAM engagement feature is enabled.
	 *
	 * Return true to enable engagement settings and functionality for GoDAM
	 * videos, galleries, and embeds.
	 *
	 * @since 1.8.0
	 *
	 * @param bool $is_enabled Whether the engagement feature is enabled. Default false.
	 */
	return (bool) apply_filters( 'rtgodam_enable_engagement_feature', false );
}

/**
 * Map a player context (godam_context) to its analytics block_source slug.
 *
 * The placement taxonomy the analytics microservice groups by. Known contexts
 * map to their canonical slug; an empty context means the plain video block /
 * shortcode; unknown contexts pass through as-is (the microservice normalizes
 * server-side and never rejects on this value).
 *
 * @since 2.1.0
 *
 * @param string $context The godam_context attribute value.
 * @return string The block_source slug for analytics events.
 */
function rtgodam_get_block_source_from_context( $context ) {
	$context = (string) $context;

	if ( '' === $context ) {
		return 'video-block';
	}

	$map = array(
		'godam-video-product-gallery'      => 'shoppable-video',
		'godam-featured-video-gallery'     => 'wc-product-gallery',
		'godam-for-woo-product-page-reels' => 'product-reels',
		'godam-reel-pop-widget'            => 'reel-pop',
	);

	return isset( $map[ $context ] ) ? $map[ $context ] : $context;
}

/**
 * Generate HTML content for the video embed page.
 *
 * This function produces the HTML markup for embedding a single video.
 * It displays the video player only, without any headers or notices,
 * making it suitable for embedding in iframes or modals.
 *
 * @param int    $video_id      The ID of the video attachment to embed.
 * @param string $godam_context Optional. The player context passed to the godam_video shortcode (e.g. 'video-only').
 * @param string $bg_color      Optional. Hex background color applied as --godam-video-bg-color CSS variable on the wrapper.
 * @param bool   $show_engagements Optional. Whether to show engagements in the embed. Default false (no engagements shown).
 * @param string $block_source  Optional. Analytics placement slug forwarded to the player (e.g. 'video-gallery' for gallery iframes).
 * @param int    $host_post_id  Optional. Post ID of the page embedding this iframe, so analytics attribute to the host page.
 *
 * @since 1.5.0
 *
 * @return string The generated HTML content for the video embed page.
 */
function godam_embed_page_content( $video_id, $godam_context = '', $bg_color = '', $show_engagements = false, $block_source = '', $host_post_id = 0 ) {
	ob_start();
	// Check if video ID is provided and if video attachment exists.
	$video_attachment  = null;
	$show_video        = false;
	$video_id          = intval( $video_id );
	$engagements_value = rtgodam_is_engagement_feature_enabled() && $show_engagements ? 'show' : '';

	if ( ! empty( $video_id ) ) {
		/**
		 * Fires before resolving this attachment's post/mime data, so
		 * integrations that centralize media on another site can switch
		 * context first.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		$video_attachment = get_post( $video_id );
		do_action( 'rtgodam_after_attachment_lookup' );
		$show_video = $video_attachment && 'attachment' === $video_attachment->post_type && 'video/' === substr( $video_attachment->post_mime_type, 0, 6 );
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
		$godam_shortcode = '[godam_video id="' . $video_id . '"';
		if ( ! empty( $godam_context ) ) {
			$godam_shortcode .= ' godam_context="' . esc_attr( $godam_context ) . '"';
		}
		if ( ! empty( $engagements_value ) ) {
			$godam_shortcode .= ' engagements="' . esc_attr( $engagements_value ) . '"';
		}
		if ( ! empty( $block_source ) ) {
			$godam_shortcode .= ' block_source="' . esc_attr( $block_source ) . '"';
		}
		if ( ! empty( $host_post_id ) ) {
			$godam_shortcode .= ' host_post_id="' . absint( $host_post_id ) . '"';
		}
		$godam_shortcode .= ']';

		$godam_wrapper_style = ! empty( $bg_color ) ? '--godam-video-bg-color: ' . $bg_color . ';' : '';
		?>
		<div 
			class="godam-video-embed" data-godam-context="<?php echo esc_attr( $godam_context ); ?>"
			data-show-engagements="<?php echo esc_attr( $show_engagements ? 'true' : 'false' ); ?>"
			style="<?php echo esc_attr( $godam_wrapper_style ); ?>"
		>
			<?php echo do_shortcode( $godam_shortcode ); ?>
		</div>
		<?php
	}
	return ob_get_clean();
}

/**
 * Convert one or more URLs to HTTPS if the current page is using SSL.
 *
 * This function checks whether the current page is using SSL and,
 * if so, returns the given URL string or array of URLs with their scheme changed to HTTPS.
 * If SSL is not active, the original value is returned unchanged.
 *
 * @since 1.7.0
 *
 * @param array|string $urls The URLs to change the scheme of.
 *
 * @return array|string The URLs with the scheme changed to HTTPS.
 */
function rtgodam_convert_to_https_url( $urls ) {

	if ( ! is_ssl() ) {
		return $urls;
	}

	if ( is_array( $urls ) ) {

		$filtered_urls = array_filter(
			$urls,
			function ( $url ) {
				return null !== $url && '' !== $url;
			}
		);

		$converted_urls = array_map(
			function ( $url ) {
				return set_url_scheme( $url, 'https' );
			},
			$filtered_urls
		);

		return array_filter(
			$converted_urls,
			function ( $url ) {
				return null !== $url && '' !== $url;
			}
		);
	}

	if ( null === $urls || '' === $urls ) {
		return $urls;
	}

	return set_url_scheme( $urls, 'https' );
}

/**
 * Whether the current admin screen hosts the WordPress media library / a wp.media modal
 * and therefore needs GoDAM's media-library integration.
 *
 * Single source of truth for the enqueue gates below. Covers the core screens that host
 * the media grid or open a wp.media modal, plus every GoDAM admin page (all of them call
 * wp_enqueue_media() and may open the modal — dashboard, media editor, analytics,
 * settings, tools, help, what's-new).
 *
 * @param WP_Screen|null $screen Current screen object.
 * @return bool True if the screen uses the media library / wp.media.
 */
function godam_is_media_library_screen( $screen ) {
	if ( ! $screen ) {
		return false;
	}

	// Core screens that host the media grid or a wp.media modal. `post`/`page` (as bases)
	// also cover the Elementor and WPBakery editors, which run on post.php.
	$media_bases = array(
		'upload',      // Media Library (grid & list views).
		'post',        // Add/Edit any post type.
		'page',        // Add/Edit Page.
		'attachment',  // Edit Media.
		'widgets',     // Classic widgets (image widget uses wp.media).
		'site-editor', // FSE.
	);

	if ( in_array( $screen->base, $media_bases, true ) || in_array( $screen->id, $media_bases, true ) ) {
		return true;
	}

	// GoDAM's own admin pages (screen ids derive from the `rtgodam` menu slug).
	$godam_pages = array(
		'toplevel_page_rtgodam',
		'godam_page_rtgodam_media_editor',
		'godam_page_rtgodam_analytics',
		'godam_page_rtgodam_settings',
		'godam_page_rtgodam_tools',
		'godam_page_rtgodam_help',
		'godam_page_rtgodam_whats_new',
	);

	return in_array( $screen->id, $godam_pages, true );
}

/**
 * Check if auth detector scripts should be loaded on current screen.
 *
 * @param WP_Screen|null $screen Current screen object.
 *
 * @return bool True if auth detector scripts should load.
 */
function godam_should_load_auth_detector_script( $screen ) {
	return godam_is_media_library_screen( $screen );
}

/**
 * Whether the (heavy) GoDAM media-library JS bundles should load on the current screen.
 *
 * The media-library.min.js (bundles video.js) and pages/media-library.min.js (React/Redux
 * folder sidebar) were enqueued on EVERY admin screen via a global admin_enqueue_scripts
 * hook. They are only needed where the media library / wp.media modal is actually used
 * (see godam_is_media_library_screen()). Everywhere else the payload is pure overhead.
 * Integrations that open wp.media on other screens can opt in via the filter below.
 *
 * @param WP_Screen|null $screen Current screen object.
 * @return bool True if the media-library bundles should be enqueued.
 */
function godam_should_load_media_library_assets( $screen ) {
	/**
	 * Filters whether the GoDAM media-library JS bundles load on the current screen.
	 *
	 * Use this to force-load the bundles on custom screens that open wp.media (e.g.
	 * term-edit screens with media fields).
	 *
	 * @param bool           $should_load Whether to enqueue the media-library bundles.
	 * @param WP_Screen|null $screen      Current screen object.
	 */
	return (bool) apply_filters( 'godam_should_load_media_library_assets', godam_is_media_library_screen( $screen ), $screen );
}

// ---------------------------------------------------------------------------
// Work-cache helpers
// ---------------------------------------------------------------------------

/** Cache group used across all work-cache entries. */
if ( ! defined( 'RTGODAM_WORK_CACHE_GROUP' ) ) {
	define( 'RTGODAM_WORK_CACHE_GROUP', 'rtgodam_work_cache' );
}

/** Cache version — bump to globally invalidate all work-cache entries. */
if ( ! defined( 'RTGODAM_WORK_CACHE_VERSION' ) ) {
	// v2: the cached attachment payload gained the transcript path/deleted keys.
	define( 'RTGODAM_WORK_CACHE_VERSION', 'v2' );
}

/** Default TTL (seconds) used as hard-expiry fallback: 30 minutes. */
if ( ! defined( 'RTGODAM_WORK_CACHE_TTL' ) ) {
	define( 'RTGODAM_WORK_CACHE_TTL', 30 * MINUTE_IN_SECONDS );
}

/**
 * Retrieve a value from the work cache.
 *
 * Uses the WordPress object cache when an external cache is active,
 * otherwise uses transients.
 *
 * @since 1.8.0
 *
 * @param string $key Cache key (without version prefix).
 * @return mixed|false Cached value or false on miss.
 */
function rtgodam_work_cache_get( $key ) {
	$versioned_key = RTGODAM_WORK_CACHE_VERSION . '_' . $key;

	if ( wp_using_ext_object_cache() ) {
		return wp_cache_get( $versioned_key, RTGODAM_WORK_CACHE_GROUP );
	}

	return get_transient( 'rtgodam_wc_' . md5( $versioned_key ) );
}

/**
 * Store a value in the work cache.
 *
 * Uses the WordPress object cache when an external cache is active,
 * otherwise uses transients.
 *
 * @since 1.8.0
 *
 * @param string $key   Cache key (without version prefix).
 * @param mixed  $value Value to cache.
 * @param int    $ttl   Time-to-live in seconds. Defaults to RTGODAM_WORK_CACHE_TTL.
 */
function rtgodam_work_cache_set( $key, $value, $ttl = RTGODAM_WORK_CACHE_TTL ) {
	$versioned_key = RTGODAM_WORK_CACHE_VERSION . '_' . $key;

	if ( wp_using_ext_object_cache() ) {
		// phpcs:ignore WordPressVIPMinimum.Performance.LowExpiryCacheTime.CacheTimeUndetermined -- $ttl defaults to RTGODAM_WORK_CACHE_TTL (1800s) and callers must pass >= 300s.
		wp_cache_set( $versioned_key, $value, RTGODAM_WORK_CACHE_GROUP, $ttl );
	} else {
		set_transient( 'rtgodam_wc_' . md5( $versioned_key ), $value, $ttl );
	}
}

/**
 * Delete a single entry from the work cache.
 *
 * Clears both the dedicated object-cache entry and the transient key so
 * stale data is removed even if the site's cache backend changed.
 *
 * @since 1.8.0
 *
 * @param string $key Cache key (without version prefix).
 */
function rtgodam_work_cache_delete( $key ) {
	$versioned_key = RTGODAM_WORK_CACHE_VERSION . '_' . $key;

	wp_cache_delete( $versioned_key, RTGODAM_WORK_CACHE_GROUP );
	delete_transient( 'rtgodam_wc_' . md5( $versioned_key ) );
}

/**
 * Register a cache key under an index so it can be bulk-deleted later.
 *
 * The index is stored as a transient with a TTL aligned to the maximum
 * render-cache TTL (RTGODAM_WORK_CACHE_TTL). This ensures stale keys are
 * pruned naturally when the index expires rather than accumulating indefinitely
 * in permanent options.
 *
 * If a key is already registered under the index the TTL of the transient is
 * refreshed so the index stays alive as long as any of its members could still
 * be cached.
 *
 * @since 1.8.0
 *
 * @param string $index_key Human-readable index identifier (e.g. `work_cache_godam_meta_{post_id}`).
 * @param string $cache_key The cache key to register.
 */
function rtgodam_work_cache_index_add( $index_key, $cache_key ) {
	$transient_name = 'rtgodam_wc_idx_' . md5( $index_key );
	$members        = (array) get_transient( $transient_name );

	if ( ! in_array( $cache_key, $members, true ) ) {
		$members[] = $cache_key;
	}

	// Always refresh the TTL so the index outlives the youngest member.
	set_transient( $transient_name, $members, RTGODAM_WORK_CACHE_TTL );
}

/**
 * Return all cache keys registered under an index.
 *
 * Returns an empty array when the index transient has expired, which means
 * all previously registered cache entries have also naturally expired.
 *
 * @since 1.8.0
 *
 * @param string $index_key Index identifier.
 * @return string[] List of registered cache keys.
 */
function rtgodam_work_cache_index_members( $index_key ) {
	$members = get_transient( 'rtgodam_wc_idx_' . md5( $index_key ) );
	return is_array( $members ) ? $members : array();
}

/**
 * Delete every cache key registered under an index and remove the index transient.
 *
 * @since 1.8.0
 *
 * @param string $index_key Index identifier.
 */
function rtgodam_work_cache_index_clear( $index_key ) {
	$members = rtgodam_work_cache_index_members( $index_key );

	foreach ( $members as $cache_key ) {
		rtgodam_work_cache_delete( $cache_key );
	}

	delete_transient( 'rtgodam_wc_idx_' . md5( $index_key ) );
}

// ---------------------------------------------------------------------------

/**
 * Normalize a GoDAM video performance mode value.
 *
 * @since 1.8.0
 *
 * @param string $mode     Candidate performance mode.
 * @param string $fallback Fallback mode when the candidate is invalid.
 *
 * @return string
 */
function rtgodam_normalize_video_performance_mode( $mode, $fallback = 'balanced' ) {
	$mode     = is_string( $mode ) ? sanitize_key( $mode ) : '';
	$fallback = 'priority' === sanitize_key( $fallback ) ? 'priority' : 'balanced';

	if ( in_array( $mode, array( 'balanced', 'priority' ), true ) ) {
		return $mode;
	}

	return $fallback;
}

/**
 * Resolve the effective performance mode for a video from modern or legacy attributes.
 *
 * @since 1.8.0
 *
 * @param array  $attributes Block or shortcode attributes.
 * @param string $default_mode Default performance mode when no stored value exists.
 *
 * @return string
 */
function rtgodam_resolve_video_performance_mode( $attributes, $default_mode = 'balanced' ) {
	if ( ! is_array( $attributes ) ) {
		return rtgodam_normalize_video_performance_mode( '', $default_mode );
	}

	if ( ! empty( $attributes['performanceMode'] ) ) {
		return rtgodam_normalize_video_performance_mode( $attributes['performanceMode'], $default_mode );
	}

	if ( ! empty( $attributes['performance_mode'] ) ) {
		return rtgodam_normalize_video_performance_mode( $attributes['performance_mode'], $default_mode );
	}

	$legacy_preload = isset( $attributes['preload'] ) ? strtolower( trim( (string) $attributes['preload'] ) ) : '';

	if ( in_array( $legacy_preload, array( 'metadata', 'auto', 'none' ), true ) ) {
		return 'balanced';
	}

	if ( in_array( $legacy_preload, array( 'preload only video thumbnail' ), true ) ) {
		return 'priority';
	}

	if ( ! empty( $attributes['preloadPoster'] ) ) {
		return 'priority';
	}

	return rtgodam_normalize_video_performance_mode( '', $default_mode );
}

/**
 * Resolve the final performance-driven render settings for a single video.
 *
 * @since 1.8.0
 *
 * @param array  $attributes Block or shortcode attributes.
 * @param string $default_mode Default performance mode.
 *
 * @return array<string, mixed>
 */
function rtgodam_get_video_performance_settings( $attributes, $default_mode = 'balanced' ) {
	$mode = rtgodam_resolve_video_performance_mode( $attributes, $default_mode );

	return array(
		'mode'              => $mode,
		'video_attributes'  => array(
			'preload' => 'priority' === $mode ? 'metadata' : 'none',
		),
		'poster_attributes' => 'priority' === $mode
			? array(
				'fetchpriority' => 'high',
			)
			: array(
				'loading' => 'lazy',
			),
	);
}

/**
 * Resolve the render attributes for a gallery tile thumbnail.
 *
 * Priority mode is intentionally capped to the leading tiles to avoid over-eager
 * image loading in multi-video layouts.
 *
 * @since 1.8.0
 *
 * @param string $performance_mode Requested performance mode.
 * @param int    $index            Zero-based tile index.
 * @param int    $priority_cutoff  Number of leading tiles that may stay in priority mode.
 *
 * @return array<string, string>
 */
function rtgodam_get_gallery_tile_image_attributes( $performance_mode, $index = 0, $priority_cutoff = 3 ) {
	$performance_mode = rtgodam_normalize_video_performance_mode( $performance_mode );
	$index            = max( 0, intval( $index ) );
	$priority_cutoff  = max( 0, intval( $priority_cutoff ) );
	$is_priority_tile = 'priority' === $performance_mode && $index < $priority_cutoff;

	if ( $is_priority_tile ) {
		return array(
			'fetchpriority' => 'high',
			'loading'       => 'eager',
		);
	}

	return array(
		'loading' => 'lazy',
	);
}

/**
 * Resolve the selected video thumbnail and its matching blur-up placeholder.
 *
 * @since 1.8.0
 *
 * @param int    $attachment_id Attachment ID.
 * @param string $thumbnail_url Optional pre-resolved thumbnail URL.
 * @return array<string, string>
 */
function rtgodam_get_video_thumbnail_sources( $attachment_id, $thumbnail_url = '' ) {
	$attachment_id = absint( $attachment_id );

	if ( ! $attachment_id ) {
		return array(
			'thumbnail'   => '',
			'placeholder' => '',
		);
	}

	$resolved_thumbnail   = '';
	$resolved_placeholder = '';

	/**
	 * Fires before resolving this attachment's thumbnail/placeholder meta
	 * and image URL, so integrations that centralize media on another site
	 * can switch context first.
	 *
	 * @since 2.2.0
	 */
	do_action( 'rtgodam_before_attachment_lookup' );

	if ( ! empty( $thumbnail_url ) && is_string( $thumbnail_url ) ) {
		$resolved_thumbnail = esc_url_raw( rtgodam_convert_to_https_url( $thumbnail_url ) );
	}

	if ( empty( $resolved_thumbnail ) ) {
		$custom_thumbnail = get_post_meta( $attachment_id, 'rtgodam_media_video_thumbnail', true );
		if ( ! empty( $custom_thumbnail ) && is_string( $custom_thumbnail ) ) {
			$resolved_thumbnail = esc_url_raw( rtgodam_convert_to_https_url( $custom_thumbnail ) );
		}
	}

	if ( empty( $resolved_thumbnail ) ) {
		$image = wp_get_attachment_image_url( $attachment_id, 'medium' );
		if ( $image ) {
			$resolved_thumbnail = esc_url_raw( $image );
		}
	}

	if ( ! empty( $resolved_thumbnail ) ) {
		$placeholder_map = get_post_meta( $attachment_id, 'rtgodam_media_placeholder_thumbnails', true );
		if ( is_array( $placeholder_map ) ) {
			$normalized_thumbnail = rtgodam_convert_to_https_url( $resolved_thumbnail );
			foreach ( $placeholder_map as $thumbnail_key => $placeholder_url ) {
				if ( empty( $thumbnail_key ) || empty( $placeholder_url ) ) {
					continue;
				}

				if ( rtgodam_convert_to_https_url( (string) $thumbnail_key ) === $normalized_thumbnail ) {
					$resolved_placeholder = esc_url_raw( rtgodam_convert_to_https_url( (string) $placeholder_url ) );
					break;
				}
			}
		}
	}

	if ( empty( $resolved_placeholder ) ) {
		$single_placeholder = get_post_meta( $attachment_id, 'rtgodam_media_video_placeholder_thumbnail', true );
		if ( ! empty( $single_placeholder ) && is_string( $single_placeholder ) ) {
			$resolved_placeholder = esc_url_raw( rtgodam_convert_to_https_url( $single_placeholder ) );
		}
	}

	// Do NOT fall back to wp_mime_type_icon() or a generic default image here.
	// When no real thumbnail is available, returning '' lets the gallery template
	// emit a --pending sentinel instead, which the frontend JS replaces with the
	// video's first frame via initFirstFrameThumbnails().

	/**
	 * Fires after resolving this attachment's thumbnail/placeholder data,
	 * so integrations can restore the site context switched in
	 * `rtgodam_before_attachment_lookup`.
	 *
	 * @since 2.2.0
	 */
	do_action( 'rtgodam_after_attachment_lookup' );

	return array(
		'thumbnail'   => $resolved_thumbnail,
		'placeholder' => $resolved_placeholder,
	);
}

/**
 * Format an associative array of HTML attributes into a string.
 *
 * @since 1.8.0
 *
 * @param array<string, scalar> $attributes Attributes to serialize.
 *
 * @return string
 */
function rtgodam_format_html_attributes( $attributes ) {
	if ( ! is_array( $attributes ) || empty( $attributes ) ) {
		return '';
	}

	$formatted = array();

	foreach ( $attributes as $name => $value ) {
		if ( ! is_scalar( $value ) || '' === $value ) {
			continue;
		}

		$name = strtolower( trim( (string) $name ) );

		if ( ! preg_match( '/^[a-z_:][-a-z0-9_:.]*$/', $name ) ) {
			continue;
		}

		$formatted[] = sprintf( '%s="%s"', $name, esc_attr( (string) $value ) );
	}

	return implode( ' ', $formatted );
}
