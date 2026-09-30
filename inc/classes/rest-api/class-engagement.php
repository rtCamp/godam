<?php
/**
 * Register REST API endpoints for Engagement.
 *
 * Get all Engagement data for a video.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use WP_REST_Server;
use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

/**
 * Class Engagement
 */
class Engagement extends Base {

	/**
	 * REST route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'engagement';

	/**
	 * How many comments to ask Central for per request when looking for one comment.
	 *
	 * @var int
	 */
	const OWNERSHIP_LOOKUP_PAGE_SIZE = 100;

	/**
	 * Most requests one ownership lookup may make to Central once the cached
	 * comments have not answered it. The player only shows the newest 20
	 * comments, so a comment someone is acting on has moved down by the number
	 * of comments added since their page loaded, not by hundreds. Five pages is
	 * the newest 500, and keeps an unknown comment ID from costing more.
	 *
	 * @var int
	 */
	const OWNERSHIP_LOOKUP_MAX_PAGES = 5;

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/activities',
				'args'      => array(
					array(
						'methods'             => WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_activities' ),
						'permission_callback' => '__return_true',
						'args'                => array_merge(
							$this->get_collection_params(), // Default collection params.
							array(
								'video_id' => array(
									'description'       => __( 'The ID of the video.', 'godam' ),
									'type'              => 'string',
									'required'          => true,
									'sanitize_callback' => 'sanitize_text_field',
									'validate_callback' => array(
										$this,
										'validate_request_args',
									),
								),
							)
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/user-hit-like',
				'args'      => array(
					array(
						'methods'             => WP_REST_Server::CREATABLE,
						'callback'            => array( $this, 'user_hit_like' ),
						'permission_callback' => array( $this, 'engagement_permission_check' ),
						'args'                => array(
							'video_id'    => array(
								'description'       => __( 'The ID of the video.', 'godam' ),
								'type'              => 'string',
								'required'          => true,
								'sanitize_callback' => 'sanitize_text_field',
								'validate_callback' => array(
									$this,
									'validate_request_args',
								),
							),
							'site_url'    => array(
								'required'          => true,
								'type'              => 'string',
								'description'       => __( 'The Site URL associated with the video.', 'godam' ),
								'sanitize_callback' => 'esc_url_raw',
								'validate_callback' => array(
									$this,
									'validate_request_args',
								),
							),
							'like_status' => array(
								'required'          => true,
								'type'              => 'boolean',
								'description'       => __( 'The like status (like or unlike).', 'godam' ),
								'sanitize_callback' => 'rest_sanitize_boolean',
								'validate_callback' => array(
									$this,
									'validate_request_args',
								),
							),
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/user-comment',
				'args'      => array(
					array(
						'methods'             => WP_REST_Server::CREATABLE,
						'callback'            => array( $this, 'user_comment' ),
						'permission_callback' => array( $this, 'engagement_permission_check' ),
						'args'                => array(
							'video_id'          => array(
								'description'       => __( 'The ID of the video.', 'godam' ),
								'type'              => 'string',
								'required'          => true,
								'sanitize_callback' => 'sanitize_text_field',
								'validate_callback' => array(
									$this,
									'validate_request_args',
								),
							),
							'site_url'          => array(
								'required'          => true,
								'type'              => 'string',
								'description'       => __( 'The Site URL associated with the video.', 'godam' ),
								'sanitize_callback' => 'esc_url_raw',
								'validate_callback' => array(
									$this,
									'validate_request_args',
								),
							),
							'comment_parent_id' => array(
								'description'       => __( 'The ID of the parent comment.', 'godam' ),
								'type'              => 'string',
								'required'          => true,
								'sanitize_callback' => 'sanitize_text_field',
								'validate_callback' => array(
									$this,
									'validate_request_args',
								),
							),
							'comment_text'      => array(
								'required'          => true,
								'type'              => 'string',
								'description'       => __( 'The comment text', 'godam' ),
								'sanitize_callback' => 'sanitize_text_field',
								'validate_callback' => array(
									$this,
									'validate_request_args',
								),
							),
							'comment_type'      => array(
								'required'          => true,
								'type'              => 'string',
								'description'       => __( 'The comment type if it is new OR edit', 'godam' ),
								'sanitize_callback' => 'sanitize_text_field',
								'validate_callback' => array(
									$this,
									'validate_request_args',
								),
							),
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/user-delete-comment',
				'args'      => array(
					array(
						'methods'             => WP_REST_Server::CREATABLE,
						'callback'            => array( $this, 'user_delete_comment' ),
						'permission_callback' => array( $this, 'engagement_permission_check' ),
						'args'                => array(
							'video_id'    => array(
								'description'       => __( 'The ID of the video.', 'godam' ),
								'type'              => 'string',
								'required'          => true,
								'sanitize_callback' => 'sanitize_text_field',
								'validate_callback' => array(
									$this,
									'validate_request_args',
								),
							),
							'comment_id'  => array(
								'description'       => __( 'The ID of the parent comment.', 'godam' ),
								'type'              => 'string',
								'required'          => true,
								'sanitize_callback' => 'sanitize_text_field',
								'validate_callback' => array(
									$this,
									'validate_request_args',
								),
							),
							'delete_type' => array(
								'description'       => __( 'The type of deletion (soft or hard).', 'godam' ),
								'type'              => 'string',
								'required'          => true,
								'sanitize_callback' => 'sanitize_text_field',
								'validate_callback' => array(
									$this,
									'validate_request_args',
								),
							),
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/guest-user-login',
				'args'      => array(
					array(
						'methods'             => WP_REST_Server::CREATABLE,
						'callback'            => array( $this, 'guest_user_login' ),
						'permission_callback' => '__return_true',
						'args'                => array(
							'guest_user_email' => array(
								'required'          => true,
								'type'              => 'string',
								'description'       => __( 'The guest user email', 'godam' ),
								'sanitize_callback' => 'sanitize_email',
								'validate_callback' => array(
									$this,
									'validate_request_args',
								),
							),
						),
					),
				),
			),
		);
	}

	/**
	 * Get all activities for a video.
	 *
	 * @param WP_REST_Request $request Request Object.
	 *
	 * @return WP_REST_Response
	 */
	public function get_activities( $request ) {

		$response_data = array();
		$video_id      = $request->get_param( 'video_id' );
		$site_url      = rtgodam_get_site_origin();
		if ( '' === $site_url ) {
			return $this->site_origin_unavailable_response( 500 );
		}

		$account_credentials = $this->access_credentials_check();

		if ( $account_credentials instanceof WP_REST_Response ) {
			return $account_credentials;
		}

		$query_params = wp_parse_args(
			array(
				'video_id' => $video_id,
				'site_url' => $site_url,
			),
			$account_credentials,
		);

		$analytics_data = $this->get_views( $query_params );

		if ( ! empty( $analytics_data['processed_analytics'] ) ) {
			$response_data['views_count'] = array_sum( $analytics_data['processed_analytics']['post_views'] ?? array() );
		}

		$transcoder_job_id = $this->get_transcoder_job_id( $video_id );

		$likes                        = $this->get_likes( $transcoder_job_id, $account_credentials );
		$response_data['is_liked']    = $likes['has_liked_by_user'];
		$response_data['likes_count'] = $likes['likes'];

		$comments                        = $this->get_comments( $transcoder_job_id, $account_credentials );
		$response_data['comments']       = $comments['comments'];
		$response_data['comments_count'] = $comments['total'];

		return new WP_REST_Response(
			array(
				'status' => 'success',
				'data'   => $response_data,
			),
			200
		);
	}

	/**
	 * Handle microservice responses and convert them into a standard format.
	 *
	 * @param \WP_Error|\WP_HTTP_Response $response Microservice response.
	 *
	 * @return WP_REST_Response Response in standard format.
	 */
	public function process_response( $response ) {

		if ( is_wp_error( $response ) ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => __( 'Unable to reach server.', 'godam' ),
					'errorType' => 'microservice_error',
				),
				500
			);
		}

		$body      = wp_remote_retrieve_body( $response );
		$data      = json_decode( $body, true );
		$http_code = wp_remote_retrieve_response_code( $response );
		$detail    = $data['detail'] ?? __( 'Unexpected error from server.', 'godam' );

		if ( 404 === $http_code || 400 === $http_code ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => $detail,
					'errorType' => 'invalid_key',
				),
				$http_code
			);
		}

		if ( $http_code >= 500 ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => $detail,
					'errorType' => 'microservice_error',
				),
				$http_code
			);
		}

		return $data;
	}

	/**
	 * Checks if access credentials (API key and account token) are valid.
	 *
	 * @return WP_REST_Response|array Returns an error response if credentials are invalid,
	 *                                otherwise an array with account token and API key.
	 */
	public function access_credentials_check() {

		$account_token = get_option( 'rtgodam-account-token', 'unverified' );
		$api_key       = get_option( 'rtgodam-api-key', '' );

		// Check if API key is missing.
		if ( empty( $api_key ) || empty( $account_token ) || 'unverified' === $account_token ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => __( 'Missing API key.', 'godam' ),
					'errorType' => 'missing_key',
				),
				404
			);
		}

		return array(
			'account_token' => $account_token,
			'api_key'       => $api_key,
		);
	}

	/**
	 * Get analytics data for given query parameters.
	 *
	 * @param array $query_params Query parameters for analytics microservice.
	 * @return array|WP_REST_Response Analytics data or error response.
	 */
	public function get_views( $query_params ) {
		$cache_key   = 'rtgodam-engagements-views-video-id-' . $query_params['video_id'];
		$cached_data = rtgodam_cache_get( $cache_key );

		if ( $cached_data ) {
			return $cached_data;
		}

		// Define API URL for fetching analytics.
		$analytics_endpoint = RTGODAM_ANALYTICS_BASE . '/processed-analytics/fetch/';
		$analytics_url      = add_query_arg( $query_params, $analytics_endpoint );

		// Send request to analytics microservice.
		$analytics_response = wp_remote_get( $analytics_url );

		$analytics_data = $this->process_response( $analytics_response );

		if ( ! $analytics_data instanceof WP_REST_Response ) {
			// Cache the response data for future requests.
			rtgodam_cache_set( $cache_key, $analytics_data );
			return $analytics_data;
		}
		return array();
	}

	/**
	 * Handle like/dislike request from user.
	 *
	 * Handles the REST request to like or dislike a video.
	 *
	 * @param WP_REST_Request $request Request object.
	 *
	 * @return WP_REST_Response Response object.
	 */
	public function user_hit_like( $request ) {

		$response_data = array();
		$video_id      = $request->get_param( 'video_id' );
		$site_url      = $request->get_param( 'site_url' );
		$like_status   = $request->get_param( 'like_status' );

		$account_credentials = $this->access_credentials_check();

		if ( $account_credentials instanceof WP_REST_Response ) {
			return $account_credentials;
		}

		$current_user       = rtgodam_get_current_logged_in_user_data();
		$current_user_email = $current_user['email'];
		$current_user_name  = $current_user['name'];
		$transcoder_job_id  = $this->get_transcoder_job_id( $video_id );

		$query_params = array(
			'api_key'        => $account_credentials['api_key'],
			'is_like'        => $like_status,
			'reference_name' => $transcoder_job_id,
			'comment_email'  => $current_user_email,
			'comment_by'     => $current_user_name,
		);

		$likes_endpoint = RTGODAM_API_BASE . '/api/method/godam_core.api.comment.wp_like';

		$likes_response = wp_remote_post(
			$likes_endpoint,
			array(
				'method'  => 'POST',
				'headers' => array(
					'Content-Type' => 'application/json',
				),
				'body'    => wp_json_encode( $query_params ),
			)
		);

		$process_response = $this->process_response( $likes_response );

		if ( $process_response instanceof WP_REST_Response ) {
			return $process_response;
		}

		if ( isset( $process_response['message']['status'] ) && 'success' === $process_response['message']['status'] ) {

			$cache_key = 'rtgodam-engagements-likes-transcoder-job-id-' . $transcoder_job_id . '-user-email-' . $current_user_email;
			rtgodam_cache_delete( $cache_key );

			return new WP_REST_Response(
				array(
					'status'      => 'success',
					'isUserLiked' => $like_status,
					'value'       => $like_status ? +1 : -1,
				),
				200
			);
		}

		return new WP_REST_Response(
			array(
				'status'    => 'error',
				'message'   => __( 'Failed to update likes.', 'godam' ),
				'errorType' => 'failed_to_update_likes',
			),
			500
		);
	}

	/**
	 * Creates a new comment for a video or edits an existing comment.
	 *
	 * Request Parameters:
	 * video_id          - The ID of the video.
	 * comment_parent_id - The ID of the parent comment.
	 * comment_text      - The comment text.
	 * comment_type      - The type of comment (new or edit).
	 *
	 * Response:
	 * status - The status of the request (success or error).
	 * data   - An array containing the comment data.
	 *
	 * @param WP_REST_Request $request The request object.
	 *
	 * @return WP_REST_Response The response object.
	 */
	public function user_comment( $request ) {

		$video_id          = $request->get_param( 'video_id' );
		$comment_parent_id = $request->get_param( 'comment_parent_id' );
		$comment_text      = $request->get_param( 'comment_text' );
		$comment_type      = $request->get_param( 'comment_type' );

		$account_credentials = $this->access_credentials_check();

		if ( $account_credentials instanceof WP_REST_Response ) {
			return $account_credentials;
		}

		$current_user       = rtgodam_get_current_logged_in_user_data();
		$current_user_email = $current_user['email'];
		$current_user_name  = $current_user['name'];
		$transcoder_job_id  = $this->get_transcoder_job_id( $video_id );

		// Only the author may edit a comment, whatever id the browser sends.
		if ( 'edit' === $comment_type ) {
			$ownership = $this->verify_comment_ownership( $transcoder_job_id, $comment_parent_id, $account_credentials );

			if ( $ownership instanceof WP_REST_Response ) {
				return $ownership;
			}
		}

		$query_params = array(
			'api_key'        => $account_credentials['api_key'],
			'reference_name' => $transcoder_job_id,
			'content'        => $comment_text,
			'comment_email'  => $current_user_email,
			'comment_by'     => $current_user_name,
		);

		if ( ! empty( $comment_parent_id ) ) {
			$query_params['custom_reply_to'] = $comment_parent_id;
		}

		$comments_endpoint = RTGODAM_API_BASE . '/api/method/godam_core.api.comment.wp_comment';

		if ( 'edit' === $comment_type ) {
			$comments_endpoint    = RTGODAM_API_BASE . '/api/method/godam_core.api.comment.wp_update_comment';
			$query_params['name'] = $comment_parent_id;
		}

		$comments_response = wp_remote_post(
			$comments_endpoint,
			array(
				'method'  => 'POST',
				'headers' => array(
					'Content-Type' => 'application/json',
				),
				'body'    => wp_json_encode( $query_params ),
			)
		);

		$process_response = $this->process_response( $comments_response );

		if ( $process_response instanceof WP_REST_Response ) {
			return $process_response;
		}

		if ( isset( $process_response['message']['status'] ) && 'success' === $process_response['message']['status'] ) {

			$cache_key = 'rtgodam-engagements-comments-transcoder-job-id-' . $transcoder_job_id;
			rtgodam_cache_delete( $cache_key );

			$comment      = $process_response['message']['data'];
			$created_date = $this->calculate_days( $comment['creation'] );

			$response_data = array(
				'id'              => $comment['name'],
				'parent_id'       => isset( $comment['custom_reply_to'] ) ? $comment['custom_reply_to'] : null,
				'text'            => html_entity_decode( $comment['content'], ENT_QUOTES, 'UTF-8' ),
				'author_name'     => $comment['comment_by'],
				'is_own'          => true,
				'created_at_date' => $created_date['date'],
				'created_at_time' => $created_date['time'],
				'author_image'    => get_avatar_url( $comment['comment_email'] ),
				'children'        => array(),
			);

			return new WP_REST_Response(
				array(
					'status' => 'success',
					'data'   => $response_data,
				),
				200
			);
		}

		return new WP_REST_Response(
			array(
				'status'    => 'error',
				'message'   => __( 'Failed to update comment.', 'godam' ),
				'errorType' => 'failed_to_update_comment',
			),
			500
		);
	}

	/**
	 * Deletes a comment for a video.
	 *
	 * Request Parameters:
	 * video_id    - The ID of the video.
	 * comment_id  - The ID of the comment to be deleted.
	 * delete_type - The type of deletion (hard-delete or soft-delete).
	 *
	 * Response:
	 * status - The status of the request (success or error).
	 * data   - An array containing the comment data.
	 *
	 * @param WP_REST_Request $request The request object.
	 *
	 * @return WP_REST_Response The response object.
	 */
	public function user_delete_comment( $request ) {

		$video_id    = $request->get_param( 'video_id' );
		$comment_id  = $request->get_param( 'comment_id' );
		$delete_type = $request->get_param( 'delete_type' );

		$account_credentials = $this->access_credentials_check();

		if ( $account_credentials instanceof WP_REST_Response ) {
			return $account_credentials;
		}

		$current_user       = rtgodam_get_current_logged_in_user_data();
		$current_user_email = $current_user['email'];
		$transcoder_job_id  = $this->get_transcoder_job_id( $video_id );

		// Only the author may delete a comment, whatever id the browser sends.
		$ownership = $this->verify_comment_ownership( $transcoder_job_id, $comment_id, $account_credentials );

		if ( $ownership instanceof WP_REST_Response ) {
			return $ownership;
		}

		$query_params = array(
			'api_key'        => $account_credentials['api_key'],
			'reference_name' => $transcoder_job_id,
			'comment_email'  => $current_user_email,
			'name'           => $comment_id,
		);

		$content = '--soft-deleted-content--';

		if ( 'hard-delete' === $delete_type ) {
			$comment_delete_endpoint = RTGODAM_API_BASE . '/api/method/godam_core.api.comment.delete_comment';
			$content                 = '--hard-deleted-content--';
		} else {
			$comment_delete_endpoint = RTGODAM_API_BASE . '/api/method/godam_core.api.comment.wp_update_comment';
			$query_params['content'] = $content;
		}

		$comments_response = wp_remote_post(
			$comment_delete_endpoint,
			array(
				'method'  => 'POST',
				'headers' => array(
					'Content-Type' => 'application/json',
				),
				'body'    => wp_json_encode( $query_params ),
			)
		);

		$process_response = $this->process_response( $comments_response );

		if ( $process_response instanceof WP_REST_Response ) {
			return $process_response;
		}

		if ( isset( $process_response['message']['status'] ) && 'success' === $process_response['message']['status'] ) {

			$cache_key = 'rtgodam-engagements-comments-transcoder-job-id-' . $transcoder_job_id;
			rtgodam_cache_delete( $cache_key );

			$response_data = array(
				'text' => $content,
			);

			return new WP_REST_Response(
				array(
					'status' => 'success',
					'data'   => $response_data,
				),
				200
			);
		}

		return new WP_REST_Response(
			array(
				'status'    => 'error',
				'message'   => __( 'Failed to update comment.', 'godam' ),
				'errorType' => 'failed_to_update_comment',
			),
			500
		);
	}

	/**
	 * Gets the public comment tree for a transcoder job ID.
	 *
	 * The tree carries the display name, avatar and an `is_own` flag for the
	 * current viewer. It never carries the author's email address.
	 *
	 * @param string $transcoder_job_id     Transcoder job ID.
	 * @param array  $account_credentials   Account credentials.
	 *
	 * @return array
	 */
	public function get_comments( $transcoder_job_id, $account_credentials ) {
		$result = $this->get_comment_tree( $transcoder_job_id, $account_credentials );

		return array(
			'comments' => $this->to_public_comments( $result['comments'] ),
			'total'    => $result['total'],
		);
	}

	/**
	 * Gets the comment tree for a transcoder job ID, from cache when possible.
	 *
	 * The tree is shared by every viewer, so it keeps each author's email for
	 * to_public_comments() to compare against the current viewer. It is server
	 * side only and must not be returned as it is.
	 *
	 * @param string $transcoder_job_id     Transcoder job ID.
	 * @param array  $account_credentials   Account credentials.
	 *
	 * @return array
	 */
	private function get_comment_tree( $transcoder_job_id, $account_credentials ) {

		$comment_tree  = array();
		$comment_index = array();

		$cache_key   = 'rtgodam-engagements-comments-transcoder-job-id-' . $transcoder_job_id;
		$cached_data = rtgodam_cache_get( $cache_key );
		if ( $cached_data ) {
			return $cached_data;
		}

		$fetched = $this->fetch_raw_comments( $transcoder_job_id, $account_credentials );

		if ( empty( $fetched['comments'] ) ) {

			return array(
				'comments' => $comment_tree,
				'total'    => 0,
			);
		}

		$comments = $fetched['comments'];
		$count    = $fetched['count'];

		foreach ( $comments as $comment ) {
			$created_date = $this->calculate_days( $comment['creation'] );
			$text         = preg_replace( '/^<p>(.*?)<\/p>$/i', '$1', $comment['content'] );

			$comment_index[ $comment['name'] ] = array(
				'id'              => $comment['name'],
				'parent_id'       => $comment['custom_reply_to'],
				'text'            => html_entity_decode( $text, ENT_QUOTES, 'UTF-8' ),
				'author_name'     => $comment['comment_by'],
				'author_email'    => $comment['comment_email'],
				'created_at_date' => $created_date['date'],
				'created_at_time' => $created_date['time'],
				'author_image'    => get_avatar_url( $comment['comment_email'] ),
				'children'        => array(),
			);
		}

		foreach ( $comment_index as $id => $comment ) {
			if ( ! empty( $comment['parent_id'] ) && isset( $comment_index[ $comment['parent_id'] ] ) ) {
				$comment_index[ $comment['parent_id'] ]['children'][] = &$comment_index[ $id ];
			}
		}

		foreach ( $comment_index as $comment ) {
			if ( empty( $comment['parent_id'] ) ) {
				$comment_tree[] = $comment;
			}
		}

		$result = array(
			'comments' => $comment_tree,
			'total'    => $count,
		);

		// Cache the response data for future requests.
		rtgodam_cache_set( $cache_key, $result );

		return $result;
	}

	/**
	 * Fetches a video's comments from GoDAM Central, without using the cache.
	 *
	 * Without `$limit`, Central answers with its default window: the newest 20
	 * comments, newest first, which is what the player shows. Pass `$start` and
	 * `$limit` to read further back.
	 *
	 * @param string   $transcoder_job_id     Transcoder job ID.
	 * @param array    $account_credentials   Account credentials.
	 * @param int|null $start                 Number of newest comments to skip. Only used with `$limit`.
	 * @param int|null $limit                 Number of comments to return.
	 *
	 * @return array|null Array with `comments` (list) and `count` (all comments on the video), or null when Central could not be reached or refused the request.
	 */
	private function fetch_raw_comments( $transcoder_job_id, $account_credentials, $start = null, $limit = null ) {
		$query_params = array(
			'name'    => $transcoder_job_id,
			'api_key' => $account_credentials['api_key'],
		);

		if ( null !== $limit ) {
			$query_params['start'] = (int) $start;
			$query_params['limit'] = (int) $limit;
		}

		$comments_endpoint = RTGODAM_API_BASE . '/api/method/godam_core.api.comment.get_wp_comments';
		$comments_response = wp_remote_post(
			$comments_endpoint,
			array(
				'body'    => wp_json_encode( $query_params ),
				'headers' => array(
					'Content-Type' => 'application/json',
				),
			)
		);
		$process_response  = $this->process_response( $comments_response );

		if ( $process_response instanceof WP_REST_Response ) {
			return null;
		}

		if ( empty( $process_response['message']['comments'] ) || ! is_array( $process_response['message']['comments'] ) ) {
			return array(
				'comments' => array(),
				'count'    => 0,
			);
		}

		return array(
			'comments' => $process_response['message']['comments'],
			'count'    => $process_response['message']['count'],
		);
	}

	/**
	 * Turns a comment tree into what the browser is allowed to see.
	 *
	 * Builds each comment from a fixed list of fields, so a field added to the
	 * stored tree later is not returned by accident.
	 *
	 * @param array $comments Comment tree from get_comment_tree().
	 *
	 * @return array
	 */
	private function to_public_comments( $comments ) {
		$public = array();

		foreach ( $comments as $comment ) {
			$public[] = array(
				'id'              => $comment['id'],
				'parent_id'       => $comment['parent_id'],
				'text'            => $comment['text'],
				'author_name'     => $comment['author_name'],
				'is_own'          => $this->is_own_comment( $comment['author_email'] ?? '' ),
				'created_at_date' => $comment['created_at_date'],
				'created_at_time' => $comment['created_at_time'],
				'author_image'    => $comment['author_image'],
				'children'        => $this->to_public_comments( $comment['children'] ?? array() ),
			);
		}

		return $public;
	}

	/**
	 * Whether a comment was written by the person making this request.
	 *
	 * Decided from the WordPress session alone. Guests and logged-out visitors
	 * never own a comment: there is no guest session on the server.
	 *
	 * @param string $author_email Email address stored with the comment.
	 *
	 * @return bool
	 */
	public function is_own_comment( $author_email ) {
		$current_user = rtgodam_get_current_logged_in_user_data();

		if ( 'user' !== $current_user['type'] || empty( $author_email ) ) {
			return false;
		}

		return strtolower( trim( $current_user['email'] ) ) === strtolower( trim( (string) $author_email ) );
	}

	/**
	 * Checks that the current user wrote a comment.
	 *
	 * Central lets any signed-in visitor edit or soft-delete a comment when its
	 * author has no GoDAM Central account, so the site has to decide.
	 *
	 * Who wrote a comment never changes, so the cached comments answer first:
	 * a comment found there is the current user's or it is not, with no call to
	 * Central. Only a comment the cache does not hold is looked for on Central,
	 * a page of 100 at a time, newest first. That covers a comment that has
	 * moved out of the window the player shows since the page loaded. If several
	 * comments arrive during the lookup, a page boundary can move past the
	 * comment; the author then gets the refusal below and can try again.
	 *
	 * @param string|null $transcoder_job_id   Transcoder job ID of the video.
	 * @param string      $comment_id          ID of the comment to change.
	 * @param array       $account_credentials Account credentials.
	 *
	 * @return true|WP_REST_Response True when the comment belongs to the current user, otherwise an error response.
	 */
	private function verify_comment_ownership( $transcoder_job_id, $comment_id, $account_credentials ) {
		$page_size = self::OWNERSHIP_LOOKUP_PAGE_SIZE;
		$start     = 0;

		if ( ! empty( $transcoder_job_id ) ) {
			$cached_comment = $this->find_comment_in_tree(
				$this->get_comment_tree( $transcoder_job_id, $account_credentials )['comments'],
				$comment_id
			);

			if ( null !== $cached_comment ) {
				return $this->is_own_comment( $cached_comment['author_email'] ?? '' ) ? true : $this->comment_not_owned_response();
			}
		}

		for ( $page_number = 0; ! empty( $transcoder_job_id ) && $page_number < self::OWNERSHIP_LOOKUP_MAX_PAGES; $page_number++ ) {
			$page = $this->fetch_raw_comments( $transcoder_job_id, $account_credentials, $start, $page_size );

			if ( null === $page ) {
				return new WP_REST_Response(
					array(
						'status'    => 'error',
						'message'   => __( 'Unable to verify the comment. Please try again.', 'godam' ),
						'errorType' => 'failed_to_verify_comment',
					),
					500
				);
			}

			foreach ( $page['comments'] as $comment ) {
				if ( isset( $comment['name'] ) && (string) $comment['name'] === (string) $comment_id ) {
					return $this->is_own_comment( $comment['comment_email'] ?? '' ) ? true : $this->comment_not_owned_response();
				}
			}

			$start += $page_size;

			// A short page, or one that reaches the total, is the last one.
			if ( count( $page['comments'] ) < $page_size || $start >= $page['count'] ) {
				break;
			}
		}

		return $this->comment_not_owned_response();
	}

	/**
	 * Finds a comment by ID in a comment tree, replies included.
	 *
	 * @param array  $comments   Comment tree from get_comment_tree().
	 * @param string $comment_id ID of the comment to find.
	 *
	 * @return array|null The comment, or null when the tree does not hold it.
	 */
	private function find_comment_in_tree( $comments, $comment_id ) {
		foreach ( $comments as $comment ) {
			if ( isset( $comment['id'] ) && (string) $comment['id'] === (string) $comment_id ) {
				return $comment;
			}

			$found = $this->find_comment_in_tree( $comment['children'] ?? array(), $comment_id );

			if ( null !== $found ) {
				return $found;
			}
		}

		return null;
	}

	/**
	 * The refusal for a comment the current user did not write.
	 *
	 * The same answer for a comment that is not there and one that is not theirs.
	 *
	 * @return WP_REST_Response
	 */
	private function comment_not_owned_response() {
		return new WP_REST_Response(
			array(
				'status'    => 'error',
				'message'   => __( 'You can only change your own comments.', 'godam' ),
				'errorType' => 'comment_not_owned',
			),
			403
		);
	}

	/**
	 * Retrieve like information for a transcoded video.
	 *
	 * This function queries the Godam API to get the like status and count for a
	 * specific video based on the transcoder job ID. It checks if the current user
	 * has liked the video and returns the like data.
	 *
	 * @param string $transcoder_job_id   The ID of the transcoder job associated with the video.
	 * @param array  $account_credentials The API credentials for accessing Godam services.
	 *
	 * @return array                      An array containing 'has_liked_by_user' and 'likes' count.
	 */
	public function get_likes( $transcoder_job_id, $account_credentials ) {
		$current_user       = rtgodam_get_current_logged_in_user_data();
		$current_user_email = $current_user['email'];

		$query_params = array(
			'name'          => $transcoder_job_id,
			'api_key'       => $account_credentials['api_key'],
			'comment_email' => $current_user_email,
		);

		$cache_key   = 'rtgodam-engagements-likes-transcoder-job-id-' . $transcoder_job_id . '-user-email-' . $current_user_email;
		$cached_data = rtgodam_cache_get( $cache_key );

		if ( $cached_data ) {
			return $cached_data;
		}

		$likes_endpoint   = RTGODAM_API_BASE . '/api/method/godam_core.api.comment.get_wp_likes';
		$likes_response   = wp_remote_post(
			$likes_endpoint,
			array(
				'body'    => wp_json_encode( $query_params ),
				'headers' => array(
					'Content-Type' => 'application/json',
				),
			)
		);
		$process_response = $this->process_response( $likes_response );

		if ( $process_response instanceof WP_REST_Response || empty( $process_response['message']['status'] ) || 'success' !== $process_response['message']['status'] ) {
			return array(
				'has_liked_by_user' => false,
				'likes'             => 0,
			);
		}
		// Cache the response data for future requests.
		rtgodam_cache_set( $cache_key, $process_response['message'] );

		return $process_response['message'];
	}

	/**
	 * Calculates the difference in days between the current date and a given date.
	 *
	 * The function takes a given date as a string and returns an array containing
	 * a string representation of the difference in days and the given date in
	 * 12-hour format.
	 *
	 * @param string $given_date The date to compare with the current date.
	 *
	 * @return array             Array containing 'date_str' and 'time' keys.
	 */
	public function calculate_days( $given_date ) {
		$current_date  = new \DateTime();
		$given_date    = new \DateTime( $given_date, wp_timezone() );
		$interval_days = $current_date->diff( $given_date )->days;
		$time          = $given_date->format( 'g:i A' );
		$date_str      = '';
		if ( 0 === $interval_days ) {
			$date_str = esc_html__( 'Today', 'godam' );
		} elseif ( 1 === $interval_days ) {
			$date_str = esc_html__( 'Yesterday', 'godam' );
		} elseif ( 2 <= $interval_days && $interval_days <= 7 ) {
			$date_str = $interval_days . esc_html__( ' days ago', 'godam' );
		} else {
			$date_str = $given_date->format( 'F jS, Y' );
		}
		return array(
			'date' => $date_str,
			'time' => $time,
		);
	}

	/**
	 * Logs in a guest user.
	 *
	 * The function takes a guest user email as input and logs them in by setting a cookie.
	 * The cookie is set for an hour and contains the guest user's email and name. If the
	 * guest user name is empty, it defaults to 'Guest'.
	 *
	 * @param WP_REST_Request $request Request object.
	 *
	 * @return WP_REST_Response
	 */
	public function guest_user_login( $request ) {
		$guest_user_email = $request->get_param( 'guest_user_email' );

		if ( empty( $guest_user_email ) || ! is_email( $guest_user_email ) ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => __( 'Invalid guest user email.', 'godam' ),
					'errorType' => 'invalid_guest_email',
				),
				500
			);
		}

