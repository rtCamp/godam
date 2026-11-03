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
			'#^https?://' . preg_quote( wp_parse_url( RTGODAM_API_BASE, PHP_URL_HOST ), '#' ) . '/web/video/.*#i',
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
		if ( ! $this->is_godam_url( $url ) ) {
			return null;
		}

		$embed_url = RTGODAM_API_BASE . '/api/method/godam_core.api.oembed.get_oembed';

		$response = wp_remote_post(
			$embed_url,
			array(
				'body'    => wp_json_encode( array( 'url' => $url ) ),
				'headers' => array(
					'Content-Type' => 'application/json',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return false;
		}

		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		// Check if valid oEmbed data is returned.
		if ( isset( $data['type'] ) && isset( $data['html'] ) && is_string( $data['html'] ) ) {
			// Override type.
			if ( 'json' === $data['type'] ) {
				$data['type'] = 'video';
			}

			$data['html'] = $this->filter_embed_html( $data['html'] );

			if ( 'yes' === get_option( self::LLMS_AV_PROG_AUTO_PLAY_OPTION, 'no' ) ) {

				$data['html'] = str_replace( '<iframe', '<iframe class="rtgodam-llms-autoplay" allow="autoplay;encrypted-media;"', $data['html'] );
			}

			return '<div class="llms-av-embed fitvidsignore">' . $data['html'] . '</div>';
		}

		return null;
	}

	/**
	 * Check whether a URL is on GoDAM's own host.
	 *
	 * The URL has to use http or https and its host has to be exactly the host
	 * of the GoDAM API, so a URL that only mentions GoDAM in its path, query or
	 * a longer host name does not count.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $url URL to check.
	 *
	 * @return bool True when the URL is on GoDAM's host.
	 */
	private function is_godam_url( string $url ): bool {
		$api_host = wp_parse_url( RTGODAM_API_BASE, PHP_URL_HOST );
		$host     = wp_parse_url( $url, PHP_URL_HOST );
		$scheme   = wp_parse_url( $url, PHP_URL_SCHEME );

		if ( ! is_string( $api_host ) || ! is_string( $host ) || ! is_string( $scheme ) ) {
			return false;
		}

		return in_array( strtolower( $scheme ), array( 'http', 'https' ), true ) && strtolower( $host ) === strtolower( $api_host );
	}

	/**
	 * Filter the HTML GoDAM returns for an embed.
	 *
	 * Keeps the iframe the embed is made of, plus the markup WordPress allows in
	 * post content, and removes anything else.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $html HTML from the GoDAM oEmbed response.
	 *
	 * @return string The filtered HTML.
	 */
	private function filter_embed_html( string $html ): string {
		$allowed_html = wp_kses_allowed_html( 'post' );

		$allowed_html['iframe'] = array(
			'src'             => true,
			'width'           => true,
			'height'          => true,
			'title'           => true,
			'name'            => true,
			'id'              => true,
			'class'           => true,
			'style'           => true,
			'allow'           => true,
			'allowfullscreen' => true,
			'frameborder'     => true,
			'loading'         => true,
			'referrerpolicy'  => true,
			'sandbox'         => true,
			'scrolling'       => true,
			'data-*'          => true,
		);

		/**
		 * Filters the HTML elements and attributes kept in the HTML GoDAM returns for an embed.
		 *
		 * @since n.e.x.t
		 *
		 * @param array $allowed_html Allowed elements and attributes, in the format wp_kses() takes.
		 */
		$allowed_html = apply_filters( 'rtgodam_oembed_allowed_html', $allowed_html );

		return wp_kses( $html, $allowed_html );
	}
}
