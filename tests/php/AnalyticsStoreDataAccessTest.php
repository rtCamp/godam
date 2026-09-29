<?php
/**
 * Unit tests for who gets store data from the analytics routes that mix it with
 * video data.
 *
 * Editors and authors see video data only. Everything that comes from the store
 * (products, add-to-carts, Video-to-Cart, orders, purchases and revenue) needs
 * WooCommerce's report permission, `view_woocommerce_reports`, held by shop
 * managers and administrators. Routes that are all store data refuse everyone
 * else (see AnalyticsRoutePermissionTest). The three routes that mix the two,
 * `dashboard-metrics`, `fetch` and `layer-analytics`, strip the store fields
 * from their responses for everyone else, so the numbers cannot be read through
 * the route even if the screen hides them. Views, plays, watch time and hotspot
 * clicks stay.
 *
 * Each test feeds a route a canned microservice reply that carries both kinds of
 * field (shaped like the analytics service's responses), calls it as an author,
 * an editor and a shop manager, and asserts on what comes back. "No store data"
 * is checked with a denylist written here, independently of the class under
 * test, that is walked through the whole response at every depth.
 *
 * The routes run on a constructor-less instance (Base's constructor registers WP
 * hooks we don't want here); the WP HTTP / REST surface is stubbed in
 * tests/bootstrap.php and tests/stubs/, and driven per-case via
 * $GLOBALS['rtgodam_stub'].
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Analytics;

require_once dirname( __DIR__ ) . '/stubs/product-lookup-functions.php';

/**
 * @covers \RTGODAM\Inc\REST_API\Analytics::can_view_store_data
 * @covers \RTGODAM\Inc\REST_API\Analytics::fetch_dashboard_metrics
 * @covers \RTGODAM\Inc\REST_API\Analytics::fetch_analytics_data
 * @covers \RTGODAM\Inc\REST_API\Analytics::fetch_layer_analytics
 * @covers \RTGODAM\Inc\REST_API\Analytics::fetch_revenue_summary
 * @covers \RTGODAM\Inc\REST_API\Analytics::fetch_video_funnel
 * @covers \RTGODAM\Inc\REST_API\Analytics::fetch_placement_funnels
 * @covers \RTGODAM\Inc\REST_API\Analytics::fetch_top_products
 */
class AnalyticsStoreDataAccessTest extends TestCase {

	/**
	 * An author: can upload files (Analytics page) but not open the Dashboard.
	 */
	const AUTHOR = array( 'read', 'edit_posts', 'upload_files' );

	/**
	 * An editor: can open the Dashboard, has no WooCommerce report permission.
	 */
	const EDITOR = array( 'read', 'edit_posts', 'upload_files', 'edit_pages' );

	/**
	 * A shop manager: an editor plus WooCommerce's report permission.
	 */
	const SHOP_MANAGER = array( 'read', 'edit_posts', 'upload_files', 'edit_pages', 'view_woocommerce_reports' );

	/**
	 * Keys that carry store data, at any depth of a response. Written out here on
	 * purpose (not read from the class) so the test fails if the class forgets one.
	 * `value:added_to_cart` stands for an add-to-cart counter row in a list of tuples.
	 */
	const STORE_KEYS = array(
		'added_to_cart',
		'value:added_to_cart',
		'video_to_cart',
		'video_funnel',
		'video_to_purchase',
		'revenue',
		'revenue_minor',
		'revenue_currency',
		'revenue_excluded_orders',
		'revenue_direct_minor',
		'revenue_assisted_minor',
		'revenue_tips',
		'orders',
		'currency',
		'purchases',
		'purchased',
	);

	/**
	 * A verified account on a WooCommerce store, and no stale HTTP fixtures.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_hooks']      = array();
		$GLOBALS['rtgodam_translated'] = array();
		$GLOBALS['rtgodam_stub']       = array(
			'options'  => array(
				'rtgodam-account-token' => 'verified-account',
				'rtgodam-api-key'       => 'test-key',
				'woocommerce_currency'  => 'USD',
			),
			'site'     => 'shop',
			'lookups'  => array(),
			'products' => array(
				11 => array(
					'name'     => 'Mug',
					'type'     => 'simple',
					'image_id' => 0,
				),
			),
		);
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		parent::tearDown();
	}

	/**
	 * Fake the microservice reply for the next route call.
	 *
	 * @param array $body Decoded JSON body.
	 */
	private function upstream_replies( array $body ) {
		$GLOBALS['rtgodam_stub']['http'] = array(
			'code' => 200,
			'body' => wp_json_encode( $body ),
		);
	}

