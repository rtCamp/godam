<?php
/**
 * Register REST API endpoints for HubSpot Forms.
 *
 * Lists the forms of the HubSpot account connected through the "HubSpot
 * All-In-One Marketing" (leadin) plugin, so the Video Editor can offer a form
 * picker for the HubSpot form layer — the same way the other form providers do.
 *
 * The HubSpot connection (and the short-lived access token) is owned by leadin;
 * we reuse its `leadin/v1/access-token` endpoint via an internal dispatch so the
 * refresh token never leaves leadin, and then read the form list from HubSpot.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Hubspot;
use RTGODAM\Inc\Traits\Central_Client;

/**
 * Class Hubspot_Forms
 */
class Hubspot_Forms extends Base {

	use Central_Client;

	/**
	 * HubSpot marketing forms endpoint (v3).
	 *
	 * @var string
	 */
	private const HUBSPOT_FORMS_API = 'https://api.hubapi.com/marketing/v3/forms';

	/**
	 * Permission check — same capability the Video Editor page requires.
	 *
	 * @return bool
	 */
	public function forms_permissions_check() {
		return current_user_can( 'upload_files' );
	}

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/hubspot-forms',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_hubspot_forms' ),
						'permission_callback' => array( $this, 'forms_permissions_check' ),
					),
				),
			),
		);
	}

	/**
	 * Whether the HubSpot (leadin) plugin is active and connected to an account.
	 *
	 * Delegates to {@see Hubspot::is_leadin_connected()} so the "is leadin
	 * connected" check lives in one place.
	 *
	 * @return bool
	 */
	private function is_hubspot_connected() {
		return Hubspot::is_leadin_connected();
	}

	/**
	 * Get a short-lived HubSpot access token from the connected leadin plugin.
	 *
	 * Dispatches leadin's own `leadin/v1/access-token` endpoint internally, so the
	 * refresh-token exchange and caching stay entirely within leadin and the
	 * refresh token never leaves its control.
	 *
	 * @return string|\WP_Error Access token, or error.
	 */
	private function get_access_token() {
		$request  = new \WP_REST_Request( 'GET', '/leadin/v1/access-token' );
		$response = rest_do_request( $request );

		if ( $response->is_error() ) {
			return new \WP_Error( 'hubspot_token_failed', __( 'Could not obtain a HubSpot access token.', 'godam' ), array( 'status' => 502 ) );
		}

		$data = $response->get_data();

		if ( empty( $data['accessToken'] ) ) {
			return new \WP_Error( 'hubspot_token_failed', __( 'Could not obtain a HubSpot access token.', 'godam' ), array( 'status' => 502 ) );
		}

		return $data['accessToken'];
	}

	/**
	 * Get the HubSpot forms for the editor's form picker, from whichever source
	 * the admin has chosen and connected.
	 *
	 * One route, one response shape (`[{ id, title }]` where `id` is the HubSpot
	 * form GUID) regardless of source, so the editor uses a single query:
	 *  - `central`: list through GoDAM Central (`get_forms?provider=hubspot`). An
	 *    empty list is returned when Central cannot list them (e.g. a forms-only
	 *    connection) so the editor falls back to a typed form-ID field.
	 *  - `leadin`: list through the leadin plugin's HubSpot account.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_hubspot_forms() {
		switch ( Hubspot::get_active_source() ) {
			case 'central':
				return $this->get_central_forms();
			case 'leadin':
				return $this->get_leadin_forms();
			default:
				return new \WP_Error( 'hubspot_not_connected', __( 'HubSpot is not connected. Connect it in Settings → Integrations, or activate and connect the HubSpot plugin.', 'godam' ), array( 'status' => 404 ) );
		}
	}

	/**
	 * List HubSpot forms through GoDAM Central.
	 *
	 * Central returns `{ id, name }`; normalise it to the editor's `{ id, title }`
	 * shape. When Central cannot list forms (a forms-only connection, or any
	 * error) return an empty list so the editor shows a typed form-ID field
	 * instead of failing.
	 *
	 * @return \WP_REST_Response
	 */
	private function get_central_forms() {
		$result = $this->call_central(
			'godam_core.api.map_wordpress.get_forms',
			array( 'provider' => 'hubspot' )
		);

		if ( is_wp_error( $result ) ) {
			// Let the editor fall back to a typed form-ID field rather than error.
			return rest_ensure_response( array() );
		}

		$forms = array();

		foreach ( (array) ( $result['forms'] ?? array() ) as $form ) {
			if ( empty( $form['id'] ) ) {
				continue;
			}

			$forms[] = array(
				'id'    => sanitize_text_field( $form['id'] ),
				'title' => sanitize_text_field( $form['name'] ?? $form['id'] ),
			);
		}

		return rest_ensure_response( $forms );
	}

	/**
	 * List all forms from the HubSpot account connected through the leadin plugin.
	 *
	 * Returns a list of `{ id, title }` where `id` is the HubSpot form ID (GUID)
	 * used by the embed, matching the shape the editor's form picker expects.
	 *
	 * @return \WP_REST_Response|\WP_Error
	 */
	private function get_leadin_forms() {
		if ( ! $this->is_hubspot_connected() ) {
			return new \WP_Error( 'hubspot_not_connected', __( 'The HubSpot plugin is not active or not connected to an account.', 'godam' ), array( 'status' => 404 ) );
		}

		$access_token = $this->get_access_token();
		if ( is_wp_error( $access_token ) ) {
			return $access_token;
		}

		$forms = array();
		$after = '';
		$page  = 0;

		// HubSpot paginates with an opaque `after` cursor. Cap the number of pages
		// so a very large account cannot hold the request open indefinitely.
		do {
			$url = add_query_arg(
				array_filter(
					array(
						'limit' => 100,
						'after' => $after,
					),
					static function ( $value ) {
						return '' !== $value;
					}
				),
				self::HUBSPOT_FORMS_API
			);

			$response = wp_remote_get(
				$url,
				array(
					'timeout' => 15, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
					'headers' => array(
						'Authorization' => 'Bearer ' . $access_token,
						'Content-Type'  => 'application/json',
					),
				)
			);

			if ( is_wp_error( $response ) ) {
				return new \WP_Error( 'hubspot_forms_request_failed', __( 'Could not fetch the HubSpot forms.', 'godam' ), array( 'status' => 502 ) );
			}

			$status_code = wp_remote_retrieve_response_code( $response );
			if ( 200 !== $status_code ) {
				return new \WP_Error( 'hubspot_forms_request_failed', __( 'Could not fetch the HubSpot forms.', 'godam' ), array( 'status' => $status_code ) );
			}

			$body = json_decode( wp_remote_retrieve_body( $response ), true );

			foreach ( (array) ( $body['results'] ?? array() ) as $form ) {
				if ( empty( $form['id'] ) ) {
					continue;
				}

				$forms[] = array(
					'id'    => sanitize_text_field( $form['id'] ),
					'title' => sanitize_text_field( $form['name'] ?? $form['id'] ),
				);
			}

			$after = $body['paging']['next']['after'] ?? '';
			++$page;
		} while ( ! empty( $after ) && $page < 10 );

		return rest_ensure_response( $forms );
	}
}
