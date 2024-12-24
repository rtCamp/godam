<?php
/**
 * Class Transcoder_Rest_Routes
 *
 * @package transcoder
 */

/**
 * Handle REST Routes for Transcoder.
 */
class Transcoder_Rest_Routes extends WP_REST_Controller {

	/**
	 * Version of REST route.
	 *
	 * @var int
	 */
	public $version = 1;

	/**
	 * Prefix for API endpoint namespace.
	 *
	 * @var string
	 */
	public $namespace_prefix = 'transcoder/v';

	/**
	 * Function to register routes.
	 */
	public function register_routes() {

		// Register `amp-media` route to get media poster info.
		register_rest_route(
			$this->namespace_prefix . $this->version,
			'/amp-media/(?P<id>\d+)',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_media_data' ),
				'permission_callback' => '__return_true',
			)
		);

		// Register `amp-rtmedia` route to get media poster info related to rtMedia.
		register_rest_route(
			$this->namespace_prefix . $this->version,
			'/amp-rtmedia',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_rtmedia_data' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	/**
	 * Return poster url for requested media if exists.
	 *
	 * @param WP_REST_Request $request Object of WP_REST_Request.
	 *
	 * @return array|bool REST API response.
	 */
	public function get_media_data( WP_REST_Request $request ) {
		$media_id = $request->get_param( 'id' );

		return $this->get_media_data_by_id( $media_id );
	}

	/**
	 * Return poster url for requested media related to rtMedia if exists.
	 *
	 * @param WP_REST_Request $request Object of WP_REST_Request.
	 *
	 * @return array|bool REST API response.
	 */
	public function get_rtmedia_data( WP_REST_Request $request ) {
		if ( ! function_exists( 'rtmedia_media_id' ) || empty( $request['media_ids'] ) ) {
			return false;
		}
		$media_ids = explode( ',', $request['media_ids'] );

		$response = array();
		foreach ( $media_ids as $media_id ) {
			// Convert rtMedia ID to post ID.
			$attachment_id = rtmedia_media_id( $media_id );
			if ( empty( $attachment_id ) ) {
				$response[ $media_id ] = 'invalid';
				continue;
			}

			// Check if media is eligible to be transcoded.
			$rt_transcoding_job_id = get_post_meta( $attachment_id, '_rt_transcoding_job_id', true );
			if ( empty( $rt_transcoding_job_id ) ) {
				$response[ $media_id ] = 'invalid';
				continue;
			}

			$res = $this->get_media_data_by_id( $attachment_id );
			if ( false !== $res ) {
				$response[ $media_id ] = $res;
				continue;
			}

			// Get transcoding status to detect if the site doesn't have HTTP auth or some other restrictions.
			$status = json_decode( rtt_get_transcoding_status( $attachment_id ), true );
			if ( ! empty( $status['message'] ) && false !== strpos( $status['message'], 'Transcoder failed to transcode this file' ) ) {
				$response[ $media_id ] = 'invalid';
			}
		}

		return ( ! empty( $response ) ) ? $response : false;
	}

	/**
	 * Return poster URL of a media from media_id.
	 *
	 * @param int $media_id Media ID.
	 *
	 * @return array|bool Poster URL and transcoded media URL or False.
	 */
	private function get_media_data_by_id( $media_id ) {
		// Check media id.
		if ( empty( $media_id ) ) {
			return false;
		}

		// Check if thumbnail and transcoded file exist for the passed attachment.
		$thumbnail_id   = get_post_thumbnail_id( $media_id );
		$transcoded_url = get_post_meta( $media_id, '_rt_media_transcoded_files', true );

		if ( empty( $thumbnail_id ) || empty( $transcoded_url ) ) {
			return false;
		}

		// Get transcoded video path.
		$transcoded_url = empty( $transcoded_url['mp4'][0] ) ? '' : $transcoded_url['mp4'][0];
		$uploads        = wp_get_upload_dir();

		// Get URL for the transcoded video.
		if ( 0 === strpos( $transcoded_url, $uploads['baseurl'] ) ) {
			$final_file_url = $transcoded_url;
		} else {
			$final_file_url = trailingslashit( $uploads['baseurl'] ) . $transcoded_url;
		}

		if ( true !== (bool) get_post_meta( $thumbnail_id, 'amp_is_poster', true ) || empty( $final_file_url ) ) {
			return false;
		}

		return array(
			'poster'          => get_the_post_thumbnail_url( $media_id ),
			'transcodedMedia' => $final_file_url,
		);
	}
}
