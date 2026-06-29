<?php
/**
 * REST API for the GoDAM onboarding flow + product-guide state.
 *
 * Two concerns share the `onboarding` REST base:
 *
 * 1. Onboarding SPA proxy — the SPA never talks to godam-core directly. These
 *    routes proxy the `godam_core.api.login` / `organization_access` endpoints,
 *    hold the short-lived GoDAM JWT server-side (never exposed to the browser),
 *    and — once a workspace is chosen — store the durable Organization API key
 *    through the existing `rtgodam_verify_api_key()` path (which also registers
 *    the site).
 *
 * 2. Product-guide state — persists per-user product-guide progress (the Video
 *    Editor guided tour) in user meta so the "Get Started" welcome modal only
 *    auto-shows until the user has either completed or dismissed the guide.
 *    State is per-user (not per-browser) so it stays consistent across devices.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use WP_REST_Server;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class Onboarding
 */
class Onboarding extends Base {

	/**
	 * REST route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'onboarding';

	/**
	 * User meta key storing the product-guide state.
	 *
	 * @var string
	 */
	const PRODUCT_GUIDE_META_KEY = 'rtgodam_product_guide_state';

	/**
	 * Allowed product-guide states.
	 *
	 * @var string[]
	 */
	const PRODUCT_GUIDE_STATES = array( 'pending', 'completed', 'dismissed' );

	/**
	 * User meta key — whether the user dismissed the "unlocked Woo features" nudge (O10).
	 *
	 * @var string
	 */
	const WOO_NUDGE_META_KEY = 'rtgodam_woo_nudge_seen';

	/**
	 * GoDAM-core base URL (follows the site's RTGODAM_API_BASE; filterable).
	 *
	 * @return string
	 */
	private function api_base() {
		/**
		 * Filter the godam-core base URL used by onboarding.
		 *
		 * @param string $base Base URL (defaults to RTGODAM_API_BASE).
		 */
		return apply_filters( 'rtgodam_onboarding_api_base', RTGODAM_API_BASE );
	}

	/**
	 * Transient key holding the current user's onboarding JWT.
	 *
	 * @return string
	 */
	private function jwt_key() {
		return 'rtgodam_onb_jwt_' . get_current_user_id();
	}

