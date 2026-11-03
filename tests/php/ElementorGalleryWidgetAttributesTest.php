<?php
/**
 * Unit tests for the gallery the GoDAM Gallery Elementor widget renders.
 *
 * The widget's settings reach the [godam_video_gallery] renderer as attribute values and never
 * as shortcode syntax.
 *
 * Each test runs in its own process because it loads the player-entry stubs, which declare
 * Elementor's widget base class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Elementor_Widgets\Godam_Gallery;

/**
 * @covers \RTGODAM\Inc\Elementor_Widgets\Godam_Gallery::render
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class ElementorGalleryWidgetAttributesTest extends TestCase {

	/**
	 * @var Godam_Gallery
	 */
	private $widget;

	/**
	 * @var array[] Attributes each gallery render received.
	 */
	private $gallery_atts = array();

	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__ ) . '/stubs/player-entry-stubs.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/elementor-widgets/class-base.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/elementor-widgets/class-godam-gallery.php';

		$GLOBALS['rtgodam_stub'] = array(
			'elementor_settings' => array(
				'mode'             => 'query',
				'layout'           => 'grid',
				'item_width'       => 'S',
				'view_ratio'       => '16:9',
				'show_title'       => 'yes',
				'performance_mode' => 'balanced',
				'show_play_button' => 'yes',
				'interaction'      => 'hover',
				'count'            => array( 'size' => 6 ),
				'orderby'          => 'date',
				'order'            => 'desc',
				'media_folder'     => array( 12, 15 ),
				'author'           => array(),
			),
		);
		rtgodam_stub_register_player_and_marker();

		$this->gallery_atts = array();
		$atts               = &$this->gallery_atts;
		add_shortcode(
			'godam_video_gallery',
			static function ( $received ) use ( &$atts ) {
				$atts[] = $received;
				return '<div class="godam-gallery-double"></div>';
			}
		);

		$this->widget = ( new \ReflectionClass( Godam_Gallery::class ) )->newInstanceWithoutConstructor();
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		parent::tearDown();
	}

	/**
	 * Render the widget.
	 *
	 * @return string
	 */
	private function render_widget() {
		$render = new \ReflectionMethod( Godam_Gallery::class, 'render' );
		$render->setAccessible( true );

		ob_start();
		$render->invoke( $this->widget );

		return ob_get_clean();
	}

	/** A normal widget renders the gallery with its settings as string attributes. */
	public function test_a_normal_widget_renders_the_gallery_with_its_settings() {
		$html = $this->render_widget();

		$this->assertStringContainsString( 'godam-gallery-double', $html );
		$this->assertCount( 1, $this->gallery_atts );
		$this->assertSame(
			$this->sorted(
				array(
					'mode'                => 'query',
					'layout'              => 'grid',
					'item_width'          => 'S',
					'view_ratio'          => '16:9',
					'show_title'          => 'true',
					'interaction'         => 'hover',
					'show_play_button'    => 'true',
					'performance_mode'    => 'balanced',
					'engagements'         => 'false',
					'count'               => '6',
					'orderby'             => 'date',
					'order'               => 'desc',
					'media_folder'        => '12,15',
					'author'              => '',
					'date_range'          => '',
					'custom_date_start'   => '',
					'custom_date_end'     => '',
					'enable_more_items'   => 'false',
					'more_items_behavior' => '',
				)
			),
			$this->sorted( $this->gallery_atts[0] )
		);
	}

	/** Handpicked videos are passed as a comma-separated list of IDs. */
	public function test_handpicked_videos_are_passed_as_ids() {
		$GLOBALS['rtgodam_stub']['elementor_settings']['mode']             = 'handpicked';
		$GLOBALS['rtgodam_stub']['elementor_settings']['handpicked_items'] = array(
			array( 'video' => array( 'id' => '31' ) ),
			array( 'video' => array( 'id' => '32' ) ),
		);

		$this->render_widget();

		$this->assertSame( '31,32', $this->gallery_atts[0]['ids'] );
	}

	/** Shortcode text in a setting is not run. */
	public function test_shortcode_text_in_a_setting_is_not_run() {
		$GLOBALS['rtgodam_stub']['elementor_settings']['custom_date_start'] = 'x][gx_marker]';

		$html = $this->render_widget();

		$this->assertSame( 0, $GLOBALS['rtgodam_stub']['marker_runs'] );
		$this->assertStringNotContainsString( 'GX-MARKER', $html );
		$this->assertCount( 1, $this->gallery_atts );
		$this->assertSame( 'x][gx_marker]', $this->gallery_atts[0]['custom_date_start'] );
		$this->assertArrayNotHasKey( 'shortcodes', $GLOBALS['rtgodam_stub'] );
	}

	/**
	 * Sort attributes by name, so the comparison does not depend on their order.
	 *
	 * @param array $atts Attributes.
	 * @return array
	 */
	private function sorted( array $atts ) {
		ksort( $atts );

		return $atts;
	}
}
