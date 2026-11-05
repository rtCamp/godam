<?php
/**
 * Signed playback sources for GoDAM media this site shows.
 *
 * Files set to Organization or Embed only in GoDAM are served from a signed CDN folder, so
 * the URLs saved when they were added to WordPress don't play. Just before playback the
 * player asks this route; it asks GoDAM with the site's License key
 * (`godam_core.api.playback.get_playback`) and returns sources signed for that one file.
 * GoDAM answers only while the license is active. The answer is cached for up to a minute
 * (never past its signatures), so a busy page costs one GoDAM call per file per minute and a
 * level change in GoDAM reaches the site within that minute.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Helpers\Api_Key;

/**
 * Class Playback
 */
class Playback extends Base {

	/**
	 * Seconds kept off the signature lifetime when caching, so a cached answer never hands
	 * the player URLs that expire mid-playback start.
	 */
	const EXPIRY_MARGIN = 120;

	/**
	 * Longest an answer is cached, whatever the signatures allow: when the owner changes the
	 * file's level in GoDAM its files move, and the site must pick that up within a minute.
	 */
	const CACHE_MAX = 60;

	/**
	 * How long a failed call (GoDAM unreachable, or rate limiting this site) is remembered,
	 * so a busy page doesn't keep calling while GoDAM can't answer. The player keeps the
	 * saved sources meanwhile.
	 */
	const RETRY_AFTER = 15;

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/playback/(?P<job_id>[A-Za-z0-9_-]{4,64})',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_playback' ),
						// Site visitors play the media: public, but limited to files this site uses.
						'permission_callback' => '__return_true',
						'args'                => array(
							'job_id' => array(
								'type'              => 'string',
								'required'          => true,
								'sanitize_callback' => 'sanitize_text_field',
							),
						),
					),
				),
			),
		);
	}

	/**
	 * Signed sources for one GoDAM job, in the order the player tries them (HLS, DASH, MP4).
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_playback( $request ) {
		$job_id = $request->get_param( 'job_id' );

		if ( ! $this->site_uses_job( $job_id ) ) {
			// Not a file this site shows: never sign arbitrary org files for visitors.
			return new \WP_Error( 'godam_playback_not_found', __( 'Media not found.', 'godam' ), array( 'status' => 404 ) );
		}

		$cache_key = 'rtgodam_playback_' . md5( $job_id );
		$cached    = get_transient( $cache_key );
		if ( is_array( $cached ) && ! empty( $cached['refused'] ) ) {
			return $this->refusal( $cached['refused'] );
		}
		if ( is_array( $cached ) && ! empty( $cached['expires_at'] ) && $cached['expires_at'] - time() > self::EXPIRY_MARGIN ) {
			return $this->response( $cached );
		}

		$api_key = Api_Key::get_key();
		if ( empty( $api_key ) ) {
			return new \WP_Error( 'godam_playback_no_key', __( 'GoDAM is not connected.', 'godam' ), array( 'status' => 503 ) );
		}

		$url  = add_query_arg(
			array(
				'file_id'  => $job_id,
				'site_url' => home_url(),
			),
			RTGODAM_API_BASE . '/api/method/godam_core.api.playback.get_playback'
		);
		$args = array(
			'headers' => array( 'X-API-KEY' => $api_key ),
			'timeout' => 3,
		);

		$response = function_exists( 'vip_safe_wp_remote_get' ) ? vip_safe_wp_remote_get( $url, '', 3, 3, 3, $args ) : wp_safe_remote_get( $url, $args );
		if ( is_wp_error( $response ) || '' === $response ) {
			// '' is vip_safe_wp_remote_get's fallback while its circuit breaker is open.
			set_transient( $cache_key, array( 'refused' => 'unreachable' ), self::RETRY_AFTER );
			return new \WP_Error( 'godam_playback_unreachable', __( 'GoDAM could not be reached.', 'godam' ), array( 'status' => 502 ) );
		}
		if ( 429 === wp_remote_retrieve_response_code( $response ) ) {
			set_transient( $cache_key, array( 'refused' => 'rate_limited' ), self::RETRY_AFTER );
			return $this->refusal( 'rate_limited' );
		}

		$body    = json_decode( wp_remote_retrieve_body( $response ), true );
		$message = is_array( $body ) && isset( $body['message'] ) && is_array( $body['message'] ) ? $body['message'] : array();
		if ( 200 !== wp_remote_retrieve_response_code( $response ) || empty( $message['sources'] ) ) {
			$error = isset( $message['error_type'] ) ? sanitize_key( $message['error_type'] ) : 'unavailable';
			// A real refusal is kept as briefly as an answer: a busy page with a file GoDAM
			// refuses must not call GoDAM on every view (the site shares one rate limit there).
			// A server error without a reason isn't kept, so a blip doesn't last a minute.
			if ( isset( $message['error_type'] ) ) {
				set_transient( $cache_key, array( 'refused' => $error ), self::CACHE_MAX );
			}
			return $this->refusal( $error );
		}

		$data = array(
			'sources'    => $this->player_sources( $message['sources'] ),
			'poster'     => isset( $message['sources']['thumbnail_url'] ) ? esc_url_raw( $message['sources']['thumbnail_url'] ) : '',
			'captions'   => $this->caption_tracks( isset( $message['caption_tracks'] ) ? $message['caption_tracks'] : array() ),
			'image'      => $this->image_source( $message['sources'] ),
			'expires_at' => isset( $message['expires_at'] ) ? absint( $message['expires_at'] ) : time() + 300,
		);

		set_transient( $cache_key, $data, max( 10, min( self::CACHE_MAX, $data['expires_at'] - time() - self::EXPIRY_MARGIN ) ) );

		return $this->response( $data );
	}

	/**
	 * GoDAM's source fields as video.js sources.
	 *
	 * @param array $sources Signed URLs keyed by GoDAM field.
	 * @return array
	 */
	private function player_sources( $sources ) {
		$map = array(
			'transcoded_hls_path'  => 'application/x-mpegURL',
			'transcoded_file_path' => 'application/dash+xml',
			'transcoded_mp4_url'   => 'video/mp4',
		);
		$out = array();
		foreach ( $map as $field => $type ) {
			if ( empty( $sources[ $field ] ) ) {
				continue;
			}
			$src = esc_url_raw( $sources[ $field ] );
			// A Transcoder Job's main path is an MP4 when it has no DASH rendition.
			if ( 'transcoded_file_path' === $field && preg_match( '/\.mp4(\?|$)/i', $src ) ) {
				$type = 'video/mp4';
			}
			$out[] = array(
				'src'  => $src,
				'type' => $type,
			);
		}
		return $out;
	}

	/**
	 * The signed full image, when the file is an image (its main path is an image file).
	 *
	 * @param array $sources Signed URLs keyed by GoDAM field.
	 * @return string
	 */
	private function image_source( $sources ) {
		$path = isset( $sources['transcoded_file_path'] ) ? (string) $sources['transcoded_file_path'] : '';
		return preg_match( '/\.(jpe?g|png|webp|avif|gif)(\?|$)/i', $path ) ? esc_url_raw( $path ) : '';
	}

	/**
	 * GoDAM's caption tracks for the file, signed, in the shape the player's transcript
	 * manager reads from GoDAM's public endpoint. That endpoint refuses an Organization or
	 * Embed only file, and their stored transcript URL is in the signed folder.
	 *
	 * @param array $tracks GoDAM's signed caption tracks.
	 * @return array
	 */
	private function caption_tracks( $tracks ) {
		$out = array();
		foreach ( is_array( $tracks ) ? $tracks : array() as $track ) {
			if ( ! is_array( $track ) || empty( $track['vtt_path'] ) ) {
				continue;
			}
			$out[] = array(
				'vtt_path'   => esc_url_raw( $track['vtt_path'] ),
				'language'   => isset( $track['language'] ) ? sanitize_text_field( $track['language'] ) : '',
				'label'      => isset( $track['label'] ) ? sanitize_text_field( $track['label'] ) : '',
				'kind'       => isset( $track['kind'] ) ? sanitize_key( $track['kind'] ) : 'subtitles',
				'is_default' => ! empty( $track['is_default'] ),
				'revision'   => isset( $track['revision'] ) ? sanitize_text_field( $track['revision'] ) : '',
			);
		}
		return $out;
	}

	/**
	 * Whether a WordPress attachment on this site points at the job.
	 *
	 * @param string $job_id GoDAM job id.
	 * @return bool
	 */
	private function site_uses_job( $job_id ) {
		$cache_key = 'rtgodam_playback_uses_' . md5( $job_id );
		$found     = wp_cache_get( $cache_key, 'godam' );
		if ( false !== $found ) {
			return 'yes' === $found;
		}

		$query = new \WP_Query(
			array(
				'post_type'      => 'attachment',
				'post_status'    => 'any',
				'posts_per_page' => 1,
				'fields'         => 'ids',
				'no_found_rows'  => true,
				'meta_query'     => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- meta_value isn't indexed; the answer is cached below.
					'relation' => 'OR',
					array(
						'key'   => '_godam_original_id',
						'value' => $job_id,
					),
					array(
						'key'   => 'rtgodam_transcoding_job_id',
						'value' => $job_id,
					),
				),
			)
		);
		$uses  = ! empty( $query->posts );
		wp_cache_set( $cache_key, $uses ? 'yes' : 'no', 'godam', 5 * MINUTE_IN_SECONDS );
		return $uses;
	}

	/**
	 * GoDAM refused to sign the file for this site.
	 *
	 * @param string $error GoDAM's error type, sanitized.
	 * @return \WP_Error
	 */
	private function refusal( $error ) {
		return new \WP_Error( 'godam_playback_' . sanitize_key( $error ), __( 'This media can\'t be played here.', 'godam' ), array( 'status' => 403 ) );
	}

	/**
	 * A response that browsers and proxies may keep only briefly: the URLs expire.
	 *
	 * @param array $data Response data.
	 * @return \WP_REST_Response
	 */
	private function response( $data ) {
		$response = new \WP_REST_Response( $data, 200 );
		$response->header( 'Cache-Control', 'private, max-age=60' );
		return $response;
	}
}
