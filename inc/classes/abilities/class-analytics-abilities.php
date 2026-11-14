<?php
/**
 * Abilities for video performance and account usage.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Abilities;

defined( 'ABSPATH' ) || exit;

/**
 * Class Analytics_Abilities
 *
 * Playback analytics are recorded and served by this site's analytics routes,
 * not by GoDAM's account API, so these abilities read them through those
 * routes, and each ability asks for the same capability as its route.
 *
 * The routes report an unconnected site or an unreachable analytics service as
 * a successful response with `status: error`; insights() turns that into an
 * error the agent can act on rather than data.
 *
 * @since n.e.x.t
 */
class Analytics_Abilities extends Ability_Group {

	/**
	 * Registers this group's abilities.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function register() {
		$this->add(
			'godam/get-media-analytics',
			array(
				'label'               => __( 'Get video analytics', 'godam' ),
				'description'         => __( 'Playback analytics for one video: plays, watch time, engagement and play rate.', 'godam' ),
				'category'            => 'godam-analytics',
				'input_schema'        => $this->media_id_input(),
				'output_schema'       => array( 'type' => 'object' ),
				'execute_callback'    => array( $this, 'get_media_analytics' ),
				'permission_callback' => array( $this, 'can_read_analytics' ),
			)
		);

		$this->add(
			'godam/get-top-videos',
			array(
				'label'               => __( 'Get top videos', 'godam' ),
				'description'         => __( 'The best-performing videos on this site, ranked by plays.', 'godam' ),
				'category'            => 'godam-analytics',
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'limit' => array(
							'type'    => 'integer',
							'minimum' => 1,
							'maximum' => 50,
							'default' => 10,
						),
						'page'  => array(
							'type'    => 'integer',
							'minimum' => 1,
							'default' => 1,
						),
					),
				),
				'output_schema'       => array( 'type' => 'object' ),
				'execute_callback'    => array( $this, 'get_top_videos' ),
				'permission_callback' => array( $this, 'can_read_dashboard' ),
			)
		);

		$this->add(
			'godam/get-storage-usage',
			array(
				'label'               => __( 'Get storage and bandwidth usage', 'godam' ),
				'description'         => __( 'Storage and bandwidth used against the GoDAM plan\'s limits, in GB. Check before large uploads or bulk retranscodes.', 'godam' ),
				'category'            => 'godam-analytics',
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'unit' => array(
							'type'    => 'string',
							'enum'    => array( 'GB' ),
							'default' => 'GB',
						),
					),
				),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'storage_used'    => array( 'type' => 'number' ),
						'total_storage'   => array( 'type' => 'number' ),
						'bandwidth_used'  => array( 'type' => 'number' ),
						'total_bandwidth' => array( 'type' => 'number' ),
					),
				),
				'execute_callback'    => array( $this, 'get_storage_usage' ),
				'permission_callback' => array( $this, 'can_manage_account' ),
			)
		);

		$this->add(
			'godam/get-layer-analytics',
			array(
				'label'               => __( 'Get layer analytics', 'godam' ),
				'description'         => __( 'How viewers interacted with one type of layer on a video: views, clicks, submissions or votes per layer. Layer types: cta, form, hotspot, woo (product hotspots) and poll.', 'godam' ),
				'category'            => 'godam-analytics',
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array_merge(
						array(
							'id'         => array(
								'type'        => 'integer',
								'minimum'     => 1,
								'description' => __( 'Media (attachment) ID of the video.', 'godam' ),
							),
							'layer_type' => array(
								'type' => 'string',
								'enum' => array( 'cta', 'form', 'hotspot', 'woo', 'poll' ),
							),
							'days'       => array(
								'type'        => 'integer',
								'minimum'     => 1,
								'description' => __( 'Only the last this many days. Ignored when start_date and end_date are given.', 'godam' ),
							),
						),
						$this->date_range_properties()
					),
					'required'   => array( 'id', 'layer_type' ),
				),
				'output_schema'       => array( 'type' => 'object' ),
				'execute_callback'    => array( $this, 'get_layer_analytics' ),
				'permission_callback' => array( $this, 'can_read_video_analytics' ),
			)
		);

		$this->add(
			'godam/get-video-funnel',
			array(
				'label'               => __( 'Get video-to-purchase funnel', 'godam' ),
				'description'         => __( 'The store-wide funnel from video views to product views, add-to-carts and purchases. Store data: needs WooCommerce\'s report permission.', 'godam' ),
				'category'            => 'godam-analytics',
				'input_schema'        => $this->date_range_input(),
				'output_schema'       => array( 'type' => 'object' ),
				'execute_callback'    => array( $this, 'get_video_funnel' ),
				'permission_callback' => array( $this, 'can_read_store_insights' ),
			)
		);

		$this->add(
			'godam/get-placement-performance',
			array(
				'label'               => __( 'Get placement performance', 'godam' ),
				'description'         => __( 'The video-to-purchase funnel for each place videos appear in the store, such as product pages and shop pages, to compare placements. Store data: needs WooCommerce\'s report permission.', 'godam' ),
				'category'            => 'godam-analytics',
				'input_schema'        => $this->date_range_input(),
				'output_schema'       => array( 'type' => 'object' ),
				'execute_callback'    => array( $this, 'get_placement_performance' ),
				'permission_callback' => array( $this, 'can_read_store_insights' ),
			)
		);

		$this->add(
			'godam/get-revenue-summary',
			array(
				'label'               => __( 'Get video-attributed revenue', 'godam' ),
				'description'         => __( 'Revenue attributed to videos in the store\'s base currency, split into direct and assisted, with the influenced figure. Counted before refunds. Store data: needs WooCommerce\'s report permission.', 'godam' ),
				'category'            => 'godam-analytics',
				'input_schema'        => $this->date_range_input(),
				'output_schema'       => array( 'type' => 'object' ),
				'execute_callback'    => array( $this, 'get_revenue_summary' ),
				'permission_callback' => array( $this, 'can_read_store_insights' ),
			)
		);

		$this->add(
			'godam/get-top-products',
			array(
				'label'               => __( 'Get top products from video', 'godam' ),
				'description'         => __( 'Products ranked by how video drives them: product views, add-to-carts, impressions or click-through rate. Store data: needs WooCommerce\'s report permission.', 'godam' ),
				'category'            => 'godam-analytics',
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array_merge(
						array(
							'sort_by'      => array(
								'type'    => 'string',
								'enum'    => array( 'product_views', 'add_to_cart', 'impressions', 'ctr' ),
								'default' => 'product_views',
							),
							'order'        => array(
								'type'    => 'string',
								'enum'    => array( 'asc', 'desc' ),
								'default' => 'desc',
							),
							'search'       => array(
								'type'        => 'string',
								'description' => __( 'Only products whose name contains this text.', 'godam' ),
							),
							'hide_deleted' => array(
								'type'        => 'boolean',
								'default'     => false,
								'description' => __( 'Leave out products deleted from the store.', 'godam' ),
							),
							'limit'        => array(
								'type'    => 'integer',
								'minimum' => 1,
								'maximum' => 50,
								'default' => 10,
							),
							'page'         => array(
								'type'    => 'integer',
								'minimum' => 1,
								'default' => 1,
							),
						),
						$this->date_range_properties()
					),
				),
				'output_schema'       => array( 'type' => 'object' ),
				'execute_callback'    => array( $this, 'get_top_products' ),
				'permission_callback' => array( $this, 'can_read_store_insights' ),
			)
		);
	}

	/**
	 * Input properties for an optional date range, as the analytics routes take it.
	 *
	 * @since n.e.x.t
	 *
	 * @return array
	 */
	private function date_range_properties() {
		return array(
			'start_date' => array(
				'type'        => 'string',
				'format'      => 'date',
				'description' => __( 'First day to include, YYYY-MM-DD. Give with end_date; omit both for all time.', 'godam' ),
			),
			'end_date'   => array(
				'type'        => 'string',
				'format'      => 'date',
				'description' => __( 'Last day to include, YYYY-MM-DD.', 'godam' ),
			),
		);
	}

