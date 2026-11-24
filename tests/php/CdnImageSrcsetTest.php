<?php
/**
 * Unit tests for the srcset GoDAM prints for images served from its CDN.
 *
 * Media_Library_Ajax::filter_virtual_media_srcset() replaces core's srcset with the
 * sizes in the `rtgodam_image_sizes` meta. These tests pin that it follows core's
 * rules while doing so: only sizes with the shape of the image being shown (no square
 * crops for a landscape or portrait image, issue #2320), nothing wider than
 * `max_srcset_image_width`, and the full-size CDN file included, so a wide or
 * high-DPI screen is not limited to the CDN's 768px copy.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Media_Library_Ajax;

/**
 * @covers \RTGODAM\Inc\Media_Library_Ajax::filter_virtual_media_srcset
 * @covers \RTGODAM\Inc\Media_Library_Ajax::build_cdn_srcset_sources
 */
class CdnImageSrcsetTest extends TestCase {

	const CDN = 'https://n8e0ka87m9.gdcdn.us/abc/';

	/**
	 * Reset the stubs.
	 *
	 * @return void
	 */
	protected function setUp(): void {
		$GLOBALS['rtgodam_stub']['mime']            = 'image/webp';
		$GLOBALS['rtgodam_stub']['post_meta_by_id'] = array();
		$GLOBALS['rtgodam_hooks']                   = array();
	}

	/**
	 * One CDN size entry, as GoDAM stores it in `rtgodam_image_sizes`.
	 *
	 * @param string $file   File name on the CDN.
	 * @param int    $width  Width.
	 * @param int    $height Height.
	 * @return array The entry.
	 */
	private function size( $file, $width, $height ) {
		return array(
			'url'    => self::CDN . $file,
			'file'   => $file,
			'width'  => $width,
			'height' => $height,
		);
	}

	/**
	 * The sizes GoDAM's CDN made for the godam.io 2.9.0 poster (2000 x 1334):
	 * square crops, plus one proportional size that stops at 768px.
	 *
	 * @return array CDN size map.
	 */
	private function poster_sizes() {
		return array(
			'thumbnail'    => $this->size( 'poster-150x150.webp', 150, 150 ),
			'medium'       => $this->size( 'poster-300x300.webp', 300, 300 ),
			'square-400'   => $this->size( 'poster-400x400.webp', 400, 400 ),
			'square-600'   => $this->size( 'poster-600x600.webp', 600, 600 ),
			'medium_large' => $this->size( 'poster-768x512.webp', 768, 512 ),
			'1536x1536'    => $this->size( 'poster-768x512.webp', 768, 512 ),
		);
	}

	/**
	 * Run the srcset filter for attachment 7 with the given CDN meta.
	 *
	 * @param array $sizes      `rtgodam_image_sizes` meta.
	 * @param array $size_array Displayed size.
	 * @param array $image_meta Image meta (full width and height).
	 * @param bool  $with_full  Whether the full-size CDN URL is stored.
	 * @return array|false Sources keyed by width, or false.
	 */
	private function srcset( $sizes, $size_array, $image_meta, $with_full = true ) {
		$GLOBALS['rtgodam_stub']['post_meta_by_id'][7] = array(
			'rtgodam_image_sizes'    => $sizes,
			'rtgodam_transcoded_url' => $with_full ? self::CDN . 'poster.webp' : '',
			'_godam_original_id'     => '',
		);

		$instance = ( new \ReflectionClass( Media_Library_Ajax::class ) )->newInstanceWithoutConstructor();

		// Core's own list, which the filter replaces.
		$core_sources = array(
			300 => array(
				'url'        => 'https://example.test/wp-content/uploads/poster-300x200.webp',
				'descriptor' => 'w',
				'value'      => 300,
			),
		);

		return $instance->filter_virtual_media_srcset( $core_sources, $size_array, self::CDN . 'poster-768x512.webp', $image_meta, 7 );
	}

	/**
	 * Widths and file names of the sources, in width order.
	 *
	 * @param array|false $sources Sources.
	 * @return array Width => file name.
	 */
	private function files( $sources ) {
		$this->assertIsArray( $sources );
		ksort( $sources );
		return array_map(
			static function ( $source ) {
				return basename( $source['url'] );
			},
			$sources
		);
	}

	/**
	 * A landscape image never offers a square crop, and offers the full-size file.
	 *
	 * @return void
	 */
	public function test_landscape_image_lists_only_its_own_shape_and_the_full_file() {
		$sources = $this->srcset(
			$this->poster_sizes(),
			array( 2000, 1334 ),
			array(
				'width'  => 2000,
				'height' => 1334,
			) 
		);

		$this->assertSame(
			array(
				768  => 'poster-768x512.webp',
				2000 => 'poster.webp',
			),
			$this->files( $sources )
		);
		$this->assertSame( 'w', $sources[2000]['descriptor'] );
		$this->assertSame( 2000, $sources[2000]['value'] );
	}

