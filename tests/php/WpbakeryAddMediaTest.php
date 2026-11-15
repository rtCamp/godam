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
	 * Pretends WPBakery is active, as it is once js_composer.php has loaded.
	 *
	 * Each test runs in its own process, so the constant does not leak.
	 *
	 * @return void
	 */
	private function activate_wpbakery() {
		define( 'WPB_VC_VERSION', '8.7.1' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- the constant WPBakery defines, isolated process.
	}

	/**
	 * A page that still has [vc_row] is not a WPBakery page while WPBakery is inactive.
	 *
	 * The rows would print as text, so the media goes in as a block instead.
	 *
	 * @return void
	 */
	public function test_a_page_with_rows_is_not_a_wpbakery_page_while_wpbakery_is_inactive() {
		$GLOBALS['rtgodam_stub'] = array( 'post_meta_by_id' => array( 7 => array( '_wpb_vc_js_status' => 'true' ) ) );

		$this->assertFalse( $this->call( 'is_wpbakery_page', array( $this->post( 5, '[vc_row][vc_column][vc_column_text]Hi[/vc_column_text][/vc_column][/vc_row]' ) ) ) );
		$this->assertFalse( $this->call( 'is_wpbakery_page', array( $this->post( 7, '' ) ) ), 'An empty page with the editor flag on.' );
	}

	/**
	 * With WPBakery active, a page with rows, or an empty page with the editor on, is a WPBakery page.
	 *
	 * @return void
	 */
	public function test_detects_wpbakery_pages() {
		$this->activate_wpbakery();

		$GLOBALS['rtgodam_stub'] = array(
			'post_meta_by_id' => array(
				7 => array( '_wpb_vc_js_status' => 'true' ),
				8 => array( '_wpb_vc_js_status' => 'true' ),
			),
		);

		$this->assertTrue( $this->call( 'is_wpbakery_page', array( $this->post( 5, '[vc_row][vc_column][vc_column_text]Hi[/vc_column_text][/vc_column][/vc_row]' ) ) ) );
		$this->assertTrue( $this->call( 'is_wpbakery_page', array( $this->post( 7, '' ) ) ), 'An empty page with the WPBakery editor on.' );
		$this->assertTrue( $this->call( 'is_wpbakery_page', array( $this->post( 8, " \n\t " ) ) ), 'A page with only whitespace and the WPBakery editor on.' );
	}

	/**
	 * The editor flag alone does not make a page with block or plain content a WPBakery page.
	 *
	 * A shortcode row added there would be glued onto the last block.
	 *
	 * @return void
	 */
	public function test_the_editor_flag_does_not_claim_a_page_that_has_other_content() {
		$this->activate_wpbakery();

		$GLOBALS['rtgodam_stub'] = array(
			'post_meta_by_id' => array(
				9  => array( '_wpb_vc_js_status' => 'true' ),
				10 => array( '_wpb_vc_js_status' => 'true' ),
			),
		);

		$this->assertFalse( $this->call( 'is_wpbakery_page', array( $this->post( 9, '<!-- wp:paragraph --><p>Hi</p><!-- /wp:paragraph -->' ) ) ), 'Block content with the editor flag on.' );
		$this->assertFalse( $this->call( 'is_wpbakery_page', array( $this->post( 10, 'Plain text.' ) ) ), 'Plain content with the editor flag on.' );
	}

	/**
	 * With WPBakery active, a page with no rows and no editor flag is not a WPBakery page.
	 *
	 * @return void
	 */
	public function test_a_page_without_rows_or_the_editor_flag_is_not_a_wpbakery_page() {
		$this->activate_wpbakery();

		$GLOBALS['rtgodam_stub'] = array();

		$this->assertFalse( $this->call( 'is_wpbakery_page', array( $this->post( 11, '<!-- wp:paragraph --><p>Hi</p><!-- /wp:paragraph -->' ) ) ) );
		$this->assertFalse( $this->call( 'is_wpbakery_page', array( $this->post( 12, '' ) ) ), 'An empty page that was never opened in WPBakery.' );
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
			'godam/gallery-v2' => '[godam_video_gallery mode="handpicked" handpicked_items="%5B%7B%22video_id%22%3A%223%22%7D%2C%7B%22video_id%22%3A%224%22%7D%5D"]',
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

	/**
	 * The gallery goes in as the element's own param group, not as ids.
	 *
	 * The WPBakery gallery element edits handpicked_items. A kept ids attribute
	 * would win over it when the shortcode renders, so an editor change would be
	 * ignored.
	 *
	 * @return void
	 */
	public function test_gallery_is_written_as_the_handpicked_items_param_group() {
		$result = $this->call(
			'wpbakery_markup',
			array(
				array(
					'name'      => 'godam/gallery-v2',
					'media_ids' => array( 3, 4 ),
				),
				array(),
			)
		);

		$this->assertSame( 1, preg_match( '/ handpicked_items="([^"]*)"/', $result['markup'], $matches ), 'The gallery carries handpicked_items.' );
		$this->assertStringContainsString( ' mode="handpicked"', $result['markup'] );
		$this->assertStringNotContainsString( ' ids=', $result['markup'], 'ids would win over what the editor saves.' );

		// Decoded the way Godam_Video_Gallery::render() reads it.
		$this->assertSame(
			array(
				array( 'video_id' => '3' ),
				array( 'video_id' => '4' ),
			),
			json_decode( rawurldecode( $matches[1] ), true )
		);
	}
}
