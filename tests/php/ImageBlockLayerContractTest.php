<?php
/**
 * Layer API contract (#2291): which saved layers the `godam/image` block sends
 * to the browser.
 *
 * render.php sends the layers whose registered type supports images and has
 * something to draw (#2295): core `hotspot` layers with hotspots and legacy
 * `woo` layers with product hotspots, plus any add-on type registered with
 * `supports.media: [ 'image' ]`. It only loads the image-layers script when
 * something is left, and lets add-ons add script dependencies through
 * `godam_image_layers_frontend_dependencies`.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

require_once dirname( __DIR__ ) . '/stubs/hooks.php';
require_once dirname( __DIR__ ) . '/stubs/i18n.php';
require_once dirname( __DIR__ ) . '/stubs/script-functions.php';
require_once dirname( __DIR__ ) . '/stubs/block-render-functions.php';
require_once dirname( __DIR__ ) . '/stubs/layer-registry.php';

if ( ! defined( 'RTGODAM_PATH' ) ) {
	define( 'RTGODAM_PATH', dirname( __DIR__, 2 ) . '/' );
}
if ( ! defined( 'RTGODAM_URL' ) ) {
	define( 'RTGODAM_URL', 'https://example.com/wp-content/plugins/godam/' );
}

/**
 * @coversNothing
 */
class ImageBlockLayerContractTest extends TestCase {

	private const ATTACHMENT_ID = 42;