	/**
	 * Call a route as a user holding the given capabilities.
	 *
	 * @param string $method Route callback name on the Analytics class.
	 * @param array  $params Request params.
	 * @param array  $caps   Capabilities the current user holds.
	 * @return array The response data.
	 */
	private function call_as( $method, array $params, array $caps ) {
		$GLOBALS['rtgodam_stub']['caps'] = $caps;

		$analytics = ( new \ReflectionClass( Analytics::class ) )->newInstanceWithoutConstructor();
		$response  = $analytics->$method( new \WP_REST_Request( $params ) );

		$this->assertInstanceOf( \WP_REST_Response::class, $response );
		return $response->get_data();
	}

	/**
	 * Collect every key that appears anywhere in a response, plus a
	 * `value:added_to_cart` marker for each add-to-cart counter row, so a leftover
	 * store field is found at any depth.
	 *
	 * @param mixed $data  Response fragment.
	 * @param array $found Keys found so far.
	 * @return string[]
	 */
	private function collect_keys( $data, array $found = array() ) {
		if ( ! is_array( $data ) ) {
			if ( 'added_to_cart' === $data ) {
				$found[] = 'value:added_to_cart';
			}
			return $found;
		}
		foreach ( $data as $key => $value ) {
			if ( is_string( $key ) ) {
				$found[] = $key;
			}
			$found = $this->collect_keys( $value, $found );
		}
		return $found;
	}

	/**
	 * Assert a response carries none of the store fields.
	 *
	 * @param mixed  $data    Response fragment.
	 * @param string $message Context for a failure.
	 */
	private function assertNoStoreData( $data, $message = '' ) {
		$leaked = array_values( array_unique( array_intersect( $this->collect_keys( $data ), self::STORE_KEYS ) ) );
		$this->assertSame( array(), $leaked, $message . ' leaked store fields' );
	}

	/**
	 * Assert a response still carries a key somewhere (so a strip that empties
	 * the whole response cannot pass as "no store data").
	 *
	 * @param mixed  $data Response fragment.
	 * @param string $key  Key expected to survive.
	 */
	private function assertKeepsKey( $data, $key ) {
		$this->assertContains( $key, $this->collect_keys( $data ), "expected '$key' to stay in the response" );
	}

	/**
	 * A Play to Cart to Purchase funnel payload, as the service builds it.
	 *
	 * @return array
	 */
	private function funnel_payload() {
		return array(
			'stages'         => array(
				array(
					'key'   => 'played',
					'count' => 80,
					'rate'  => 100.0,
				),
				array(
					'key'      => 'added_to_cart',
					'count'    => 9,
					'rate'     => 11.25,
					'direct'   => 6,
					'assisted' => 4,
				),
				array(
					'key'      => 'purchased',
					'count'    => 3,
					'rate'     => 3.75,
					'direct'   => 2,
					'assisted' => 1,
				),
			),
			'still_counting' => true,
		);
	}

	/**
	 * A Video-to-Cart payload.
	 *
	 * @return array
	 */
	private function video_to_cart_payload() {
		return array(
			'played'   => 80,
			'carts'    => 9,
			'direct'   => 6,
			'assisted' => 4,
			'rate'     => 11.25,
		);
	}

	/**
	 * A revenue object as the service builds it for the dashboard.
	 *
	 * @return array
	 */
	private function revenue_payload() {
		return array(
			'revenue_minor'    => 12345,
			'currency'         => 'USD',
			'excluded_orders'  => 0,
			'direct_minor'     => 10000,
			'assisted_minor'   => 2345,
			'influenced_minor' => 0,
			'change'           => 1.5,
		);
	}

