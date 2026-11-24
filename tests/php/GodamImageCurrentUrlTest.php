<?php
/**
 * Unit tests for the image URL the GoDAM Image block prints (#2401).
 *
 * The block saves the image URL when it is picked in the editor. That saved URL goes
 * stale: it can be the local uploads file of an image GoDAM now serves from its CDN,
 * or an older version of an image that was replaced since. The block prints the
 * attachment's current URL and keeps the saved one only for a deleted attachment.
 *
 * Each test runs in its own process: the stubs below stand in for WordPress functions
 * that other tests define differently.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Media_Library_Ajax;

/**
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 *
 * @coversNothing
 */
class GodamImageCurrentUrlTest extends TestCase {

	private const SAVED_URL = 'https://example.test/wp-content/uploads/2026/11/photo.png';

	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__ ) . '/stubs/hooks.php';
		require_once dirname( __DIR__ ) . '/stubs/godam-image-render-functions.php';
		require_once dirname( __DIR__ ) . '/stubs/layer-registry.php';

		$GLOBALS['rtgodam_hooks'] = array();
		$GLOBALS['rtgodam_stub']  = array( 'post_meta' => array() );
		rtgodam_test_register_core_layer_types();
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'], $GLOBALS['rtgodam_hooks'] );
		parent::tearDown();
	}

	/**
	 * Render the block and return the `src` of its image.
	 *
	 * @param array $attributes Block attributes.
	 * @return string
	 */
	private function rendered_src( array $attributes ): string {
		ob_start();
		include dirname( __DIR__, 2 ) . '/assets/src/blocks/godam-image/render.php';
		$markup = (string) ob_get_clean();

		$this->assertSame( 1, preg_match( '/<img[^>]*\bsrc="([^"]*)"/', $markup, $matches ), 'The block printed no image.' );

		return html_entity_decode( $matches[1], ENT_QUOTES, 'UTF-8' );
	}

	public function test_prints_the_cdn_url_when_the_block_saved_the_local_file(): void {
		$GLOBALS['rtgodam_stub']['attachment_image_url'] = 'https://abc.gdcdn.us/xyz/photo.webp?v=v1';

		$src = $this->rendered_src(
			array(
				'id'  => 42,
				'url' => self::SAVED_URL,
			)
		);

		$this->assertSame( 'https://abc.gdcdn.us/xyz/photo.webp?v=v1', $src );
	}

	public function test_prints_the_replaced_version_when_the_block_saved_an_older_one(): void {
		$GLOBALS['rtgodam_stub']['attachment_image_url'] = 'https://abc.gdcdn.us/xyz/photo.webp?v=v3';

		$src = $this->rendered_src(
			array(
				'id'  => 42,
				'url' => 'https://abc.gdcdn.us/xyz/photo.webp?v=v2',
			)
		);

		$this->assertSame( 'https://abc.gdcdn.us/xyz/photo.webp?v=v3', $src );
	}

	public function test_keeps_the_saved_url_when_the_attachment_is_gone(): void {
		$GLOBALS['rtgodam_stub']['attachment_image_url'] = false;

		$src = $this->rendered_src(
			array(
				'id'  => 42,
				'url' => self::SAVED_URL,
			)
		);

		$this->assertSame( self::SAVED_URL, $src );
	}

	/**
	 * Runs the real GoDAM URL filters behind the lookup, so this fails if the block asks
	 * for a size GoDAM resolves differently, or if the filters stop returning the CDN URL
	 * for an image offloaded from the Media Library.
	 */
	public function test_the_real_godam_filters_give_the_cdn_url_for_a_media_library_image(): void {
		$godam_ajax = ( new \ReflectionClass( Media_Library_Ajax::class ) )->newInstanceWithoutConstructor();
		add_filter( 'wp_get_attachment_url', array( $godam_ajax, 'filter_attachment_url_for_virtual_media' ), 10, 2 );
		add_filter( 'image_downsize', array( $godam_ajax, 'filter_image_downsize_for_virtual_media' ), 10, 3 );

		$GLOBALS['rtgodam_stub']['attachment_image_url_via_core'] = true;
		$GLOBALS['rtgodam_stub']['attachment_url']                = self::SAVED_URL;
		$GLOBALS['rtgodam_stub']['mime']                          = 'image/png';
		$GLOBALS['rtgodam_stub']['post_meta_by_id'][42]           = array(
			'rtgodam_transcoded_url' => 'https://abc.gdcdn.us/xyz/photo.webp?v=v3',
			'rtgodam_image_sizes'    => array(
				'medium' => array(
					'url'    => 'https://abc.gdcdn.us/xyz/photo-300x200.webp?v=v3',
					'width'  => 300,
					'height' => 200,
				),
			),
		);

		$src = $this->rendered_src(
			array(
				'id'  => 42,
				'url' => self::SAVED_URL,
			)
		);

		$this->assertSame( 'full', $GLOBALS['rtgodam_stub']['attachment_image_size'] );
		$this->assertSame( 'https://abc.gdcdn.us/xyz/photo.webp?v=v3', $src );
	}

	public function test_uses_the_attachment_url_when_the_block_saved_none(): void {
		$GLOBALS['rtgodam_stub']['attachment_image_url'] = 'https://abc.gdcdn.us/xyz/photo.webp';

		$this->assertSame( 'https://abc.gdcdn.us/xyz/photo.webp', $this->rendered_src( array( 'id' => 42 ) ) );
	}
}
