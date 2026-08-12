<?php
/**
 * REST API class for Analytics.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use WP_REST_Server;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class Analytics.
 */
class Analytics extends Base {

	/**
	 * REST route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'analytics';

	/**
	 * Register custom REST API routes for Analytics.
	 *
	 * @return array Array of registered REST API routes.
	 */
	public function get_rest_routes() {
		$routes = array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/fetch',
				'args'      => array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'fetch_analytics_data' ),
					'permission_callback' => '__return_true', // Publicly accessible.
					'args'                => array(
						'video_id' => array(
							'required'          => true,
							'type'              => 'integer',
							'description'       => __( 'The Video ID for fetching analytics data.', 'godam' ),
							'validate_callback' => function ( $param ) {
								return is_numeric( $param ) && intval( $param ) > 0;
							},
							'sanitize_callback' => 'absint',
						),
						'site_url' => array(
							'required'          => true,
							'type'              => 'string',
							'description'       => __( 'The Site URL associated with the video.', 'godam' ),
							'sanitize_callback' => 'esc_url_raw',
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/history',
				'args'      => array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'fetch_analytics_history' ),
					'permission_callback' => '__return_true',
					'args'                => array(
						'days'     => array(
							'required'          => false,
							'type'              => 'integer',
							'sanitize_callback' => 'absint',
						),
						'video_id' => array(
							'required'          => true,
							'type'              => 'integer',
							'sanitize_callback' => 'absint',
						),
						'site_url' => array(
							'required'          => true,
							'type'              => 'string',
							'sanitize_callback' => 'esc_url_raw',
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/dashboard-metrics',
				'args'      => array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'fetch_dashboard_metrics' ),
					'permission_callback' => '__return_true',
					'args'                => array(
						'site_url' => array(
							'required'          => true,
							'type'              => 'string',
							'sanitize_callback' => 'esc_url_raw',
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/dashboard-history',
				'args'      => array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'fetch_dashboard_history' ),
					'permission_callback' => '__return_true',
					'args'                => array(
						'days'     => array(
							'required'          => false,
							'type'              => 'integer',
							'sanitize_callback' => 'absint',
						),
						'site_url' => array(
							'required'          => true,
							'type'              => 'string',
							'sanitize_callback' => 'esc_url_raw',
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/top-videos',
				'args'      => array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'fetch_top_videos' ),
					// Admin-dashboard read: gate to users who can see the analytics
					// dashboard (authors and above — matches the menu's `upload_files`
					// capability). The search path resolves an uncached WP_Query, so
					// this also closes the unauthenticated DB-amplification vector.
					'permission_callback' => function () {
						return current_user_can( 'upload_files' );
					},
					'args'                => array(
						'page'         => array(
							'required'          => false,
							'type'              => 'integer',
							'default'           => 1,
							'sanitize_callback' => 'absint',
						),
						'limit'        => array(
							'required'          => false,
							'type'              => 'integer',
							'default'           => 10,
							'sanitize_callback' => 'absint',
						),
						'site_url'     => array(
							'required'          => true,
							'type'              => 'string',
							'sanitize_callback' => 'esc_url_raw',
						),
						'search'       => array(
							'required'          => false,
							'type'              => 'string',
							'default'           => '',
							'sanitize_callback' => 'sanitize_text_field',
						),
						'hide_deleted' => array(
							'required'          => false,
							'type'              => 'boolean',
							'default'           => false,
							'sanitize_callback' => 'rest_sanitize_boolean',
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/top-products',
				'args'      => array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'fetch_top_products' ),
					// Admin-dashboard read, gated like top-videos (authors and above);
					// the search path resolves an uncached WP_Query, so this also
					// closes the unauthenticated DB-amplification vector.
					'permission_callback' => function () {
						return current_user_can( 'upload_files' );
					},
					'args'                => array(
						'page'     => array(
							'required'          => false,
							'type'              => 'integer',
							'default'           => 1,
							'sanitize_callback' => 'absint',
						),
						'limit'    => array(
							'required'          => false,
							'type'              => 'integer',
							'default'           => 10,
							'sanitize_callback' => 'absint',
						),
						'site_url' => array(
							'required'          => true,
							'type'              => 'string',
							'sanitize_callback' => 'esc_url_raw',
						),
						'search'   => array(
							'required'          => false,
							'type'              => 'string',
							'default'           => '',
							'sanitize_callback' => 'sanitize_text_field',
						),
						'sort_by'  => array(
							'required'          => false,
							'type'              => 'string',
							'default'           => 'product_views',
							'sanitize_callback' => 'sanitize_text_field',
						),
						'order'    => array(
							'required'          => false,
							'type'              => 'string',
							'default'           => 'desc',
							'sanitize_callback' => 'sanitize_text_field',
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/layer-analytics',
				'args'      => array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'fetch_layer_analytics' ),
					// Matches the sibling analytics routes: the api_key / account_token
					// are injected server-side (never client-supplied) and the
					// microservice scopes every query by account, so this can only ever
					// return this site's own non-PII aggregate analytics. Locking down
					// analytics reads, if ever wanted, should be done uniformly across
					// all analytics routes rather than just this one.
					'permission_callback' => '__return_true',
					'args'                => array(
						'video_id'   => array(
							'required'          => true,
							'type'              => 'integer',
							'sanitize_callback' => 'absint',
							'validate_callback' => function ( $param ) {
								return is_numeric( $param ) && intval( $param ) > 0;
							},
						),
						'layer_type' => array(
							'required'          => true,
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_text_field',
							'validate_callback' => function ( $param ) {
								// Mirror of LAYER_TYPE_WHITELIST in godam-analytics.
								return in_array( $param, array( 'cta', 'form', 'hotspot', 'woo', 'poll' ), true );
							},
						),
						'site_url'   => array(
							'required'          => true,
							'type'              => 'string',
							'sanitize_callback' => 'esc_url_raw',
						),
						'days'       => array(
							'required'          => false,
							'type'              => 'integer',
							'sanitize_callback' => 'absint',
						),
					),
				),
			),
		);

		// Optional start_date / end_date (YYYY-MM-DD) range args, forwarded to
		// the range-capable microservice read endpoints. Additive: when absent
		// the request behaves exactly as before (all-time / `days`).
		$range_args   = array(
			'start_date' => array(
				'required'          => false,
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'validate_callback' => array( $this, 'validate_iso_date' ),
			),
			'end_date'   => array(
				'required'          => false,
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'validate_callback' => array( $this, 'validate_iso_date' ),
			),
		);
		$range_routes = array(
			'/' . $this->rest_base . '/fetch',
			'/' . $this->rest_base . '/history',
			'/' . $this->rest_base . '/dashboard-metrics',
			'/' . $this->rest_base . '/dashboard-history',
			'/' . $this->rest_base . '/layer-analytics',
			'/' . $this->rest_base . '/top-videos',
			'/' . $this->rest_base . '/top-products',
		);
		foreach ( $routes as &$route ) {
			if ( in_array( $route['route'], $range_routes, true ) ) {
				$route['args']['args'] = array_merge( $route['args']['args'], $range_args );
			}
		}
		unset( $route );

		return $routes;
	}

	/**
	 * Validate an optional ISO-8601 (YYYY-MM-DD) date range param.
	 *
	 * Empty is allowed (the param is optional); a non-empty value must parse as
	 * a real calendar date in strict Y-m-d form so a malformed string 400s at
	 * the proxy rather than being forwarded to the microservice.
	 *
	 * @param mixed $param The submitted value.
	 * @return bool
	 */
	public function validate_iso_date( $param ) {
		if ( empty( $param ) ) {
			return true;
		}
		$date = \DateTime::createFromFormat( 'Y-m-d', (string) $param );
		return $date && $date->format( 'Y-m-d' ) === (string) $param;
	}

	/**
	 * Merge start_date / end_date (when supplied) into a microservice query arg
	 * array. No-op when neither is present, so all-time requests are unchanged.
	 *
	 * @param WP_REST_Request $request The incoming request.
	 * @param array           $params  Query params destined for the microservice.
	 * @return array
	 */
	private function append_range_params( WP_REST_Request $request, array $params ) {
		$start_date = $request->get_param( 'start_date' );
		$end_date   = $request->get_param( 'end_date' );
		if ( ! empty( $start_date ) ) {
			$params['start_date'] = $start_date;
		}
		if ( ! empty( $end_date ) ) {
			$params['end_date'] = $end_date;
		}
		return $params;
	}

	/**
	 * Proxy /processed-layer-analytics/ from the analytics microservice.
	 *
	 * Looks up the transcoded job_id from the attachment ID so callers only
	 * need the video_id; the microservice can use either to identify the
	 * video. Honors the microservice's 4xx codes by returning a 200 with
	 * errorType so the frontend RTK Query layer can branch on it.
	 *
	 * @param WP_REST_Request $request REST API request.
	 * @return WP_REST_Response
	 */
	public function fetch_layer_analytics( WP_REST_Request $request ) {
		$attachment_id = $request->get_param( 'video_id' );
		$layer_type    = $request->get_param( 'layer_type' );
		$site_url      = $request->get_param( 'site_url' );
		$days          = $request->get_param( 'days' );
		$account_token = get_option( 'rtgodam-account-token', 'unverified' );
		$api_key       = get_option( 'rtgodam-api-key', '' );

		if ( empty( $api_key ) ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => __( 'Missing API key.', 'godam' ),
					'errorType' => 'missing_key',
				),
				200
			);
		}

		if ( empty( $account_token ) || 'unverified' === $account_token ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => __( 'GoDAM account is not verified. Connect your account in GoDAM settings to view layer analytics.', 'godam' ),
					'errorType' => 'unverified_account',
				),
				200
			);
		}

		// Resolve job_id from attachment meta when available — the microservice
		// can query by job_id when the WP video_id is empty or differs across
		// sites within the same account.
		$job_id = '';
		if ( $attachment_id ) {
			$job_id = (string) get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );
			if ( empty( $job_id ) ) {
				$job_id = (string) get_post_meta( $attachment_id, '_godam_original_id', true );
			}
		}

		// site_url is a client-supplied *filter*, not a trust boundary: the
		// account_token above is read from this site's own stored option (never
		// from the request), and the microservice scopes every query by
		// account_token — so a caller cannot read another account's data
		// regardless of the site_url passed.
		$query_params = array(
			'video_id'      => $attachment_id,
			'layer_type'    => $layer_type,
			'site_url'      => $site_url,
			'account_token' => $account_token,
			'api_key'       => $api_key,
		);
		if ( ! empty( $days ) ) {
			$query_params['days'] = (int) $days;
		}
		if ( ! empty( $job_id ) ) {
			$query_params['job_id'] = $job_id;
		}
		$query_params = $this->append_range_params( $request, $query_params );

		$endpoint = add_query_arg( $query_params, RTGODAM_ANALYTICS_BASE . '/processed-layer-analytics/' );
		// Bounded timeout: useVideoLayerData fires one of these per layer type
		// (5 in parallel) on page load, so a hung upstream must not pin a PHP
		// worker for the full default (5s) — and certainly not 5s × 5.
		$response = wp_remote_get( $endpoint, array( 'timeout' => 3 ) );

		if ( is_wp_error( $response ) ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => __( 'Unable to reach analytics server.', 'godam' ),
					'errorType' => 'microservice_error',
				),
				200
			);
		}

		$http_code = wp_remote_retrieve_response_code( $response );
		$body      = json_decode( wp_remote_retrieve_body( $response ), true );
		$detail    = $body['detail'] ?? __( 'Unexpected error from analytics server.', 'godam' );

		if ( 400 === $http_code ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => $detail,
					'errorType' => 'bad_request',
				),
				200
			);
		}
		if ( 404 === $http_code ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => $detail,
					'errorType' => 'not_found',
				),
				200
			);
		}
		if ( 200 !== $http_code ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => $detail,
					'errorType' => 'microservice_error',
				),
				200
			);
		}

		return new WP_REST_Response(
			array(
				'status'          => 'success',
				'layer_analytics' => $body['layer_analytics'] ?? array(),
			),
			200
		);
	}

	/**
	 * Enrich microservice placement rows with WP-side page data.
	 *
	 * Each row arrives as { post_id, block_source, views, plays, page_load,
	 * play_time }. WP adds title (with a "Deleted page" fallback), permalink,
	 * edit_url (null when the current user can't edit the post) and is_deleted.
	 * The metric primitives pass through untouched. Lookups are capped to the
	 * first 100 rows as a defensive bound on per-request DB work; rows past the
	 * cap still get a constant-cost attributable label so none render blank.
	 *
	 * The /analytics/fetch route is public (permission_callback __return_true),
	 * so this never leaks non-public pages (private, draft, pending, trashed) to
	 * anonymous callers: the real title/permalink is revealed only when the page
	 * is publicly viewable, or the current user can edit it.
	 *
	 * @param array $placements Placement rows from the microservice.
	 * @return array Enriched placement rows.
	 */
	private function enrich_placements( $placements ) {
		if ( ! is_array( $placements ) || empty( $placements ) ) {
			return is_array( $placements ) ? $placements : array();
		}

		$lookup_limit = 100;
		$placements   = array_values( $placements );

		// Prime the post cache in ONE query for the rows we are about to enrich,
		// so the loop below hits cache instead of issuing up to 100 individual
		// uncached get_post() calls per request on a public endpoint.
		$prime_ids = array();
		foreach ( array_slice( $placements, 0, $lookup_limit ) as $placement ) {
			if ( is_array( $placement ) && ! empty( $placement['post_id'] ) ) {
				$prime_ids[] = absint( $placement['post_id'] );
			}
		}
		$prime_ids = array_filter( array_unique( $prime_ids ) );
		if ( ! empty( $prime_ids ) ) {
			_prime_post_caches( $prime_ids, false, false );
		}

		foreach ( $placements as $index => $placement ) {
			if ( ! is_array( $placement ) ) {
				continue;
			}

			$placement_post_id = isset( $placement['post_id'] ) ? absint( $placement['post_id'] ) : 0;

			// Beyond the per-request lookup cap: skip the DB work, but emit a
			// constant-cost attributable label so the row never renders blank.
			if ( $index >= $lookup_limit ) {
				$placements[ $index ]['title'] = $placement_post_id
					/* translators: %d: WordPress post ID. */
					? sprintf( __( 'Post #%d', 'godam' ), $placement_post_id )
					: __( 'Deleted page', 'godam' );
				$placements[ $index ]['permalink']  = null;
				$placements[ $index ]['edit_url']   = null;
				$placements[ $index ]['is_deleted'] = false;
				continue;
			}

			$placement_post = $placement_post_id ? get_post( $placement_post_id ) : null;

			// A trashed post is treated as gone even for users who can edit it:
			// WordPress maps edit_post on a trashed post to its pre-trash status
			// (so current_user_can passes), but wp-admin/post.php refuses to open
			// it ("You cannot edit this item because it is in the Trash", HTTP
			// 409). Surfacing an Edit link would be a dead end, and the page is
			// unreachable for visitors, so it belongs in the deleted state.
			$is_trashed  = $placement_post && 'trash' === $placement_post->post_status;
			$can_edit    = $placement_post && ! $is_trashed && current_user_can( 'edit_post', $placement_post_id );
			$is_viewable = $placement_post && ! $is_trashed && is_post_publicly_viewable( $placement_post );
			$edit_url    = $can_edit ? get_edit_post_link( $placement_post_id, 'raw' ) : null;

			if ( $is_viewable ) {
				// Public page: reveal title, permalink and (if capable) an edit link.
				$permalink = get_permalink( $placement_post );

				$placements[ $index ]['title']      = get_the_title( $placement_post );
				$placements[ $index ]['permalink']  = $permalink ? $permalink : null;
				$placements[ $index ]['edit_url']   = $edit_url ? $edit_url : null;
				$placements[ $index ]['is_deleted'] = false;
			} elseif ( $can_edit ) {
				// Not public (private/draft/pending), but this user may edit it:
				// show the real title + an Edit link, without a public permalink.
				$placements[ $index ]['title']      = get_the_title( $placement_post );
				$placements[ $index ]['permalink']  = null;
				$placements[ $index ]['edit_url']   = $edit_url ? $edit_url : null;
				$placements[ $index ]['is_deleted'] = false;
			} elseif ( $placement_post ) {
				// A REAL post exists (private/draft/pending/trashed) and this
				// caller may not even know it exists. Redact everything that
				// could identify or describe it -- not just the title: the raw
				// post_id and its engagement metrics (views/plays/page_load/
				// play_time) were still passing through on the public
				// `/analytics/fetch` route, letting an anonymous caller
				// enumerate hidden page IDs and read their traffic. Every
				// redacted row is intentionally identical (same generic label,
				// zeroed metrics, post_id 0) so nothing distinguishes one
				// hidden page from another.
				$placements[ $index ]['post_id']    = 0;
				$placements[ $index ]['title']      = __( 'Unavailable', 'godam' );
				$placements[ $index ]['permalink']  = null;
				$placements[ $index ]['edit_url']   = null;
				$placements[ $index ]['is_deleted'] = true;
				$placements[ $index ]['views']      = 0;
				$placements[ $index ]['plays']      = 0;
				$placements[ $index ]['page_load']  = 0;
				$placements[ $index ]['play_time']  = 0;
			} else {
				// post_id doesn't resolve to any post at all: nothing real to
				// protect, so the metrics stay and the ID is safe to show.
				$placements[ $index ]['title'] = $placement_post_id
					/* translators: %d: WordPress post ID. */
					? sprintf( __( 'Post #%d (deleted)', 'godam' ), $placement_post_id )
					: __( 'Deleted page', 'godam' );
				$placements[ $index ]['permalink']  = null;
				$placements[ $index ]['edit_url']   = null;
				$placements[ $index ]['is_deleted'] = true;
			}
		}

		return $placements;
	}

	/**
	 * Fetch analytics data from the external API securely.
	 *
	 * @param WP_REST_Request $request REST API request.
	 * @return WP_REST_Response
	 */
	public function fetch_analytics_data( WP_REST_Request $request ) {
		$video_id = $request->get_param( 'video_id' );
		$site_url = $request->get_param( 'site_url' );

		// Define API URL for fetching analytics.
		$analytics_endpoint = RTGODAM_ANALYTICS_BASE . '/processed-analytics/fetch/';

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
				200
			);
		}

		// Build query parameters safely.
		$query_params = array(
			'video_id'      => $video_id,
			'site_url'      => $site_url,
			'account_token' => $account_token,
			'api_key'       => $api_key,
		);
		$query_params = $this->append_range_params( $request, $query_params );

		$analytics_url = add_query_arg( $query_params, $analytics_endpoint );

		// Send request to analytics microservice.
		$response = wp_remote_get( $analytics_url );

		// Handle response errors.
		if ( is_wp_error( $response ) ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => __( 'Unable to reach analytics server.', 'godam' ),
					'errorType' => 'microservice_error',
				),
				200
			);
		}

		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		$http_code = wp_remote_retrieve_response_code( $response );
		$detail    = $data['detail'] ?? __( 'Unexpected error from analytics server.', 'godam' );

		if ( 404 === $http_code || 400 === $http_code ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => $detail,
					'errorType' => 'invalid_key',
				),
				200
			);
		}

		if ( $http_code >= 500 ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => $detail,
					'errorType' => 'microservice_error',
				),
				200
			);
		}

		// Return analytics data if available.
		if ( isset( $data['processed_analytics'] ) ) {
			// Placement rows (added by the placements-capable microservice) get
			// WP-side page context. Key left absent when the microservice
			// doesn't send it, so the frontend can treat "old microservice"
			// and "no placements yet" the same way.
			if ( isset( $data['processed_analytics']['placements'] ) ) {
				$data['processed_analytics']['placements'] = $this->enrich_placements(
					$data['processed_analytics']['placements']
				);
			}

			$post_views   = $data['processed_analytics']['post_views'] ?? array();
			$post_ids     = array_keys( $post_views );
			$post_details = array();

			if ( ! empty( $post_ids ) ) {
				// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.get_posts_get_posts
				$posts = get_posts(
					array(
						'post__in'         => $post_ids,
						'post_type'        => 'any',
						'posts_per_page'   => -1,
						'orderby'          => 'post__in',
						'suppress_filters' => false,
					)
				);

				foreach ( $posts as $post ) {
					if ( isset( $post_views[ $post->ID ] ) ) {
						$post_details[] = array(
							'id'    => $post->ID,
							'title' => get_the_title( $post ),
							'url'   => get_permalink( $post ),
							'views' => $post_views[ $post->ID ],
						);
					}
				}
			}

			return new WP_REST_Response(
				array(
					'status' => 'success',
					'data'   => array_merge(
						$data['processed_analytics'],
						array( 'post_details' => $post_details )
					),
				),
				200
			);
		}

		// If no data found, return empty response.
		return new WP_REST_Response(
			array(
				'status' => 'success',
				'data'   => array(
					'account_token'         => '',
					'all_time_heatmap'      => wp_json_encode( array() ),
					'date'                  => gmdate( 'Y-m-d' ),
					'heatmap'               => wp_json_encode( array() ),
					'page_load'             => 0,
					'play_time'             => 0.0,
					'plays'                 => 0,
					'unique_viewers'        => 0,
					'site_url'              => '',
					'video_id'              => 0,
					'video_length'          => 0.0,
					'country_views'         => array(),
					'post_views'            => array(),
					'views_change'          => 0.0,
					'watch_time_change'     => 0.0,
					'play_rate_change'      => 0.0,
					'avg_engagement_change' => 0.0,
					'post_details'          => array(),
				),
			),
			200
		);
	}

	/**
	 * Fetch analytics history from the external API securely.
	 *
	 * @param WP_REST_Request $request REST API request.
	 * @return WP_REST_Response
	 */
	public function fetch_analytics_history( WP_REST_Request $request ) {
		$days          = $request->get_param( 'days' );
		$video_id      = $request->get_param( 'video_id' );
		$site_url      = $request->get_param( 'site_url' );
		$account_token = get_option( 'rtgodam-account-token', 'unverified' );
		$api_key       = get_option( 'rtgodam-api-key', '' );

		if ( empty( $account_token ) || 'unverified' === $account_token ) {
			return new WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => __( 'Invalid or unverified API key.', 'godam' ),
				),
				200
			);
		}

		$microservice_url = RTGODAM_ANALYTICS_BASE . '/processed-analytics/history/';
		$params           = array(
			'video_id'      => $video_id,
			'site_url'      => $site_url,
			'account_token' => $account_token,
			'api_key'       => $api_key,
		);

		// Only add days parameter if it's provided.
		if ( ! empty( $days ) ) {
			$params['days'] = $days;
		}
		$params = $this->append_range_params( $request, $params );

		$history_url = add_query_arg( $params, $microservice_url );
		$response    = wp_remote_get( $history_url );

		if ( is_wp_error( $response ) ) {
			return new WP_REST_Response(
				array(
					'status'  => 'error',
					/* translators: %s is the error message from the API response. */
					'message' => sprintf( __( 'Error fetching history data: %s', 'godam' ), $response->get_error_message() ),
				),
				500
			);
		}

		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		return new WP_REST_Response(
			array(
				'status'              => 'success',
				'processed_analytics' => $data['processed_analytics'] ?? array(),
			),
			200
		);
	}

	/**
	 * Fetch dashboard metrics from the external API securely.
	 *
	 * @param WP_REST_Request $request REST API request.
	 * @return WP_REST_Response
	 */
	public function fetch_dashboard_metrics( WP_REST_Request $request ) {
		$site_url      = $request->get_param( 'site_url' );
		$account_token = get_option( 'rtgodam-account-token', 'unverified' );
		$api_key       = get_option( 'rtgodam-api-key', '' );

		if ( empty( $api_key ) || empty( $account_token ) || 'unverified' === $account_token ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => __( 'Missing API key.', 'godam' ),
					'errorType' => 'missing_key',
				),
				200
			);
		}

		$params   = $this->append_range_params(
			$request,
			array(
				'site_url'      => $site_url,
				'account_token' => $account_token,
				'api_key'       => $api_key,
			)
		);
		$endpoint = add_query_arg(
			$params,
			RTGODAM_ANALYTICS_BASE . '/dashboard/metrics/fetch/'
		);

		$empty_metrics = array(
			'plays'                 => 0,
			'play_time'             => 0.0,
			'page_load'             => 0,
			'avg_engagement'        => 0.0,
			'country_views'         => array(),
			'views_change'          => 0.0,
			'watch_time_change'     => 0.0,
			'play_rate_change'      => 0.0,
			'avg_engagement_change' => 0.0,
			'unique_viewers'        => 0,
		);

		$response = wp_remote_get( $endpoint );
		if ( is_wp_error( $response ) ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => __( 'Unable to reach analytics server.', 'godam' ),
					'errorType' => 'microservice_error',
				),
				200
			);
		}

		$http_code = wp_remote_retrieve_response_code( $response );
		$body      = json_decode( wp_remote_retrieve_body( $response ), true );
		$detail    = $body['detail'] ?? __( 'Unexpected error from analytics server.', 'godam' );

		if ( 404 === $http_code || 400 === $http_code ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => $detail,
					'errorType' => 'invalid_key',
				),
				200
			);
		}

		if ( $http_code >= 500 ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => $detail,
					'errorType' => 'microservice_error',
				),
				200
			);
		}

		return new WP_REST_Response(
			array(
				'status'            => 'success',
				'dashboard_metrics' => array_merge( $empty_metrics, $body['dashboard_metrics'] ?? array() ),
			),
			200
		);
	}

	/**
	 * Fetch dashboard metrics history from the external API securely.
	 *
	 * @param WP_REST_Request $request REST API request.
	 * @return WP_REST_Response
	 */
	public function fetch_dashboard_history( WP_REST_Request $request ) {
		$days          = $request->get_param( 'days' );
		$site_url      = $request->get_param( 'site_url' );
		$account_token = get_option( 'rtgodam-account-token', 'unverified' );
		$api_key       = get_option( 'rtgodam-api-key', '' );

		if ( empty( $account_token ) || 'unverified' === $account_token ) {
			return new WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => __( 'Invalid or unverified API key.', 'godam' ),
				),
				200
			);
		}

		$params = array(
			'site_url'      => $site_url,
			'account_token' => $account_token,
			'api_key'       => $api_key,
		);

		// Only add days parameter if it's provided.
		if ( ! empty( $days ) ) {
			$params['days'] = $days;
		}
		$params = $this->append_range_params( $request, $params );

		$endpoint = add_query_arg(
			$params,
			RTGODAM_ANALYTICS_BASE . '/dashboard/metrics/history/'
		);

		$response = wp_remote_get( $endpoint );
		if ( is_wp_error( $response ) ) {
			return new WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => $response->get_error_message(),
				),
				500
			);
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		return new WP_REST_Response(
			array(
				'status'                    => 'success',
				'dashboard_metrics_history' => $body['dashboard_metrics_history'] ?? array(),
			),
			200
		);
	}

	/**
	 * Fetch top videos from the external API securely.
	 *
	 * @param WP_REST_Request $request REST API request.
	 * @return WP_REST_Response
	 */
	public function fetch_top_videos( WP_REST_Request $request ) {
		$page          = $request->get_param( 'page' ) ?? 1;
		$limit         = $request->get_param( 'limit' ) ?? 10;
		$site_url      = $request->get_param( 'site_url' );
		$search        = trim( (string) $request->get_param( 'search' ) );
		$hide_deleted  = rest_sanitize_boolean( $request->get_param( 'hide_deleted' ) );
		$account_token = get_option( 'rtgodam-account-token', 'unverified' );
		$api_key       = get_option( 'rtgodam-api-key', '' );

		if ( empty( $account_token ) || 'unverified' === $account_token ) {
			return new WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => __( 'Invalid or unverified API key.', 'godam' ),
				),
				200
			);
		}

		// Name search + hide-deleted are WordPress-only concerns (titles and
		// deletion state live in WP, not the microservice). Resolve them into the
		// microservice's `video_ids` include-filter. null => no restriction;
		// an array (including []) => restrict to that set ([] yields zero rows).
		$video_ids = $this->resolve_top_videos_id_filter( $search, $hide_deleted );

		$endpoint = add_query_arg(
			$this->append_range_params(
				$request,
				array(
					'page'          => $page,
					'limit'         => $limit,
					'site_url'      => $site_url,
					'account_token' => $account_token,
					'api_key'       => $api_key,
				)
			),
			RTGODAM_ANALYTICS_BASE . '/dashboard/top-videos/'
		);

		// When a `video_ids` include-filter applies, POST it (the list can be
		// large); otherwise fall back to a plain GET.
		if ( is_array( $video_ids ) ) {
			$response = wp_remote_post(
				$endpoint,
				array(
					'timeout' => 3,
					'headers' => array( 'Content-Type' => 'application/json' ),
					'body'    => wp_json_encode( array( 'video_ids' => array_values( array_map( 'intval', $video_ids ) ) ) ),
				)
			);
		} else {
			$response = wp_remote_get( $endpoint, array( 'timeout' => 3 ) );
		}
		if ( is_wp_error( $response ) ) {
			return new WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => $response->get_error_message(),
				),
				500
			);
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		$top_videos = $body['top_videos'] ?? array();

		foreach ( $top_videos as &$video ) {
			if ( ! empty( $video['video_id'] ) ) {
				$attachment_id = intval( $video['video_id'] );
				$attachment    = get_post( $attachment_id );
				
				if ( $attachment && 'attachment' === $attachment->post_type ) {
					// Check if this is virtual media (from GoDAM Tab).
					$godam_original_id = get_post_meta( $attachment_id, '_godam_original_id', true );
					$is_virtual_media  = ! empty( $godam_original_id );
					
					// Get file size - different approach for virtual vs local media.
					if ( $is_virtual_media ) {
						// For virtual media, get size from metadata.
						$metadata  = get_post_meta( $attachment_id, '_wp_attachment_metadata', true );
						$file_size = isset( $metadata['filesize'] ) ? (int) $metadata['filesize'] : 0;
					} else {
						// For local media, get actual file size.
						$file_path = get_attached_file( $attachment_id );
						
						$file_size = ( $file_path && file_exists( $file_path ) ) ? filesize( $file_path ) : 0;
						
					}
					
					$video['video_size']    = round( $file_size / ( 1024 * 1024 ), 2 );
					$video['title']         = get_the_title( $attachment_id );
					$video['exists']        = true;
					$video['is_virtual']    = $is_virtual_media;
					$custom_thumbnail       = get_post_meta( $attachment_id, 'rtgodam_media_video_thumbnail', true );
					$default_thumb          = wp_get_attachment_image_url( $attachment_id, 'medium' );
					$video['thumbnail_url'] = $custom_thumbnail ?: $default_thumb ?: null;
				} else {
					// Media doesn't exist.
					$video['title']         = sprintf( 'ID: %d (Deleted Media)', $video['video_id'] );
					$video['video_size']    = 0;
					$video['thumbnail_url'] = null;
					$video['exists']        = false;
					$video['is_virtual']    = false;
				}
			}
		}

		return new WP_REST_Response(
			array(
				'status'      => 'success',
				'top_videos'  => $top_videos,
				'total_pages' => $body['total_pages'] ?? 1,
				'total_items' => $body['total_items'] ?? 0,
			),
			200
		);
	}

	/**
	 * Resolve the `video_ids` include-filter for name-search + hide-deleted.
	 *
	 * Titles and deletion state live in WordPress, not the microservice, so both
	 * concerns are turned into an explicit list of existing video-attachment IDs
	 * (optionally matching the search term) for the microservice to filter on.
	 *
	 * @param string $search       Search term. Passed to WP_Query `s`, which matches the attachment title, content (description) and excerpt (caption) — not title-only.
	 * @param bool   $hide_deleted Whether to restrict to existing attachments.
	 *
	 * @return array|null Attachment IDs, or null when neither concern is active.
	 */
	private function resolve_top_videos_id_filter( $search, $hide_deleted ) {
		$has_search = ( '' !== (string) $search );

		// Neither concern active => let the microservice return everything
		// (deleted rows are still flagged `exists:false` during enrichment).
		if ( ! $has_search && ! $hide_deleted ) {
			return null;
		}

		// The default the UI sends on every load / page change is no-search +
		// hide-deleted, which resolves to the full set of existing video
		// attachment IDs — that set rarely changes, so cache it briefly to avoid
		// re-querying a large media library on each request. (Up to 5 min stale,
		// which is fine for analytics — it isn't real-time.) Search results vary
		// per term, so they're not cached.
		$cache_key   = 'rtgodam_top_videos_existing_ids';
		$is_full_set = ( ! $has_search && $hide_deleted );
		if ( $is_full_set ) {
			$cached = get_transient( $cache_key );
			if ( is_array( $cached ) ) {
				return $cached;
			}
		}

		// Existing video attachments, optionally matching the search term.
		// Capped at the microservice's `video_ids` limit (10000).
		$query_args = array(
			'post_type'        => 'attachment',
			'post_status'      => 'inherit',
			'post_mime_type'   => 'video',
			'fields'           => 'ids',
			// phpcs:ignore WordPress.WP.PostsPerPage.posts_per_page_posts_per_page -- intentional: we need the full existing-attachment set to build the include-filter, bounded by the microservice's 10000 video_ids cap, and the common case is cached above.
			'posts_per_page'   => 10000,
			'no_found_rows'    => true,
			'suppress_filters' => false,
			'orderby'          => 'ID',
			'order'            => 'ASC',
		);

		if ( $has_search ) {
			$query_args['s'] = $search;
		}

		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.get_posts_get_posts -- bounded, `suppress_filters => false` (cacheable), and the common no-search case is transient-cached; matches the existing convention in this class.
		$ids = array_map( 'intval', (array) get_posts( $query_args ) );

		if ( $is_full_set ) {
			set_transient( $cache_key, $ids, 5 * MINUTE_IN_SECONDS );
		}

		return $ids;
	}

	/**
	 * Proxy /dashboard/top-products/ from the analytics microservice, then hydrate
	 * each product row with its current WooCommerce name, image and permalink,
	 * resolved from product_id. Display fields live in WooCommerce, not the
	 * microservice, so a rename or a new image reflects immediately and no stale
	 * copy is stored.
	 *
	 * Mirrors fetch_top_videos: a product-name search is a WordPress-only concern,
	 * resolved to a product_ids include-filter and POSTed; otherwise a plain GET.
	 *
	 * @param WP_REST_Request $request REST API request.
	 * @return WP_REST_Response
	 */
	public function fetch_top_products( WP_REST_Request $request ) {
		$page          = $request->get_param( 'page' ) ?? 1;
		$limit         = $request->get_param( 'limit' ) ?? 10;
		$site_url      = $request->get_param( 'site_url' );
		$search        = trim( (string) $request->get_param( 'search' ) );
		$sort_by       = $request->get_param( 'sort_by' );
		$order         = $request->get_param( 'order' );
		$account_token = get_option( 'rtgodam-account-token', 'unverified' );
		$api_key       = get_option( 'rtgodam-api-key', '' );

		if ( empty( $account_token ) || 'unverified' === $account_token ) {
			return new WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => __( 'Invalid or unverified API key.', 'godam' ),
				),
				200
			);
		}

		// Product-name search lives in WooCommerce, not the microservice. Resolve
		// it into the microservice's product_ids include-filter. null => no
		// restriction; an array (including []) => restrict to that set.
		$product_ids = $this->resolve_top_products_id_filter( $search );

		$query = array(
			'page'          => $page,
			'limit'         => $limit,
			'site_url'      => $site_url,
			'account_token' => $account_token,
			'api_key'       => $api_key,
		);
		if ( ! empty( $sort_by ) ) {
			$query['sort_by'] = $sort_by;
		}
		if ( ! empty( $order ) ) {
			$query['order'] = $order;
		}

		$endpoint = add_query_arg(
			$this->append_range_params( $request, $query ),
			RTGODAM_ANALYTICS_BASE . '/dashboard/top-products/'
		);

		// POST the product_ids filter when a search applies (the list can be
		// large); otherwise a plain GET.
		if ( is_array( $product_ids ) ) {
			$response = wp_remote_post(
				$endpoint,
				array(
					'timeout' => 3,
					'headers' => array( 'Content-Type' => 'application/json' ),
					'body'    => wp_json_encode( array( 'product_ids' => array_values( array_map( 'intval', $product_ids ) ) ) ),
				)
			);
		} else {
			$response = wp_remote_get( $endpoint, array( 'timeout' => 3 ) );
		}

		if ( is_wp_error( $response ) ) {
			return new WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => $response->get_error_message(),
				),
				500
			);
		}

		$body         = json_decode( wp_remote_retrieve_body( $response ), true );
		$top_products = $body['top_products'] ?? array();

		foreach ( $top_products as &$product ) {
			$product_id = intval( $product['product_id'] ?? 0 );
			$wc_product = ( $product_id && function_exists( 'wc_get_product' ) ) ? wc_get_product( $product_id ) : false;

			if ( $wc_product ) {
				$image_id                 = $wc_product->get_image_id();
				$product['title']         = $wc_product->get_name();
				$product['permalink']     = get_permalink( $product_id );
				$product['thumbnail_url'] = $image_id
					? wp_get_attachment_image_url( $image_id, 'thumbnail' )
					: ( function_exists( 'wc_placeholder_img_src' ) ? wc_placeholder_img_src( 'thumbnail' ) : null );
				$product['exists']        = true;
			} else {
				$product['title'] = sprintf(
					/* translators: %d: WooCommerce product ID. */
					__( 'ID: %d (Deleted Product)', 'godam' ),
					$product_id
				);
				$product['permalink']     = null;
				$product['thumbnail_url'] = null;
				$product['exists']        = false;
			}
		}
		unset( $product );

		return new WP_REST_Response(
			array(
				'status'       => 'success',
				'top_products' => $top_products,
				'total_pages'  => $body['total_pages'] ?? 1,
				'total_items'  => $body['total_items'] ?? 0,
			),
			200
		);
	}

	/**
	 * Resolve the product_ids include-filter for a product-name search.
	 *
	 * Product names live in WooCommerce, not the microservice, so a search term is
	 * turned into an explicit list of matching product IDs for the microservice to
	 * filter on. Returns null when no search is active (no restriction).
	 *
	 * @param string $search Search term, matched against the product title/content.
	 * @return array|null Product IDs, or null when no search is active.
	 */
	private function resolve_top_products_id_filter( $search ) {
		if ( '' === (string) $search ) {
			return null;
		}

		// Existing published products matching the search term. Capped at the
		// microservice's product_ids limit (10000).
		$query_args = array(
			'post_type'        => 'product',
			'post_status'      => 'publish',
			'fields'           => 'ids',
			's'                => $search,
			// phpcs:ignore WordPress.WP.PostsPerPage.posts_per_page_posts_per_page -- bounded by the microservice's 10000 product_ids cap; search results vary per term so are not cached.
			'posts_per_page'   => 10000,
			'no_found_rows'    => true,
			'suppress_filters' => false,
			'orderby'          => 'ID',
			'order'            => 'ASC',
		);

		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.get_posts_get_posts -- bounded and cacheable (suppress_filters => false); matches resolve_top_videos_id_filter in this class.
		$ids = array_map( 'intval', (array) get_posts( $query_args ) );

		return $ids;
	}
}
