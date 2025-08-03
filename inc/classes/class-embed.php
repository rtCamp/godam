<?php
/**
 * Class to handle GoDAM as oEmbed provide.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Embed
 */
class Embed {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks.
	 *
	 * @return void
	 */
	public function setup_hooks() {
		add_action( 'init', array( $this, 'register_oembed_provider' ) );
		add_filter( 'pre_oembed_result', array( $this, 'pre_oembed_result' ), 10, 2 );
	}

	/**
	 * Register the oEmbed provider for GoDAM videos.
	 *
	 * @return void
	 */
	public function register_oembed_provider() {
		// Register the oEmbed provider for GoDAM videos.
		wp_oembed_add_provider(
			'#https?://app-godam\.rt\.gw/web/video/.*#i',
			'https://app-godam.rt.gw/api/method/godam_core.api.oembed.get_oembed',
			true
		);
	}

	/**
	 * Pre-process the oEmbed result for GoDAM videos.
	 *
	 * @param mixed  $data data to be filled with oEmbed data.
	 * @param string $url URL to be processed.
	 *
	 * @return false|mixed
	 */
	public function pre_oembed_result( $data, string $url ) {
		if ( strpos( $url, 'app-godam.rt.gw' ) !== false ) {

			$response = wp_remote_get( 'https://app-godam.rt.gw/api/method/godam_core.api.oembed.get_oembed?url=' . urlencode( $url ) );

			if ( is_wp_error( $response ) ) {
				return false;
			}

			$body = wp_remote_retrieve_body( $response );
			$data = json_decode( $body, true );

			if ( isset( $data['type'] ) && 'rich' === $data['type'] ) {
				$data['type'] = 'video';
			}

			return $data['html'] ?? false;
		}

		return false;
	}
}
