<?php
/**
 * REST API class for Transcoding Pages.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

use RTGODAM\Inc\Media_Library_Ajax;

defined( 'ABSPATH' ) || exit;

/**
 * Class Transcoding
 */
class Transcoding extends Base {

	/**
	 * REST route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'transcoding';

	/**
	 * Default media type used when none is provided.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const DEFAULT_MEDIA_TYPE = 'video';

	/**
	 * Media types that can be fetched for transcoding, mapped to the MIME types they cover.
	 *
	 * The keys are the accepted values of the `media_type` parameter on the
	 * `not-transcoded` route. `all` covers only the types the retranscode trigger
	 * actually supports, not every MIME type in the media library: handing an
	 * unsupported type to the transcoder is a no-op that surfaces as an unknown error.
	 *
	 * A method rather than a constant because the document MIME types have to come from
	 * rtgodam_get_supported_document_types(), and a constant expression cannot call it.
	 * Restating the list here would be exactly the duplication that helper exists to prevent.
	 *
	 * `document` spans PDF and the Office / OpenDocument / text formats alike: which of the two
	 * Central job types a file ends up on ('pdf' or 'document') is decided per extension by
	 * RTGODAM_Transcoder_Handler, and is not a distinction anyone picking media here cares about.
	 *
	 * `application/ogg` rides alongside the bare `audio` top-level type: the transcoder lists it
	 * among its supported types (RTGODAM_Transcoder_Handler::$allowed_mimetypes), but WordPress
	 * stores such files with an `application/` prefix that the `audio` match never covers. Normal
	 * .ogg uploads are stored as `audio/ogg` and matched already; this only reaches the ones a
	 * migration or custom MIME filter typed as `application/ogg`.
	 *
	 * @since n.e.x.t
	 *
	 * @return array<string, string[]> Media type => MIME types (or bare top-level types).
	 */
	private static function get_media_type_mime_map() {
		$document_mime_types = self::get_document_mime_types();

		return array(
			'all'      => array_merge( array( 'video', 'audio', 'application/ogg', 'image' ), $document_mime_types ),
			'video'    => array( 'video' ),
			'audio'    => array( 'audio', 'application/ogg' ),
			'document' => $document_mime_types,
			'image'    => array( 'image' ),
		);
	}

	/**
	 * MIME types the Document pipeline covers.
	 *
	 * @since n.e.x.t
	 *
	 * @return string[] Document MIME types.
	 */
	private static function get_document_mime_types() {
		return array_keys( rtgodam_get_supported_document_types() );
	}