	/**
	 * Dashboard metrics: an editor keeps plays and viewers and loses every store
	 * section, including the "unavailable" notes for cards they never see.
	 */
	public function test_dashboard_metrics_for_an_editor_has_video_data_only() {
		$this->upstream_replies(
			array(
				'dashboard_metrics' => array(
					'plays'                => 120,
					'unique_viewers'       => 80,
					'total_videos'         => 3,
					'video_to_cart'        => $this->video_to_cart_payload(),
					'video_to_purchase'    => array(
						'played'    => 80,
						'purchases' => 3,
						'rate'      => 3.75,
					),
					'video_funnel'         => $this->funnel_payload(),
					'revenue'              => $this->revenue_payload(),
					'unavailable_sections' => array( 'unique_viewers', 'video_to_cart', 'video_to_purchase', 'video_funnel', 'revenue' ),
				),
			)
		);

		$data = $this->call_as( 'fetch_dashboard_metrics', array( 'site_url' => 'https://shop.test' ), self::EDITOR );

		$this->assertSame( 'success', $data['status'] );
		$metrics = $data['dashboard_metrics'];
		$this->assertNoStoreData( $metrics, 'dashboard-metrics' );
		$this->assertSame( 120, $metrics['plays'] );
		$this->assertSame( 80, $metrics['unique_viewers'] );
		$this->assertSame( 3, $metrics['total_videos'] );
		$this->assertSame( array( 'unique_viewers' ), $metrics['unavailable_sections'], 'only the video section note stays' );
	}

	/**
	 * Dashboard metrics: a shop manager gets every field.
	 */
	public function test_dashboard_metrics_for_a_shop_manager_has_everything() {
		$this->upstream_replies(
			array(
				'dashboard_metrics' => array(
					'plays'                => 120,
					'video_to_cart'        => $this->video_to_cart_payload(),
					'video_to_purchase'    => array(
						'played'    => 80,
						'purchases' => 3,
						'rate'      => 3.75,
					),
					'video_funnel'         => $this->funnel_payload(),
					'revenue'              => $this->revenue_payload(),
					'unavailable_sections' => array( 'revenue', 'video_to_cart' ),
				),
			)
		);

		$metrics = $this->call_as( 'fetch_dashboard_metrics', array( 'site_url' => 'https://shop.test' ), self::SHOP_MANAGER )['dashboard_metrics'];

		$this->assertSame( 9, $metrics['video_to_cart']['carts'] );
		$this->assertSame( 12345, $metrics['revenue']['revenue_minor'] );
		$this->assertSame( 3, $metrics['video_to_purchase']['purchases'] );
		$this->assertCount( 3, $metrics['video_funnel']['stages'] );
		$this->assertSame( array( 'revenue', 'video_to_cart' ), $metrics['unavailable_sections'] );
	}

	/**
	 * A per-video record as the service builds it, with every store field. The
	 * counter lists use the service's tuple shape: [ layer_type, action_type, count ]
	 * and [ layer_id, name, layer_type, action_type, count, timestamp, ... ].
	 *
	 * @return array
	 */
	private function video_record() {
		return array(
			'video_id'                => 55,
			'plays'                   => 70,
			'page_load'               => 200,
			'play_time'               => 640.5,
			'unique_viewers'          => 60,
			'post_views'              => array(),
			'layer_type_stats'        => array(
				array( 'woo', 'clicked', 3 ),
				array( 'woo', 'added_to_cart', 3 ),
			),
			'layer_details'           => array(
				array( 'l1::p11', '', 'woo', 'viewed', 4, 5, '', '' ),
				array( 'l1::p11', '', 'woo', 'clicked', 3, 5, '', '' ),
				array( 'l1::p11', '', 'woo', 'added_to_cart', 3, 5, '', '' ),
			),
			'video_to_cart'           => $this->video_to_cart_payload(),
			'video_to_purchase'       => array(
				'played'    => 60,
				'purchases' => 2,
				'rate'      => 3.33,
			),
			'video_funnel'            => $this->funnel_payload(),
			'revenue'                 => 8800,
			'revenue_currency'        => 'USD',
			'revenue_excluded_orders' => 1,
			'revenue_direct_minor'    => 8000,
			'revenue_assisted_minor'  => 800,
			'revenue_tips'            => array(
				'aov_favourable'  => true,
				'video_aov_minor' => 4400,
				'store_aov_minor' => 3000,
				'currency'        => 'USD',
			),
		);
	}

