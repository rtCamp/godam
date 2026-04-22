<?php
/**
 * Frappe Dispatch - Native WordPress Plugin Updater
 *
 * @package FrappeDispatch\Client
 * @author  rtCamp
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * A clean, robust updater class to connect WordPress
 * plugins directly to your Frappe Dispatch backend.
 */
class Frappe_Dispatch_Updater {

	/**
	 * The URL to the Frappe API endpoint.
	 *
	 * @var string
	 */
	private $api_url;

	/**
	 * Absolute path to the main plugin file.
	 *
	 * @var string
	 */
	private $plugin_file;

	/**
	 * The short slug of the plugin.
	 *
	 * @var string
	 */
	private $plugin_slug;

	/**
	 * The basename of the plugin (folder/file.php).
	 *
	 * @var string
	 */
	private $plugin_basename;

	/**
	 * Associative array of plugin arguments.
	 *
	 * @var array
	 */
	private $args;

	/**
	 * Constructor.
	 *
	 * @param string $api_url     Base URL for Frappe Dispatch.
	 * @param string $plugin_file Absolute path to the plugin file.
	 * @param array  $args        Optional overrides.
	 */
	public function __construct( $api_url, $plugin_file, $args = array() ) {
		// Allow wp-config.php to globally override the update server URL.
		if ( defined( 'FRAPPE_DISPATCH_SITE_URL' ) ) {
			$api_url = FRAPPE_DISPATCH_SITE_URL;
		}

		// Auto-append the exact API endpoint if only the base domain was provided.
		$api_url = rtrim( $api_url, '/' );
		if ( false === strpos( $api_url, '/api/method/' ) ) {
			$api_url .= '/api/method/frappe_dispatch.api.dispatch.get_version';
		}

		$this->api_url         = esc_url_raw( $api_url );
		$this->plugin_file     = $plugin_file;
		$this->plugin_basename = plugin_basename( $plugin_file );
		$this->plugin_slug     = basename( dirname( $plugin_file ) );
		$this->args            = wp_parse_args(
			$args,
			array(
				'type'    => 'plugin', // 'plugin' or 'theme'
				'version' => '1.0.0',
				'item_id' => '',
				'license' => '',
				'author'  => '',
			)
		);

		if ( 'theme' === $this->args['type'] ) {
			add_filter( 'pre_set_site_transient_update_themes', array( $this, 'check_for_update' ) );
			add_filter( 'site_transient_update_themes', array( $this, 'check_for_update' ) );
		} else {
			add_filter( 'pre_set_site_transient_update_plugins', array( $this, 'check_for_update' ) );
			add_filter( 'site_transient_update_plugins', array( $this, 'check_for_update' ) );
			add_filter( 'plugins_api', array( $this, 'plugin_info_modal' ), 10, 3 );
		}
	}

	/**
	 * Fetches update metadata from the Frappe server.
	 *
	 * @return object|false
	 */
	public function fetch_api_data() {
		$cache_key = 'fd_update_' . md5( $this->plugin_slug . $this->args['license'] . $this->args['version'] );
		$cached    = get_transient( $cache_key );

		if ( false !== $cached ) {
			return $cached; // Already an object.
		}

		$request_args = array(
			'item_id' => $this->args['item_id'],
			'license' => $this->args['license'],
			'url'     => home_url(),
			'version' => $this->args['version'],
			'slug'    => $this->plugin_slug,
		);

		$request_options = array(
			'timeout'   => 15,
			'sslverify' => apply_filters( 'frappe_dispatch_verify_ssl', true ),
			'body'      => $request_args,
		);

		// WordPress VIP Go compatibility: Use VIP safe HTTP wrappers if available.
		if ( function_exists( 'vip_safe_wp_remote_post' ) ) {
			$response = vip_safe_wp_remote_post( $this->api_url, false, 3, 3, 20, $request_options );
		} else {
			$response = wp_remote_post( $this->api_url, $request_options );
		}

		if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
			return false;
		}

		$api_data = json_decode( wp_remote_retrieve_body( $response ) );

		if ( ! is_object( $api_data ) ) {
			return false;
		}

		set_transient( $cache_key, $api_data, 3 * HOUR_IN_SECONDS );

