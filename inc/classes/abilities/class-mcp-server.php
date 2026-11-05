<?php
/**
 * Registers a GoDAM MCP server when the MCP Adapter plugin is active.
 *
 * The adapter's default server exposes abilities only indirectly, through
 * three generic tools (discover, describe, execute), so an agent cannot see
 * what GoDAM offers until it goes looking. This server lists each exposed
 * GoDAM ability as its own tool, with its schema, at /wp-json/godam/mcp.
 *
 * GoDAM does not bundle the adapter. If it is not installed, nothing here runs
 * and the abilities remain available to the REST API and any other server.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Abilities;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Mcp_Server
 *
 * @since 2.8.0
 */
class Mcp_Server {

	use Singleton;

	/**
	 * Server ID, also the WP-CLI `--server` value.
	 *
	 * @var string
	 */
	const SERVER_ID = 'godam';

	/**
	 * Construct method.
	 */
	protected function __construct() {
		add_action( 'mcp_adapter_init', array( $this, 'register_server' ) );
	}

	/**
	 * Registers the GoDAM server with the adapter.
	 *
	 * @since 2.8.0
	 *
	 * @param object $adapter The adapter instance (\WP\MCP\Core\McpAdapter).
	 *
	 * @return void
	 */
	public function register_server( $adapter ) {
		if ( ! is_object( $adapter ) || ! method_exists( $adapter, 'create_server' ) || ! class_exists( '\WP\MCP\Transport\HttpTransport' ) ) {
			return;
		}

		$adapter->create_server(
			self::SERVER_ID,
			'godam',
			'mcp',
			__( 'GoDAM', 'godam' ),
			__( 'Find, organise and process media in the GoDAM library, add interactive layers, place GoDAM media on pages, and read analytics.', 'godam' ),
			RTGODAM_VERSION,
			array( \WP\MCP\Transport\HttpTransport::class ),
			\WP\MCP\Infrastructure\ErrorHandling\ErrorLogMcpErrorHandler::class,
			null,
			$this->exposed_ability_names()
		);
	}

	/**
	 * Names of the abilities this server should list.
	 *
	 * Abilities named in a server's tool list are exposed regardless of their
	 * `meta.public` flags, so the flags are honoured here explicitly. Otherwise
	 * this server would quietly expose write abilities a site has not enabled.
	 *
	 * @since 2.8.0
	 *
	 * @return string[]
	 */
	private function exposed_ability_names() {
		/**
		 * Filters the ability namespaces the GoDAM MCP server lists.
		 *
		 * GoDAM add-ons register their abilities under their own namespace and
		 * add it here, so one GoDAM server carries the whole product. For
		 * example, GoDAM for WooCommerce adds `godam-woo`.
		 *
		 * @since 2.8.0
		 *
		 * @param string[] $namespaces Ability namespaces, without the trailing slash.
		 */
		$namespaces = (array) apply_filters( 'rtgodam_mcp_ability_namespaces', array( 'godam' ) );
		$names      = array();

		foreach ( wp_get_abilities() as $ability ) {
			$name = $ability->get_name();

			if ( ! in_array( strtok( $name, '/' ), $namespaces, true ) ) {
				continue;
			}

			$meta = $ability->get_meta();

			if ( ! empty( $meta['mcp']['public'] ) ) {
				$names[] = $name;
			}
		}

		return $names;
	}
}