	/**
	 * Per-video analytics: an editor and an author keep plays, watch time and the
	 * layer views and clicks; every store field and every add-to-cart row goes.
	 */
	public function test_per_video_analytics_for_editor_and_author_has_video_data_only() {
		foreach (
			array(
				'editor' => self::EDITOR,
				'author' => self::AUTHOR,
			) as $role => $caps
		) {
			$this->upstream_replies( array( 'processed_analytics' => $this->video_record() ) );

			$data = $this->call_as(
				'fetch_analytics_data',
				array(
					'video_id' => 55,
					'site_url' => 'https://shop.test',
				),
				$caps
			);

			$this->assertSame( 'success', $data['status'], $role );
			$this->assertNoStoreData( $data['data'], "fetch as $role" );
			$this->assertSame( 70, $data['data']['plays'], $role );
			$this->assertSame( 640.5, $data['data']['play_time'], $role );
			$this->assertSame( 200, $data['data']['page_load'], $role );
			$this->assertSame( array( array( 'woo', 'clicked', 3 ) ), $data['data']['layer_type_stats'], "$role keeps the click rows" );
			$this->assertCount( 2, $data['data']['layer_details'], "$role keeps the viewed and clicked rows" );
			$this->assertSame( 'viewed', $data['data']['layer_details'][0][3], $role );
			$this->assertArrayHasKey( 'post_details', $data['data'], "$role still gets the post details" );
		}
	}

	/**
	 * Per-video analytics: a shop manager gets every field.
	 */
	public function test_per_video_analytics_for_a_shop_manager_has_everything() {
		$this->upstream_replies( array( 'processed_analytics' => $this->video_record() ) );

		$data = $this->call_as(
			'fetch_analytics_data',
			array(
				'video_id' => 55,
				'site_url' => 'https://shop.test',
			),
			self::SHOP_MANAGER
		)['data'];

		foreach ( array_keys( $this->video_record() ) as $key ) {
			$this->assertArrayHasKey( $key, $data, "shop manager should get '$key'" );
		}
		$this->assertSame( 8800, $data['revenue'] );
		$this->assertSame( 9, $data['video_to_cart']['carts'] );
		$this->assertCount( 2, $data['layer_type_stats'] );
		$this->assertCount( 3, $data['layer_details'] );
	}

	/**
	 * A layer analytics payload with per-hotspot store figures on a Woo layer.
	 *
	 * @return array
	 */
	private function layer_analytics_payload() {
		return array(
			'layer_type'        => 'woo',
			'days'              => 30,
			'cumulative'        => array(
				'viewed'          => 100,
				'clicked'         => 20,
				'added_to_cart'   => 8,
				'conversion_rate' => 25.0,
			),
			'daily_breakdown'   => array(
				array(
					'date'          => '2026-09-29',
					'viewed'        => 100,
					'clicked'       => 20,
					'added_to_cart' => 8,
				),
			),
			'individual_layers' => array(
				array(
					'layer_id'        => 'l1::p11',
					'viewed'          => 50,
					'clicked'         => 10,
					'added_to_cart'   => 4,
					'conversion_rate' => 28.0,
					'revenue_minor'   => 500,
					'orders'          => 2,
					'currency'        => 'USD',
				),
				array(
					'layer_id'        => 'l1',
					'viewed'          => 50,
					'clicked'         => 10,
					'added_to_cart'   => 4,
					'conversion_rate' => 28.0,
					'revenue_minor'   => 0,
					'orders'          => 0,
					'currency'        => '',
				),
			),
		);
	}

	/**
	 * Layer analytics: an editor and an author keep viewed, clicked and the
	 * interaction rate per hotspot; the add-to-cart counter, revenue, orders and
	 * currency go, per layer, in the totals and per day.
	 */
	public function test_layer_analytics_for_editor_and_author_has_video_data_only() {
		foreach (
			array(
				'editor' => self::EDITOR,
				'author' => self::AUTHOR,
			) as $role => $caps
		) {
			$this->upstream_replies( array( 'layer_analytics' => $this->layer_analytics_payload() ) );

			$data = $this->call_as(
				'fetch_layer_analytics',
				array(
					'video_id'   => 55,
					'layer_type' => 'woo',
					'site_url'   => 'https://shop.test',
				),
				$caps
			);

			$this->assertSame( 'success', $data['status'], $role );
			$layer_analytics = $data['layer_analytics'];
			$this->assertNoStoreData( $layer_analytics, "layer-analytics as $role" );
			$this->assertCount( 2, $layer_analytics['individual_layers'], $role );
			$this->assertSame( 50, $layer_analytics['individual_layers'][0]['viewed'], $role );
			$this->assertSame( 10, $layer_analytics['individual_layers'][0]['clicked'], $role );
			$this->assertEquals( 28.0, $layer_analytics['individual_layers'][0]['conversion_rate'], $role );
			$this->assertSame( 20, $layer_analytics['cumulative']['clicked'], $role );
			$this->assertSame( 20, $layer_analytics['daily_breakdown'][0]['clicked'], $role );
		}
	}

