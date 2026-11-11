<?php
/**
 * Turns a Vimeo URL into the GoDAM video that replaces it.
 *
 * @since n.e.x.t
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Vimeo_Migration;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\REST_API\Video_Migration;

/**
 * Class Vimeo_Resolver
 *
 * Looks up, through GoDAM Central, the video that Central imported from a
 * Vimeo URL, makes sure it exists as an attachment, and returns what a page
 * builder needs to show it. Results are cached by Vimeo video ID for the
 * lifetime of the object, so a video used many times in one batch costs one
 * Central request.
 *
 * @since n.e.x.t
 */
class Vimeo_Resolver {

	/**
	 * The migration that creates attachments from Vimeo videos.
	 *
	 * @since n.e.x.t
	 *
	 * @var Video_Migration
	 */
	private $migration;

	/**
	 * Resolved videos keyed by Vimeo video ID. Null marks a failed lookup.
	 *
	 * @since n.e.x.t
	 *
	 * @var array<string, array|null>
	 */
	private $cache = array();

	/**
	 * Constructor.
	 *
	 * @since n.e.x.t
	 *
	 * @param Video_Migration $migration The migration that creates attachments from Vimeo videos.
	 */
	public function __construct( Video_Migration $migration ) {
		$this->migration = $migration;
	}

	/**
	 * Resolve a Vimeo URL to the GoDAM video that replaces it.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $vimeo_url Vimeo video URL.
	 *
	 * @return array|null Null when the video can't be replaced (not imported in
	 *                    GoDAM Central yet, or an error). Otherwise an array with:
	 *                    - id        (int)    Attachment ID.
	 *                    - url       (string) Attachment URL.
	 *                    - title     (string) Attachment title.
	 *                    - share_url (string) GoDAM share URL (RTGODAM_API_BASE/web/video/<job id>), or '' when unknown.
	 */
	public function resolve( string $vimeo_url ) {
		$video_id  = Vimeo_Url::get_video_id( $vimeo_url );
		$cache_key = '' !== $video_id ? $video_id : trim( $vimeo_url );

		if ( array_key_exists( $cache_key, $this->cache ) ) {
			return $this->cache[ $cache_key ];
		}

		$this->cache[ $cache_key ] = $this->lookup( $vimeo_url );

		return $this->cache[ $cache_key ];
	}

	/**
	 * Look a Vimeo URL up in GoDAM Central and read the replacement attachment.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $vimeo_url Vimeo video URL.
	 *
	 * @return array|null See resolve().
	 */
	private function lookup( string $vimeo_url ) {
		$attachment_id = $this->migration->create_attachment_from_vimeo_video( $vimeo_url );

		if ( is_wp_error( $attachment_id ) || empty( $attachment_id ) ) {
			return null;
		}

		$attachment_id = (int) $attachment_id;

		/**
		 * Fires before reading the migrated attachment's URL, title and
		 * job ID, so integrations that centralize media on another site can
		 * switch context first.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );

		$url    = wp_get_attachment_url( $attachment_id );
		$title  = get_the_title( $attachment_id );
		$job_id = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );

		/**
		 * Fires after reading the migrated attachment's data, so
		 * integrations can restore the context switched in
		 * `rtgodam_before_attachment_lookup`.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_after_attachment_lookup' );

		if ( empty( $url ) ) {
			return null;
		}

		return array(
			'id'        => $attachment_id,
			'url'       => (string) $url,
			'title'     => is_string( $title ) ? $title : '',
			'share_url' => self::build_share_url( is_string( $job_id ) ? $job_id : '' ),
		);
	}

	/**
	 * Build the GoDAM share URL for a Central job ID.
	 *
	 * GoDAM registers itself as the oEmbed provider for these URLs (see
	 * RTGODAM\Inc\Embed), so they render the GoDAM player wherever WordPress
	 * embeds a URL.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $job_id GoDAM Central job ID.
	 *
	 * @return string The share URL, or '' when the job ID is empty.
	 */
	public static function build_share_url( string $job_id ): string {
		$job_id = trim( $job_id );

		if ( '' === $job_id ) {
			return '';
		}

		return untrailingslashit( RTGODAM_API_BASE ) . '/web/video/' . rawurlencode( $job_id );
	}
}