	/**
	 * Register custom REST API.
	 *
	 * @return array Array of registered REST API routes
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/transcoding-status',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'update_transcoding_status' ),
					'permission_callback' => array( $this, 'verify_status_permission' ),
					'args'                => array(
						'job_id'     => array(
							'required'          => true,
							'type'              => 'string',
							'description'       => __( 'The jobID of transcoding job.', 'godam' ),
							'sanitize_callback' => 'sanitize_text_field',
						),
						'status'     => array(
							'required'          => true,
							'type'              => 'string',
							'description'       => __( 'The status of the transcoding job.', 'godam' ),
							'sanitize_callback' => 'sanitize_text_field',
						),
						'progress'   => array(
							'required'          => false,
							'type'              => 'integer',
							'description'       => __( 'The progress of the transcoding job.', 'godam' ),
							'sanitize_callback' => 'absint',
						),
						'error_msg'  => array(
							'required'          => false,
							'type'              => 'string',
							'description'       => __( 'The error message of the transcoding job.', 'godam' ),
							'sanitize_callback' => 'sanitize_text_field',
						),
						'error_code' => array(
							'required'          => false,
							'type'              => 'string',
							'description'       => __( 'The error code of the transcoding job.', 'godam' ),
							'sanitize_callback' => 'sanitize_text_field',
						),
						'api_key'    => array(
							'required'          => true,
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_text_field',
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/transcoding-status/',
				'args'      => array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_transcoding_status' ),
					'permission_callback' => '__return_true',
					'args'                => array(
						'ids' => array(
							'required'          => true,
							'type'              => 'array',
							'description'       => __( 'The array of attachment IDs.', 'godam' ),
							'validate_callback' => function ( $param ) {
								return is_array( $param );
							},
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/not-transcoded/',
				'args'      => array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_media_require_retranscoding' ),
					'permission_callback' => function () {
						return current_user_can( 'edit_others_posts' );
					},
					'args'                => array(
						'media_type' => array(
							'required'          => false,
							'type'              => 'string',
							'default'           => self::DEFAULT_MEDIA_TYPE,
							'enum'              => array_keys( self::get_media_type_mime_map() ),
							'description'       => __( 'The type of media to fetch for transcoding.', 'godam' ),
							'sanitize_callback' => 'sanitize_text_field',
							// WordPress only enforces `enum` when a validate_callback is present;
							// without this the schema is decorative and an unrecognised value
							// silently falls back to video rather than telling the caller.
							'validate_callback' => 'rest_validate_request_arg',
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/retranscode/',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'retranscode_media' ),
					'permission_callback' => function () {
						return current_user_can( 'edit_others_posts' );
					},
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/check-transcoded-status/',
				'args'      => array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'check_transcoded_status' ),
					'permission_callback' => function () {
						return current_user_can( 'edit_others_posts' );
					},
					'args'                => array(
						'ids' => array(
							'required'          => true,
							'type'              => 'string',
							'description'       => __( 'The comma-separated string of attachment IDs to check.', 'godam' ),
							'sanitize_callback' => 'sanitize_text_field',
						),
					),
				),
			),
		);
	}

	/**
	 * Update transcoding status of a media.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 */
	public function update_transcoding_status( \WP_REST_Request $request ) {

		$job_id     = $request->get_param( 'job_id' );
		$status     = $request->get_param( 'status' );
		$progress   = $request->get_param( 'progress' );
		$error_msg  = $request->get_param( 'error_msg' );
		$error_code = $request->get_param( 'error_code' );

		$attachment_id = $this->get_post_id_by_meta_key_and_value( 'rtgodam_transcoding_job_id', $job_id );

		if ( ! $attachment_id ) {
			wp_send_json_error(
				array(
					'message' => __( 'Attachment not found.', 'godam' ),
				)
			);
		}

		if ( ! empty( $error_msg ) || ! empty( $error_code ) ) {

			update_post_meta( $attachment_id, 'rtgodam_transcoding_error_msg', $error_msg );
			update_post_meta( $attachment_id, 'rtgodam_transcoding_error_code', $error_code );

			$progress = 0;
		}

		update_post_meta( $attachment_id, 'rtgodam_transcoding_status', $status );
		update_post_meta( $attachment_id, 'rtgodam_transcoding_progress', $progress );

		wp_send_json_success(
			array(
				'message' => __( 'Transcoding status updated successfully.', 'godam' ),
			)
		);
	}

	/**
	 * Return transcoding status of a media.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_transcoding_status( \WP_REST_Request $request ) {

		$attachment_ids = $request->get_param( 'ids' );

		$response_object = array();

		foreach ( $attachment_ids as $attachment_id ) {
			$status_object                     = $this->get_status_object_from_attachment( $attachment_id );
			$response_object[ $attachment_id ] = $status_object;
		}

		return rest_ensure_response( $response_object );
	}

	/**
	 * Get transcoding status of an attachment.
	 *
	 * @param int $attachment_id Attachment ID.
	 *
	 * @return string
	 */
	private function get_status_object_from_attachment( int $attachment_id ) {
		// Check if video has a transcoding job ID.
		$job_id = sanitize_text_field( get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true ) );

		// Get and sanitize the transcoding status.
		$status = sanitize_text_field( get_post_meta( $attachment_id, 'rtgodam_transcoding_status', true ) );

		// Handle failure even if job id is missing.
		if ( ! empty( $status ) && 'failed' === strtolower( $status ) ) {
			$error_code = sanitize_text_field( get_post_meta( $attachment_id, 'rtgodam_transcoding_error_code', true ) );
			$error_msg  = sanitize_textarea_field( get_post_meta( $attachment_id, 'rtgodam_transcoding_error_msg', true ) );

			return array(
				'status'     => 'failed',
				'progress'   => 0,
				'error_code' => $error_code,
				'error_msg'  => $error_msg,
			);
		}

