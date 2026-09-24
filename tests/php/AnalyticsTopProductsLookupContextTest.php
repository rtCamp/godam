<?php
/**
 * Unit tests for which site fetch_top_products reads each Top Products field on.
 *
 * The rtgodam_before_attachment_lookup / rtgodam_after_attachment_lookup pair lets
 * a media-centralizing plugin (e.g. wp-dam on multisite) switch to the media site
 * around an attachment read. Only the product thumbnail is an attachment. The
 * products, their permalinks and the WooCommerce placeholder live on the shop
 * site, so those lookups must run outside the pair: inside it, on such a network,
 * the products are looked up on the media site, where they don't exist.
 *
 * The stubs in tests/stubs/product-lookup-functions.php answer only on the site
 * that holds the data and log the site each lookup ran on; the hook listeners
 * registered in setUp() play the centralizing plugin.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Analytics;

require_once dirname( __DIR__ ) . '/stubs/product-lookup-functions.php';

/**
 * @covers \RTGODAM\Inc\REST_API\Analytics::fetch_top_products
 */
class AnalyticsTopProductsLookupContextTest extends TestCase {

	/**
	 * How many times each hook of the pair fired.
	 *
	 * @var int[]
	 */
	private $fired = array(
		'before' => 0,
		'after'  => 0,
	);

	/**
	 * A verified account, three microservice rows (two live products, one deleted)
	 * and a centralizing plugin listening on the hook pair.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_hooks']      = array();
		$GLOBALS['rtgodam_translated'] = array();
		$GLOBALS['rtgodam_stub']       = array(
			'options'     => array(
				'rtgodam-account-token' => 'verified-account',
				'rtgodam-api-key'       => 'test-key',
			),
			'site'        => 'shop',
			'site_stack'  => array(),
			'lookups'     => array(),
			'products'    => array(
				11 => array(
					'name'     => 'Mug',
					'type'     => 'simple',
					'image_id' => 501,
				),
				12 => array(
					'name'     => 'Tee',
					'type'     => 'variable',
					'image_id' => 0,
				),
			),
			'attachments' => array(
				501 => 'https://media.test/wp-content/uploads/mug-150x150.jpg',
			),
		);

		add_action( 'rtgodam_before_attachment_lookup', array( $this, 'switch_to_media_site' ) );
		add_action( 'rtgodam_after_attachment_lookup', array( $this, 'restore_current_site' ) );

		$this->set_microservice_rows( array( 11, 12, 13 ) );
	}

	/**
	 * Drop the listeners so they don't leak into other test classes.
	 */
	protected function tearDown(): void {
		$GLOBALS['rtgodam_hooks'] = array();
		parent::tearDown();
	}

	/**
	 * Listener on rtgodam_before_attachment_lookup: what wp-dam does, switch_to_blog()
	 * to the media site.
	 */
	public function switch_to_media_site() {
		++$this->fired['before'];
		$GLOBALS['rtgodam_stub']['site_stack'][] = $GLOBALS['rtgodam_stub']['site'];
		$GLOBALS['rtgodam_stub']['site']         = 'media';
	}

	/**
	 * Listener on rtgodam_after_attachment_lookup: restore_current_blog().
	 */
	public function restore_current_site() {
		++$this->fired['after'];
		$GLOBALS['rtgodam_stub']['site'] = array_pop( $GLOBALS['rtgodam_stub']['site_stack'] ) ?? 'shop';
	}

	/**
	 * Make the microservice return one Top Products row per product id.
	 *
	 * Written for both HTTP stub sets: bootstrap.php's (read `remote_code` /
	 * `remote_body`) and tests/stubs/wp-http-functions.php's (read `http`).
	 * Whichever file defines wp_remote_* first wins, so the response is the same
	 * either way.
	 *
	 * @param int[] $product_ids Product ids, in rank order.
	 */
	private function set_microservice_rows( array $product_ids ) {
		$rows = array();
		foreach ( $product_ids as $product_id ) {
			$rows[] = array(
				'product_id' => $product_id,
				'revenue'    => 10,
				'orders'     => 1,
			);
		}

		$body = wp_json_encode(
			array(
				'top_products' => $rows,
				'total_pages'  => 1,
				'total_items'  => count( $rows ),
			)
		);

		$GLOBALS['rtgodam_stub']['http']        = array(
			'code' => 200,
			'body' => $body,
		);
		$GLOBALS['rtgodam_stub']['remote_code'] = 200;
		$GLOBALS['rtgodam_stub']['remote_body'] = $body;
	}

