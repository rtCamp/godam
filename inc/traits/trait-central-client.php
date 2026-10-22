<?php
/**
 * Central_Client trait: a shared server-to-server client for GoDAM Central's
 * WordPress MAP API (`godam_core.api.map_wordpress.*`).
 *
 * Both the Marketo and HubSpot integration REST controllers call Central the
 * same way — authenticated by the site's licence key alone (`X-API-KEY`), the
 * credential the plugin already uses for `verify_api_key` and `track`. Keeping
 * the call in one place means the auth, HTTPS guard, `site_url` whitelisting
 * parameter and Frappe `message`-envelope handling stay identical across
 * integrations.
 *
 * The licence key never reaches the browser: these calls run on the WordPress
 * server only.
 *
 * @since 2.5.0
 * @package GoDAM
 */

namespace RTGODAM\Inc\Traits;

use RTGODAM\Inc\Helpers\Api_Key;
use WP_Error;

defined( 'ABSPATH' ) || exit;

/**
 * Trait Central_Client
 *
 * @since 2.5.0
 */
trait Central_Client {

	/**
	 * Server-to-server call to a GoDAM Central `map_wordpress` method.
	 *
	 * Authenticates with the licence key alone (`X-API-KEY`) — the same credential
	 * the plugin already uses for `verify_api_key` and `track`. GoDAM Central
	 * treats these endpoints as licence-key authenticated (`X-WP-Secret` is
	 * optional there and only checked when sent, which this plugin never does).
	 * Adds `site_url` so Central can apply site whitelisting and name the site in
	 * its activity log. Unwraps Frappe's `message` envelope; turns an error body
	 * into a WP_Error carrying Central's human message and `error_type`.
	 *
	 * @param string $method      Dotted godam-core method path.
	 * @param array  $args        Request params (query for GET, body for POST).
	 * @param string $http_method HTTP method, GET or POST.
	 * @return array|WP_Error Unwrapped `message` payload, or WP_Error.
	 */
	protected function call_central( $method, $args = array(), $http_method = 'GET' ) {
		$api_key = Api_Key::get_key();

		if ( '' === $api_key ) {
			return new WP_Error(
				'godam_no_api_key',
				__( 'Connect your GoDAM licence key first, then manage this integration.', 'godam' ),
				array( 'status' => 403 )
			);
		}

		$url = RTGODAM_API_BASE . '/api/method/' . $method;

		// Never send the licence key over cleartext: require https, allowing http
		// only for a localhost dev backend.
		$host   = (string) wp_parse_url( $url, PHP_URL_HOST );
		$scheme = (string) wp_parse_url( $url, PHP_URL_SCHEME );
		if ( 'https' !== $scheme && ! in_array( $host, array( 'localhost', '127.0.0.1', '::1' ), true ) ) {
			return new WP_Error(
				'godam_insecure_endpoint',
				__( 'Managing this integration requires a secure (HTTPS) connection to GoDAM.', 'godam' ),
				array( 'status' => 500 )
			);
		}

		// Same address the plugin registers with Central on verify, so site
		// whitelisting (when the licence has it on) matches.
		$args['site_url'] = get_site_url();

		$request_args = array(
			'timeout' => 15, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout -- connect validates credentials against the upstream tool.
			'headers' => array(
				'X-API-KEY' => $api_key,
			),
		);

		if ( 'POST' === $http_method ) {
			// Form-encoded body — matches the godam-core API.
			$request_args['body'] = $args;
			$response             = wp_safe_remote_post( $url, $request_args );
		} else {
			// add_query_arg() URL-encodes values itself — don't pre-encode.
			$response = wp_safe_remote_get( add_query_arg( $args, $url ), $request_args );
		}

		if ( is_wp_error( $response ) ) {
			return new WP_Error(
				'godam_central_unreachable',
				__( 'Could not reach GoDAM. Please try again.', 'godam' ),
				array( 'status' => 503 )
			);
		}

		$status = (int) wp_remote_retrieve_response_code( $response );
		$body   = json_decode( wp_remote_retrieve_body( $response ), true );
		$inner  = isset( $body['message'] ) && is_array( $body['message'] ) ? $body['message'] : array();

		if ( $status >= 400 ) {
			$message = isset( $inner['message'] ) && '' !== $inner['message']
				? (string) $inner['message']
				: __( 'The request to GoDAM failed. Please try again.', 'godam' );

			return new WP_Error(
				'godam_central_error',
				$message,
				array(
					'status'     => $status,
					'error_type' => isset( $inner['error_type'] ) ? (string) $inner['error_type'] : '',
				)
			);
		}

		// Frappe wraps the return value under a top-level `message` key.
		return $inner;
	}
}