		if ( empty( $job_id ) ) {
			return array(
				'status'  => 'not_transcoding',
				'message' => __( 'Media has not been transcoded.', 'godam' ),
			);
		}

		if ( empty( $status ) ) {
			return array(
				'status'  => 'not_started',
				'message' => __( 'Transcoding has not started.', 'godam' ),
			);
		}

		// Get and sanitize transcoding progress.
		$progress = intval( get_post_meta( $attachment_id, 'rtgodam_transcoding_progress', true ) );

		// Define status messages.
		$status_messages = array(
			'Queued'      => __( 'Media is queued for transcoding.', 'godam' ),
			'Downloading' => __( 'Media is downloading for transcoding.', 'godam' ),
			'Downloaded'  => __( 'Media is downloaded for transcoding.', 'godam' ),
			'Transcoding' => __( 'Media is transcoding.', 'godam' ),
			'Transcoded'  => __( 'Media is transcoded.', 'godam' ),
		);

		// Set default message for unknown status.
		$message = isset( $status_messages[ $status ] ) ? $status_messages[ $status ] : __( 'Unknown transcoding status.', 'godam' );

		// Check if media has thumbnail generated after transcoding.
		$thumbnail_id = get_post_meta( $attachment_id, 'rtgodam_media_video_thumbnail', true );

		// Handle retry logic for missing thumbnails when transcoding is complete.
		if ( 'transcoded' === strtolower( $status ) && empty( $thumbnail_id ) ) {
			$retry_count = intval( get_post_meta( $attachment_id, 'rtgodam_thumbnail_retry_count', true ) );
			$max_retries = 3;

			if ( $retry_count < $max_retries ) {
				// Increment retry count.
				update_post_meta( $attachment_id, 'rtgodam_thumbnail_retry_count', $retry_count + 1 );

				// Return transcoding status with 95% progress to indicate waiting for thumbnail.
				return array(
					'status'    => 'transcoding',
					'progress'  => 95,
					'message'   => __( 'Transcoding complete, generating thumbnail...', 'godam' ),
					'thumbnail' => '',
				);
			}
			// If max retries reached, continue with normal flow (return transcoded status without thumbnail).
		}