	/**
	 * Layer analytics: a shop manager gets every field.
	 */
	public function test_layer_analytics_for_a_shop_manager_has_everything() {
		$this->upstream_replies( array( 'layer_analytics' => $this->layer_analytics_payload() ) );

		$layer_analytics = $this->call_as(
			'fetch_layer_analytics',
			array(
				'video_id'   => 55,
				'layer_type' => 'woo',
				'site_url'   => 'https://shop.test',
			),
			self::SHOP_MANAGER
		)['layer_analytics'];

		$this->assertSame( 4, $layer_analytics['individual_layers'][0]['added_to_cart'] );
		$this->assertSame( 500, $layer_analytics['individual_layers'][0]['revenue_minor'] );
		$this->assertSame( 2, $layer_analytics['individual_layers'][0]['orders'] );
		$this->assertSame( 'USD', $layer_analytics['individual_layers'][0]['currency'] );
		$this->assertSame( 8, $layer_analytics['cumulative']['added_to_cart'] );
		$this->assertSame( 8, $layer_analytics['daily_breakdown'][0]['added_to_cart'] );
	}

	/**
	 * The strip never empties a response: each mixed route still returns video
	 * data an editor can use, so an over-eager strip cannot pass as "no store data".
	 */
	public function test_editor_responses_keep_their_video_content() {
		$this->upstream_replies( array( 'processed_analytics' => $this->video_record() ) );
		$record = $this->call_as(
			'fetch_analytics_data',
			array(
				'video_id' => 55,
				'site_url' => 'https://shop.test',
			),
			self::EDITOR
		)['data'];
		$this->assertKeepsKey( $record, 'plays' );
		$this->assertKeepsKey( $record, 'layer_type_stats' );

		$this->upstream_replies( array( 'layer_analytics' => $this->layer_analytics_payload() ) );
		$layers = $this->call_as(
			'fetch_layer_analytics',
			array(
				'video_id'   => 55,
				'layer_type' => 'woo',
				'site_url'   => 'https://shop.test',
			),
			self::EDITOR
		)['layer_analytics'];
		$this->assertKeepsKey( $layers, 'individual_layers' );
		$this->assertKeepsKey( $layers, 'clicked' );
	}

	/**
	 * The four store-only routes are guarded by their permission, not by
	 * stripping: for the user who is allowed in, the response is the service's
	 * answer untouched.
	 */
	public function test_store_routes_pass_the_service_answer_through_for_a_shop_manager() {
		$this->upstream_replies( array( 'revenue' => $this->revenue_payload() ) );
		$revenue = $this->call_as( 'fetch_revenue_summary', array( 'site_url' => 'https://shop.test' ), self::SHOP_MANAGER );
		$this->assertSame( 12345, $revenue['revenue']['revenue_minor'] );

		$this->upstream_replies( array( 'video_funnel' => $this->funnel_payload() ) );
		$funnel = $this->call_as( 'fetch_video_funnel', array( 'site_url' => 'https://shop.test' ), self::SHOP_MANAGER );
		$this->assertCount( 3, $funnel['video_funnel']['stages'] );
		$this->assertTrue( $funnel['video_funnel']['still_counting'] );

		$this->upstream_replies(
			array(
				'placement_funnels' => array(
					array(
						'block_source'  => 'woo-layer',
						'played'        => 50,
						'added'         => 8,
						'purchased'     => 2,
						'purchase_rate' => 4.0,
					),
				),
			)
		);
		$placements = $this->call_as( 'fetch_placement_funnels', array( 'site_url' => 'https://shop.test' ), self::SHOP_MANAGER );
		$this->assertSame( 2, $placements['placement_funnels'][0]['purchased'] );

		$this->upstream_replies(
			array(
				'top_products' => array(
					array(
						'product_id'    => 11,
						'product_views' => 40,
						'added_to_cart' => 9,
						'revenue_minor' => 4500,
						'orders'        => 3,
						'currency'      => 'USD',
					),
				),
				'total_pages'  => 1,
				'total_items'  => 1,
			)
		);
		$products = $this->call_as(
			'fetch_top_products',
			array(
				'site_url' => 'https://shop.test',
				'search'   => '',
			),
			self::SHOP_MANAGER
		);
		$this->assertSame( 4500, $products['top_products'][0]['revenue_minor'] );
		$this->assertSame( 9, $products['top_products'][0]['added_to_cart'] );
		$this->assertSame( 'Mug', $products['top_products'][0]['title'] );
	}
}
