<?php
/**
 * REST API for the Marketo integration tab.
 *
 * Admin-only WordPress routes under `godam/v1/marketo/*` that proxy to GoDAM
 * Central's WordPress MAP API (`godam_core.api.map_wordpress.*`). GoDAM Central
 * is the source of truth for the Marketo connection; these routes let a
 * WordPress admin read its status, connect or update it, test it and list its
 * forms without ever handling Central's stored Marketo credentials.
 *
 * The browser never calls Central directly: the WP→Central leg is server to
 * server, authenticated by the licence key (`X-API-KEY`) alone — the same
 * credential the plugin already uses for `verify_api_key` and `track`, kept
 * server-side and never exposed to JS.
 *
 * @since 2.6.0
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Marketo;
use RTGODAM\Inc\Traits\Central_Client;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class Marketo_Integration
 *
 * @since 2.6.0
 */
class Marketo_Integration extends Base {

	use Central_Client;

	/**
	 * REST route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'marketo';

	/**
	 * Register the Marketo integration routes.
	 *
	 * @return array
	 */
	public function get_rest_routes() {
		$manage = function () {
			return current_user_can( 'manage_options' );
		};

		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/status',
				'args'      => array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_status' ),
					'permission_callback' => $manage,
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/forms',
				'args'      => array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_forms' ),
					'permission_callback' => $manage,
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/connect',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'connect' ),
					'permission_callback' => $manage,
					'args'                => array(
						'munchkin_id'        => array(
							'required'          => true,
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_text_field',
						),
						'client_id'          => array(
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_text_field',
						),
						'client_secret'      => array(
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_text_field',
						),
						'forms_host'         => array(
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_text_field',
						),
						'recaptcha_site_key' => array(
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_text_field',
						),
						'activity_type_id'   => array(
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_text_field',
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/test',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'test_connection' ),
					'permission_callback' => $manage,
				),
			),
		);
	}

	/**
	 * GET /marketo/status — the Marketo connection state and account details.
	 *
	 * Normally Central's live `get_status`, so it carries the per-tool `state`,
	 * `reason`, tracking flags and `settings_url`, with `live: true`. If Central
	 * cannot answer (unreachable, or the WordPress MAP API is not available on
	 * that GoDAM yet) it falls back to the account details cached in the licence's
	 * `map` block, with `live: false` and the error, so the tab still shows what
	 * it can and links out to Central.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function get_status( WP_REST_Request $request ) {
		$result = $this->call_central( 'godam_core.api.map_wordpress.get_status' );

		if ( is_wp_error( $result ) ) {
			$fallback          = $this->fallback_status();
			$fallback['error'] = $result->get_error_message();
			return new WP_REST_Response( $fallback, 200 );
		}

		$result['live'] = true;

		return new WP_REST_Response( $result, 200 );
	}

	/**
	 * GET /marketo/forms — approved Marketo forms for the layer picker.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_forms( WP_REST_Request $request ) {
		$result = $this->call_central(
			'godam_core.api.map_wordpress.get_forms',
			array( 'provider' => 'marketo' )
		);

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return new WP_REST_Response( $result, 200 );
	}

	/**
	 * POST /marketo/connect — connect or update the Marketo instance on Central.
	 *
	 * Central checks the credentials against Marketo before saving anything and,
	 * on success, sets up the "GoDAM Video View" activity type. On an update the
	 * credential fields may be left empty to keep the stored ones.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function connect( WP_REST_Request $request ) {
		$body = array( 'munchkin_id' => (string) $request->get_param( 'munchkin_id' ) );

		// Only forward credential fields when the admin actually typed them, so an
		// update that leaves them blank keeps Central's stored values.
		foreach ( array( 'client_id', 'client_secret', 'activity_type_id' ) as $key ) {
			$value = (string) $request->get_param( $key );
			if ( '' !== $value ) {
				$body[ $key ] = $value;
			}
		}

		// `forms_host` and `recaptcha_site_key` are sent as given (an empty
		// `recaptcha_site_key` clears Central's stored key; an empty `forms_host`
		// leaves none). Only include them when the parameter was present.
		foreach ( array( 'forms_host', 'recaptcha_site_key' ) as $key ) {
			if ( null !== $request->get_param( $key ) ) {
				$body[ $key ] = (string) $request->get_param( $key );
			}
		}

		$result = $this->call_central(
			'godam_core.api.map_wordpress.connect_marketo',
			$body,
			'POST'
		);

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		// Form rendering reads the Marketo account details from the `map` block of
		// the cached verify response, so force a refresh now; the new connection
		// then shows on videos right away instead of after the hourly cache expiry.
		if ( function_exists( 'rtgodam_get_user_data' ) ) {
			rtgodam_get_user_data( false, HOUR_IN_SECONDS, true );
		}

		return new WP_REST_Response( $result, 200 );
	}

	/**
	 * POST /marketo/test — check the stored Marketo credentials still work.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function test_connection( WP_REST_Request $request ) {
		$result = $this->call_central(
			'godam_core.api.map_wordpress.test_marketo_connection',
			array(),
			'POST'
		);

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return new WP_REST_Response( $result, 200 );
	}

	/**
	 * A read-only status built from the cached `map` block, for when Central's
	 * live `get_status` cannot be reached.
	 *
	 * Shaped like Central's `get_status` so the tab consumes one response either
	 * way, with `live: false` as the only difference the UI branches on.
	 *
	 * @return array
	 */
	private function fallback_status() {
		$central = Marketo::get_central_config();
		$has     = ! empty( $central['munchkin_id'] );

		return array(
			'live'         => false,
			'status'       => 'success',
			'settings_url' => Marketo::central_settings_url(),
			'marketo'      => array(
				'state'              => $has ? 'connected' : 'not_connected',
				'reason'             => null,
				'munchkin_id'        => $has ? (string) $central['munchkin_id'] : null,
				'forms_host'         => isset( $central['forms_host'] ) ? $central['forms_host'] : null,
				'recaptcha_site_key' => isset( $central['recaptcha_site_key'] ) ? $central['recaptcha_site_key'] : null,
			),
		);
	}
}