	/**
	 * Input schema for abilities that take only a date range.
	 *
	 * @since n.e.x.t
	 *
	 * @return array
	 */
	private function date_range_input() {
		return array(
			'type'       => 'object',
			'properties' => $this->date_range_properties(),
		);
	}

	/**
	 * Permission: matches the analytics fetch route, which then checks the video.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool
	 */
	public function can_read_analytics() {
		return current_user_can( 'upload_files' );
	}

	/**
	 * Permission: matches the analytics dashboard routes.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool
	 */
	public function can_read_dashboard() {
		return current_user_can( 'edit_pages' );
	}

	/**
	 * Permission: matches the layer-analytics route, which reads one video's
	 * analytics for a user who can edit that video.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return bool
	 */
	public function can_read_video_analytics( $input = array() ) {
		return current_user_can( 'upload_files' ) && $this->can_edit_media( $input );
	}

	/**
	 * Permission: matches the store-data dashboard routes. They need the
	 * dashboard's capability and WooCommerce's report permission, which
	 * WooCommerce gives shop managers and administrators.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool
	 */
	public function can_read_store_insights() {
		return current_user_can( 'edit_pages' ) && current_user_can( 'view_woocommerce_reports' ); // phpcs:ignore WordPress.WP.Capabilities.Unknown -- WooCommerce registers this capability itself.
	}

	/**
	 * Permission: account usage is a billing concern, so administrators only.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool
	 */
	public function can_manage_account() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Executes godam/get-media-analytics.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function get_media_analytics( $input = array() ) {
		$post = $this->get_attachment( $input['id'] ?? 0 );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		$data = $this->insights( '/godam/v1/analytics/fetch', array( 'video_id' => $post->ID ), array() );

		if ( is_wp_error( $data ) ) {
			return $data;
		}

		return array(
			'media_id'  => $post->ID,
			'title'     => $this->plain_title( $post ),
			'analytics' => $data,
		);
	}