	/**
	 * Reset hooks, scripts and post meta.
	 */
	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['rtgodam_hooks']   = array();
		$GLOBALS['rtgodam_scripts'] = array(
			'registered' => array(),
			'enqueued'   => array(),
			'inline'     => array(),
		);
		$GLOBALS['rtgodam_stub']    = array();
		rtgodam_test_register_core_layer_types();
	}

	/**
	 * Render the block for an attachment with these saved layers.
	 *
	 * @param array $layers     Saved `rtgodam_meta['layers']`.
	 * @param array $attributes Extra block attributes.
	 * @return string Rendered HTML.
	 */
	private function render( array $layers, array $attributes = array() ): string {
		$GLOBALS['rtgodam_stub']['post_meta_by_id'][ self::ATTACHMENT_ID ] = array(
			'rtgodam_meta' => array( 'layers' => $layers ),
		);

		$attributes = array_merge(
			array(
				'id'     => self::ATTACHMENT_ID,
				'url'    => 'https://example.com/image.jpg',
				'alt'    => 'An image',
				'width'  => 800,
				'height' => 600,
			),
			$attributes
		);

		ob_start();
		// phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found -- render.php reads $attributes from this scope.
		( static function ( $attributes ) {
			require dirname( __DIR__, 2 ) . '/assets/src/blocks/godam-image/render.php';
		} )( $attributes );
		return (string) ob_get_clean();
	}

	/**
	 * Layers the front end receives in `data-godam-image-layers`, or null when the attribute is absent.
	 *
	 * @param string $html Rendered HTML.
	 * @return array|null
	 */
	private function sent_layers( string $html ): ?array {
		if ( ! preg_match( '/data-godam-image-layers="([^"]*)"/', $html, $match ) ) {
			return null;
		}
		return json_decode( html_entity_decode( $match[1], ENT_QUOTES, 'UTF-8' ), true );
	}

	/**
	 * Hotspot layers with hotspots and woo layers with product hotspots are sent, in saved order.
	 */
	public function test_sends_hotspot_and_woo_layers_in_saved_order(): void {
		$hotspot = array(
			'id'       => 'h1',
			'type'     => 'hotspot',
			'hotspots' => array( array( 'id' => 's1' ) ),
		);
		$woo     = array(
			'id'              => 'w1',
			'type'            => 'woo',
			'productHotspots' => array( array( 'productId' => 7 ) ),
		);

		$this->assertSame( array( $woo, $hotspot ), $this->sent_layers( $this->render( array( $woo, $hotspot ) ) ) );
	}

	/**
	 * Video-only and unregistered types are dropped on the server.
	 */
	public function test_drops_every_other_layer_type(): void {
		$keep = array(
			'id'       => 'h1',
			'type'     => 'hotspot',
			'hotspots' => array( array( 'id' => 's1' ) ),
		);

		$sent = $this->sent_layers(
			$this->render(
				array(
					array(
						'id'   => 'c1',
						'type' => 'cta',
					),
					array(
						'id'    => 'a1',
						'type'  => 'acme',
						'items' => array( 1 ),
					),
					$keep,
				)
			)
		);

		$this->assertSame( array( $keep ), $sent );
	}

	/**
	 * An add-on type registered with image support is sent too.
	 */
	public function test_sends_an_add_on_type_that_supports_images(): void {
		godam_register_layer_type(
			array(
				'name'     => 'acme/badge',
				'supports' => array( 'media' => array( 'image' ) ),
			)
		);
		$badge = array(
			'id'   => 'b1',
			'type' => 'acme/badge',
		);

		$this->assertSame( array( $badge ), $this->sent_layers( $this->render( array( $badge ) ) ) );
	}

	/**
	 * Empty hotspot and woo layers, untyped layers and non-array entries are dropped.
	 */
	public function test_drops_empty_and_malformed_layers(): void {
		$html = $this->render(
			array(
				array(
					'id'       => 'h-empty',
					'type'     => 'hotspot',
					'hotspots' => array(),
				),
				array(
					'id'              => 'w-empty',
					'type'            => 'woo',
					'productHotspots' => array(),
				),
				array( 'id' => 'no-type' ),
				'not-a-layer',
			)
		);

		$this->assertNull( $this->sent_layers( $html ) );
		$this->assertStringNotContainsString( 'godam-image-layer"', $html );
	}

	/**
	 * With layers to draw, the overlay is printed and both front-end scripts load.
	 */
	public function test_prints_overlay_and_loads_scripts_when_layers_exist(): void {
		$html = $this->render(
			array(
				array(
					'id'       => 'h1',
					'type'     => 'hotspot',
					'hotspots' => array( array( 'id' => 's1' ) ),
				),
			)
		);

		$this->assertMatchesRegularExpression( '/id="layer-img_[0-9a-f]{16}-all" class="easydam-layer hotspot-layer godam-image-layer"/', $html );
		$this->assertStringContainsString( 'data-id="42"', $html );
		$this->assertStringContainsString( 'data-block-source="godam-image"', $html );
		$this->assertSame( array( 'godam-layer-analytics-script', 'godam-image-layers-frontend' ), $GLOBALS['rtgodam_scripts']['enqueued'] );
	}

	/**
	 * With nothing to draw, no layer data, overlay or scripts.
	 */
	public function test_loads_nothing_when_no_layer_survives(): void {
		$html = $this->render(
			array(
				array(
					'id'   => 'c1',
					'type' => 'cta',
				),
			)
		);

		$this->assertStringNotContainsString( 'data-instance-id', $html );
		$this->assertSame( array(), $GLOBALS['rtgodam_scripts']['enqueued'] );
	}

	/**
	 * Add-ons add their front-end script as a dependency through this filter.
	 */
	public function test_add_ons_can_add_script_dependencies(): void {
		$seen = null;
		add_filter(
			'godam_image_layers_frontend_dependencies',
			static function ( $deps ) use ( &$seen ) {
				$seen   = $deps;
				$deps[] = 'acme-layer-frontend';
				return $deps;
			}
		);

		$this->render(
			array(
				array(
					'id'              => 'w1',
					'type'            => 'woo',
					'productHotspots' => array( array( 'productId' => 7 ) ),
				),
			)
		);

		$this->assertIsArray( $seen );
	}

	/**
	 * Turning the block's layer toggle off sends no layers.
	 */
	public function test_sends_no_layers_when_the_block_hides_them(): void {
		$html = $this->render(
			array(
				array(
					'id'       => 'h1',
					'type'     => 'hotspot',
					'hotspots' => array( array( 'id' => 's1' ) ),
				),
			),
			array( 'showImageLayers' => false )
		);

		$this->assertNull( $this->sent_layers( $html ) );
	}
}
