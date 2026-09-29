<?php
/**
 * Unit tests for who gets order data from the analytics routes.
 *
 * Revenue, order counts, purchases, Video-to-Purchase and the funnels' Purchase
 * step follow WooCommerce's own report permission (`view_woocommerce_reports`,
 * held by shop managers and administrators). The routes strip those fields from
 * their responses for everyone else, so the numbers cannot be read through the
 * route even if the screen hides them. Views, plays, clicks and add-to-carts stay.
 *
 * Each test feeds a route a canned microservice reply that carries both kinds of
 * field (shaped like the analytics service's responses), calls it as an author,
 * an editor and a shop manager, and asserts on what comes back. "No order data"
 * is checked with a denylist written here, independently of the class under test,
 * that is walked through the whole response at every depth.
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
 * @covers \RTGODAM\Inc\REST_API\Analytics::can_view_order_data
 * @covers \RTGODAM\Inc\REST_API\Analytics::fetch_dashboard_metrics
 * @covers \RTGODAM\Inc\REST_API\Analytics::fetch_revenue_summary
 * @covers \RTGODAM\Inc\REST_API\Analytics::fetch_video_funnel
 * @covers \RTGODAM\Inc\REST_API\Analytics::fetch_placement_funnels
 * @covers \RTGODAM\Inc\REST_API\Analytics::fetch_top_products
 * @covers \RTGODAM\Inc\REST_API\Analytics::fetch_analytics_data
 * @covers \RTGODAM\Inc\REST_API\Analytics::fetch_layer_analytics
 */