		// @To-Do: Implement guest user login logic here. Will be done in future.

		$guest_user_name = explode( '@', $guest_user_email )[0];
		$user_data       = array(
			'email' => $guest_user_email,
			'name'  => ! empty( $guest_user_name ) ? $guest_user_name : __( 'Guest', 'godam' ),
			'type'  => 'guest',
		);

		return new WP_REST_Response(
			array(
				'status'  => 'success',
				'message' => __( 'Guest user email saved successfully.', 'godam' ),
				'data'    => $user_data,
			),
			200
		);
	}

	/**
	 * Checks if the current user has permission to interact with engagement endpoints.
	 *
	 * Guests are not allowed to interact with engagement endpoints.
	 *
	 * @return bool True if the user is not a guest, false otherwise.
	 */
	public function engagement_permission_check() {
		$current_user      = rtgodam_get_current_logged_in_user_data();
		$current_user_type = $current_user['type'];

		if ( 'user' !== $current_user_type ) {
			return false;
		}

		return true;
	}

	/**
	 * Returns the transcoding job ID for a given video ID.
	 *
	 * @param int|string $video_id The video ID. If it starts with 'cmmid_', the rest is the transcoding job ID.
	 *
	 * @return string|null The transcoding job ID, or null if not found.
	 */
	public function get_transcoder_job_id( $video_id ) {
		if ( 0 === strpos( $video_id, 'cmmid_' ) ) {
			return preg_replace( '/^cmmid_/', '', $video_id );
		}

		/**
		 * Fires before reading this attachment's transcoding job ID, so
		 * integrations that centralize media on another site can switch
		 * context first.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		$transcoder_job_id = get_post_meta( $video_id, 'rtgodam_transcoding_job_id', true );
		do_action( 'rtgodam_after_attachment_lookup' );

		return ! empty( $transcoder_job_id ) ? $transcoder_job_id : null;
	}

	/**
	 * Validates a request argument.
	 *
	 * Checks if the value is not empty and, if not, delegates to rest_validate_request_arg().
	 *
	 * @param mixed           $value   Value to validate.
	 * @param WP_REST_Request $request Request instance.
	 * @param string          $param   Parameter name.
	 *
	 * @return WP_Error|true WP_Error if invalid, true otherwise.
	 */
	public function validate_request_args( $value, $request, $param ) {
		$attributes = $request->get_attributes();
		if ( ! isset( $attributes['args'][ $param ] ) || ! is_array( $attributes['args'][ $param ] ) ) {
			return new WP_Error(
				'rest_invalid_param',
				/* translators: 1: Parameter. */
				sprintf( __( '%1$s is invalid.', 'godam' ), $param )
			);
		}
		$args      = $attributes['args'][ $param ];
		$exception = array( 'comment_parent_id' );

		if ( 'string' === $args['type'] && empty( $value ) && ! in_array( $param, $exception, true ) ) {
			return new WP_Error(
				'rest_invalid_param',
				/* translators: 1: Parameter. */
				sprintf( __( '%1$s is empty.', 'godam' ), $param )
			);
		}

		return rest_validate_request_arg( $value, $request, $param );
	}
}