	/**
	 * A portrait image smaller than 768px gets only its full file, so no srcset at all,
	 * rather than the square crops it got before (the screenshot in #2320).
	 *
	 * @return void
	 */
	public function test_portrait_image_with_only_square_crops_gets_no_srcset() {
		$sizes = array(
			'thumbnail'  => $this->size( 'shot-150x150.webp', 150, 150 ),
			'medium'     => $this->size( 'shot-300x300.webp', 300, 300 ),
			'square-600' => $this->size( 'shot-600x600.webp', 600, 600 ),
		);

		$this->assertFalse(
			$this->srcset(
				$sizes,
				array( 560, 752 ),
				array(
					'width'  => 560,
					'height' => 752,
				) 
			) 
		);
	}

	/**
	 * A square crop shown as a square keeps the square sizes, as core does.
	 *
	 * @return void
	 */
	public function test_square_crop_shown_as_square_keeps_square_sizes() {
		$sources = $this->srcset(
			$this->poster_sizes(),
			array( 300, 300 ),
			array(
				'width'  => 2000,
				'height' => 1334,
			) 
		);

		$this->assertSame(
			array(
				150 => 'poster-150x150.webp',
				300 => 'poster-300x300.webp',
				400 => 'poster-400x400.webp',
				600 => 'poster-600x600.webp',
			),
			$this->files( $sources )
		);
	}

	/**
	 * Sizes wider than `max_srcset_image_width` are left out.
	 *
	 * @return void
	 */
	public function test_sizes_wider_than_the_limit_are_left_out() {
		$GLOBALS['rtgodam_hooks']['max_srcset_image_width'][10][] = static function () {
			return 1000;
		};

		$sources = $this->srcset(
			array(
				'medium'       => $this->size( 'poster-300x200.webp', 300, 200 ),
				'medium_large' => $this->size( 'poster-768x512.webp', 768, 512 ),
				'1536x1536'    => $this->size( 'poster-1536x1024.webp', 1536, 1024 ),
			),
			array( 768, 512 ),
			array(
				'width'  => 2000,
				'height' => 1334,
			)
		);

		$this->assertSame(
			array(
				300 => 'poster-300x200.webp',
				768 => 'poster-768x512.webp',
			),
			$this->files( $sources )
		);
	}

	/**
	 * Without a stored full-size URL, the matching CDN sizes are still listed.
	 *
	 * @return void
	 */
	public function test_without_a_full_size_url_the_matching_sizes_are_listed() {
		$sources = $this->srcset(
			array(
				'medium'       => $this->size( 'poster-300x200.webp', 300, 200 ),
				'medium_large' => $this->size( 'poster-768x512.webp', 768, 512 ),
				'square-600'   => $this->size( 'poster-600x600.webp', 600, 600 ),
			),
			array( 2000, 1334 ),
			array(
				'width'  => 2000,
				'height' => 1334,
			),
			false
		);

		$this->assertSame(
			array(
				300 => 'poster-300x200.webp',
				768 => 'poster-768x512.webp',
			),
			$this->files( $sources )
		);
	}

	/**
	 * An entry with no height can't be checked for shape, so it is left out.
	 *
	 * @return void
	 */
	public function test_entry_without_height_is_left_out() {
		$sources = $this->srcset(
			array(
				'medium'       => $this->size( 'poster-300x200.webp', 300, 200 ),
				'odd'          => array(
					'url'   => self::CDN . 'poster-500.webp',
					'width' => 500,
				),
				'medium_large' => $this->size( 'poster-768x512.webp', 768, 512 ),
			),
			array( 2000, 1334 ),
			array(
				'width'  => 2000,
				'height' => 1334,
			),
			false
		);

		$this->assertArrayNotHasKey( 500, $sources );
	}

	/**
	 * An image GoDAM doesn't manage keeps core's srcset untouched.
	 *
	 * @return void
	 */
	public function test_image_godam_does_not_manage_keeps_core_srcset() {
		$sources = $this->srcset(
			array(),
			array( 2000, 1334 ),
			array(
				'width'  => 2000,
				'height' => 1334,
			),
			false 
		);

		$this->assertSame( array( 300 ), array_keys( $sources ) );
		$this->assertStringStartsWith( 'https://example.test/', $sources[300]['url'] );
	}
}