	/**
	 * Run fetch_top_products on a constructor-less instance (Base's constructor
	 * registers WP hooks we don't want here) and key the rows by product id.
	 *
	 * @return array[] Hydrated rows keyed by product_id.
	 */
	private function fetch_rows() {
		$analytics = ( new \ReflectionClass( Analytics::class ) )->newInstanceWithoutConstructor();
		$request   = new \WP_REST_Request(
			array(
				'site_url' => 'https://shop.test',
				'search'   => '',
			)
		);

		$data = $analytics->fetch_top_products( $request )->get_data();
		$this->assertSame( 'success', $data['status'], 'the stubbed microservice answer should reach the hydration loop' );

		return array_column( $data['top_products'], null, 'product_id' );
	}

	/**
	 * The sites a given lookup ran on, in call order.
	 *
	 * @param string $name Lookup name as logged by the stubs.
	 * @return string[]
	 */
	private function sites_for( $name ) {
		$sites = array();
		foreach ( $GLOBALS['rtgodam_stub']['lookups'] as $lookup ) {
			if ( $name === $lookup['name'] ) {
				$sites[] = $lookup['site'];
			}
		}
		return $sites;
	}

	/**
	 * Every product lookup runs on the shop site, outside the pair.
	 */
	public function test_product_lookups_run_outside_the_attachment_lookup_pair() {
		$this->fetch_rows();

		foreach ( array( 'wc_get_product', 'get_permalink', 'get_type', 'get_name', 'get_image_id', 'wc_placeholder_img_src' ) as $name ) {
			$sites = $this->sites_for( $name );
			$this->assertNotEmpty( $sites, "$name() should have been called" );
			$this->assertSame( array( 'shop' ), array_values( array_unique( $sites ) ), "$name() ran inside the attachment-lookup pair" );
		}
	}

	/**
	 * The thumbnail's attachment lookup is the only thing inside the pair, and the
	 * pair wraps the thumbnail pass once, not once per product.
	 */
	public function test_only_the_thumbnail_lookup_runs_inside_the_pair_which_fires_once() {
		$this->fetch_rows();

		$this->assertSame( array( 'media' ), $this->sites_for( 'wp_get_attachment_image_url' ), 'one thumbnail lookup (the one product with an image), on the media site' );

		$inside = array();
		foreach ( $GLOBALS['rtgodam_stub']['lookups'] as $lookup ) {
			if ( 'media' === $lookup['site'] ) {
				$inside[] = $lookup['name'];
			}
		}
		$this->assertSame( array( 'wp_get_attachment_image_url' ), $inside );

		$this->assertSame( 1, $this->fired['before'] );
		$this->assertSame( 1, $this->fired['after'] );
	}

	/**
	 * The outcome on a centralized-media network: products hydrate from the shop,
	 * the thumbnail from the media site, and only the really deleted product is
	 * flagged as deleted.
	 */
	public function test_rows_hydrate_on_a_network_that_centralizes_media() {
		$rows = $this->fetch_rows();

		$this->assertTrue( $rows[11]['exists'], 'a live product must not be flagged as deleted' );
		$this->assertSame( 'Mug', $rows[11]['title'] );
		$this->assertSame( 'https://shop.test/?p=11', $rows[11]['permalink'] );
		$this->assertSame( 'https://media.test/wp-content/uploads/mug-150x150.jpg', $rows[11]['thumbnail_url'] );
		$this->assertTrue( $rows[11]['supports_direct_add_to_cart'] );

		$this->assertTrue( $rows[12]['exists'] );
		$this->assertSame( 'Tee', $rows[12]['title'] );
		$this->assertSame( 'https://shop.test/wp-content/uploads/woocommerce-placeholder-150x150.png', $rows[12]['thumbnail_url'], "a product with no image shows the store's own placeholder" );
		$this->assertFalse( $rows[12]['supports_direct_add_to_cart'], 'a variable product cannot be added to cart in-video' );

		$this->assertFalse( $rows[13]['exists'] );
		$this->assertSame( 'ID: 13 (Deleted Product)', $rows[13]['title'] );
		$this->assertNull( $rows[13]['permalink'] );
		$this->assertNull( $rows[13]['thumbnail_url'] );
	}

	/**
	 * Guard: on a plain site (nothing listens on the pair, media is local) the rows
	 * hydrate exactly the same.
	 */
	public function test_rows_hydrate_the_same_on_a_single_site() {
		$GLOBALS['rtgodam_hooks']                   = array();
		$GLOBALS['rtgodam_stub']['attachment_site'] = 'shop';

		$rows = $this->fetch_rows();

		$this->assertSame( 'Mug', $rows[11]['title'] );
		$this->assertSame( 'https://shop.test/?p=11', $rows[11]['permalink'] );
		$this->assertSame( 'https://media.test/wp-content/uploads/mug-150x150.jpg', $rows[11]['thumbnail_url'] );
		$this->assertSame( 'https://shop.test/wp-content/uploads/woocommerce-placeholder-150x150.png', $rows[12]['thumbnail_url'] );
		$this->assertSame( 'ID: 13 (Deleted Product)', $rows[13]['title'] );
	}
}
