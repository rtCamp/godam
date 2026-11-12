<?php
/**
 * Notice on GoDAM's admin pages that the site can be used from an AI agent.
 *
 * @package GoDAM
 *
 * @since n.e.x.t
 */

namespace RTGODAM\Inc\Abilities;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Ai_Agents_Notice
 *
 * Shown to administrators on GoDAM's own pages, and only on a site where the
 * MCP Adapter plugin is active and GoDAM's MCP switch is on, so it reaches the
 * people who can already connect an agent. Each administrator can dismiss it
 * for good.
 *
 * GoDAM's pages remove WordPress admin notices, so the notice is part of the
 * GoDAM header and asks this route whether to show.
 *
 * @since n.e.x.t
 */
class Ai_Agents_Notice {

	use Singleton;

	/**
	 * User meta key that records an administrator dismissed the notice.
	 *
	 * Uninstall runs without loading the plugin, so uninstall.php repeats this
	 * key. Keep the two in sync.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const DISMISSED_META_KEY = 'rtgodam_ai_agents_notice_dismissed';

	/**
	 * Help page that explains how to connect an agent.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const DOCS_URL = 'https://godam.io/docs/ai-agents/';

	/**
	 * Construct method.
	 */
	protected function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Registers the route the GoDAM header reads and dismisses the notice through.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function register_routes() {
		register_rest_route(
			'godam/v1',
			'/ai-agents/notice',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_notice' ),
					'permission_callback' => array( $this, 'permissions_check' ),
				),
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'dismiss_notice' ),
					'permission_callback' => array( $this, 'permissions_check' ),
				),
			)
		);
	}

	/**
	 * Only site administrators see or dismiss the notice.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool
	 */
	public function permissions_check() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Whether the notice should show to the current user.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool
	 */
	public static function should_show() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return false;
		}

		if ( ! Abilities::mcp_enabled() || ! Mcp_Server::adapter_is_supported() ) {
			return false;
		}

		return ! get_user_meta( get_current_user_id(), self::DISMISSED_META_KEY, true );
	}

	/**
	 * Says whether to show the notice, and where its links go.
	 *
	 * @since n.e.x.t
	 *
	 * @return \WP_REST_Response
	 */
	public function get_notice() {
		return rest_ensure_response(
			array(
				'show'        => self::should_show(),
				'settingsUrl' => admin_url( 'admin.php?page=rtgodam_settings#general-settings' ),
				'docsUrl'     => self::DOCS_URL,
			)
		);
	}

	/**
	 * Records that the current user dismissed the notice.
	 *
	 * @since n.e.x.t
	 *
	 * @return \WP_REST_Response
	 */
	public function dismiss_notice() {
		update_user_meta( get_current_user_id(), self::DISMISSED_META_KEY, time() );

		return rest_ensure_response( array( 'show' => false ) );
	}
}
