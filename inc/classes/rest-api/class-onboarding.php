<?php
/**
 * REST API proxy for the GoDAM onboarding flow.
 *
 * The onboarding SPA never talks to godam-core directly. These routes proxy
 * the `godam_core.api.login` / `organization_access` endpoints, hold the
 * short-lived GoDAM JWT server-side (never exposed to the browser), and — once
 * a workspace is chosen — store the durable Organization API key through the
 * existing `rtgodam_verify_api_key()` path (which also registers the site).
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

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
	 * Register the onboarding proxy routes.
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
					'methods'             => \WP_REST_Server::CREATABLE,
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
			$route( $base . '/google-login', 'google_login' ),
			$route( $base . '/list-organizations', 'list_organizations' ),
			$route( $base . '/organization-api-key', 'organization_api_key' ),
			$route( $base . '/verify-license-key', 'verify_license_key' ),
			$route( $base . '/reset-password', 'reset_password' ),
			$route( $base . '/resend-verification', 'resend_verification' ),
		);
	}

	/**
	 * Low-level call to a godam-core whitelisted method.
	 *
	 * @param string $path     Dotted method path.
	 * @param array  $args     Request params.
	 * @param string $method   HTTP method (GET|POST).
	 * @param bool   $with_jwt Attach the stored Bearer JWT.
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
			$headers['Authorization'] = 'Bearer ' . $jwt;
		}

		$request_args = array(
			// Auth/signup calls can provision an account, so allow a longer wait.
			'timeout' => 15, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
			'headers' => $headers,
		);

		if ( 'GET' === $method ) {
			$response = wp_remote_get( add_query_arg( array_map( 'rawurlencode', $args ), $url ), $request_args );
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
	 * Build the Google OAuth URL (redirect lands back in the SPA).
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function google_oauth_url() {
		$redirect_to = admin_url( 'admin.php?page=rtgodam_onboarding' );
		$result      = $this->call_core( 'godam_core.api.user.get_oauth2_url', array( 'redirect_to' => $redirect_to ), 'GET' );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		$url = is_string( $result ) ? $result : ( $result['url'] ?? '' );
		return rest_ensure_response( array( 'url' => $url ) );
	}

	/**
	 * Exchange a Google OAuth code for a JWT (auto-provisions on first sign-in).
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function google_login( $request ) {
		$result = $this->call_core(
			'godam_core.api.login.google_login',
			array(
				'code'           => (string) $request->get_param( 'code' ),
				'wordpress_site' => get_site_url(),
			)
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
		return is_wp_error( $connected ) ? $connected : rest_ensure_response( array( 'connected' => true ) );
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
}