		return array(
			'status'    => strtolower( $status ),
			'progress'  => $progress,
			'message'   => $message,
			'thumbnail' => ! empty( $thumbnail_id ) ? $thumbnail_id : '',
		);
	}

	/**
	 * Get post id from meta key and value.
	 *
	 * Taken the function from the rt-transcoder-handler.php file.
	 *
	 * @param string $key   Meta key.
	 * @param mixed  $value Meta value.
	 *
	 * @return int|bool     Return post id if found else false.
	 */
	private function get_post_id_by_meta_key_and_value( $key, $value ) {
		global $wpdb;
		$cache_key = md5( 'meta_key_' . $key . '_meta_value_' . $value );

		$meta = wp_cache_get( $cache_key, 'godam' );

		if ( empty( $meta ) ) {
			$meta = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$wpdb->postmeta} WHERE meta_key = %s AND meta_value = %s", $key, $value ) );  // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			wp_cache_set( $cache_key, $meta, 'godam', 3600 );
		}

		if ( is_array( $meta ) && ! empty( $meta ) && isset( $meta[0] ) ) {
			$meta = $meta[0];
		}

		if ( is_object( $meta ) ) {
			return $meta->post_id;
		} else {
			return false;
		}
	}

	/**
	 * Permission callback for the transcoding status endpoint.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 *
	 * @return bool|WP_Error
	 */
	public function verify_status_permission( $request ) {
		$provided_api_key = $request->get_param( 'api_key' );
		$stored_api_key   = get_option( 'rtgodam-api-key' );

		if ( empty( $provided_api_key ) ) {
			return new \WP_Error( 'forbidden', __( 'API key is required.', 'godam' ), array( 'status' => 403 ) );
		}
		if ( empty( $stored_api_key ) ) {
			return new \WP_Error( 'forbidden', __( 'API key not configured.', 'godam' ), array( 'status' => 403 ) );
		}
		if ( ! hash_equals( $stored_api_key, $provided_api_key ) ) {
			return new \WP_Error( 'forbidden', __( 'Invalid API key.', 'godam' ), array( 'status' => 403 ) );
		}
		return true;
	}

	/**
	 * Permission callback for the transcoding status endpoint.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 *
	 * @since 1.4.0
	 *
	 * @return WP_REST_Response
	 */
	public function get_media_require_retranscoding( $request ) {
		$media_type    = $request->get_param( 'media_type' );
		$mime_type_map = self::get_media_type_mime_map();

		// The route validates against the map, but stay safe for direct calls.
		if ( ! isset( $mime_type_map[ $media_type ] ) ) {
			$media_type = self::DEFAULT_MEDIA_TYPE;
		}

		$mime_types = $mime_type_map[ $media_type ];
		$force      = (bool) $request->get_param( 'force' );

		/*
		 * Documents are handled apart from audio/video/image because a MIME type is not enough
		 * to identify one, and post_mime_type is all WP_Query can filter on. WordPress maps
		 * .srt/.asc/.c/.cc/.h to text/plain exactly as it maps .txt, .xlt/.xlw/.xla to
		 * application/vnd.ms-excel as it maps .xls, and .pot/.pps to
		 * application/vnd.ms-powerpoint as it maps .ppt — none of which Central can convert.
		 *
		 * Left in, they would be dispatched, rejected by the extension gate in
		 * wp_media_transcoding(), and reported to the user as "Unknown error" — and they would
		 * inflate the media count shown beside the fetched list, which on a site with a few
		 * hundred caption files is most of it.
		 */
		$document_mime_types = self::get_document_mime_types();
		$document_mimes      = array_values( array_intersect( $mime_types, $document_mime_types ) );
		$plain_mimes         = array_values( array_diff( $mime_types, $document_mime_types ) );

		$documents = empty( $document_mimes )
			? array(
				'eligible'     => array(),
				'untranscoded' => array(),
			)
			: $this->get_document_attachments( $document_mimes );

		/*
		 * Total. The document half is counted from the scan above rather than from
		 * wp_count_attachments(), which counts by MIME and cannot express the extension rule.
		 */
		$total_media_count = count( $documents['eligible'] );

		if ( ! empty( $plain_mimes ) ) {
			$attachment_counts = (array) wp_count_attachments( $plain_mimes );

			/*
			 * wp_count_attachments() reports trashed attachments under a separate `trash` key
			 * while its per-MIME rows exclude them. Every query here uses post_status 'any',
			 * which excludes trash too, so adding them back double-counts and leaves
			 * total_media_count overshooting by the number of trashed attachments.
			 */
			unset( $attachment_counts['trash'] );

			$total_media_count += array_sum( $attachment_counts );
		}

		// Check if storage limits are exceeded (only storage blocks transcoding).
		$user_data = rtgodam_get_user_data();
		if ( ! empty( $user_data ) && isset( $user_data['storage_used'], $user_data['total_storage'] ) ) {
			$storage_exceeded = $user_data['storage_used'] > $user_data['total_storage'];

			if ( $storage_exceeded ) {
				return new \WP_REST_Response(
					array(
						'data'              => array(),
						'total_media_count' => $total_media_count,
						'media_type'        => $media_type,
						'storage_exceeded'  => true,
						'message'           => sprintf(
							// translators: %s is the storage usage percentage.
							__( 'Storage limit exceeded (%s%%). Retranscoding is currently blocked. Please upgrade your plan to continue.', 'godam' ),
							number_format( ( $user_data['storage_used'] / max( 1, $user_data['total_storage'] ) ) * 100, 1 )
						),
					),
					200
				);
			}
		}

		// Force fetches every eligible document; otherwise only the ones Central has not seen.
		$all_posts = $force ? $documents['eligible'] : $documents['untranscoded'];

		// Guarded: an empty post_mime_type is not a narrower filter, it is no filter at all,
		// so an unguarded query would return the whole media library for media_type=document.
		if ( ! empty( $plain_mimes ) ) {
			$paged    = 1;
			$per_page = 200;

			do {
				$args = array(
					'post_type'      => 'attachment',
					'post_mime_type' => $plain_mimes,
					'post_status'    => 'any',
					'posts_per_page' => $per_page,
					'paged'          => $paged,
					'fields'         => 'ids',
					'meta_query'     => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- This is a necessary query to find posts that need retranscoding.
						array(
							'key'     => 'rtgodam_transcoded_url',
							'compare' => 'NOT EXISTS',
						),
					),
				);

				// If force is set, fetch all media of the selected type regardless of transcoded_url.
				if ( $force ) {
					// remove the meta query condition.
					$args['meta_query'] = null; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- False positive check for meta query.
				}

				$query = new \WP_Query( $args );

				if ( $query->have_posts() ) {
					$all_posts = array_merge( $all_posts, $query->posts );
					++$paged;
				} else {
					break;
				}
			} while ( true );
		}

		return new \WP_REST_Response(
			array(
				'data'              => $all_posts,
				'total_media_count' => $total_media_count,
				'media_type'        => $media_type,
			),
			200
		);
	}

	/**
	 * Document attachments the transcoder can actually convert, split by transcoding state.
	 *
	 * One paged scan answers two questions at once — which documents to send (the ones Central
	 * has not seen yet) and how many convertible ones there are in total — because neither can be
	 * answered by SQL alone. rtgodam_is_supported_document_attachment() has to read each
	 * attachment's extension as well as its MIME type, and neither wp_count_attachments() nor
	 * a meta query can express that.
	 *
	 * @since n.e.x.t
	 *
	 * @param string[] $mime_types Document MIME types to scan. Must not be empty.
	 *
	 * @return array{eligible: int[], untranscoded: int[]} Every convertible document, and the
	 *                                                     subset with no transcoded URL yet.
	 */
	private function get_document_attachments( array $mime_types ) {
		$eligible     = array();
		$untranscoded = array();
		$paged        = 1;
		$per_page     = 200;

		do {
			$query = new \WP_Query(
				array(
					'post_type'      => 'attachment',
					'post_mime_type' => $mime_types,
					'post_status'    => 'any',
					'posts_per_page' => $per_page,
					'paged'          => $paged,
					'fields'         => 'ids',
				)
			);

			if ( ! $query->have_posts() ) {
				break;
			}

			/*
			 * Two queries per page instead of two per attachment: the eligibility test reads
			 * both the post row (for the MIME type) and _wp_attached_file, and a 'fields' => 'ids'
			 * query primes neither.
			 */
			_prime_post_caches( $query->posts, false, true );

			foreach ( $query->posts as $attachment_id ) {
				if ( ! rtgodam_is_supported_document_attachment( $attachment_id ) ) {
					continue;
				}

				$eligible[] = $attachment_id;

				// metadata_exists() rather than an empty() check on the value, to match the
				// NOT EXISTS meta query the audio/video/image half of the fetch uses.
				if ( ! metadata_exists( 'post', $attachment_id, 'rtgodam_transcoded_url' ) ) {
					$untranscoded[] = $attachment_id;
				}
			}

			++$paged;
		} while ( true );

		return array(
			'eligible'     => $eligible,
			'untranscoded' => $untranscoded,
		);
	}

	/**
	 * Check if specific media IDs are transcoded.
	 *
	 * @param \WP_REST_Request $request REST request object.
	 *
	 * @return \WP_REST_Response
	 */
	public function check_transcoded_status( $request ) {
		$ids_param = $request->get_param( 'ids' );

		// If it's a string (comma-separated), split it into array.
		if ( is_string( $ids_param ) ) {
			$attachment_ids = array_map( 'intval', explode( ',', $ids_param ) );
		} else {
			$attachment_ids = array_map( 'intval', (array) $ids_param );
		}

		$transcode_count   = 0;
		$retranscode_count = 0;

		foreach ( $attachment_ids as $attachment_id ) {
			$transcoded_url = get_post_meta( $attachment_id, 'rtgodam_transcoded_url', true );
			// If transcoded, it should have URL.
			if ( ! empty( $transcoded_url ) ) {
				++$retranscode_count;
			} else {
				++$transcode_count;
			}
		}

		return new \WP_REST_Response(
			array(
				'transcode_count'   => $transcode_count,
				'retranscode_count' => $retranscode_count,
			),
			200
		);
	}

	/**
	 * Retranscode media.
	 *
	 * This function handles the retranscoding of media files, but skips virtual media
	 * and migrated Vimeo videos, showing appropriate messages instead.
	 *
	 * @since 1.4.0
	 *
	 * @param \WP_REST_Request $request REST request object.
	 */
	public function retranscode_media( \WP_REST_Request $request ) {
		$attachment_id = $request->get_param( 'id' );

		if ( empty( $attachment_id ) ) {
			return new \WP_REST_Response(
				array(
					'message' => __( 'Attachment ID not provided', 'godam' ),
				),
				400
			);
		}

		$title = get_the_title( $attachment_id );

		// Check if local development environment.
		if ( rtgodam_is_local_environment() ) {
			$message = sprintf(
				// translators: 1: Attachment title, 2: Attachment ID.
				__( '%1$s (ID %2$d) transcoding request failed. Transcoding requests are not allowed in the localhost environment.', 'godam' ),
				esc_html( $title ),
				absint( $attachment_id )
			);

			return new \WP_REST_Response(
				array(
					'message' => $message,
					'skipped' => true,
					'reason'  => 'local_environment',
				),
				200
			);
		}

		// Check if this is virtual media (fetched from Central).
		$godam_original_id = get_post_meta( $attachment_id, '_godam_original_id', true );
		if ( ! empty( $godam_original_id ) ) {
			$message = sprintf(
				// translators: 1: Attachment title, 2: Attachment ID.
				__( '%1$s (ID %2$d) is virtual media from GoDAM Central. Please retranscode this media on GoDAM Central.', 'godam' ),
				esc_html( $title ),
				absint( $attachment_id )
			);

			return new \WP_REST_Response(
				array(
					'message' => $message,
					'skipped' => true,
					'reason'  => 'virtual_media',
				),
				200
			);
		}

		// Check if this is migrated Vimeo video.
		$is_migrated_vimeo = get_post_meta( $attachment_id, 'rtgodam_is_migrated_vimeo_video', true );
		if ( ! empty( $is_migrated_vimeo ) ) {
			$message = sprintf(
				// translators: 1: Attachment title, 2: Attachment ID.
				__( '%1$s (ID %2$d) is migrated Vimeo video. Please retranscode this video on GoDAM Central.', 'godam' ),
				esc_html( $title ),
				absint( $attachment_id )
			);

			return new \WP_REST_Response(
				array(
					'message' => $message,
					'skipped' => true,
					'reason'  => 'migrated_vimeo',
				),
				200
			);
		}

		// Check if storage limits are exceeded (only storage blocks transcoding).
		$user_data = rtgodam_get_user_data();
		if ( ! empty( $user_data ) && isset( $user_data['storage_used'], $user_data['total_storage'] ) ) {
			$storage_exceeded = $user_data['storage_used'] > $user_data['total_storage'];

			if ( $storage_exceeded ) {
				$message = sprintf(
					// translators: 1: Attachment title, 2: Attachment ID, 3: storage usage percent.
					__( '%1$s (ID %2$d) cannot be retranscoded. Storage limit exceeded (%3$s%%). Please upgrade your plan to continue transcoding.', 'godam' ),
					esc_html( $title ),
					absint( $attachment_id ),
					number_format( ( $user_data['storage_used'] / max( 1, $user_data['total_storage'] ) ) * 100, 1 )
				);

				return new \WP_REST_Response(
					array(
						'message' => $message,
						'skipped' => true,
						'reason'  => 'storage_exceeded',
					),
					200
				);
			}
		}

		// Check if HTTP auth is enabled.
		if ( rtgodam_has_http_auth() ) {
			$message = sprintf(
				// translators: 1: Attachment title, 2: Attachment ID.
				__( '%1$s (ID %2$d) cannot be transcoded. HTTP authentication is enabled on your site. Please disable it to allow transcoding.', 'godam' ),
				esc_html( $title ),
				absint( $attachment_id )
			);

			// Persist failure state so the Media Library UI reflects the error.
			update_post_meta( $attachment_id, 'rtgodam_transcoding_status', 'failed' );
			update_post_meta( $attachment_id, 'rtgodam_transcoding_error_code', 'http_auth_enabled' );
			update_post_meta( $attachment_id, 'rtgodam_transcoding_error_msg', $message );

			return new \WP_REST_Response(
				array(
					'message' => $message,
					'skipped' => true,
					'reason'  => 'http_auth_enabled',
				),
				200
			);
		}

		$mime_type = get_post_mime_type( $attachment_id );

		/*
		 * A document MIME type whose extension disagrees with it — a .srt, .c or .h carrying
		 * text/plain, a .xlt carrying application/vnd.ms-excel. Central has no conversion path
		 * for these, so wp_media_transcoding() drops them without creating a job and this route
		 * would otherwise report the empty job id below as a 500 "Unknown error".
		 *
		 * The Media Library row action already hides itself for these, but the bulk action does
		 * not, so they can still arrive here by way of the media_ids handoff.
		 */
		if (
			array_key_exists( $mime_type, rtgodam_get_supported_document_types() )
			&& ! rtgodam_is_supported_document_attachment( $attachment_id )
		) {
			$message = sprintf(
				// translators: 1: Attachment title, 2: Attachment ID.
				__( '%1$s (ID %2$d) is not a document format GoDAM can convert, so it was skipped.', 'godam' ),
				esc_html( $title ),
				absint( $attachment_id )
			);

			return new \WP_REST_Response(
				array(
					'message' => $message,
					'skipped' => true,
					'reason'  => 'unsupported_document',
				),
				200
			);
		}

		// Proceed with normal retranscoding for original media.
		delete_post_meta( $attachment_id, 'rtgodam_transcoding_status' );
		delete_post_meta( $attachment_id, 'rtgodam_transcoding_error_msg' );
		delete_post_meta( $attachment_id, 'rtgodam_transcoding_error_code' );

		$wp_metadata              = array();
		$wp_metadata['mime_type'] = $mime_type;

		// This is a manual retranscode request from the tools page.
		// Always bypass the godam_auto_transcode_on_upload filter to allow transcoding even if the filter returns false.
		$manual_retranscode = true;

		// Retranscode the media.
		if ( preg_match( '/image/i', $mime_type ) ) {
			$transcoder = Media_Library_Ajax::get_instance();
			$transcoder->upload_media_to_frappe_backend( $attachment_id, $manual_retranscode );
		} else {
			$transcoder = new \RTGODAM_Transcoder_Handler( true );
			$transcoder->wp_media_transcoding( $wp_metadata, $attachment_id, true, $manual_retranscode );
		}

		// Check if the transcoding job ID is set.
		$is_sent = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );

		if ( empty( $is_sent ) ) {

			$message = sprintf(
				// translators: 1: Attachment title, 2: Attachment ID.
				__( '%1$s (ID %2$d) transcoding request failed. Unknown error', 'godam' ),
				esc_html( $title ),
				absint( $attachment_id )
			);

			return new \WP_REST_Response(
				array( 'message' => $message ),
				500
			);
		}

		// Update the post meta to indicate that the retranscoding request was sent.
		update_post_meta( $attachment_id, 'rtgodam_retranscoding_sent', $is_sent );

		$message = sprintf(
			// translators: 1: Attachment title, 2: Attachment ID.
			__( '%1$s (ID %2$d) transcoding request was sent successfully', 'godam' ),
			esc_html( $title ),
			absint( $attachment_id )
		);

		return new \WP_REST_Response(
			array(
				'message' => $message,
				'skipped' => false,
				'sent'    => true,
			),
			200
		);
	}
}