class AnalyticsOrderDataAccessTest extends TestCase {

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
	 * Keys that carry order data, at any depth of a response. Written out here on
	 * purpose (not read from the class) so the test fails if the class forgets one.
	 */
	const ORDER_KEYS = array(
		'revenue',
		'revenue_minor',
		'revenue_currency',
		'revenue_excluded_orders',
		'revenue_direct_minor',
		'revenue_assisted_minor',
		'revenue_tips',
		'revenue_by_placement',
		'influenced_revenue_minor',
		'influenced_currency',
		'influenced_orders',
		'influenced_provisional',
		'orders',
		'currency',
		'video_to_purchase',
		'purchases',
		'purchased',
		'purchase_rate',
		'still_counting',
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
	 * Collect every key that appears anywhere in a response, and every funnel
	 * stage key, so a leftover order field is found at any depth.
	 *
	 * @param mixed $data   Response fragment.
	 * @param array $found  Keys found so far.
	 * @return string[] Keys, including 'stage:<key>' for funnel stages.
	 */
	private function collect_keys( $data, array $found = array() ) {
		if ( ! is_array( $data ) ) {
			return $found;
		}
		foreach ( $data as $key => $value ) {
			if ( is_string( $key ) ) {
				$found[] = $key;
			}
			$found = $this->collect_keys( $value, $found );
		}
		if ( isset( $data['key'] ) && is_string( $data['key'] ) ) {
			$found[] = 'stage:' . $data['key'];
		}
		return $found;
	}

	/**
	 * Assert a response carries none of the order fields.
	 *
	 * @param mixed  $data    Response fragment.
	 * @param string $message Context for a failure.
	 */
	private function assertNoOrderData( $data, $message = '' ) {
		$leaked = array_values( array_intersect( $this->collect_keys( $data ), array_merge( self::ORDER_KEYS, array( 'stage:purchased' ) ) ) );
		$this->assertSame( array(), $leaked, $message . ' leaked order fields' );
	}

	/**
	 * Assert a response still carries a key somewhere (so a strip that empties
	 * the whole response cannot pass as "no order data").
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
	 * A per-video Video-to-Cart payload, which every role keeps.
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
	 * Every role sees the funnel's Played and Added to cart steps; only the shop
	 * manager sees the Purchased step.
	 *
	 * @param array $funnel A `video_funnel` payload as returned by a route.
	 * @return string[] The step keys.
	 */
	private function stage_keys( $funnel ) {
		return array_column( $funnel['stages'], 'key' );
	}

	/**
	 * Dashboard metrics: an editor keeps plays and Video-to-Cart, loses revenue,
	 * Video-to-Purchase, the Purchase step and the matching "unavailable" notes.
	 */
	public function test_dashboard_metrics_for_an_editor_has_no_order_data() {
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
					'unavailable_sections' => array( 'revenue', 'video_to_purchase', 'video_funnel' ),
				),
			)
		);

		$data = $this->call_as( 'fetch_dashboard_metrics', array( 'site_url' => 'https://shop.test' ), self::EDITOR );

		$this->assertSame( 'success', $data['status'] );
		$metrics = $data['dashboard_metrics'];
		$this->assertNoOrderData( $metrics, 'dashboard-metrics' );
		$this->assertSame( 120, $metrics['plays'] );
		$this->assertSame( 80, $metrics['unique_viewers'] );
		$this->assertSame( 9, $metrics['video_to_cart']['carts'], 'add-to-carts stay visible' );
		$this->assertSame( array( 'played', 'added_to_cart' ), $this->stage_keys( $metrics['video_funnel'] ) );
		$this->assertSame( array( 'video_funnel' ), $metrics['unavailable_sections'], 'no "could not load" note for a hidden card' );
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
					'unavailable_sections' => array( 'revenue', 'video_to_purchase' ),
				),
			)
		);

		$metrics = $this->call_as( 'fetch_dashboard_metrics', array( 'site_url' => 'https://shop.test' ), self::SHOP_MANAGER )['dashboard_metrics'];

		$this->assertSame( 12345, $metrics['revenue']['revenue_minor'] );
		$this->assertSame( 3, $metrics['video_to_purchase']['purchases'] );
		$this->assertSame( array( 'played', 'added_to_cart', 'purchased' ), $this->stage_keys( $metrics['video_funnel'] ) );
		$this->assertTrue( $metrics['video_funnel']['still_counting'] );
		$this->assertSame( array( 'revenue', 'video_to_purchase' ), $metrics['unavailable_sections'] );
	}

	/**
	 * Revenue summary is all order data: an editor gets a null revenue, and the
	 * microservice is not even asked.
	 */
	public function test_revenue_summary_for_an_editor_is_null_and_not_fetched() {
		$this->upstream_replies( array( 'revenue' => $this->revenue_payload() ) );

		$data = $this->call_as( 'fetch_revenue_summary', array( 'site_url' => 'https://shop.test' ), self::EDITOR );

		$this->assertSame( array( 'revenue' => null ), $data );
		$this->assertArrayNotHasKey( 'last_remote_url', $GLOBALS['rtgodam_stub'], 'no upstream call for a user who may not see the answer' );
	}

	/**
	 * Revenue summary: a shop manager gets the revenue.
	 */
	public function test_revenue_summary_for_a_shop_manager_has_the_revenue() {
		$this->upstream_replies( array( 'revenue' => $this->revenue_payload() ) );

		$data = $this->call_as( 'fetch_revenue_summary', array( 'site_url' => 'https://shop.test' ), self::SHOP_MANAGER );

		$this->assertSame( 12345, $data['revenue']['revenue_minor'] );
	}

	/**
	 * Purchase funnel: an editor keeps Played and Added to cart, loses Purchased
	 * and the "purchases still settling" flag. A shop manager gets all three.
	 */
	public function test_video_funnel_drops_the_purchase_step_for_an_editor() {
		$this->upstream_replies( array( 'video_funnel' => $this->funnel_payload() ) );

		$editor = $this->call_as( 'fetch_video_funnel', array( 'site_url' => 'https://shop.test' ), self::EDITOR );
		$this->assertNoOrderData( $editor, 'video-funnel' );
		$this->assertSame( array( 'played', 'added_to_cart' ), $this->stage_keys( $editor['video_funnel'] ) );
		$this->assertSame( 6, $editor['video_funnel']['stages'][1]['direct'], 'the Direct/Assisted cart split stays' );

		$manager = $this->call_as( 'fetch_video_funnel', array( 'site_url' => 'https://shop.test' ), self::SHOP_MANAGER );
		$this->assertSame( array( 'played', 'added_to_cart', 'purchased' ), $this->stage_keys( $manager['video_funnel'] ) );
	}

	/**
	 * A funnel that is null or missing (nothing to show) stays that way.
	 */
	public function test_video_funnel_null_stays_null_for_an_editor() {
		$this->upstream_replies( array( 'video_funnel' => null ) );

		$data = $this->call_as( 'fetch_video_funnel', array( 'site_url' => 'https://shop.test' ), self::EDITOR );

		$this->assertNull( $data['video_funnel'] );
	}

	/**
	 * Funnel by placement: an editor keeps played, added and the add rate; the
	 * purchased count and the play-to-purchase rate go. A shop manager gets both.
	 */
	public function test_placement_funnels_drop_the_purchase_step_for_an_editor() {
		$this->upstream_replies(
			array(
				'placement_funnels' => array(
					array(
						'block_source'  => 'woo-layer',
						'label'         => 'Woo hotspot layer',
						'played'        => 50,
						'added'         => 8,
						'purchased'     => 2,
						'add_rate'      => 16.0,
						'purchase_rate' => 4.0,
						'videos'        => 3,
						'units'         => 4,
						'unit_label'    => 'layers',
					),
				),
			)
		);

		$editor = $this->call_as( 'fetch_placement_funnels', array( 'site_url' => 'https://shop.test' ), self::EDITOR );
		$this->assertNoOrderData( $editor, 'placement-funnels' );
		$row = $editor['placement_funnels'][0];
		$this->assertSame( 50, $row['played'] );
		$this->assertSame( 8, $row['added'] );
		$this->assertEquals( 16.0, $row['add_rate'] );
		$this->assertSame( 'Woo hotspot layer', $row['label'] );

		$manager = $this->call_as( 'fetch_placement_funnels', array( 'site_url' => 'https://shop.test' ), self::SHOP_MANAGER );
		$this->assertSame( 2, $manager['placement_funnels'][0]['purchased'] );
		$this->assertEquals( 4.0, $manager['placement_funnels'][0]['purchase_rate'] );
	}

	/**
	 * A top-products row as the service builds it, with every order field.
	 *
	 * @return array
	 */
	private function top_product_row() {
		return array(
			'product_id'               => 11,
			'site_url'                 => 'https://shop.test',
			'product_views'            => 40,
			'product_views_ctr'        => 12.5,
			'impressions'              => 320,
			'added_to_cart_direct'     => 6,
			'added_to_cart_assisted'   => 3,
			'added_to_cart'            => 9,
			'revenue_minor'            => 4500,
			'orders'                   => 3,
			'currency'                 => 'USD',
			'video_count'              => 2,
			'layer_count'              => 1,
			'sources'                  => array( 'woo-layer' ),
			'influenced_revenue_minor' => 900,
			'influenced_currency'      => 'USD',
			'influenced_orders'        => 1,
			'influenced_provisional'   => false,
			'revenue_by_placement'     => array( 'woo-layer' => array( 'revenue_minor' => 4500 ) ),
			'revenue_direct_minor'     => 3000,
			'revenue_assisted_minor'   => 1500,
		);
	}

	/**
	 * Top products: an editor keeps views, impressions, add-to-carts and the
	 * WooCommerce name; every revenue and order field goes.
	 */
	public function test_top_products_for_an_editor_has_no_order_data() {
		$this->upstream_replies(
			array(
				'top_products' => array( $this->top_product_row() ),
				'total_pages'  => 1,
				'total_items'  => 1,
			)
		);

		$data = $this->call_as(
			'fetch_top_products',
			array(
				'site_url' => 'https://shop.test',
				'search'   => '',
			),
			self::EDITOR
		);

		$this->assertSame( 'success', $data['status'] );
		$this->assertNoOrderData( $data, 'top-products' );
		$row = $data['top_products'][0];
		$this->assertSame( 40, $row['product_views'] );
		$this->assertSame( 320, $row['impressions'] );
		$this->assertSame( 9, $row['added_to_cart'] );
		$this->assertSame( 6, $row['added_to_cart_direct'] );
		$this->assertSame( 'Mug', $row['title'], 'the WooCommerce name is still hydrated' );
		$this->assertSame( 1, $data['total_items'] );
	}

	/**
	 * Top products: a shop manager gets every field.
	 */
	public function test_top_products_for_a_shop_manager_has_everything() {
		$this->upstream_replies(
			array(
				'top_products' => array( $this->top_product_row() ),
				'total_pages'  => 1,
				'total_items'  => 1,
			)
		);

		$row = $this->call_as(
			'fetch_top_products',
			array(
				'site_url' => 'https://shop.test',
				'search'   => '',
			),
			self::SHOP_MANAGER
		)['top_products'][0];

		foreach ( array_keys( $this->top_product_row() ) as $key ) {
			$this->assertArrayHasKey( $key, $row, "shop manager should get '$key'" );
		}
		$this->assertSame( 4500, $row['revenue_minor'] );
		$this->assertSame( 3, $row['orders'] );
	}

	/**
	 * A per-video record as the service builds it, with every order field.
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
	 * Per-video analytics: an editor and an author keep plays, watch time and
	 * Video-to-Cart; the revenue, tips, Video-to-Purchase and Purchase step go.
	 */
	public function test_per_video_analytics_for_editor_and_author_has_no_order_data() {
		foreach ( array(
			'editor' => self::EDITOR,
			'author' => self::AUTHOR,
		) as $role => $caps ) {
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
			$this->assertNoOrderData( $data['data'], "fetch as $role" );
			$this->assertSame( 70, $data['data']['plays'], $role );
			$this->assertSame( 640.5, $data['data']['play_time'], $role );
			$this->assertSame( 9, $data['data']['video_to_cart']['carts'], $role );
			$this->assertSame( array( 'played', 'added_to_cart' ), $this->stage_keys( $data['data']['video_funnel'] ), $role );
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
		$this->assertSame( array( 'played', 'added_to_cart', 'purchased' ), $this->stage_keys( $data['video_funnel'] ) );
	}

	/**
	 * A layer analytics payload with per-hotspot revenue on a Woo layer.
	 *
	 * @return array
	 */
	private function layer_analytics_payload() {
		return array(
			'layer_type'        => 'woo',
			'days'              => 30,
			'cumulative'        => array(
				'viewed'        => 100,
				'clicked'       => 20,
				'added_to_cart' => 8,
			),
			'daily_breakdown'   => array(),
			'individual_layers' => array(
				array(
					'layer_id'      => 'l1::p11',
					'viewed'        => 50,
					'clicked'       => 10,
					'added_to_cart' => 4,
					'revenue_minor' => 500,
					'orders'        => 2,
					'currency'      => 'USD',
				),
				array(
					'layer_id'      => 'l1',
					'viewed'        => 50,
					'clicked'       => 10,
					'added_to_cart' => 4,
					'revenue_minor' => 0,
					'orders'        => 0,
					'currency'      => '',
				),
			),
		);
	}

	/**
	 * Layer analytics: an editor and an author keep viewed, clicked and
	 * add-to-cart per hotspot; the per-hotspot revenue, orders and currency go.
	 */
	public function test_layer_analytics_for_editor_and_author_has_no_order_data() {
		foreach ( array(
			'editor' => self::EDITOR,
			'author' => self::AUTHOR,
		) as $role => $caps ) {
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
			$this->assertNoOrderData( $data['layer_analytics'], "layer-analytics as $role" );
			$layers = $data['layer_analytics']['individual_layers'];
			$this->assertCount( 2, $layers, $role );
			$this->assertSame( 4, $layers[0]['added_to_cart'], "$role keeps add-to-carts" );
			$this->assertSame( 50, $layers[0]['viewed'], $role );
			$this->assertSame( 8, $data['layer_analytics']['cumulative']['added_to_cart'], $role );
		}
	}

	/**
	 * Layer analytics: a shop manager gets the per-hotspot revenue.
	 */
	public function test_layer_analytics_for_a_shop_manager_has_the_revenue() {
		$this->upstream_replies( array( 'layer_analytics' => $this->layer_analytics_payload() ) );

		$layers = $this->call_as(
			'fetch_layer_analytics',
			array(
				'video_id'   => 55,
				'layer_type' => 'woo',
				'site_url'   => 'https://shop.test',
			),
			self::SHOP_MANAGER
		)['layer_analytics']['individual_layers'];

		$this->assertSame( 500, $layers[0]['revenue_minor'] );
		$this->assertSame( 2, $layers[0]['orders'] );
		$this->assertSame( 'USD', $layers[0]['currency'] );
	}

	/**
	 * The strip never empties a response: each route still returns something an
	 * editor can use, so an over-eager strip cannot pass as "no order data".
	 */
	public function test_editor_responses_keep_their_non_order_content() {
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
		$this->assertKeepsKey( $record, 'video_to_cart' );

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
		$this->assertKeepsKey( $layers, 'added_to_cart' );
	}
}
