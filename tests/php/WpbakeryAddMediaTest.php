<?php
/**
 * Tests how godam/add-media-to-page adds media to a WPBakery page.
 *
 * @package GoDAM
 */

declare( strict_types = 1 );

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Abilities\Block_Abilities;

/**
 * On a page built with WPBakery the media goes in as GoDAM's WPBakery element,
 * in a new row, with the attribute names the element saves.
 *
 * Runs in its own process because it defines core functions.
 *
 * @covers \RTGODAM\Inc\Abilities\Block_Abilities
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class WpbakeryAddMediaTest extends TestCase {

	/**
	 * Calls a private method of the ability group.
	 *
	 * @param string $method Method name.
	 * @param array  $args   Arguments.
	 *
	 * @return mixed
	 */
	private function call( $method, array $args ) {
		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-ability-group.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-block-abilities.php';

		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		if ( ! class_exists( 'WP_Post' ) ) {
			eval( 'final class WP_Post { public $ID = 0; public $post_content = ""; public function __construct( $post = null ) {} }' );
		}
		if ( ! function_exists( 'sanitize_text_field' ) ) {
			eval( 'function sanitize_text_field( $text ) { return trim( strip_tags( (string) $text ) ); }' );
		}
		// phpcs:enable Squiz.PHP.Eval.Discouraged

		$reflection = new \ReflectionClass( Block_Abilities::class );
		$target     = $reflection->getMethod( $method );

		if ( PHP_VERSION_ID < 80100 ) {
			$target->setAccessible( true );
		}

		return $target->invokeArgs( $reflection->newInstanceWithoutConstructor(), $args );
	}

	/**
	 * Returns a post with the given content.
	 *
	 * @param int    $id      Post ID.
	 * @param string $content Post content.
	 *
	 * @return \WP_Post
	 */
	private function post( $id, $content ) {
		if ( ! class_exists( 'WP_Post' ) ) {
			eval( 'final class WP_Post { public $ID = 0; public $post_content = ""; public function __construct( $post = null ) {} }' ); // phpcs:ignore Squiz.PHP.Eval.Discouraged -- test-only stub, isolated process.
		}

		$post               = new \WP_Post( (object) array() );
		$post->ID           = $id;
		$post->post_content = $content;

		return $post;
	}

	/**
	 * A page with WPBakery rows, or with the WPBakery editor turned on, is a WPBakery page.
	 *
	 * @return void
	 */
	public function test_detects_wpbakery_pages() {
		$GLOBALS['rtgodam_stub'] = array( 'post_meta_by_id' => array( 7 => array( '_wpb_vc_js_status' => 'true' ) ) );

		$this->assertTrue( $this->call( 'is_wpbakery_page', array( $this->post( 5, '[vc_row][vc_column][vc_column_text]Hi[/vc_column_text][/vc_column][/vc_row]' ) ) ) );
		$this->assertTrue( $this->call( 'is_wpbakery_page', array( $this->post( 7, '' ) ) ), 'An empty page with the WPBakery editor on.' );
		$this->assertFalse( $this->call( 'is_wpbakery_page', array( $this->post( 9, '<!-- wp:paragraph --><p>Hi</p><!-- /wp:paragraph -->' ) ) ) );
	}

	/**
	 * A video becomes the godam_video element with its player settings.
	 *
	 * @return void
	 */
	public function test_video_element_with_player_settings() {
		$result = $this->call(
			'wpbakery_markup',
			array(
				array(
					'name'      => 'godam/video',
					'media_ids' => array( 42 ),
				),
				array(
					'autoplay'             => 'true',
					'controls'             => false,
					'out_of_view_behavior' => 'pause',
					'caption'              => 'Lesson "one" [intro]',
				),
			)
		);

		$this->assertSame( 'godam_video', $result['element'] );
		$this->assertSame(
			'[vc_row][vc_column][godam_video id="42" autoplay="1" controls="0" muted="1" out_of_view="pause" caption="Lesson one intro" show_caption="1"][/vc_column][/vc_row]',
			$result['markup']
		);
	}

	/**
	 * Audio, image, document and gallery map to their own elements.
	 *
	 * @return void
	 */
	public function test_other_media_types() {
		$cases = array(
			'godam/audio'      => '[godam_audio id="3"]',
			'godam/image'      => '[godam_image id="3"]',
			'godam/pdf'        => '[godam_document id="3"]',
			'godam/gallery-v2' => '[godam_video_gallery mode="handpicked" ids="3,4"]',
		);

		foreach ( $cases as $block => $shortcode ) {
			$result = $this->call(
				'wpbakery_markup',
				array(
					array(
						'name'      => $block,
						'media_ids' => array( 3, 4 ),
					),
					array(),
				)
			);

			$this->assertSame( '[vc_row][vc_column]' . $shortcode . '[/vc_column][/vc_row]', $result['markup'], $block );
		}
	}
}
