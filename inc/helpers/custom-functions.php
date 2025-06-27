<?php
/**
 * Custom functions.
 *
 * @package GoDAM
 */

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Filesystem\API_Cache;
use RTGODAM\Inc\Filesystem\API_Client;

const CACHE_GROUP = 'godam-files-acl';

/**
 * This method is an improved version of PHP's filter_input() and
 * works well on PHP CLI as well which PHP default method does not.
 *
 * Reference:
 * - https://bugs.php.net/bug.php?id=49184
 * - https://bugs.php.net/bug.php?id=54672
 *
 * @param int    $type          One of INPUT_GET, INPUT_POST, INPUT_COOKIE, INPUT_SERVER, or INPUT_ENV.
 * @param string $variable_name Name of a variable to get.
 * @param int    $filter        The ID of the filter to apply.
 * @param mixed  $options       filter to apply.
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
 * @return string The URL of the media file, or an empty string if invalid or not found.
 * @throws Exception If the media is not found or is not an attachment.
 */
function rtgodam_fetch_overlay_media_url( $media_id ) {
	if ( empty( $media_id ) || 0 === intval( $media_id ) ) {
		return '';
	}

	$media = get_post( $media_id );

	if ( ! $media || 'attachment' !== $media->post_type ) {
		throw new Exception( 'Media not found' );
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
 *     - 'imageCtaOrientation' (string): Orientation of the CTA ('portrait' or other).
 *     - 'imageOpacity' (float): Opacity of the image (default is 1).
 *     - 'imageText' (string): Heading text for the CTA.
 *     - 'imageDescription' (string): Description text for the CTA.
 *     - 'imageLink' (string): URL for the CTA link.
 *     - 'imageCtaButtonText' (string): Text for the CTA button.
 * @return string The generated HTML string for the image CTA overlay.
 */
function rtgodam_image_cta_html( $layer ) {
	$image_url = rtgodam_fetch_overlay_media_url( $layer['image'] );
	// Ensure $layer is an associative array and has required fields.
	$orientation_class = isset( $layer['imageCtaOrientation'] ) && 'portrait' === $layer['imageCtaOrientation']
		? 'vertical-image-cta-container'
		: 'image-cta-container';

	$image_opacity     = isset( $layer['imageOpacity'] ) ? $layer['imageOpacity'] : 1;
	$image_text        = isset( $layer['imageText'] ) ? $layer['imageText'] : '';
	$image_description = isset( $layer['imageDescription'] ) ? $layer['imageDescription'] : '';
	$image_link        = isset( $layer['imageLink'] ) ? $layer['imageLink'] : '/';
	$cta_button_text   = isset( $layer['imageCtaButtonText'] ) ? $layer['imageCtaButtonText'] : 'Buy Now';

	return "
	<div class= \"image-cta-overlay-container\">
		<div class=\"image-cta-parent-container\">
			<div class=\"{$orientation_class}\">
				<img 
					src=\"{$image_url}\" 
					alt=\"CTA ad\" 
					height=\"300\" 
					width=\"250\" 
					style=\"opacity: {$image_opacity};\" 
				/>
				<div class=\"image-cta-description\">
					" . ( ! empty( $image_text ) ? "<h2>{$image_text}</h2>" : '' ) . '
					' . ( ! empty( $image_description ) ? "<p>{$image_description}</p>" : '' ) . "
					<a class=\"image-cta-btn\" href=\"{$image_link}\" target=\"_blank\">
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
 * @param int $timeout The time in seconds after which the user data should be refreshed.
 */
function rtgodam_get_user_data( $timeout = 300 ) {
	$rtgodam_user_data = get_option( 'rtgodam_user_data', false );
	$api_key           = get_option( 'rtgodam-api-key', '' );

	if (
		empty( $rtgodam_user_data ) ||
		( empty( $rtgodam_user_data ) && ! empty( $api_key ) ) ||
		( isset( $rtgodam_user_data['timestamp'] ) && ( time() - $rtgodam_user_data['timestamp'] ) > $timeout )
	) {
		// Verify the user's API Key.
		$result = rtgodam_verify_api_key( $api_key );

		$valid_api_key = false;
		$user_data     = array();

		if ( is_wp_error( $result ) ) {
			$valid_api_key               = false;
			$user_data['masked_api_key'] = rtgodam_mask_string( $api_key );
		} else {
			$valid_api_key               = true;
			$user_data                   = $result['data'] ?? array();
			$user_data['masked_api_key'] = rtgodam_mask_string( $api_key );
		}

		$rtgodam_user_data = array(
			'currentUserId' => get_current_user_id(),
			'valid_api_key' => $valid_api_key,
			'user_data'     => $user_data,
		);

		$usage_data = rtgodam_get_usage_data();

		if ( ! is_wp_error( $usage_data ) ) {
			$rtgodam_user_data = array_merge( $rtgodam_user_data, $usage_data );
		} elseif ( ! $valid_api_key ) {
			$rtgodam_user_data['storageBandwidthError'] = __( 'Oops! It looks like your API key is incorrect or has expired. Please update it and try again.', 'godam' );
		} else {
			$rtgodam_user_data['storageBandwidthError'] = $usage_data->get_error_message();
		}

		$rtgodam_user_data['timestamp'] = time();

		// Save the userData in wp_options.
		update_option( 'rtgodam_user_data', $rtgodam_user_data );
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
		return new \WP_Error( 'rtgodam_api_error', 'API key not found ( try refreshing the page )' );
	}

	$endpoint = RTGODAM_API_BASE . '/api/method/godam_core.api.stats.get_bandwidth_and_storage';

	$url = add_query_arg(
		array(
			'api_key' => $api_key,
		),
		$endpoint
	);

	$response = wp_safe_remote_get( $url );

	if ( is_wp_error( $response ) ) {
		return $response;
	}

	$body = wp_remote_retrieve_body( $response );

	$data = json_decode( $body, true );

	// Validate response structure.
	if ( ! isset( $data['message'] ) || ! isset( $data['message']['storage_used'] ) || ! isset( $data['message']['bandwidth_used'] ) ) {
		return new \WP_Error( 'rtgodam_api_error', 'Error fetching data for storage and bandwidth ( remove and add again the API key to get usage analytics )' );
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

// function rtgodam_new_api_client() {
// return new API_Client(
// 'https://app-godam.rt.gw/api/method/godam_core.api.file', // constant( 'FILE_SERVICE_URI' ),
// '1', // constant( 'FILES_CLIENT_SITE_ID' ),
// '8e4e72e8dfe1ad59eb4871bb36c3524f', // constant( 'FILES_ACCESS_TOKEN' ),
// API_Cache::get_instance()
// );
// }

define( 'FILES_CLIENT_SITE_ID', 1 );
define( 'FILES_ACCESS_TOKEN', 'test-token' );
define( 'VIP_FILESYSTEM_USE_STREAM_WRAPPER', true );

function a8c_files_init() {
	\RTGODAM\Inc\Stream_Wrapper::get_instance();
}

/**
 * Prevent WP from creating intermediate image sizes
 *
 * Function name parallels wpcom's implementation to accommodate existing code
 */
function wpcom_intermediate_sizes() {
	return __return_empty_array();
}

/**
 * Figure out whether srcset is enabled or not. Should be run on init action
 * earliest in order to allow clients to override this via theme's functions.php
 *
 * @return bool True if VIP Go File Service compatibile srcset solution is enabled.
 */
function is_vip_go_srcset_enabled() {
	// Allow override via querystring for easy testing
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- nonce is not available
	if ( isset( $_GET['disable_vip_srcset'] ) ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		return '0' === $_GET['disable_vip_srcset'];
	}

	$enabled = true;

	/**
	 * Filters the default state of VIP Go File Service compatible srcset solution.
	 *
	 * @param bool True if the srcset solution is turned on, False otherwise.
	 */
	return (bool) apply_filters( 'vip_go_srcset_enabled', $enabled );
}

/**
 * Inject image sizes to attachment metadata.
 *
 * @param array $data          Attachment metadata.
 * @param int   $attachment_id Attachment's post ID.
 *
 * @return array Attachment metadata.
 */
function a8c_files_maybe_inject_image_sizes( $data, $attachment_id ) {
	// Can't do much if data is empty
	if ( empty( $data ) ) {
		return $data;
	}

	// Missing some critical data we need to determine sizes, so bail.
	if ( ! isset( $data['file'] )
		|| ! isset( $data['width'] )
		|| ! isset( $data['height'] ) ) {
		return $data;
	}

	static $cached_sizes = array();

	// Don't process image sizes that we already processed.
	if ( isset( $cached_sizes[ $attachment_id ] ) ) {
		$data['sizes'] = $cached_sizes[ $attachment_id ];
		return $data;
	}

	// Skip non-image attachments
	$mime_type           = get_post_mime_type( $attachment_id );
	$attachment_is_image = preg_match( '!^image/!', $mime_type );
	if ( 1 !== $attachment_is_image ) {
		return $data;
	}

	if ( ! isset( $data['sizes'] ) || ! is_array( $data['sizes'] ) ) {
		$data['sizes'] = array();
	}

	$sizes_already_exist = false === empty( $data['sizes'] );

	global $_wp_additional_image_sizes;

	if ( is_array( $_wp_additional_image_sizes ) ) {
		$available_sizes = array_keys( $_wp_additional_image_sizes );
		$known_sizes     = array_keys( $data['sizes'] );
		$missing_sizes   = array_diff( $available_sizes, $known_sizes );

		if ( $sizes_already_exist && empty( $missing_sizes ) ) {
			return $data;
		}

		$new_sizes = array();

		foreach ( $missing_sizes as $size ) {
			$new_width          = (int) $_wp_additional_image_sizes[ $size ]['width'];
			$new_height         = (int) $_wp_additional_image_sizes[ $size ]['height'];
			$new_sizes[ $size ] = array(
				'file'      => basename( $data['file'] ),
				'width'     => $new_width,
				'height'    => $new_height,
				'mime_type' => $mime_type,
			);
		}

		if ( ! empty( $new_sizes ) ) {
			$data['sizes'] = array_merge( $data['sizes'], $new_sizes );
		}
	}

	$image_sizes   = new \RTGODAM\Inc\Filesystem\ImageSizes( $attachment_id, $data );
	$data['sizes'] = $image_sizes->generate_sizes_meta();

	$cached_sizes[ $attachment_id ] = $data['sizes'];

	return $data;
}

if ( defined( 'FILES_CLIENT_SITE_ID' ) && defined( 'FILES_ACCESS_TOKEN' ) ) {
	// Kick things off
	a8c_files_init();

	// Disable automatic creation of intermediate image sizes.
	// We generate them on-the-fly on VIP.
	add_filter( 'intermediate_image_sizes', 'wpcom_intermediate_sizes' );
	add_filter( 'intermediate_image_sizes_advanced', 'wpcom_intermediate_sizes' );
	add_filter( 'fallback_intermediate_image_sizes', 'wpcom_intermediate_sizes' );

	// Conditionally load our srcset solution during our testing period.
	add_action(
		'init',
		function () {
			if ( true !== is_vip_go_srcset_enabled() ) {
				return;
			}

			require_once __DIR__ . './../classes/filesystem/class-image.php';
			require_once __DIR__ . './../classes/filesystem/class-image-sizes.php';

			// Load the native VIP Go srcset solution on priority of 20, allowing other plugins to set sizes earlier.
			add_filter( 'wp_get_attachment_metadata', 'a8c_files_maybe_inject_image_sizes', 20, 2 );
		},
		10,
		0
	);
}

/**
 * WordPress 5.3 adds "big image" processing, for images over 2560px (by default).
 * This is not needed on VIP Go since we use Photon for dynamic image work.
 */
add_filter( 'big_image_size_threshold', '__return_false' );
