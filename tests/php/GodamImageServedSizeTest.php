<?php
/**
 * Unit tests for the image size the GoDAM Image block prints (#2401).
 *
 * The block saves the image's width and height when it is picked in the editor, and
 * WordPress's own metadata keeps the size of the file uploaded to WordPress. Both go
 * stale once the image is replaced in GoDAM with one of a different size. The block
 * prints the size of the image GoDAM serves now, saved from the transcoder callback in
 * the `rtgodam_image_dimensions` meta, and falls back to the old sources without it.
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
 * @coversNothing
 */
class GodamImageServedSizeTest extends TestCase {

	private const ATTACHMENT_ID = 42;

	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__ ) . '/stubs/hooks.php';
		require_once dirname( __DIR__ ) . '/stubs/godam-image-render-functions.php';
		require_once dirname( __DIR__ ) . '/stubs/layer-registry.php';

		$GLOBALS['rtgodam_hooks'] = array();
		$GLOBALS['rtgodam_stub']  = array(
			'post_meta'            => array(),
			'attachment_image_url' => 'https://abc.gdcdn.us/xyz/photo.webp?v=v3',
		);
		rtgodam_test_register_core_layer_types();
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'], $GLOBALS['rtgodam_hooks'] );
		parent::tearDown();
	}

	/**
	 * Render the block and return its frame style and the image's width and height.
	 *
	 * @param array $attributes Block attributes.
	 * @return array{frame: string, width: string|null, height: string|null}
	 */
	private function render( array $attributes ): array {
		ob_start();
		include dirname( __DIR__, 2 ) . '/assets/src/blocks/godam-image/render.php';
		$markup = (string) ob_get_clean();

		$this->assertSame( 1, preg_match( '/<img[^>]*>/', $markup, $img ), 'The block printed no image.' );
		preg_match( '/class="godam-image__frame"\s+style="([^"]*)"/', $markup, $frame );

		return array(
			'frame'  => $frame[1] ?? '',
			'width'  => preg_match( '/\bwidth="(\d+)"/', $img[0], $w ) ? $w[1] : null,
			'height' => preg_match( '/\bheight="(\d+)"/', $img[0], $h ) ? $h[1] : null,
		);
	}

	/**
	 * Give the attachment the size GoDAM serves now, and GoDAM's URL for it on the CDN
	 * host the block prints (set in setUp()).
	 *
	 * @param mixed $value Meta value.
	 */
	private function served_size( $value ): void {
		$GLOBALS['rtgodam_stub']['post_meta_by_id'][ self::ATTACHMENT_ID ]['rtgodam_image_dimensions'] = $value;
		$GLOBALS['rtgodam_stub']['post_meta_by_id'][ self::ATTACHMENT_ID ]['rtgodam_transcoded_url']   = 'https://abc.gdcdn.us/xyz/photo.webp';
	}

	/**
	 * Before GoDAM's image sizes arrive, the URL is not switched to the CDN and the block
	 * shows the local file. The served size belongs to GoDAM's copy, which may be a newer
	 * image of another shape, so the block keeps the size that matches the local file.
	 */
	public function test_ignores_the_served_size_while_the_local_file_is_shown(): void {
		$this->served_size(
			array(
				'width'  => 900,
				'height' => 1600,
			)
		);
		$GLOBALS['rtgodam_stub']['attachment_image_url'] = 'https://example.test/wp-content/uploads/2026/11/photo.png';

		$out = $this->render(
			array(
				'id'     => self::ATTACHMENT_ID,
				'url'    => 'https://example.test/wp-content/uploads/2026/11/photo.png',
				'width'  => 1600,
				'height' => 900,
			)
		);

		$this->assertSame( '1600', $out['width'] );
		$this->assertSame( '900', $out['height'] );
		$this->assertStringContainsString( 'max-width:1600px', $out['frame'] );
	}

	public function test_prints_the_served_size_over_the_size_saved_on_the_block(): void {
		$this->served_size(
			array(
				'width'  => 2560,
				'height' => 1800,
			)
		);

		$out = $this->render(
			array(
				'id'     => self::ATTACHMENT_ID,
				'url'    => 'https://abc.gdcdn.us/xyz/photo.webp?v=v2',
				'width'  => 1030,
				'height' => 207,
			)
		);

		$this->assertSame( '2560', $out['width'] );
		$this->assertSame( '1800', $out['height'] );
		$this->assertStringContainsString( 'max-width:2560px', $out['frame'] );
	}

	public function test_prints_the_served_size_over_stale_wordpress_metadata_for_a_copied_block(): void {
		$this->served_size(
			array(
				'width'  => 2560,
				'height' => 1800,
			)
		);
		$GLOBALS['rtgodam_stub']['attachment_metadata'] = array(
			'width'  => 1030,
			'height' => 207,
		);

		$out = $this->render( array( 'id' => self::ATTACHMENT_ID ) );

		$this->assertSame( '2560', $out['width'] );
		$this->assertSame( '1800', $out['height'] );
	}

	public function test_keeps_the_saved_size_without_a_served_size(): void {
		$GLOBALS['rtgodam_stub']['attachment_metadata'] = array(
			'width'  => 1030,
			'height' => 207,
		);

		$out = $this->render(
			array(
				'id'     => self::ATTACHMENT_ID,
				'url'    => 'https://abc.gdcdn.us/xyz/photo.webp',
				'width'  => 800,
				'height' => 600,
			)
		);

		$this->assertSame( '800', $out['width'] );
		$this->assertSame( '600', $out['height'] );
	}

	public function test_reads_wordpress_metadata_when_neither_is_there(): void {
		$GLOBALS['rtgodam_stub']['attachment_metadata'] = array(
			'width'  => 1030,
			'height' => 207,
		);

		$out = $this->render( array( 'id' => self::ATTACHMENT_ID ) );

		$this->assertSame( '1030', $out['width'] );
		$this->assertSame( '207', $out['height'] );
	}

	public function test_ignores_a_served_size_missing_a_side(): void {
		$this->served_size( array( 'width' => 2560 ) );

		$out = $this->render(
			array(
				'id'     => self::ATTACHMENT_ID,
				'url'    => 'https://abc.gdcdn.us/xyz/photo.webp',
				'width'  => 800,
				'height' => 600,
			)
		);

		$this->assertSame( '800', $out['width'] );
		$this->assertSame( '600', $out['height'] );
	}

	/**
	 * A block copied from another site keeps its own image, so the size GoDAM serves for
	 * this site's attachment with the same ID is not printed for it.
	 */
	public function test_keeps_the_saved_size_when_the_block_shows_another_image(): void {
		$this->served_size(
			array(
				'width'  => 2560,
				'height' => 1800,
			)
		);

		$out = $this->render(
			array(
				'id'     => self::ATTACHMENT_ID,
				'url'    => 'https://abc.gdcdn.us/h7/hero.webp',
				'width'  => 800,
				'height' => 600,
			)
		);

		$this->assertSame( '800', $out['width'] );
		$this->assertSame( '600', $out['height'] );
	}
}