	/**
	 * Only connected-capable admins may drive onboarding.
	 *
	 * @return bool
	 */
	public function onboarding_permission() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Register the onboarding proxy + product-guide routes.
	 *
	 * @return array
	 */
	public function get_rest_routes() {
		$perm = array( $this, 'onboarding_permission' );
		$base = '/' . $this->rest_base;

		$route = function ( $path, $callback ) use ( $perm ) {
			return array(
				'namespace' => $this->namespace,
				'route'     => $path,
				'args'      => array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, $callback ),
					'permission_callback' => $perm,
				),
			);
		};

		return array(
			$route( $base . '/check-user-exists', 'check_user_exists' ),
			$route( $base . '/signup', 'signup' ),
			$route( $base . '/password-login', 'password_login' ),
			$route( $base . '/google-oauth-url', 'google_oauth_url' ),
			$route( $base . '/exchange-oauth-code', 'exchange_oauth_code' ),
			$route( $base . '/list-organizations', 'list_organizations' ),
			$route( $base . '/organization-api-key', 'organization_api_key' ),
			$route( $base . '/verify-license-key', 'verify_license_key' ),
			$route( $base . '/reset-password', 'reset_password' ),
			$route( $base . '/resend-verification', 'resend_verification' ),
			// Product-guide (Video Editor guided tour) state. Uses a lighter
			// capability (upload_files) than the proxy routes — any editor user
			// drives the tour, not just connected-capable admins.
			array(
				'namespace' => $this->namespace,
				'route'     => $base . '/product-guide',
				'args'      => array(
					array(
						'methods'             => WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_product_guide' ),
						'permission_callback' => array( $this, 'permissions_check' ),
					),
					array(
						'methods'             => WP_REST_Server::CREATABLE,
						'callback'            => array( $this, 'update_product_guide' ),
						'permission_callback' => array( $this, 'permissions_check' ),
						'args'                => array(
							'status' => array(
								'type'     => 'string',
								'required' => true,
								'enum'     => self::PRODUCT_GUIDE_STATES,
							),
						),
					),
				),
			),
			// O10: post-install "unlocked Woo features" nudge — dismissal persisted per user.
			array(
				'namespace' => $this->namespace,
				'route'     => $base . '/woo-nudge',
				'args'      => array(
					array(
						'methods'             => WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_woo_nudge' ),
						'permission_callback' => array( $this, 'permissions_check' ),
					),
					array(
						'methods'             => WP_REST_Server::CREATABLE,
						'callback'            => array( $this, 'dismiss_woo_nudge' ),
						'permission_callback' => array( $this, 'permissions_check' ),
					),
				),
			),
		);
	}

	/**
	 * Low-level call to a godam-core whitelisted method.
	 *
	 * @param string $path     Dotted method path.
	 * @param array  $args     Request params.
	 * @param string $method   HTTP method (GET|POST).
	 * @param bool   $with_jwt Attach the stored JWT (as the X-GoDAM-Token header).
	 * @return array|string|\WP_Error Unwrapped `message` payload, or WP_Error.
	 */
	private function call_core( $path, $args = array(), $method = 'POST', $with_jwt = false ) {
		$url     = trailingslashit( $this->api_base() ) . 'api/method/' . $path;
		$headers = array( 'X-GoDAM-Site' => get_site_url() );

		if ( $with_jwt ) {
			$jwt = get_transient( $this->jwt_key() );
			if ( empty( $jwt ) ) {
				return new \WP_Error( 'godam_no_session', __( 'Your session has expired. Please sign in again.', 'godam' ), array( 'status' => 401 ) );
			}
			// godam-core carries the JWT in a dedicated X-GoDAM-Token header — NOT
			// `Authorization: Bearer`, which Frappe's framework auth would reject.
			$headers['X-GoDAM-Token'] = $jwt;
		}

		$request_args = array(
			// Auth/signup calls can provision an account, so allow a longer wait.
			'timeout' => 15, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
			'headers' => $headers,
		);

		if ( 'GET' === $method ) {
			// add_query_arg() URL-encodes values itself — don't pre-encode (would double-encode).
			$response = wp_remote_get( add_query_arg( $args, $url ), $request_args );
		} else {
			$request_args['body'] = $args; // Form-encoded — matches the godam-core API.
			$response             = wp_remote_post( $url, $request_args );
		}

		if ( is_wp_error( $response ) ) {
			return new \WP_Error( 'godam_core_unreachable', __( 'Could not reach GoDAM. Please try again.', 'godam' ), array( 'status' => 503 ) );
		}

		$status = wp_remote_retrieve_response_code( $response );
		$body   = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( $status >= 400 ) {
			$message = Onboarding_Response::error_message( $body );
			return new \WP_Error( 'godam_core_error', $message ? $message : __( 'Request failed. Please try again.', 'godam' ), array( 'status' => $status ) );
		}

		// Frappe wraps the return value under a top-level `message` key.
		return Onboarding_Response::unwrap( $body );
	}

	/**
	 * Probe whether an email already has an account (branch signup vs login).
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function check_user_exists( $request ) {
		$result = $this->call_core( 'godam_core.api.user.check_user_exists', array( 'email' => $request->get_param( 'email' ) ), 'GET' );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	/**
	 * Email signup → disabled account + verification email (no JWT).
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function signup( $request ) {
		$result = $this->call_core(
			'godam_core.api.login.signup',
			array(
				'first_name'     => sanitize_text_field( $request->get_param( 'first_name' ) ),
				'last_name'      => sanitize_text_field( (string) $request->get_param( 'last_name' ) ),
				'email'          => sanitize_email( $request->get_param( 'email' ) ),
				'password'       => (string) $request->get_param( 'password' ),
				'tnc'            => $request->get_param( 'tnc' ) ? 1 : 0,
				'newsletter'     => $request->get_param( 'newsletter' ) ? 1 : 0,
				'wordpress_site' => get_site_url(),
			)
		);
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}

	/**
	 * Email + password login → store the JWT server-side, return the user only.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function password_login( $request ) {
		$result = $this->call_core(
			'godam_core.api.login.password_login',
			array(
				'email'          => sanitize_email( $request->get_param( 'email' ) ),
				'password'       => (string) $request->get_param( 'password' ),
				'wordpress_site' => get_site_url(),
			)
		);
		return $this->handle_token_response( $result );
	}

	/**
	 * Build the Google authorize URL for the popup flow.
	 *
	 * `wordpress_site` opts godam-core into the WordPress popup flow and is the
	 * only origin its completion page will postMessage the handoff code to, so
	 * it must match the browser window's origin (passed as `wp_origin`).
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function google_oauth_url( $request ) {
		$wp_origin = esc_url_raw( (string) $request->get_param( 'wp_origin' ) );
		if ( empty( $wp_origin ) ) {
			$wp_origin = home_url();
		}
		$result = $this->call_core( 'godam_core.api.user.get_oauth2_url', array( 'wordpress_site' => $wp_origin ), 'GET' );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		$url = is_string( $result ) ? $result : ( $result['url'] ?? '' );
		return rest_ensure_response( array( 'url' => $url ) );
	}

	/**
	 * Exchange the one-time handoff code (relayed from the popup's completion
	 * page via postMessage) for a JWT. Auto-provisions on first sign-in.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function exchange_oauth_code( $request ) {
		$result = $this->call_core(
			'godam_core.api.login.exchange_oauth_code',
			array( 'code' => (string) $request->get_param( 'code' ) )
		);
		return $this->handle_token_response( $result );
	}

	/**
	 * Store the JWT from a login response; return the user (never the token).
	 *
	 * @param array|\WP_Error $result Unwrapped login payload.
	 * @return \WP_REST_Response|\WP_Error
	 */
	private function handle_token_response( $result ) {
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		if ( empty( $result['token'] ) ) {
			return new \WP_Error( 'godam_no_token', __( 'Sign-in failed. Please try again.', 'godam' ), array( 'status' => 502 ) );
		}
		$ttl = isset( $result['expires_in'] ) ? (int) $result['expires_in'] : DAY_IN_SECONDS;
		set_transient( $this->jwt_key(), $result['token'], $ttl );
		return rest_ensure_response( array( 'user' => $result['user'] ?? '' ) );
	}

	/**
	 * List the signed-in user's workspaces (uses the stored JWT).
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function list_organizations() {
		$result = $this->call_core( 'godam_core.api.organization_access.list_my_organizations', array(), 'POST', true );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return rest_ensure_response( array( 'organizations' => $result['organizations'] ?? array() ) );
	}

	/**
	 * Fetch the chosen workspace's API key and connect the site through the
	 * existing verify/registration path. The JWT is discarded afterwards.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function organization_api_key( $request ) {
		$result = $this->call_core(
			'godam_core.api.organization_access.get_organization_api_key',
			array( 'organization' => sanitize_text_field( $request->get_param( 'organization' ) ) ),
			'POST',
			true
		);
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		if ( empty( $result['api_key'] ) ) {
			return new \WP_Error( 'godam_no_key', __( 'This workspace has no API key yet.', 'godam' ), array( 'status' => 404 ) );
		}

		$connected = $this->connect_with_key( $result['api_key'] );
		if ( is_wp_error( $connected ) ) {
			return $connected;
		}

		// Persist the organization name — the upgrade flow needs it to build the
		// godam-core /godam_upgrade URL (verify_api_key doesn't return it).
		update_option( 'rtgodam_organization', sanitize_text_field( $result['organization'] ?? '' ) );

		delete_transient( $this->jwt_key() );
		return rest_ensure_response(
			array(
				'connected'    => true,
				'organization' => $result['organization'] ?? '',
			)
		);
	}

	/**
	 * "Activate with license key" — the existing verify_api_key flow (no JWT).
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function verify_license_key( $request ) {
		$connected = $this->connect_with_key( sanitize_text_field( $request->get_param( 'api_key' ) ) );
		if ( is_wp_error( $connected ) ) {
			return $connected;
		}
		// License-key connect doesn't surface the org name — clear any stale one so
		// the upgrade flow falls back to billing rather than targeting the wrong org.
		delete_option( 'rtgodam_organization' );
		return rest_ensure_response( array( 'connected' => true ) );
	}

	/**
	 * Validate + store an API key and register the site (existing helper).
	 *
	 * @param string $api_key Organization API key (license).
	 * @return true|\WP_Error
	 */
	private function connect_with_key( $api_key ) {
		if ( empty( $api_key ) || ! function_exists( 'rtgodam_verify_api_key' ) ) {
			return new \WP_Error( 'godam_connect_failed', __( 'Could not connect this site.', 'godam' ), array( 'status' => 500 ) );
		}
		$result = rtgodam_verify_api_key( $api_key, true );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		return true;
	}

	/**
	 * Forgot password — godam-core emails a reset link (completes on the web).
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function reset_password( $request ) {
		$result = $this->call_core(
			'godam_core.api.user.reset_password',
			array(
				'user'          => sanitize_email( $request->get_param( 'user' ) ),
				'external_user' => 1,
			)
		);
		return is_wp_error( $result ) ? $result : rest_ensure_response( is_array( $result ) ? $result : array( 'message' => $result ) );
	}

	/**
	 * Resend the verification email.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function resend_verification( $request ) {
		$result = $this->call_core(
			'godam_core.api.resend_verification.resend_verification_email',
			array( 'email' => sanitize_email( $request->get_param( 'email' ) ) )
		);
		return is_wp_error( $result ) ? $result : rest_ensure_response( is_array( $result ) ? $result : array( 'message' => $result ) );
	}

	/**
	 * Get the stored product-guide state for a user, falling back to "pending".
	 *
	 * @param int $user_id User ID. Defaults to the current user.
	 * @return string One of self::PRODUCT_GUIDE_STATES.
	 */
	public static function get_product_guide_state( $user_id = 0 ) {
		$user_id = $user_id ? $user_id : get_current_user_id();
		$state   = get_user_meta( $user_id, self::PRODUCT_GUIDE_META_KEY, true );

		return in_array( $state, self::PRODUCT_GUIDE_STATES, true ) ? $state : 'pending';
	}

	/**
	 * Permission check for the product-guide routes — same capability the Video
	 * Editor page requires.
	 *
	 * @return bool Whether the current user can manage their product-guide state.
	 */
	public function permissions_check() {
		return current_user_can( 'upload_files' );
	}

	/**
	 * GET handler — return the current user's product-guide state.
	 *
	 * @return WP_REST_Response Response with the current state.
	 */
	public function get_product_guide() {
		return new WP_REST_Response(
			array( 'status' => self::get_product_guide_state() ),
			200
		);
	}

	/**
	 * POST handler — persist the current user's product-guide state.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response Response with the saved state.
	 */
	public function update_product_guide( WP_REST_Request $request ) {
		$status = $request->get_param( 'status' );

		update_user_meta( get_current_user_id(), self::PRODUCT_GUIDE_META_KEY, $status );

		return new WP_REST_Response( array( 'status' => $status ), 200 );
	}

	/**
	 * GET handler (O10) — whether to show the "unlocked Woo features" nudge:
	 * WooCommerce is active and the current user hasn't dismissed it yet.
	 *
	 * @return WP_REST_Response
	 */
	public function get_woo_nudge() {
		$active = class_exists( 'WooCommerce' );
		$seen   = (bool) get_user_meta( get_current_user_id(), self::WOO_NUDGE_META_KEY, true );

		return new WP_REST_Response(
			array(
				'active' => $active,
				'seen'   => $seen,
				'show'   => $active && ! $seen,
			),
			200
		);
	}

	/**
	 * POST handler (O10) — mark the Woo nudge dismissed for the current user.
	 *
	 * @return WP_REST_Response
	 */
	public function dismiss_woo_nudge() {
		update_user_meta( get_current_user_id(), self::WOO_NUDGE_META_KEY, 1 );

		return new WP_REST_Response( array( 'seen' => true ), 200 );
	}
}
