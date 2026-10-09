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
	 * Fields of the `dashboard_metrics` payload that are video data. Users without
	 * `view_woocommerce_reports` get these and nothing else, so a field the
	 * analytics service adds later stays hidden from them until it is listed here.
	 *
	 * @var string[]
	 */
	const VIDEO_DATA_DASHBOARD_METRICS = array(
		'plays',
		'play_time',
		'page_load',
		'avg_engagement',
		'views_change',
		'watch_time_change',
		'play_rate_change',
		'avg_engagement_change',
		'country_views',
		'total_videos',
		'unique_viewers',
		'unavailable_sections',
	);

	/**
	 * Sections of `dashboard_metrics` the service may report as unavailable that
	 * are video data. Every other name is a store section.
	 *
	 * @var string[]
	 */
	const VIDEO_DATA_SECTIONS = array( 'unique_viewers' );

	/**
	 * Fields of a per-video analytics record (the `processed_analytics` row plus
	 * the placements the service flattens into it) that are video data. The store
	 * fields the service adds to the same record (Video-to-Cart, Video-to-Purchase,
	 * the funnel, revenue and tips) are deliberately not listed.
	 *
	 * @var string[]
	 */
	const VIDEO_DATA_RECORD = array(
		'video_id',
		'job_id',
		'account_token',
		'site_url',
		'date',
		'plays',
		'unique_viewers',
		'unique_converting_sessions',
		'play_time',
		'page_load',
		'video_length',
		'heatmap',
		'all_time_heatmap',
		'country_views',
		'post_views',
		'placements',
		'views_change',
		'watch_time_change',
		'play_rate_change',
		'avg_engagement_change',
		'layer_type_stats',
		'layer_details',
		'layer_positions',
		'layer_converting_sessions',
	);

	/**
	 * Layer actions that are video data: what a viewer did with a layer. The
	 * `added_to_cart` action is store data and is not listed.
	 *
	 * @var string[]
	 */
	const VIDEO_DATA_LAYER_ACTIONS = array( 'viewed', 'clicked', 'hovered', 'skipped', 'submitted', 'voted' );

	/**
	 * Where the action sits in one row of each per-layer counter list of a record:
	 * `layer_type_stats` rows are [ layer_type, action_type, count ] and
	 * `layer_details` rows are [ layer_id, layer_name, layer_type, action_type,
	 * count, timestamp, page_url, layer_metadata ]. Only that column is checked,
	 * because the other columns hold text an editor can choose, such as a layer name.
	 *
	 * @var array<string,int>
	 */
	const VIDEO_DATA_COUNTER_ACTION_COLUMN = array(
		'layer_type_stats' => 1,
		'layer_details'    => 3,
	);

	/**
	 * Fields of the layer analytics payload that are video data, at its top level.
	 *
	 * @var string[]
	 */
	const VIDEO_DATA_LAYER_PAYLOAD = array( 'layer_type', 'days', 'cumulative', 'daily_breakdown', 'individual_layers' );

	/**
	 * Fields other than the layer actions that are video data in the layer totals
	 * and in each day of the daily breakdown.
	 *
	 * The conversion counters (`conversion_rate`, `converting_sessions`,
	 * `unique_converting_sessions`, `layer_converting_sessions`) are kept on purpose.
	 * They count sessions that acted on a video: clicked, submitted or voted and, on
	 * a WooCommerce layer, added to cart, once per session. They carry no product,
	 * amount or order and are the only figure for how well a form or call-to-action
	 * layer performs, so Editors and Authors see them. The `added_to_cart` counter
	 * itself and everything from the store stay behind `view_woocommerce_reports`.
	 *
	 * @var string[]
	 */
	const VIDEO_DATA_LAYER_TOTALS = array( 'date', 'conversion_rate' );

	/**
	 * Fields other than the layer actions that are video data in one layer or
	 * hotspot row. Revenue, orders and currency are deliberately not listed.
	 *
	 * @var string[]
	 */
	const VIDEO_DATA_LAYER_ROW = array(
		'layer_id',
		'layer_name',
		'layer_type',
		'timestamp',
		'page_url',
		'layer_metadata',
		'historical_positions',
		'is_subhotspot',
		'conversion_rate',
		'converting_sessions',
	);

	/**
	 * Register REST routes (via the parent) plus the cache-invalidation hooks
	 * for the Top Products / Top Videos "existing ids" allow-lists.
	 *
	 * The resolve_top_products_id_filter()/resolve_top_videos_id_filter() helpers
	 * cache the set of published product / attachment ids in a 5-minute transient so the
	 * common "hide deleted" request doesn't re-query a large catalog every time.
	 * Without invalidation, a product a shop owner just trashed stays in that
	 * cached allow-list, so it keeps appearing in Top Products (with "Show
	 * deleted" off) until the transient expires — which reads as "the toggle is
	 * broken". Flush the relevant cache the moment the underlying post is
	 * trashed, untrashed, restored, or deleted so the change shows immediately.
	 *
	 * @return void
	 */
	protected function setup_hooks() {
		parent::setup_hooks();

		// Trash / untrash / publish / draft transitions for products.
		add_action( 'transition_post_status', array( $this, 'flush_existing_ids_cache_on_transition' ), 10, 3 );
		// Permanent deletion of a product (and any other post type below).
		add_action( 'before_delete_post', array( $this, 'flush_existing_ids_cache_on_delete' ), 10, 2 );
		// Attachments (videos) are removed via wp_delete_attachment, which fires
		// delete_attachment rather than transition_post_status.
		add_action( 'delete_attachment', array( $this, 'flush_top_videos_ids_cache' ) );
		// A newly added product/attachment should also drop the stale allow-list
		// so it can enter the "hide deleted" set without a 5-minute wait.
		add_action( 'save_post_product', array( $this, 'flush_top_products_ids_cache' ) );
		add_action( 'add_attachment', array( $this, 'flush_top_videos_ids_cache' ) );
	}

	/**
	 * Flush the right allow-list cache when a post changes status (e.g. a
	 * product moved to or out of the trash). Only acts on a real status change
	 * for a post type the analytics tables track.
	 *
	 * @param string   $new_status New post status.
	 * @param string   $old_status Previous post status.
	 * @param \WP_Post $post       The post being transitioned.
	 * @return void
	 */
	public function flush_existing_ids_cache_on_transition( $new_status, $old_status, $post ) {
		if ( $new_status === $old_status || ! $post instanceof \WP_Post ) {
			return;
		}
		$this->flush_existing_ids_cache_for_post_type( $post->post_type );
	}

	/**
	 * Flush the right allow-list cache when a post is permanently deleted.
	 *
	 * @param int           $post_id The post ID being deleted.
	 * @param \WP_Post|null $post    The post object (WP 5.5+), or null on older cores.
	 * @return void
	 */
	public function flush_existing_ids_cache_on_delete( $post_id, $post = null ) {
		if ( ! $post instanceof \WP_Post ) {
			$post = get_post( $post_id ); // godam-coverage-ignore -- reads only post_type to pick the allow-list transient to flush, not attachment data.
		}
		if ( $post instanceof \WP_Post ) {
			$this->flush_existing_ids_cache_for_post_type( $post->post_type );
		}
	}

	/**
	 * Map a post type to its allow-list transient and delete it.
	 *
	 * @param string $post_type The post type that changed.
	 * @return void
	 */
	private function flush_existing_ids_cache_for_post_type( $post_type ) {
		if ( 'product' === $post_type ) {
			$this->flush_top_products_ids_cache();
		} elseif ( 'attachment' === $post_type ) {
			$this->flush_top_videos_ids_cache();
		}
	}

	/**
	 * Delete the cached Top Products published-id allow-list.
	 *
	 * @return void
	 */
	public function flush_top_products_ids_cache() {
		delete_transient( 'rtgodam_top_products_existing_ids' );
	}

	/**
	 * Delete the cached Top Videos published-id allow-list.
	 *
	 * @return void
	 */
	public function flush_top_videos_ids_cache() {
		delete_transient( 'rtgodam_top_videos_existing_ids' );
	}

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
					'permission_callback' => array( $this, 'check_analytics_read_permission' ),
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
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/history',
				'args'      => array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'fetch_analytics_history' ),
					'permission_callback' => array( $this, 'check_analytics_read_permission' ),
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
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/dashboard-metrics',
				'args'      => array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'fetch_dashboard_metrics' ),
					'permission_callback' => array( $this, 'check_dashboard_read_permission' ),
					'args'                => array(),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/dashboard-history',
				'args'      => array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'fetch_dashboard_history' ),
					'permission_callback' => array( $this, 'check_dashboard_read_permission' ),
					'args'                => array(
						'days' => array(
							'required'          => false,
							'type'              => 'integer',
							'sanitize_callback' => 'absint',
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
					'permission_callback' => array( $this, 'check_dashboard_read_permission' ),
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
					'permission_callback' => array( $this, 'check_dashboard_store_permission' ),
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
						'search'       => array(
							'required'          => false,
							'type'              => 'string',
							'default'           => '',
							'sanitize_callback' => 'sanitize_text_field',
						),
						'sort_by'      => array(
							'required'          => false,
							'type'              => 'string',
							'default'           => 'product_views',
							// Allowlist at the WP boundary (defense in depth): these are
							// the analytics service's own TOP_PRODUCTS_METRIC_SQL keys, so
							// a bad value 400s here with a clear message instead of being
							// forwarded upstream.
							'enum'              => array( 'product_views', 'add_to_cart', 'impressions', 'ctr' ),
							'sanitize_callback' => 'sanitize_text_field',
							'validate_callback' => 'rest_validate_request_arg',
						),
						'order'        => array(
							'required'          => false,
							'type'              => 'string',
							'default'           => 'desc',
							'enum'              => array( 'asc', 'desc' ),
							'sanitize_callback' => 'sanitize_text_field',
							'validate_callback' => 'rest_validate_request_arg',
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
				'route'     => '/' . $this->rest_base . '/placement-funnels',
				'args'      => array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'fetch_placement_funnels' ),
					'permission_callback' => array( $this, 'check_dashboard_store_permission' ),
					'args'                => array(),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/revenue-summary',
				'args'      => array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'fetch_revenue_summary' ),
					'permission_callback' => array( $this, 'check_dashboard_store_permission' ),
					'args'                => array(),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/video-funnel',
				'args'      => array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'fetch_video_funnel' ),
					'permission_callback' => array( $this, 'check_dashboard_store_permission' ),
					'args'                => array(),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/layer-analytics',
				'args'      => array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'fetch_layer_analytics' ),
					'permission_callback' => array( $this, 'check_analytics_read_permission' ),
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
			'/' . $this->rest_base . '/placement-funnels',
			'/' . $this->rest_base . '/revenue-summary',
			'/' . $this->rest_base . '/video-funnel',
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
	 * Permission check for the analytics routes the Analytics page and the Video
	 * Editor call (fetch, history, layer-analytics).
	 *
	 * Each route proxies the site's stored API key and account token to the
	 * analytics microservice, so none may answer anonymous callers. Access
	 * matches the Analytics and Media Editor menus' `upload_files` capability
	 * (authors and above). It also stops unauthenticated requests from
	 * triggering uncached upstream calls.
	 *
	 * @return bool Whether the current user may read per-video analytics.
	 */
	public function check_analytics_read_permission() {
		return current_user_can( 'upload_files' );
	}

	/**
	 * Permission check for the routes only the Dashboard page calls and that
	 * carry no store data (dashboard-metrics, dashboard-history, top-videos).
	 *
	 * The Dashboard menu needs `edit_pages` (editors and above), so its routes
	 * ask for the same capability: a user who cannot open the page cannot read
	 * its store-wide figures through the routes either.
	 *
	 * @return bool Whether the current user may read the Dashboard's video analytics.
	 */
	public function check_dashboard_read_permission() {
		return current_user_can( 'edit_pages' );
	}

	/**
	 * Permission check for the Dashboard routes whose whole answer is store data
	 * (top-products, revenue-summary, placement-funnels, video-funnel).
	 *
	 * The user must be able to open the Dashboard (`edit_pages`) and must hold
	 * WooCommerce's report permission. Anyone else is refused with a 403 rather
	 * than sent an empty or partial answer.
	 *
	 * @return bool Whether the current user may read the Dashboard's store analytics.
	 */
	public function check_dashboard_store_permission() {
		return $this->check_dashboard_read_permission() && $this->can_view_store_data();
	}

	/**
	 * Whether the current user may see store data: products, add-to-carts,
	 * Video-to-Cart, orders, purchases and revenue.
	 *
	 * This follows WooCommerce's own report permission, which it grants to shop
	 * managers and administrators only. Editors and authors get no WooCommerce or
	 * Products menu, so they see video data only. Routes that are all store data
	 * refuse everyone else; routes that mix video and store data reduce their
	 * responses to the video fields listed in the VIDEO_DATA_* constants, so the
	 * numbers cannot be read through the route even if the screen hides them.
	 *
	 * The capability lives on the roles, not in WooCommerce's code. Where
	 * WooCommerce has never been active, or where its data was removed on
	 * uninstall (it then removes its roles and capabilities), nobody holds it, so
	 * even an Administrator gets video data only from the mixed routes and a 403
	 * from the store routes. Deactivating WooCommerce leaves the capability on the
	 * roles, so shop managers and administrators can still read store data
	 * recorded earlier while it is off.
	 *
	 * @return bool Whether the current user may view store analytics.
	 */
	public function can_view_store_data() {
		return current_user_can( 'view_woocommerce_reports' ); // phpcs:ignore WordPress.WP.Capabilities.Unknown -- WooCommerce registers this capability itself.
	}

	/**
	 * Keep only the named keys of an array. Anything that is not an array passes
	 * through unchanged, so a null payload stays null.
	 *
	 * The routes that mix video and store data use this, not a list of store
	 * fields to remove: a field the analytics service adds later is hidden from
	 * users without store access until it is listed as video data.
	 *
	 * @param mixed $data    Response fragment.
	 * @param array $allowed Keys that are video data.
	 * @return mixed
	 */
	private function only_keys( $data, array $allowed ) {
		if ( ! is_array( $data ) ) {
			return $data;
		}
		return array_intersect_key( $data, array_flip( $allowed ) );
	}

	/**
	 * Keep the rows of a per-layer counter list that are about a video action. The
	 * service sends each counter as a row with the action in a fixed column (see
	 * VIDEO_DATA_COUNTER_ACTION_COLUMN); a row is kept only when that column holds a
	 * video layer action. An `added_to_cart` row, a row for an action added later, and
	 * a row too short to have the column are dropped. No other column is looked at, so
	 * a layer named after a video action cannot keep its `added_to_cart` row.
	 *
	 * @param mixed $rows          A list of counter rows.
	 * @param int   $action_column Index of the action in each row.
	 * @return mixed The list with only the video action rows.
	 */
	private function only_video_action_rows( $rows, $action_column ) {
		if ( ! is_array( $rows ) ) {
			return $rows;
		}
		return array_values(
			array_filter(
				$rows,
				function ( $row ) use ( $action_column ) {
					return is_array( $row )
						&& isset( $row[ $action_column ] )
						&& in_array( $row[ $action_column ], self::VIDEO_DATA_LAYER_ACTIONS, true );
				}
			)
		);
	}

	/**
	 * Reduce a `dashboard_metrics` payload to its video data. The names of store
	 * sections also leave `unavailable_sections`, so the page has no "couldn't
	 * load" state to show for a card the user was never going to see.
	 *
	 * @param array $metrics The merged `dashboard_metrics` payload.
	 * @return array
	 */
	private function video_data_in_dashboard_metrics( array $metrics ) {
		$metrics = $this->only_keys( $metrics, self::VIDEO_DATA_DASHBOARD_METRICS );
		if ( isset( $metrics['unavailable_sections'] ) && is_array( $metrics['unavailable_sections'] ) ) {
			$metrics['unavailable_sections'] = array_values(
				array_intersect( $metrics['unavailable_sections'], self::VIDEO_DATA_SECTIONS )
			);
		}
		return $metrics;
	}

	/**
	 * Reduce a per-video analytics record to its video data: the listed fields
	 * only, and of the per-layer counters only the video action rows.
	 *
	 * @param array $record The `processed_analytics` record for one video.
	 * @return array
	 */
	private function video_data_in_video_record( array $record ) {
		$record = $this->only_keys( $record, self::VIDEO_DATA_RECORD );
		foreach ( self::VIDEO_DATA_COUNTER_ACTION_COLUMN as $counter_rows => $action_column ) {
			if ( array_key_exists( $counter_rows, $record ) ) {
				$record[ $counter_rows ] = $this->only_video_action_rows( $record[ $counter_rows ], $action_column );
			}
		}
		return $record;
	}

	/**
	 * Reduce a layer analytics payload to its video data: views, hovers, clicks,
	 * skips, submissions and votes, with the interaction rate, per layer, in the
	 * totals and per day. The add-to-cart counter and per-hotspot revenue, orders
	 * and currency are store data and go.
	 *
	 * @param mixed $layer_analytics The `layer_analytics` payload.
	 * @return mixed
	 */
	private function video_data_in_layer_analytics( $layer_analytics ) {
		if ( ! is_array( $layer_analytics ) ) {
			return $layer_analytics;
		}
		$totals_fields = array_merge( self::VIDEO_DATA_LAYER_TOTALS, self::VIDEO_DATA_LAYER_ACTIONS );
		$row_fields    = array_merge( self::VIDEO_DATA_LAYER_ROW, self::VIDEO_DATA_LAYER_ACTIONS );

		$layer_analytics = $this->only_keys( $layer_analytics, self::VIDEO_DATA_LAYER_PAYLOAD );
		if ( isset( $layer_analytics['cumulative'] ) ) {
			$layer_analytics['cumulative'] = $this->only_keys( $layer_analytics['cumulative'], $totals_fields );
		}
		if ( isset( $layer_analytics['daily_breakdown'] ) && is_array( $layer_analytics['daily_breakdown'] ) ) {
			$layer_analytics['daily_breakdown'] = array_map(
				function ( $day ) use ( $totals_fields ) {
					return $this->only_keys( $day, $totals_fields );
				},
				$layer_analytics['daily_breakdown']
			);
		}
		if ( isset( $layer_analytics['individual_layers'] ) && is_array( $layer_analytics['individual_layers'] ) ) {
			$layer_analytics['individual_layers'] = array_map(
				function ( $layer ) use ( $row_fields ) {
					return $this->only_keys( $layer, $row_fields );
				},
				$layer_analytics['individual_layers']
			);
		}
		return $layer_analytics;
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
	 * Add the store's current UTC offset, in minutes, to a query for one of the
	 * funnel reads (Video-to-Cart, Video-to-Purchase, the funnels).
	 *
	 * With it the microservice counts every play, add and order on the store's own
	 * day, the day the Revenue card uses for an order, instead of the UTC day. It is
	 * the offset WordPress's timezone setting has now, the same value GoDAM for Woo
	 * stamps on an order, so around a daylight-saving change an event within an hour
	 * of midnight can fall on the neighbouring day. A microservice that does not know
	 * the parameter ignores it and keeps counting on the UTC day.
	 *
	 * @param array $params Query params destined for the microservice.
	 * @return array
	 */
	private function append_store_offset_param( array $params ) {
		$timezone = wp_timezone();
		$minutes  = (int) round( $timezone->getOffset( new \DateTimeImmutable( 'now', $timezone ) ) / 60 );

		// The microservice takes -12:00 to +14:00 (the range of a WordPress timezone).
		$params['store_utc_offset_minutes'] = max( -720, min( 840, $minutes ) );
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
		$site_url      = rtgodam_get_request_site_origin( $request->get_param( 'site_url' ) );
		if ( '' === $site_url ) {
			return $this->site_origin_unavailable_response();
		}
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
			/**
			 * Fires before resolving job_id from attachment meta, so
			 * integrations that centralize media on another site can switch
			 * context first.
			 *
			 * @since 2.2.0
			 */
			do_action( 'rtgodam_before_attachment_lookup' );

			$job_id = (string) get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );
			if ( empty( $job_id ) ) {
				$job_id = (string) get_post_meta( $attachment_id, '_godam_original_id', true );
			}

			do_action( 'rtgodam_after_attachment_lookup' );
		}

		// site_url and account_token both come from this site (its origin and its
		// stored option), never from the request.
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
		// Single store currency: the service returns per-hotspot Direct revenue in
		// this currency (Woo layers only); other currencies are excluded, not
		// converted. Empty when WooCommerce is inactive, so the service omits it.
		$base_currency = get_option( 'woocommerce_currency', '' );
		if ( ! empty( $base_currency ) ) {
			$query_params['base_currency'] = $base_currency;
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

		$layer_analytics = $body['layer_analytics'] ?? array();
		if ( ! $this->can_view_store_data() ) {
			$layer_analytics = $this->video_data_in_layer_analytics( $layer_analytics );
		}

		return new WP_REST_Response(
			array(
				'status'          => 'success',
				'layer_analytics' => $layer_analytics,
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
	 * The analytics read routes are gated on `upload_files` (authors and above),
	 * but this still never leaks non-public pages (private, draft, pending,
	 * trashed) beyond what the caller may see: the real title/permalink is
	 * revealed only when the page is publicly viewable, or the caller can edit it.
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

			$placement_post = $placement_post_id ? get_post( $placement_post_id ) : null; // godam-coverage-ignore -- enrich_placements(): $placement_post_id is the host page a video was placed on, not an attachment ID.

			// A trashed post is treated as gone even for users who can edit it:
			// WordPress maps edit_post on a trashed post to its pre-trash status
			// (so current_user_can passes), but wp-admin/post.php refuses to open
			// it ("You cannot edit this item because it is in the Trash", HTTP
			// 409). Surfacing an Edit link would be a dead end, and the page is
			// unreachable for visitors, so it belongs in the deleted state.
			$is_trashed  = $placement_post && 'trash' === $placement_post->post_status;
			$can_edit    = $placement_post && ! $is_trashed && current_user_can( 'edit_post', $placement_post_id ); // godam-coverage-ignore -- enrich_placements(): checks edit capability on $placement_post_id, the host page a video was placed on, not an attachment ID (see get_post() above).
			$is_viewable = $placement_post && ! $is_trashed && is_post_publicly_viewable( $placement_post );
			$edit_url    = $can_edit ? get_edit_post_link( $placement_post_id, 'raw' ) : null;

			if ( $is_viewable ) {
				// Public page: reveal title, permalink and (if capable) an edit link.
				$permalink = get_permalink( $placement_post );

				$placements[ $index ]['title']      = get_the_title( $placement_post ); // godam-coverage-ignore -- enrich_placements(): $placement_post is the host page a video was placed on, not an attachment (see get_post() above).
				$placements[ $index ]['permalink']  = $permalink ? $permalink : null;
				$placements[ $index ]['edit_url']   = $edit_url ? $edit_url : null;
				$placements[ $index ]['is_deleted'] = false;
			} elseif ( $can_edit ) {
				// Not public (private/draft/pending), but this user may edit it:
				// show the real title + an Edit link, without a public permalink.
				$placements[ $index ]['title']      = get_the_title( $placement_post ); // godam-coverage-ignore -- enrich_placements(): $placement_post is the host page a video was placed on, not an attachment (see get_post() above).
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
		$site_url = rtgodam_get_request_site_origin( $request->get_param( 'site_url' ) );
		if ( '' === $site_url ) {
			return $this->site_origin_unavailable_response();
		}

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
		$query_params = $this->append_store_offset_param( $query_params );

		// Single store currency: pass the store base currency so the per-video
		// record carries base-currency revenue (and a count of orders in other
		// currencies). Only when WooCommerce is active; otherwise the service
		// returns revenue 0 / '' and the card stays hidden.
		$base_currency = get_option( 'woocommerce_currency', '' );
		if ( ! empty( $base_currency ) ) {
			$query_params['base_currency'] = $base_currency;
		}

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
			if ( ! $this->can_view_store_data() && is_array( $data['processed_analytics'] ) ) {
				$data['processed_analytics'] = $this->video_data_in_video_record( $data['processed_analytics'] );
			}

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
				$posts = get_posts( // godam-coverage-ignore -- fetch_analytics_data(): $post_ids are HOST post IDs (post_type "any") from the external microservice's per-page view-count data, not attachment IDs — same host-page pattern as enrich_placements() above.
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
							'title' => get_the_title( $post ), // godam-coverage-ignore -- fetch_analytics_data(): $post comes from $post_ids above, HOST post IDs (post_type "any"), not attachment IDs (see get_posts() above).
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
		$days     = $request->get_param( 'days' );
		$video_id = $request->get_param( 'video_id' );
		$site_url = rtgodam_get_request_site_origin( $request->get_param( 'site_url' ) );
		if ( '' === $site_url ) {
			return $this->site_origin_unavailable_response();
		}
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
		$site_url = rtgodam_get_request_site_origin( $request->get_param( 'site_url' ) );
		if ( '' === $site_url ) {
			return $this->site_origin_unavailable_response();
		}
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

		$params = $this->append_range_params(
			$request,
			array(
				'site_url'      => $site_url,
				'account_token' => $account_token,
				'api_key'       => $api_key,
			)
		);
		$params = $this->append_store_offset_param( $params );
		// Single store currency: pass the store base currency so the service returns
		// base-currency revenue plus a count of orders in other currencies (not
		// converted). Only meaningful when WooCommerce is active; when absent the
		// service simply omits the `revenue` object.
		$base_currency = get_option( 'woocommerce_currency', '' );
		if ( ! empty( $base_currency ) ) {
			$params['base_currency'] = $base_currency;
		}
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

		$dashboard_metrics = array_merge( $empty_metrics, $body['dashboard_metrics'] ?? array() );
		if ( ! $this->can_view_store_data() ) {
			$dashboard_metrics = $this->video_data_in_dashboard_metrics( $dashboard_metrics );
		}

		return new WP_REST_Response(
			array(
				'status'            => 'success',
				'dashboard_metrics' => $dashboard_metrics,
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
		$days     = $request->get_param( 'days' );
		$site_url = rtgodam_get_request_site_origin( $request->get_param( 'site_url' ) );
		if ( '' === $site_url ) {
			return $this->site_origin_unavailable_response();
		}
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

		$code = (int) wp_remote_retrieve_response_code( $response );
		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		// An error status, or a body without the history, is a failed call, not an empty history.
		if ( $code < 200 || $code >= 300 || ! is_array( $body ) || ! isset( $body['dashboard_metrics_history'] ) ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'errorType' => 'microservice_error',
					'message'   => __( 'Could not load the analytics history.', 'godam' ),
				),
				200
			);
		}

		return new WP_REST_Response(
			array(
				'status'                    => 'success',
				'dashboard_metrics_history' => is_array( $body['dashboard_metrics_history'] ) ? $body['dashboard_metrics_history'] : array(),
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
		$page     = $request->get_param( 'page' ) ?? 1;
		$limit    = $request->get_param( 'limit' ) ?? 10;
		$site_url = rtgodam_get_request_site_origin( $request->get_param( 'site_url' ) );
		if ( '' === $site_url ) {
			return $this->site_origin_unavailable_response();
		}
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

		$http_code = (int) wp_remote_retrieve_response_code( $response );
		$body      = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( 200 !== $http_code || ! is_array( $body ) ) {
			// Surface a non-2xx OR a 200-with-unparseable-body (e.g. an HTML error
			// page that decodes to null) as an error rather than an empty "no data"
			// table (mirrors fetch_layer_analytics / fetch_placement_funnels).
			$detail = ( is_array( $body ) && isset( $body['detail'] ) )
				? $body['detail']
				: __( 'Unexpected error from analytics server.', 'godam' );
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => $detail,
					'errorType' => 400 === $http_code ? 'bad_request' : 'microservice_error',
				),
				200
			);
		}

		$top_videos = is_array( $body ) ? ( $body['top_videos'] ?? array() ) : array();

		/**
		 * Fires before enriching each top-video row with local attachment
		 * data, so integrations that centralize media on another site can
		 * switch context first.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );

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

		/**
		 * Fires after enriching top-video rows, so integrations can restore
		 * the site context switched in `rtgodam_before_attachment_lookup`.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_after_attachment_lookup' );

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

		do_action( 'rtgodam_before_attachment_lookup' );
		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.get_posts_get_posts -- bounded, `suppress_filters => false` (cacheable), and the common no-search case is transient-cached; matches the existing convention in this class.
		$ids = array_map( 'intval', (array) get_posts( $query_args ) );
		do_action( 'rtgodam_after_attachment_lookup' );

		if ( $is_full_set ) {
			set_transient( $cache_key, $ids, 5 * MINUTE_IN_SECONDS );
		}

		return $ids;
	}

	/**
	 * Proxy the per-placement funnel (the "Funnel by placement" card) from the
	 * analytics microservice. Account-scoped server-side (api_key / account_token
	 * injected, never client-supplied); the selected date range is forwarded.
	 *
	 * @param WP_REST_Request $request REST API request.
	 * @return WP_REST_Response
	 */
	public function fetch_placement_funnels( WP_REST_Request $request ) {
		$site_url = rtgodam_get_request_site_origin( $request->get_param( 'site_url' ) );
		if ( '' === $site_url ) {
			return $this->site_origin_unavailable_response();
		}
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
		$params   = $this->append_store_offset_param( $params );
		$endpoint = add_query_arg(
			$params,
			RTGODAM_ANALYTICS_BASE . '/dashboard/placement-funnels/'
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

		if ( 200 !== $http_code || ! is_array( $body ) ) {
			$detail = ( is_array( $body ) && isset( $body['detail'] ) ) ? $body['detail'] : __( 'Unexpected error from analytics server.', 'godam' );
			return new WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => $detail,
				),
				200
			);
		}

		return new WP_REST_Response(
			array(
				'placement_funnels' => $body['placement_funnels'] ?? array(),
			),
			200
		);
	}

	/**
	 * Video-Attributed Revenue card data, scoped to the card's own date range.
	 *
	 * Base-currency revenue with the Direct / Assisted split and the Influenced
	 * figure. Standalone from the Insights metrics so the card carries its own
	 * range picker; the store base currency is injected server-side.
	 *
	 * @param WP_REST_Request $request The request.
	 * @return WP_REST_Response
	 */
	public function fetch_revenue_summary( WP_REST_Request $request ) {
		$site_url = rtgodam_get_request_site_origin( $request->get_param( 'site_url' ) );
		if ( '' === $site_url ) {
			return $this->site_origin_unavailable_response();
		}
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

		$params = $this->append_range_params(
			$request,
			array(
				'site_url'      => $site_url,
				'account_token' => $account_token,
				'api_key'       => $api_key,
			)
		);
		// Single store currency: pass the base currency so the service sums only it
		// and counts the rest as excluded. Absent (no WooCommerce) -> the service
		// returns revenue null and the card hides.
		$base_currency = get_option( 'woocommerce_currency', '' );
		if ( ! empty( $base_currency ) ) {
			$params['base_currency'] = $base_currency;
		}
		$endpoint = add_query_arg(
			$params,
			RTGODAM_ANALYTICS_BASE . '/dashboard/revenue-summary/'
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

		if ( 200 !== $http_code || ! is_array( $body ) ) {
			$detail = ( is_array( $body ) && isset( $body['detail'] ) ) ? $body['detail'] : __( 'Unexpected error from analytics server.', 'godam' );
			return new WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => $detail,
				),
				200
			);
		}

		return new WP_REST_Response(
			array(
				'revenue' => $body['revenue'] ?? null,
			),
			200
		);
	}

	/**
	 * Purchase Funnel card data, scoped to the card's own date range.
	 *
	 * The account-wide Play to Cart to Purchase funnel (nested cohorts, Direct /
	 * Assisted split within the added stage). Standalone so the card carries its
	 * own range picker.
	 *
	 * @param WP_REST_Request $request The request.
	 * @return WP_REST_Response
	 */
	public function fetch_video_funnel( WP_REST_Request $request ) {
		$site_url = rtgodam_get_request_site_origin( $request->get_param( 'site_url' ) );
		if ( '' === $site_url ) {
			return $this->site_origin_unavailable_response();
		}
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
		$params   = $this->append_store_offset_param( $params );
		$endpoint = add_query_arg(
			$params,
			RTGODAM_ANALYTICS_BASE . '/dashboard/video-funnel/'
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

		if ( 200 !== $http_code || ! is_array( $body ) ) {
			$detail = ( is_array( $body ) && isset( $body['detail'] ) ) ? $body['detail'] : __( 'Unexpected error from analytics server.', 'godam' );
			return new WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => $detail,
				),
				200
			);
		}

		return new WP_REST_Response(
			array(
				'video_funnel' => $body['video_funnel'] ?? null,
			),
			200
		);
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
		$page     = $request->get_param( 'page' ) ?? 1;
		$limit    = $request->get_param( 'limit' ) ?? 10;
		$site_url = rtgodam_get_request_site_origin( $request->get_param( 'site_url' ) );
		if ( '' === $site_url ) {
			return $this->site_origin_unavailable_response();
		}
		$search        = trim( (string) $request->get_param( 'search' ) );
		$sort_by       = $request->get_param( 'sort_by' );
		$order         = $request->get_param( 'order' );
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

		// Product-name search and hide-deleted are WordPress-only concerns (titles
		// and deletion state live in WP, not the microservice). Resolve them into
		// the microservice's product_ids include-filter. null => no restriction;
		// an array (including []) => restrict to that set ([] yields zero rows).
		$product_ids = $this->resolve_top_products_id_filter( $search, $hide_deleted );

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
		// Single store currency: revenue/orders sum only the base currency.
		$base_currency = get_option( 'woocommerce_currency', '' );
		if ( ! empty( $base_currency ) ) {
			$query['base_currency'] = $base_currency;
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

		$http_code = (int) wp_remote_retrieve_response_code( $response );
		$body      = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( 200 !== $http_code || ! is_array( $body ) ) {
			// A non-2xx (bad request, service down, HTML error page) or a
			// 200-with-unparseable-body (decodes to null) must NOT be rendered as an
			// empty "no product activity" table. Surface it as an error so the
			// frontend RTK Query layer can show it, mirroring fetch_layer_analytics /
			// fetch_placement_funnels.
			$detail = ( is_array( $body ) && isset( $body['detail'] ) )
				? $body['detail']
				: __( 'Unexpected error from analytics server.', 'godam' );
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => $detail,
					'errorType' => 400 === $http_code ? 'bad_request' : 'microservice_error',
				),
				200
			);
		}

		$top_products = is_array( $body ) ? ( $body['top_products'] ?? array() ) : array();

		// Products, their permalinks and the WooCommerce placeholder image live on
		// this site, so they are looked up here, OUTSIDE the attachment-lookup
		// context below: a media-centralizing plugin switches to the media site
		// inside it, where these products don't exist. Each product's image id is
		// kept for the thumbnail pass.
		$thumbnail_ids = array();

		foreach ( $top_products as $index => &$product ) {
			$product_id = intval( $product['product_id'] ?? 0 );
			$wc_product = ( $product_id && function_exists( 'wc_get_product' ) ) ? wc_get_product( $product_id ) : false;

			if ( $wc_product ) {
				$image_id                 = $wc_product->get_image_id();
				$product['title']         = $wc_product->get_name();
				$product['permalink']     = get_permalink( $product_id );
				$product['thumbnail_url'] = $image_id
					? null // Resolved from the attachment in the thumbnail pass below.
					: ( function_exists( 'wc_placeholder_img_src' ) ? wc_placeholder_img_src( 'thumbnail' ) : null );
				$product['exists']        = true;
				// Whether the product can be added to cart from inside a video. Variable,
				// grouped and external products cannot (they only convert on the product
				// page), so their in-video/Direct count is always 0 and the UI greys it
				// with a helper. Mirrors the shoppable template's own guard.
				$product['supports_direct_add_to_cart'] = ! in_array(
					$wc_product->get_type(),
					array( 'variable', 'grouped', 'external' ),
					true
				);
				// The type itself lets the UI say why a grouped or external product
				// has no adds or revenue at all: neither ever reaches this store's cart.
				$product['product_type'] = $wc_product->get_type();

				if ( $image_id ) {
					$thumbnail_ids[ $index ] = $image_id;
				}
			} else {
				$product['title'] = sprintf(
					/* translators: %d: WooCommerce product ID. */
					__( 'ID: %d (Deleted Product)', 'godam' ),
					$product_id
				);
				$product['permalink']     = null;
				$product['thumbnail_url'] = null;
				$product['exists']        = false;
				// Unknown for a deleted product; default to true so we don't grey it.
				$product['supports_direct_add_to_cart'] = true;
				$product['product_type']                = null;
			}
		}
		unset( $product );

		// Product thumbnails are media-library attachments, so only these
		// wp_get_attachment_image_url() calls run inside the centralized
		// attachment-lookup context (offloaded/CDN media resolve there). Wrapped
		// once around the whole loop, mirroring the Top Videos thumbnail loop,
		// rather than switching context per product.
		do_action( 'rtgodam_before_attachment_lookup' );

		foreach ( $thumbnail_ids as $index => $image_id ) {
			$top_products[ $index ]['thumbnail_url'] = wp_get_attachment_image_url( $image_id, 'thumbnail' );
		}

		do_action( 'rtgodam_after_attachment_lookup' );

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
	 * Resolve the product_ids include-filter for a product-name search and/or the
	 * hide-deleted toggle.
	 *
	 * Product names and deletion state live in WooCommerce, not the microservice,
	 * so both concerns are turned into an explicit list of product IDs for the
	 * microservice to filter on. Returns null when neither is active (no
	 * restriction); an array (including []) restricts to that set. Mirrors
	 * resolve_top_videos_id_filter so pagination stays correct (the set is
	 * restricted before the microservice paginates, never filtered after).
	 *
	 * @param string $search       Search term, matched against the product title/content.
	 * @param bool   $hide_deleted Whether to restrict to existing (published) products.
	 * @return array|null Product IDs, or null when no restriction applies.
	 */
	private function resolve_top_products_id_filter( $search, $hide_deleted ) {
		$has_search = ( '' !== (string) $search );

		// Neither concern active => let the microservice return everything
		// (deleted rows are still flagged "Deleted Product" during hydration).
		if ( ! $has_search && ! $hide_deleted ) {
			return null;
		}

		// The default the UI sends on every load / page change is no-search +
		// hide-deleted, which resolves to the full set of published product IDs —
		// that set rarely changes, so cache it briefly to avoid re-querying a large
		// catalog on each request. (Up to 5 min stale, which is fine for analytics —
		// it isn't real-time.) Search results vary per term, so they're not cached.
		$cache_key   = 'rtgodam_top_products_existing_ids';
		$is_full_set = ( ! $has_search && $hide_deleted );
		if ( $is_full_set ) {
			$cached = get_transient( $cache_key );
			if ( is_array( $cached ) ) {
				return $cached;
			}
		}

		// Existing published products, optionally matching the search term. Capped
		// at the microservice's product_ids limit (10000).
		$query_args = array(
			'post_type'        => 'product',
			'post_status'      => 'publish',
			'fields'           => 'ids',
			// phpcs:ignore WordPress.WP.PostsPerPage.posts_per_page_posts_per_page -- bounded by the microservice's 10000 product_ids cap, and the common no-search case is transient-cached below.
			'posts_per_page'   => 10000,
			'no_found_rows'    => true,
			'suppress_filters' => false,
			'orderby'          => 'ID',
			'order'            => 'ASC',
		);

		if ( $has_search ) {
			$query_args['s'] = $search;
		}

		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.get_posts_get_posts -- bounded and cacheable (suppress_filters => false); matches resolve_top_videos_id_filter in this class.
		$ids = array_map( 'intval', (array) get_posts( $query_args ) );

		if ( $is_full_set ) {
			set_transient( $cache_key, $ids, 5 * MINUTE_IN_SECONDS );
		}

		return $ids;
	}
}