		return $api_data;
	}

	/**
	 * Clear the cached API data so the next fetch is fresh.
	 *
	 * @return void
	 */
	public function clear_cache() {
		$cache_key = 'fd_update_' . md5( $this->plugin_slug . $this->args['license'] . $this->args['version'] );
		delete_transient( $cache_key );
	}

	/**
	 * Get the current plugin version tracked by this updater.
	 *
	 * @return string
	 */
	public function get_version() {
		return $this->args['version'];
	}

	/**
	 * Intercepts the update transient to show plugin updates.
	 *
	 * @param object $transient The WordPress update transient.
	 * @return object
	 */
	public function check_for_update( $transient ) {
		if ( empty( $transient->checked ) ) {
			return $transient;
		}

		$api_data      = $this->fetch_api_data();
		$transient_key = ( 'theme' === $this->args['type'] ) ? $this->plugin_slug : $this->plugin_basename;

		if ( $api_data && isset( $api_data->new_version ) ) {
			if ( version_compare( $this->args['version'], $api_data->new_version, '<' ) ) {

				if ( 'theme' === $this->args['type'] ) {
					// WordPress requires themes to be strict arrays keyed by slug.
					$transient->response[ $transient_key ] = array(
						'theme'       => $this->plugin_slug,
						'new_version' => sanitize_text_field( $api_data->new_version ),
						'url'         => isset( $api_data->url ) ? esc_url_raw( $api_data->url ) : '',
						'package'     => isset( $api_data->download_link ) ? esc_url_raw( $api_data->download_link ) : '',
					);
				} else {
					// WordPress requires plugins to be stdClass objects keyed by basename.
					$plugin_data               = new \stdClass();
					$plugin_data->id           = $this->plugin_slug;
					$plugin_data->slug         = $this->plugin_slug;
					$plugin_data->plugin       = $this->plugin_basename;
					$plugin_data->new_version  = sanitize_text_field( $api_data->new_version );
					$plugin_data->url          = isset( $api_data->url ) ? esc_url_raw( $api_data->url ) : '';
					$plugin_data->package      = isset( $api_data->download_link ) ? esc_url_raw( $api_data->download_link ) : '';
					$plugin_data->icons        = isset( $api_data->icons ) ? (array) $api_data->icons : array();
					$plugin_data->banners      = isset( $api_data->banners ) ? (array) $api_data->banners : array();
					$plugin_data->tested       = isset( $api_data->tested ) ? sanitize_text_field( $api_data->tested ) : '';
					$plugin_data->requires_php = isset( $api_data->requires_php ) ? sanitize_text_field( $api_data->requires_php ) : '';

					$transient->response[ $transient_key ] = $plugin_data;
				}
			} else {
				// Prevent 'ghost' updates by actively removing the item from the queue.
				if ( isset( $transient->response[ $transient_key ] ) ) {
					unset( $transient->response[ $transient_key ] );
				}

				// Optional: track up-to-date status (mainly used for plugins).
				if ( 'plugin' === $this->args['type'] && isset( $plugin_data ) ) {
					$transient->no_update[ $transient_key ] = $plugin_data;
				}
			}
		}

		return $transient;
	}

	/**
	 * Populates the View Details modal with changelogs and banner images.
	 *
	 * @param false|object $false  Always false.
	 * @param string       $action The API action being performed.
	 * @param object       $args   Arguments required for the query.
	 * @return object|false
	 */
	public function plugin_info_modal( $false, $action, $args ) {
		if ( 'plugin_information' !== $action || ! isset( $args->slug ) || $args->slug !== $this->plugin_slug ) {
			return $false;
		}

		$api_data = $this->fetch_api_data();
		if ( ! $api_data ) {
			return $false;
		}

		$info                  = new \stdClass();
		$info->name            = isset( $api_data->name ) ? sanitize_text_field( $api_data->name ) : '';
		$info->slug            = $this->plugin_slug;
		$info->plugin          = $this->plugin_basename;
		$info->version         = isset( $api_data->new_version ) ? sanitize_text_field( $api_data->new_version ) : '';
		$info->author          = isset( $api_data->author ) && ! empty( $api_data->author ) ? wp_kses_post( $api_data->author ) : ( isset( $this->args['author'] ) ? wp_kses_post( $this->args['author'] ) : '' );
		$info->author_profile  = isset( $api_data->author_profile ) ? esc_url_raw( $api_data->author_profile ) : '';
		$info->homepage        = isset( $api_data->url ) ? esc_url_raw( $api_data->url ) : '';
		$info->requires        = isset( $api_data->requires ) ? sanitize_text_field( $api_data->requires ) : '';
		$info->requires_php    = isset( $api_data->requires_php ) ? sanitize_text_field( $api_data->requires_php ) : '';
		$info->tested          = isset( $api_data->tested ) ? sanitize_text_field( $api_data->tested ) : '';
		$info->rating          = isset( $api_data->rating ) ? absint( $api_data->rating ) : 0;
		$info->num_ratings     = isset( $api_data->num_ratings ) ? absint( $api_data->num_ratings ) : 0;
		$info->downloaded      = isset( $api_data->downloaded ) ? absint( $api_data->downloaded ) : 0;
		$info->active_installs = isset( $api_data->active_installs ) ? absint( $api_data->active_installs ) : 0;
		$info->donate_link     = isset( $api_data->donate_link ) ? esc_url_raw( $api_data->donate_link ) : '';
		$info->download_link   = isset( $api_data->download_link ) ? esc_url_raw( $api_data->download_link ) : '';
		$info->added           = isset( $api_data->added ) ? sanitize_text_field( $api_data->added ) : '';
		$info->last_updated    = isset( $api_data->last_updated ) ? sanitize_text_field( $api_data->last_updated ) : '';
		$info->sections        = isset( $api_data->sections ) ? (array) $api_data->sections : array();
		$info->banners         = isset( $api_data->banners ) ? (array) $api_data->banners : array();

		// Sanitize all rich text data strictly.
		foreach ( $info->sections as $key => $content ) {
			$info->sections[ $key ] = wp_kses_post( $content );
		}

		return $info;
	}
}
