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
	 * Attachment IDs found for GoDAM job IDs during this request; 0 when none.
	 *
	 * @since n.e.x.t
	 *
	 * @var array<string, int>
	 */
	private $attachment_ids_by_job = array();

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
		add_action( 'init', array( $this, 'register_local_embed_handler' ) );
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

		// A video that's in this site's media library plays in the site's own
		// player, so it doesn't depend on GoDAM's oEmbed API, which only
		// embeds videos shared publicly.
		$local_html = $this->get_local_embed_html( $url );

		if ( '' !== $local_html ) {
			return $local_html;
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
	 * Register an embed handler for GoDAM share URLs of videos in the media library.
	 *
	 * WordPress runs embed handlers before its oEmbed cache when it embeds a
	 * URL in post content (and when ACF's oEmbed field falls back to it), so
	 * the player renders, with its scripts, on every view. The oEmbed HTML
	 * cache would keep the markup but skip the scripts.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function register_local_embed_handler() {
		$host = wp_parse_url( RTGODAM_API_BASE, PHP_URL_HOST );

		if ( ! is_string( $host ) || '' === $host ) {
			return;
		}

		wp_embed_register_handler(
			'godam-local-video',
			'#^https?://' . preg_quote( $host, '#' ) . '/web/video/[A-Za-z0-9_-]+/?(?:[?\#].*)?$#i',
			array( $this, 'render_local_embed' ),
			9
		);
	}

	/**
	 * Embed handler callback: render a GoDAM share URL with the site's own player.
	 *
	 * @since n.e.x.t
	 *
	 * @param array  $matches The regex matches.
	 * @param array  $attr    Embed attributes.
	 * @param string $url     The URL being embedded.
	 *
	 * @return string|false The player HTML, or false to let WordPress try oEmbed.
	 */
	public function render_local_embed( $matches, $attr, $url ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundBeforeLastUsed -- signature set by wp_embed_register_handler().
		$html = $this->get_local_embed_html( (string) $url );

		return '' === $html ? false : $html;
	}

	/**
	 * Render a GoDAM share URL with the site's own player, when its video is in the media library.
	 *
	 * The share URL is RTGODAM_API_BASE/web/video/<job ID>. The Vimeo
	 * migration writes these into ACF fields; they can also be pasted into
	 * content.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $url GoDAM share URL.
	 *
	 * @return string The player HTML, or '' when the URL isn't a share URL of a video in the media library.
	 */
	public function get_local_embed_html( string $url ): string {
		if ( ! $this->is_godam_url( $url ) ) {
			return '';
		}

		$job_id = self::get_share_url_job_id( $url );

		if ( '' === $job_id ) {
			return '';
		}

		$attachment_id = $this->find_attachment_id_by_job_id( $job_id );

		if ( $attachment_id <= 0 ) {
			return '';
		}

		/**
		 * Filters whether a GoDAM share URL renders with the site's own player.
		 *
		 * Return false to embed the video through GoDAM's oEmbed API instead,
		 * as LifterLMS lessons do: their player integration talks to the
		 * embedded iframe.
		 *
		 * @since n.e.x.t
		 *
		 * @param bool   $render_locally Whether to render with the site's own player. Default true.
		 * @param string $url            The GoDAM share URL.
		 * @param int    $attachment_id  ID of the video in the media library.
		 */
		if ( ! apply_filters( 'rtgodam_render_share_url_locally', true, $url, $attachment_id ) ) {
			return '';
		}

		return (string) do_shortcode( sprintf( '[godam_video id="%d"]', $attachment_id ) );
	}

	/**
	 * Read the GoDAM job ID from a share URL.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $url GoDAM share URL, RTGODAM_API_BASE/web/video/<job ID>.
	 *
	 * @return string The job ID, or '' when the URL has none.
	 */
	public static function get_share_url_job_id( string $url ): string {
		$path = wp_parse_url( $url, PHP_URL_PATH );

		if ( is_string( $path ) && preg_match( '#^/web/video/([A-Za-z0-9_-]+)/?$#', $path, $matches ) ) {
			return $matches[1];
		}

		return '';
	}

	/**
	 * Find the media library attachment for a GoDAM job ID.
	 *
	 * Matches transcoded uploads (`rtgodam_transcoding_job_id`) and media
	 * imported from GoDAM, including migrated Vimeo videos
	 * (`_godam_original_id`).
	 *
	 * @since n.e.x.t
	 *
	 * @param string $job_id GoDAM job ID.
	 *
	 * @return int Attachment ID, or 0 when none.
	 */
	private function find_attachment_id_by_job_id( string $job_id ): int {
		if ( isset( $this->attachment_ids_by_job[ $job_id ] ) ) {
			return $this->attachment_ids_by_job[ $job_id ];
		}

		global $wpdb;

		if ( ! is_object( $wpdb ) ) {
			return 0;
		}

		/**
		 * Fires before looking the attachment up, so integrations that
		 * centralize media on another site can switch context first.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );

		try {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- cached per request in $attachment_ids_by_job.
			$attachment_id = (int) $wpdb->get_var(
				$wpdb->prepare(
					"SELECT pm.post_id
					 FROM {$wpdb->postmeta} pm
					 INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
					 WHERE pm.meta_key IN ('rtgodam_transcoding_job_id', '_godam_original_id')
					   AND pm.meta_value = %s
					   AND p.post_type = 'attachment'
					   AND p.post_status <> 'trash'
					 ORDER BY pm.post_id ASC
					 LIMIT 1",
					$job_id
				)
			);
		} finally {
			/**
			 * Fires after the lookup, so integrations can restore the
			 * context switched in `rtgodam_before_attachment_lookup`.
			 *
			 * @since 2.2.0
			 */
			do_action( 'rtgodam_after_attachment_lookup' );
		}

		$this->attachment_ids_by_job[ $job_id ] = $attachment_id;

		return $attachment_id;
	}

	/**
	 * Check whether a URL is on GoDAM's own host.
	 *
	 * The URL has to use http or https and its host has to be exactly the host
	 * of the GoDAM API, so a URL that only mentions GoDAM in its path, query or
	 * a longer host name does not count.
	 *
	 * @since 2.7.0
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
	 * @since 2.7.0
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
		 * @since 2.7.0
		 *
		 * @param array $allowed_html Allowed elements and attributes, in the format wp_kses() takes.
		 */
		$allowed_html = apply_filters( 'rtgodam_oembed_allowed_html', $allowed_html );

		return wp_kses( $html, $allowed_html );
	}
}
