<?php
/**
 * Class to handle GoDAM as oEmbed provider.
 *
 * @since 1.4.0
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Embed
 *
 * @since 1.4.0
 */
class Embed {

	use Singleton;

	/**
	 * Constant LifterLMS Advanced Video autoplay option.
	 *
	 * @since 1.4.0
	 *
	 * @var string
	 */
	const LLMS_AV_PROG_AUTO_PLAY_OPTION = 'llms_av_prog_auto_play';

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
	 * @since 1.4.0
	 *
	 * @return void
	 */
	public function register_oembed_provider() {
		// Register the oEmbed provider for GoDAM videos.
		wp_oembed_add_provider(
			'#https?://' . preg_quote( wp_parse_url( RTGODAM_API_BASE, PHP_URL_HOST ), '#' ) . '/web/video/.*#i',
			RTGODAM_API_BASE . '/api/method/godam_core.api.oembed.get_oembed',
			true
		);
	}

	/**
	 * Pre-process the oEmbed result for GoDAM videos.
	 *
	 * @since 1.4.0
	 *
	 * @param mixed  $data data to be filled with oEmbed data.
	 * @param string $url URL to be processed.
	 *
	 * @return false|mixed
	 */
	public function pre_oembed_result( $data, string $url ) {
		// Only intercept GoDAM specific URLs.
		if ( strpos( $url, RTGODAM_API_BASE ) === false ) {
			return null;
		}

		$embed_url = RTGODAM_API_BASE . '/api/method/godam_core.api.oembed.get_oembed?url=' . rawurlencode( $url );

		$response = wp_remote_get( $embed_url );

		if ( is_wp_error( $response ) ) {
			return false;
		}

		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		// Check if valid oEmbed data is returned.
		if ( isset( $data['type'] ) && isset( $data['html'] ) ) {
			// Override type.
			if ( 'json' === $data['type'] ) {
				$data['type'] = 'video';
			}

			if ( 'yes' === get_option( self::LLMS_AV_PROG_AUTO_PLAY_OPTION, 'no' ) ) {

				$data['html'] = str_replace( '<iframe', '<iframe class="rtgodam-llms-autoplay" allow="autoplay;encrypted-media;"', $data['html'] );
			}

			return '<div class="llms-av-embed fitvidsignore">' . $data['html'] . '</div>';
		}

		return null;
	}
}
