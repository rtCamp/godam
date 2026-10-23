<?php
/**
 * Unit tests for the hotspot links the GoDAM Image block hands to the front end.
 *
 * The block prints an attachment's hotspot layers into a data attribute, and front-end
 * script makes each hotspot's `link` the `href` of a link. Only http, https and mailto
 * links go out; a link on any other scheme is emptied and the hotspot still renders.
 *
 * Each test runs in its own process: the stubs below stand in for WordPress functions
 * that other tests define differently.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 *
 * @covers ::rtgodam_sanitize_hotspot_links
 */
class HotspotLinkSanitizeTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__ ) . '/stubs/hooks.php';
		require_once dirname( __DIR__ ) . '/stubs/url-functions.php';
		require_once dirname( __DIR__ ) . '/stubs/godam-image-render-functions.php';

		$GLOBALS['rtgodam_hooks'] = array();
		$GLOBALS['rtgodam_stub']  = array();
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'], $GLOBALS['rtgodam_hooks'] );
		parent::tearDown();
	}

	/**
	 * A hotspot layer with one hotspot carrying the given link.
	 *
	 * @param mixed $link Link stored on the hotspot.
	 * @return array
	 */
	private function layer_with_link( $link ): array {
		return array(
			'id'       => 'layer-1',
			'type'     => 'hotspot',
			'hotspots' => array(
				array(
					'id'          => 'h1',
					'tooltipText' => 'Shop',
					'link'        => $link,
					'position'    => array(
						'x' => 10,
						'y' => 20,
					),
				),
			),
		);
	}

	/**
	 * Links a visitor can follow.
	 *
	 * @return array<string, array{0: string}>
	 */
	public function safe_links(): array {
		return array(
			'http'              => array( 'http://example.com/shop' ),
			'https with query'  => array( 'https://example.com/shop?a=1&b=2#top' ),
			'upper-case scheme' => array( 'HTTPS://example.com/shop' ),
			'mailto'            => array( 'mailto:hello@example.com' ),
			'root-relative'     => array( '/shop/' ),
			'hash'              => array( '#products' ),
		);
	}

	/**
	 * Links on a scheme that is neither web nor mail.
	 *
	 * @return array<string, array{0: string}>
	 */
	public function unsafe_links(): array {
		return array(
			'javascript'                => array( 'javascript:alert(1)' ),
			'javascript in mixed case'  => array( 'JaVaScRiPt:alert(1)' ),
			'javascript after a space'  => array( '  javascript:alert(1)' ),
			'javascript split by a tab' => array( "java\tscript:alert(1)" ),
			'data'                      => array( 'data:text/html,<script>alert(1)</script>' ),
			'vbscript'                  => array( 'vbscript:msgbox(1)' ),
		);
	}

	/**
	 * @dataProvider safe_links
	 *
	 * @param string $link Stored link.
	 */
	public function test_a_safe_link_is_kept( string $link ): void {
		$layers = rtgodam_sanitize_hotspot_links( array( $this->layer_with_link( $link ) ) );

		$this->assertSame( $link, $layers[0]['hotspots'][0]['link'] );
	}

	/**
	 * @dataProvider unsafe_links
	 *
	 * @param string $link Stored link.
	 */
	public function test_an_unsafe_link_is_emptied( string $link ): void {
		$layers = rtgodam_sanitize_hotspot_links( array( $this->layer_with_link( $link ) ) );

		$this->assertSame( '', $layers[0]['hotspots'][0]['link'] );
	}

	public function test_the_rest_of_the_hotspot_and_its_layer_is_unchanged(): void {
		$original = $this->layer_with_link( 'javascript:alert(1)' );
		$layers   = rtgodam_sanitize_hotspot_links( array( $original ) );

		$expected                        = $original;
		$expected['hotspots'][0]['link'] = '';

		$this->assertSame( array( $expected ), $layers );
	}

	public function test_each_hotspot_is_judged_on_its_own_link(): void {
		$layer             = $this->layer_with_link( 'https://example.com/a' );
		$layer['hotspots'] = array_merge(
			$layer['hotspots'],
			$this->layer_with_link( 'javascript:alert(1)' )['hotspots'],
			$this->layer_with_link( 'mailto:hello@example.com' )['hotspots']
		);

		$layers = rtgodam_sanitize_hotspot_links( array( $layer ) );

		$this->assertSame(
			array( 'https://example.com/a', '', 'mailto:hello@example.com' ),
			array_column( $layers[0]['hotspots'], 'link' )
		);
	}

	public function test_a_hotspot_without_a_link_is_left_alone(): void {
		$layer = $this->layer_with_link( '' );
		unset( $layer['hotspots'][0]['link'] );

		$this->assertSame( array( $layer ), rtgodam_sanitize_hotspot_links( array( $layer ) ) );
	}

	public function test_layers_without_hotspots_are_returned_as_they_were(): void {
		$layers = array(
			array(
				'id'              => 'woo-1',
				'type'            => 'woo',
				'productHotspots' => array(
					array(
						'productId' => 7,
						'link'      => 'javascript:alert(1)',
					),
				),
			),
			array(
				'id'       => 'empty',
				'type'     => 'hotspot',
				'hotspots' => array(),
			),
		);

		$this->assertSame( $layers, rtgodam_sanitize_hotspot_links( $layers ) );
	}

	public function test_malformed_layers_do_not_error(): void {
		$layers = array(
			'not a layer',
			array(
				'type'     => 'hotspot',
				'hotspots' => 'not a list',
			),
			array(
				'type'     => 'hotspot',
				'hotspots' => array(
					'not a hotspot',
					array( 'link' => array( 'https://example.com/' ) ),
					array( 'link' => 'https://example.com/ok' ),
				),
			),
		);

		$result = rtgodam_sanitize_hotspot_links( $layers );

		$this->assertSame( 'not a layer', $result[0] );
		$this->assertSame( 'not a list', $result[1]['hotspots'] );
		$this->assertSame( 'not a hotspot', $result[2]['hotspots'][0] );
		$this->assertSame( '', $result[2]['hotspots'][1]['link'] );
		$this->assertSame( 'https://example.com/ok', $result[2]['hotspots'][2]['link'] );
		$this->assertSame( array(), rtgodam_sanitize_hotspot_links( 'not layers' ) );
	}

	/**
	 * Render the block for an image whose attachment has the given layers.
	 *
	 * @param array $layers Layers stored in the attachment's `rtgodam_meta`.
	 * @return string The block's markup.
	 */
	private function render_block( array $layers ): string {
		$GLOBALS['rtgodam_stub']['post_meta'] = array(
			'rtgodam_meta' => array( 'layers' => $layers ),
		);

		$attributes = array(
			'id'  => 42,
			'url' => 'https://example.test/wp-content/uploads/photo.jpg',
			'alt' => 'A photo',
		);

		ob_start();
		include dirname( __DIR__, 2 ) . '/assets/src/blocks/godam-image/render.php';

		return (string) ob_get_clean();
	}

	/**
	 * The layers the block printed for the front-end script.
	 *
	 * @param string $markup Block markup.
	 * @return array
	 */
	private function printed_layers( string $markup ): array {
		$this->assertSame( 1, preg_match( '/data-godam-image-layers="([^"]*)"/', $markup, $matches ), 'The block printed no layers.' );

		return json_decode( html_entity_decode( $matches[1], ENT_QUOTES, 'UTF-8' ), true );
	}

	public function test_the_image_block_prints_only_safe_hotspot_links(): void {
		$layer             = $this->layer_with_link( 'https://example.com/a' );
		$layer['hotspots'] = array_merge(
			$layer['hotspots'],
			$this->layer_with_link( 'javascript:alert(1)' )['hotspots'],
			$this->layer_with_link( 'mailto:hello@example.com' )['hotspots']
		);

		$printed = $this->printed_layers( $this->render_block( array( $layer ) ) );

		$this->assertSame(
			array( 'https://example.com/a', '', 'mailto:hello@example.com' ),
			array_column( $printed[0]['hotspots'], 'link' )
		);
		$this->assertSame( 'Shop', $printed[0]['hotspots'][1]['tooltipText'] );
		$this->assertSame(
			array(
				'x' => 10,
				'y' => 20,
			),
			$printed[0]['hotspots'][1]['position']
		);
	}

	public function test_the_image_block_still_renders_a_hotspot_whose_link_was_emptied(): void {
		$markup = $this->render_block( array( $this->layer_with_link( 'javascript:alert(1)' ) ) );

		$this->assertStringContainsString( 'data-godam-image-layers=', $markup );
		$this->assertStringContainsString( 'godam-image-layer', $markup );
		$this->assertStringNotContainsString( 'javascript:', $markup );
	}
}
