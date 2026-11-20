<?php
/**
 * Unit tests for replacing Vimeo videos in Elementor data (Vimeo migration, issue #100).
 *
 * The fixture is real `_elementor_data`, saved through Elementor 4.1's
 * document API: a container with a Vimeo background video, a Vimeo Video
 * widget inside an inner container, a Vimeo Video widget with playback,
 * overlay, lightbox and Advanced-tab settings, and a YouTube Video widget.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Vimeo_Migration\Elementor_Source;

require_once dirname( __DIR__ ) . '/stubs/vimeo-migration-functions.php';

/**
 * @covers \RTGODAM\Inc\Vimeo_Migration\Elementor_Source
 */
class VimeoMigrationElementorTest extends TestCase {

	const VIMEO_URL = 'https://vimeo.com/1126119215?fl=pl&fe=sh';

	/**
	 * URLs the fake resolver was asked for.
	 *
	 * @var string[]
	 */
	private $resolved_urls = array();

	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['rtgodam_stub']  = array();
		$GLOBALS['rtgodam_hooks'] = array();
		$this->resolved_urls      = array();
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		$GLOBALS['rtgodam_hooks'] = array();
		parent::tearDown();
	}

	/**
	 * The stored element tree.
	 *
	 * @return array
	 */
	private function fixture(): array {
		return json_decode( file_get_contents( dirname( __DIR__ ) . '/fixtures/vimeo-migration/elementor-data.json' ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- local test fixture.
	}

	/**
	 * A resolver that knows the test video.
	 *
	 * @return callable
	 */
	private function resolver(): callable {
		return function ( string $url ) {
			$this->resolved_urls[] = $url;

			return array(
				'id'        => 501,
				'url'       => 'https://cdn.example.org/501/video.mp4',
				'title'     => 'Screen Recording',
				'sources'   => array(
					array(
						'src'  => 'https://cdn.example.org/501/video.mpd',
						'type' => 'application/dash+xml',
					),
				),
				'share_url' => 'https://app.godam.io/web/video/3fqjd5bmpr',
			);
		};
	}

	/**
	 * Run the migration over a tree.
	 *
	 * @param array    $elements Element tree.
	 * @param callable $resolve  Resolver.
	 *
	 * @return array{0: array, 1: array, 2: bool} New tree, counts, changed.
	 */
	private function migrate( array $elements, callable $resolve ): array {
		$counts  = array(
			'found'    => 0,
			'migrated' => 0,
		);
		$changed = false;
		$result  = ( new Elementor_Source( $resolve ) )->migrate_elements( $elements, 4909, $counts, $changed );

		return array( $result, $counts, $changed );
	}

	public function test_replaces_vimeo_video_widgets_and_counts_the_background_video() {
		list( $tree, $counts, $changed ) = $this->migrate( $this->fixture(), $this->resolver() );

		$this->assertTrue( $changed );
		$this->assertSame(
			array(
				'found'    => 3,
				'migrated' => 2,
			),
			$counts,
			'Two Video widgets replaced; the background video is found but kept.'
		);
		$this->assertSame( array( self::VIMEO_URL, self::VIMEO_URL ), $this->resolved_urls );

		// Background video on the container is left as it is.
		$this->assertSame( 'container', $tree[0]['elType'] );
		$this->assertSame( self::VIMEO_URL, $tree[0]['settings']['background_video_link'] );

		// Nested widget, default settings.
		$nested = $tree[0]['elements'][0]['elements'][0];
		$this->assertSame( 'a1b2c03', $nested['id'] );
		$this->assertSame( 'godam-video', $nested['widgetType'] );
		$this->assertSame( 'widget', $nested['elType'] );
		$this->assertSame(
			array(
				'video-file'   => array(
					'id'    => 501,
					'url'   => 'https://cdn.example.org/501/video.mp4',
					'title' => 'Screen Recording',
					'name'  => 'video.mp4',
					'icon'  => '',
				),
				'aspect_ratio' => '16:9',
			),
			$nested['settings']
		);
	}

	public function test_maps_playback_overlay_and_advanced_settings() {
		list( $tree ) = $this->migrate( $this->fixture(), $this->resolver() );

		$widget   = $tree[0]['elements'][1];
		$settings = $widget['settings'];

		$this->assertSame( 'a1b2c04', $widget['id'] );
		$this->assertSame( 'godam-video', $widget['widgetType'] );
		$this->assertSame( 'yes', $settings['autoplay'] );
		$this->assertSame( 'yes', $settings['muted'] );
		$this->assertSame( 'yes', $settings['loop'] );
		$this->assertSame( 'yes', $settings['show_in_lightbox'] );
		$this->assertSame( 'responsive', $settings['aspect_ratio'], 'Elementor 21:9 has no GoDAM equivalent.' );
		$this->assertSame(
			array(
				'id'  => 4810,
				'url' => 'https://example.org/wp-content/uploads/poster.jpeg',
			),
			$settings['poster']
		);
		$this->assertSame( 'my-vimeo-video', $settings['_css_classes'] );
		$this->assertSame( '20', $settings['_margin']['top'] );

		foreach ( array( 'video_type', 'vimeo_url', 'mute', 'lightbox', 'show_image_overlay', 'image_overlay' ) as $dropped ) {
			$this->assertArrayNotHasKey( $dropped, $settings );
		}
	}

	public function test_leaves_youtube_widgets_alone() {
		list( $tree ) = $this->migrate( $this->fixture(), $this->resolver() );

		$this->assertSame( $this->fixture()[0]['elements'][2], $tree[0]['elements'][2] );
	}

	public function test_keeps_widgets_when_the_video_is_not_in_godam_central() {
		$fixture = $this->fixture();

		list( $tree, $counts, $changed ) = $this->migrate(
			$fixture,
			static function () {
				return null;
			}
		);

		$this->assertFalse( $changed );
		$this->assertSame( $fixture, $tree );
		$this->assertSame(
			array(
				'found'    => 3,
				'migrated' => 0,
			),
			$counts
		);
	}

	public function test_skips_a_vimeo_url_from_a_dynamic_tag() {
		$elements = array(
			array(
				'id'         => 'd1',
				'elType'     => 'widget',
				'widgetType' => 'video',
				'settings'   => array(
					'video_type'  => 'vimeo',
					'vimeo_url'   => self::VIMEO_URL,
					'__dynamic__' => array( 'vimeo_url' => '[elementor-tag id="1" name="acf-url" settings="%7B%7D"]' ),
				),
				'elements'   => array(),
			),
		);

		list( $tree, $counts, $changed ) = $this->migrate( $elements, $this->resolver() );

		$this->assertFalse( $changed );
		$this->assertSame( $elements, $tree );
		$this->assertSame( 1, $counts['found'] );
		$this->assertSame( array(), $this->resolved_urls );
	}

	public function test_ignores_a_stale_vimeo_url_on_a_youtube_widget() {
		$elements = array(
			array(
				'id'         => 'y1',
				'elType'     => 'widget',
				'widgetType' => 'video',
				'settings'   => array(
					'video_type'  => 'youtube',
					'youtube_url' => 'https://www.youtube.com/watch?v=XHOmBV4js_E',
					'vimeo_url'   => self::VIMEO_URL,
				),
				'elements'   => array(),
			),
		);

		list( , $counts, $changed ) = $this->migrate( $elements, $this->resolver() );

		$this->assertFalse( $changed );
		$this->assertSame( 0, $counts['found'] );
	}

	public function test_keeps_only_advanced_keys_of_dynamic_and_global_settings() {
		$element = array(
			'id'         => 'g1',
			'elType'     => 'widget',
			'widgetType' => 'video',
			'settings'   => array(
				'video_type'  => 'vimeo',
				'vimeo_url'   => self::VIMEO_URL,
				'color'       => '#ff0000',
				'hide_mobile' => 'hidden-mobile',
				'__globals__' => array(
					'color'             => 'globals/colors?id=primary',
					'_background_color' => 'globals/colors?id=secondary',
				),
				'__dynamic__' => array( '_element_id' => '[elementor-tag id="2" name="post-id" settings="%7B%7D"]' ),
			),
			'elements'   => array(),
		);

		$settings = Elementor_Source::build_godam_video_element( $element, ( $this->resolver() )( self::VIMEO_URL ) )['settings'];

		$this->assertSame( array( '_background_color' => 'globals/colors?id=secondary' ), $settings['__globals__'] );
		$this->assertSame( array( '_element_id' => '[elementor-tag id="2" name="post-id" settings="%7B%7D"]' ), $settings['__dynamic__'] );
		$this->assertSame( 'hidden-mobile', $settings['hide_mobile'] );
		$this->assertArrayNotHasKey( 'color', $settings );
	}

	public function test_a_filter_can_migrate_another_widget() {
		add_filter(
			'rtgodam_migrate_elementor_vimeo_element_result',
			static function ( $args ) {
				if ( 'custom-vimeo' !== ( $args['element']['widgetType'] ?? '' ) ) {
					return $args;
				}

				$args['element']['widgetType'] = 'godam-video';
				$args['changed']               = true;
				$args['found']                 = 1;
				$args['migrated']              = 1;

				return $args;
			}
		);

		$elements = array(
			array(
				'id'         => 'c1',
				'elType'     => 'widget',
				'widgetType' => 'custom-vimeo',
				'settings'   => array( 'url' => self::VIMEO_URL ),
				'elements'   => array(),
			),
		);

		list( $tree, $counts, $changed ) = $this->migrate( $elements, $this->resolver() );

		$this->assertTrue( $changed );
		$this->assertSame( 'godam-video', $tree[0]['widgetType'] );
		$this->assertSame(
			array(
				'found'    => 1,
				'migrated' => 1,
			),
			$counts
		);
	}
}