	/**
	 * Executes godam/get-top-videos.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function get_top_videos( $input = array() ) {
		$data = $this->insights(
			'/godam/v1/analytics/top-videos',
			array(
				'limit' => (int) ( $input['limit'] ?? 10 ),
				'page'  => (int) ( $input['page'] ?? 1 ),
			),
			array()
		);

		return is_wp_error( $data ) ? $data : array( 'top_videos' => $data );
	}

	/**
	 * Executes godam/get-storage-usage.
	 *
	 * @since n.e.x.t
	 *
	 * @return array|\WP_Error
	 */
	public function get_storage_usage() {
		return rtgodam_get_usage_data();
	}

	/**
	 * Executes godam/get-layer-analytics.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function get_layer_analytics( $input = array() ) {
		$post = $this->get_attachment( $input['id'] ?? 0 );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		$params = array(
			'video_id'   => $post->ID,
			'layer_type' => $input['layer_type'] ?? '',
		);

		if ( ! empty( $input['days'] ) ) {
			$params['days'] = absint( $input['days'] );
		}

		$data = $this->insights( '/godam/v1/analytics/layer-analytics', $params, $input );

		if ( is_wp_error( $data ) ) {
			return $data;
		}

		return array(
			'media_id'   => $post->ID,
			'title'      => $this->plain_title( $post ),
			'layer_type' => $params['layer_type'],
			'analytics'  => $data,
		);
	}

	/**
	 * Executes godam/get-video-funnel.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function get_video_funnel( $input = array() ) {
		return $this->insights( '/godam/v1/analytics/video-funnel', array(), $input );
	}

	/**
	 * Executes godam/get-placement-performance.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function get_placement_performance( $input = array() ) {
		return $this->insights( '/godam/v1/analytics/placement-funnels', array(), $input );
	}

	/**
	 * Executes godam/get-revenue-summary.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function get_revenue_summary( $input = array() ) {
		return $this->insights( '/godam/v1/analytics/revenue-summary', array(), $input );
	}

	/**
	 * Executes godam/get-top-products.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function get_top_products( $input = array() ) {
		$params = array(
			'sort_by'      => $input['sort_by'] ?? 'product_views',
			'order'        => $input['order'] ?? 'desc',
			'hide_deleted' => ! empty( $input['hide_deleted'] ),
			'limit'        => (int) ( $input['limit'] ?? 10 ),
			'page'         => (int) ( $input['page'] ?? 1 ),
		);

		if ( ! empty( $input['search'] ) ) {
			$params['search'] = sanitize_text_field( $input['search'] );
		}

		return $this->insights( '/godam/v1/analytics/top-products', $params, $input );
	}

	/**
	 * Reads an analytics route, passing on an optional date range.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $route  Route.
	 * @param array  $params Route parameters.
	 * @param array  $input  Ability input, for start_date and end_date.
	 *
	 * @return array|\WP_Error
	 */
	private function insights( $route, array $params, $input ) {
		$input = (array) $input;

		if ( empty( $input['start_date'] ) !== empty( $input['end_date'] ) ) {
			return new \WP_Error( 'rtgodam_incomplete_date_range', __( 'Give both start_date and end_date, or neither for all time.', 'godam' ), array( 'status' => 400 ) );
		}

		if ( ! empty( $input['start_date'] ) ) {
			$params['start_date'] = $input['start_date'];
			$params['end_date']   = $input['end_date'];
		}

		$data = $this->rest( 'GET', $route, $params );

		if ( is_wp_error( $data ) ) {
			return $data;
		}

		if ( is_array( $data ) && 'error' === ( $data['status'] ?? '' ) ) {
			// top-products sends no errorType when the site is not connected.
			$type = ! empty( $data['errorType'] ) ? (string) $data['errorType'] : ( rtgodam_is_api_key_valid() ? 'unavailable' : 'missing_key' );

			return new \WP_Error(
				'rtgodam_analytics_' . $type,
				in_array( $type, array( 'missing_key', 'unverified_account' ), true )
					/* translators: %s: the analytics route's own message. */
					? sprintf( __( '%s Analytics need a GoDAM plan. Connect this site to GoDAM with a verified API key in GoDAM > Settings, then try again.', 'godam' ), $data['message'] ?? '' )
					/* translators: %s: the analytics route's own message. */
					: sprintf( __( '%s Try again in a moment. If it keeps failing, ask a site administrator to check the GoDAM connection in GoDAM > Settings.', 'godam' ), (string) ( $data['message'] ?? __( 'Analytics are unavailable right now.', 'godam' ) ) ),
				array( 'status' => 503 )
			);
		}

		return $data;
	}
}
