<?php
/**
 * Unit tests for the LearnDash Video Progression integration.
 *
 * Covers the parts that decide what counts as a GoDAM video for LearnDash and
 * how the "Use GoDAM Video" switch is stored, without WordPress or LearnDash.
 * The test API base (see tests/stubs/site-functions.php) is https://api.test.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\LearnDash\LearnDash;

require_once dirname( __DIR__ ) . '/stubs/site-functions.php';
require_once dirname( __DIR__ ) . '/stubs/i18n.php';
require_once dirname( __DIR__ ) . '/stubs/learndash-functions.php';

/**
 * @covers \RTGODAM\Inc\LearnDash\LearnDash
 */
class LearnDashIntegrationTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__, 2 ) . '/inc/traits/trait-singleton.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/learndash/class-learndash.php';
	}

	protected function tearDown(): void {
		unset( $_POST['learndash-lesson-display-content-settings'] );
		parent::tearDown();
	}

	/**
	 * LearnDash without its constructor (it registers WP hooks).
	 *
	 * @return LearnDash
	 */
	private function integration() {
		return ( new \ReflectionClass( LearnDash::class ) )->newInstanceWithoutConstructor();
	}

	public function test_marker_without_a_video_means_the_content_block() {
		$this->assertSame( 0, LearnDash::get_marker_video_id( LearnDash::BLOCK_MARKER ) );
		$this->assertSame( 0, LearnDash::get_marker_video_id( '  ' . LearnDash::BLOCK_MARKER . "\n" ) );
		$this->assertTrue( LearnDash::is_marker( LearnDash::BLOCK_MARKER ) );
	}

	/**
	 * Markers that carry a picked video, as saved or escaped by LearnDash.
	 *
	 * @return array<string, array{0: string}>
	 */
	public function picked_markers() {
		return array(
			'double quotes'  => array( '[video_godam id="123"]' ),
			'single quotes'  => array( "[video_godam id='123']" ),
			'no quotes'      => array( '[video_godam id=123]' ),
			'escaped quotes' => array( '[video_godam id=&quot;123&quot;]' ),
			'whitespace'     => array( " [video_godam  id=\"123\" ]\n" ),
		);
	}

	/**
	 * @dataProvider picked_markers
	 *
	 * @param string $value Video URL setting value.
	 */
	public function test_marker_carries_the_picked_video( $value ) {
		$this->assertSame( 123, LearnDash::get_marker_video_id( $value ) );
		$this->assertTrue( LearnDash::is_marker( $value ) );
	}

	public function test_other_values_are_not_the_marker() {
		$this->assertNull( LearnDash::get_marker_video_id( '' ) );
		$this->assertNull( LearnDash::get_marker_video_id( '[video src="https://example.test/a.mp4"][/video]' ) );
		$this->assertNull( LearnDash::get_marker_video_id( '[video_godam id="12" extra="1"]' ) );
		$this->assertNull( LearnDash::get_marker_video_id( '[video_godam id="abc"]' ) );
		$this->assertNull( LearnDash::get_marker_video_id( '[video_godam id="1\']' ) );
		$this->assertNull( LearnDash::get_marker_video_id( '[video_godamx]' ) );
		$this->assertNull( LearnDash::get_marker_video_id( 'https://www.youtube.com/watch?v=abc' ) );
		$this->assertNull( LearnDash::get_marker_video_id( null ) );
		$this->assertNull( LearnDash::get_marker_video_id( array( LearnDash::BLOCK_MARKER ) ) );
		$this->assertFalse( LearnDash::is_marker( 'https://www.youtube.com/watch?v=abc' ) );
	}

	public function test_marker_is_built_for_a_picked_video_or_the_content_block() {
		$this->assertSame( '[video_godam id="45"]', LearnDash::build_marker( 45 ) );
		$this->assertSame( LearnDash::BLOCK_MARKER, LearnDash::build_marker( 0 ) );
		$this->assertSame( 45, LearnDash::get_marker_video_id( LearnDash::build_marker( 45 ) ) );
	}

	public function test_picked_video_plays_in_a_godam_video_block() {
		$block = LearnDash::build_video_block( 45 );

		$this->assertSame( 'godam/video', $block['blockName'] );
		$this->assertSame( array( 'id' => 45 ), $block['attrs'] );
	}

	/**
	 * Video URL values that point at GoDAM.
	 *
	 * @return array<string, array{0: string}>
	 */
	public function godam_values() {
		return array(
			'video URL'            => array( 'https://api.test/web/video/abc' ),
			'host in capitals'     => array( 'HTTPS://API.TEST/web/video/abc' ),
			'iframe embed code'    => array( '<iframe src="https://api.test/web/embed/abc" width="640"></iframe>' ),
			'escaped iframe code'  => array( '&lt;iframe src=&quot;https://api.test/web/embed/abc&quot;&gt;&lt;/iframe&gt;' ),
			'embed shortcode'      => array( '[embed]https://api.test/web/video/abc[/embed]' ),
			'LearnDash video wrap' => array( '[video src="https://api.test/web/video/abc"][/video]' ),
			'with a query string'  => array( 'https://api.test/web/video/abc?autoplay=1' ),
		);
	}

	/**
	 * @dataProvider godam_values
	 *
	 * @param string $value Video URL setting value.
	 */
	public function test_godam_values_are_godam_urls( $value ) {
		$this->assertTrue( LearnDash::is_godam_url( $value ) );
		$this->assertTrue( LearnDash::is_godam_source( $value ) );
	}

	/**
	 * Video URL values that only mention GoDAM, or are another provider.
	 *
	 * @return array<string, array{0: mixed}>
	 */
	public function other_values() {
		return array(
			'YouTube'            => array( 'https://www.youtube.com/watch?v=abc' ),
			'longer host'        => array( 'https://api.test.example.com/web/video/abc' ),
			'subdomain'          => array( 'https://evil.api.test/web/video/abc' ),
			'GoDAM in the path'  => array( 'https://example.test/api.test/web/video/abc' ),
			'GoDAM in the query' => array( 'https://example.test/?u=https%3A%2F%2Fapi.test%2Fweb' ),
			'not a URL'          => array( 'api.test/web/video/abc' ),
			'empty'              => array( '' ),
			'not a string'       => array( null ),
		);
	}

	/**
	 * @dataProvider other_values
	 *
	 * @param mixed $value Video URL setting value.
	 */
	public function test_other_values_are_not_godam_urls( $value ) {
		$this->assertFalse( LearnDash::is_godam_url( $value ) );
	}

	public function test_embed_iframe_is_built_from_a_video_or_embed_url() {
		$from_video = LearnDash::build_embed_iframe( 'https://api.test/web/video/abc_12-x' );
		$from_embed = LearnDash::build_embed_iframe( 'https://api.test/web/embed/abc_12-x/?autoplay=1' );

		$this->assertStringContainsString( '<iframe src="https://api.test/web/embed/abc_12-x"', $from_video );
		$this->assertStringContainsString( 'allowfullscreen', $from_video );
		$this->assertStringContainsString( '<iframe src="https://api.test/web/embed/abc_12-x"', $from_embed );
	}

	public function test_no_embed_iframe_for_other_urls() {
		$this->assertSame( '', LearnDash::build_embed_iframe( 'https://example.test/web/video/abc' ) );
		$this->assertSame( '', LearnDash::build_embed_iframe( 'https://api.test/web/folder/abc' ) );
		$this->assertSame( '', LearnDash::build_embed_iframe( 'https://api.test/web/video/abc/extra' ) );
		$this->assertSame( '', LearnDash::build_embed_iframe( 'https://api.test/web/video/a"b' ) );
	}

	public function test_find_video_block_finds_the_first_one_inside_other_blocks() {
		$first  = array(
			'blockName'   => 'godam/video',
			'attrs'       => array( 'id' => 1 ),
			'innerBlocks' => array(),
		);
		$second = array(
			'blockName'   => 'godam/video',
			'attrs'       => array( 'id' => 2 ),
			'innerBlocks' => array(),
		);

		$blocks = array(
			array(
				'blockName'   => 'core/paragraph',
				'attrs'       => array(),
				'innerBlocks' => array(),
			),
			array(
				'blockName'   => 'core/group',
				'attrs'       => array(),
				'innerBlocks' => array(
					array(
						'blockName'   => 'core/columns',
						'attrs'       => array(),
						'innerBlocks' => array( $first ),
					),
				),
			),
			$second,
		);

		$this->assertSame( $first, LearnDash::find_video_block( $blocks ) );
	}

	public function test_find_video_block_returns_null_without_one() {
		$this->assertNull(
			LearnDash::find_video_block(
				array(
					array(
						'blockName'   => 'core/video',
						'attrs'       => array(),
						'innerBlocks' => array(),
					),
					array(
						'blockName' => null,
						'attrs'     => array(),
					),
				)
			)
		);
	}

	public function test_turning_use_godam_on_stores_the_marker() {
		$settings = LearnDash::apply_use_godam_setting(
			array(
				'lesson_video_enabled' => 'on',
				'lesson_video_url'     => 'https://www.youtube.com/watch?v=abc',
			),
			true
		);

		$this->assertSame( LearnDash::BLOCK_MARKER, $settings['lesson_video_url'] );
		$this->assertSame( 'on', $settings['lesson_video_enabled'] );
	}

	public function test_turning_use_godam_on_with_a_picked_video_stores_it_in_the_marker() {
		$settings = LearnDash::apply_use_godam_setting( array( 'lesson_video_url' => '[video_godam]' ), true, 77 );

		$this->assertSame( '[video_godam id="77"]', $settings['lesson_video_url'] );
	}

	public function test_turning_use_godam_off_clears_only_the_marker() {
		$cleared = LearnDash::apply_use_godam_setting( array( 'lesson_video_url' => " [video_godam]\n" ), false );
		$picked  = LearnDash::apply_use_godam_setting( array( 'lesson_video_url' => '[video_godam id=&quot;77&quot;]' ), false );
		$kept    = LearnDash::apply_use_godam_setting( array( 'lesson_video_url' => 'https://api.test/web/video/abc' ), false );

		$this->assertSame( '', $cleared['lesson_video_url'] );
		$this->assertSame( '', $picked['lesson_video_url'] );
		$this->assertSame( 'https://api.test/web/video/abc', $kept['lesson_video_url'] );
	}

	/**
	 * LearnDash integration whose attachment check answers from a list of video IDs.
	 *
	 * @param int[] $video_ids Attachment IDs that are videos.
	 *
	 * @return LearnDash
	 */
	private function integration_with_videos( array $video_ids ) {
		$GLOBALS['rtgodam_ld_test_videos'] = $video_ids;

		$class = get_class(
			new class() extends LearnDash {

				public function __construct() {} // phpcs:ignore Squiz.Commenting.FunctionComment.Missing -- test double.

				public static function is_video_attachment( int $attachment_id ): bool { // phpcs:ignore Squiz.Commenting.FunctionComment.Missing -- test double.
					return in_array( $attachment_id, $GLOBALS['rtgodam_ld_test_videos'], true );
				}
			}
		);

		return new $class();
	}

	public function test_save_stores_the_picked_video() {
		$_POST['learndash-lesson-display-content-settings'] = array(
			LearnDash::FIELD       => 'on',
			LearnDash::VIDEO_FIELD => '77',
		);

		$settings = $this->integration_with_videos( array( 77 ) )->save_settings_field(
			array( 'lesson_video_url' => '' ),
			'learndash-lesson-display-content-settings'
		);

		$this->assertSame( '[video_godam id="77"]', $settings['lesson_video_url'] );
	}

	public function test_save_ignores_a_picked_attachment_that_is_not_a_video() {
		$_POST['learndash-lesson-display-content-settings'] = array(
			LearnDash::FIELD       => 'on',
			LearnDash::VIDEO_FIELD => '88',
		);

		$settings = $this->integration_with_videos( array( 77 ) )->save_settings_field(
			array( 'lesson_video_url' => '' ),
			'learndash-lesson-display-content-settings'
		);

		$this->assertSame( LearnDash::BLOCK_MARKER, $settings['lesson_video_url'] );
	}

	public function test_save_ignores_an_unresolved_godam_id() {
		$_POST['learndash-lesson-display-content-settings'] = array(
			LearnDash::FIELD       => 'on',
			LearnDash::VIDEO_FIELD => 'qvbgt6hd9u',
		);

		$settings = $this->integration_with_videos( array( 77 ) )->save_settings_field(
			array( 'lesson_video_url' => '' ),
			'learndash-lesson-display-content-settings'
		);

		$this->assertSame( LearnDash::BLOCK_MARKER, $settings['lesson_video_url'] );
	}

	public function test_picked_video_goes_down_the_local_path_while_it_is_a_video() {
		$integration = $this->integration_with_videos( array( 77 ) );

		$this->assertSame( 'local', $integration->filter_video_provider( false, array( 'lesson_video_url' => '[video_godam id="77"]' ) ) );
		$this->assertFalse( $integration->filter_video_provider( false, array( 'lesson_video_url' => '[video_godam id="88"]' ) ) );
	}

	public function test_picked_video_is_renamed_to_the_godam_provider() {
		$data = $this->integration()->filter_video_data(
			array( 'videos_found_provider' => 'local' ),
			array( 'lesson_video_url' => '[video_godam id="77"]' )
		);

		$this->assertSame( LearnDash::PROVIDER, $data['videos_found_provider'] );
	}

	public function test_player_settings_come_from_the_step_settings() {
		$data = $this->integration()->filter_video_data(
			array(
				'videos_found_provider' => 'local',
				'videos_auto_start'     => false,
				'videos_show_controls'  => false,
			),
			array(
				'lesson_video_url'           => LearnDash::BLOCK_MARKER,
				'lesson_video_auto_start'    => 'on',
				'lesson_video_show_controls' => '',
				'lesson_video_focus_pause'   => 'on',
				'lesson_video_track_time'    => 'on',
			)
		);

		$this->assertSame(
			array(
				'auto_start'    => true,
				'show_controls' => false,
				'focus_pause'   => true,
				'track_time'    => true,
			),
			$data['rtgodam_player']
		);
	}

	public function test_save_reads_the_switch_from_the_metabox_form() {
		$_POST['learndash-lesson-display-content-settings'] = array( LearnDash::FIELD => 'on' );

		$settings = $this->integration()->save_settings_field(
			array( 'lesson_video_url' => '' ),
			'learndash-lesson-display-content-settings'
		);

		$this->assertSame( LearnDash::BLOCK_MARKER, $settings['lesson_video_url'] );
	}

	public function test_save_reads_an_unchecked_switch_as_off_when_the_form_was_posted() {
		$_POST['learndash-lesson-display-content-settings'] = array( 'lesson_video_url' => '[video_godam]' );

		$settings = $this->integration()->save_settings_field(
			array( 'lesson_video_url' => '[video_godam]' ),
			'learndash-lesson-display-content-settings'
		);

		$this->assertSame( '', $settings['lesson_video_url'] );
	}

	public function test_rest_saves_keep_the_marker_they_set() {
		unset( $_POST['learndash-lesson-display-content-settings'] );

		$settings = $this->integration()->save_settings_field(
			array(
				'lesson_video_enabled' => 'on',
				'lesson_video_url'     => '[video_godam]',
			),
			'learndash-lesson-display-content-settings'
		);

		$this->assertSame( '[video_godam]', $settings['lesson_video_url'] );
	}

	public function test_save_leaves_settings_alone_when_learndash_did_not_read_the_form() {
		$_POST['learndash-lesson-display-content-settings'] = array( LearnDash::FIELD => 'on' );

		$settings = $this->integration()->save_settings_field(
			array( 'lesson_video_shown' => 'AFTER' ),
			'learndash-lesson-display-content-settings'
		);

		$this->assertSame( array( 'lesson_video_shown' => 'AFTER' ), $settings );
	}

	public function test_switch_and_picker_are_added_right_before_the_video_url() {
		$fields = $this->integration()->add_settings_field(
			array(
				'lesson_video_enabled' => array( 'name' => 'lesson_video_enabled' ),
				'lesson_video_url'     => array(
					'name'  => 'lesson_video_url',
					'value' => " [video_godam]\n",
				),
				'lesson_video_shown'   => array( 'name' => 'lesson_video_shown' ),
			),
			'learndash-topic-display-content-settings'
		);

		$this->assertSame(
			array( 'lesson_video_enabled', LearnDash::FIELD, LearnDash::VIDEO_FIELD, 'lesson_video_url', 'lesson_video_shown' ),
			array_keys( $fields )
		);
		$this->assertSame( 'on', $fields[ LearnDash::FIELD ]['value'] );
		$this->assertSame( 'checkbox-switch', $fields[ LearnDash::FIELD ]['type'] );
		$this->assertSame( 'lesson_video_enabled', $fields[ LearnDash::FIELD ]['parent_setting'] );
		$this->assertSame( 'custom', $fields[ LearnDash::VIDEO_FIELD ]['type'] );
		$this->assertSame( 'lesson_video_enabled', $fields[ LearnDash::VIDEO_FIELD ]['parent_setting'] );
		$this->assertStringContainsString( 'name="learndash-topic-display-content-settings[lesson_video_godam_id]" value=""', $fields[ LearnDash::VIDEO_FIELD ]['html'] );
	}

	public function test_picker_shows_the_saved_video() {
		$GLOBALS['rtgodam_stub']['title'] = 'Intro <video>';

		$html = LearnDash::get_picker_html( 'learndash-lesson-display-content-settings', 77 );

		unset( $GLOBALS['rtgodam_stub']['title'] );

		$this->assertStringContainsString( 'id="learndash-lesson-display-content-settings_lesson_video_godam_id_picker"', $html );
		$this->assertStringContainsString( 'value="77"', $html );
		$this->assertStringContainsString( 'Intro &lt;video&gt;', $html );
		$this->assertStringContainsString( '>Replace</button>', $html );
		$this->assertStringContainsString( 'rtgodam-ld-video-picker is-picked', $html );
		$this->assertStringContainsString( '<button type="button" class="button rtgodam-ld-video-picker__remove">', $html );
	}

	public function test_switch_is_off_for_another_video_and_absent_from_other_metaboxes() {
		$fields = array(
			'lesson_video_url' => array(
				'name'  => 'lesson_video_url',
				'value' => 'https://www.youtube.com/watch?v=abc',
			),
		);

		$lesson = $this->integration()->add_settings_field( $fields, 'learndash-lesson-display-content-settings' );
		$course = $this->integration()->add_settings_field( $fields, 'learndash-course-display-content-settings' );

		$this->assertSame( '', $lesson[ LearnDash::FIELD ]['value'] );
		$this->assertSame( $fields, $course );
	}

	public function test_godam_url_goes_down_the_local_path_only_when_learndash_found_no_provider() {
		$integration = $this->integration();
		$settings    = array( 'lesson_video_url' => 'https://api.test/web/video/abc' );

		$this->assertSame( 'local', $integration->filter_video_provider( false, $settings ) );
		$this->assertSame( 'local', $integration->filter_video_provider( '', $settings ) );
		$this->assertSame( 'youtube', $integration->filter_video_provider( 'youtube', array( 'lesson_video_url' => 'https://youtu.be/abc' ) ) );
		$this->assertFalse( $integration->filter_video_provider( false, array( 'lesson_video_url' => 'https://example.test/video' ) ) );
	}

	public function test_godam_sources_are_renamed_to_the_godam_provider() {
		$integration = $this->integration();
		$data        = array(
			'videos_found_provider' => 'local',
			'video_cookie_key'      => 'learndash-video-progress-abc',
		);

		$block = $integration->filter_video_data( $data, array( 'lesson_video_url' => LearnDash::BLOCK_MARKER ) );
		$embed = $integration->filter_video_data( $data, array( 'lesson_video_url' => '[video src="https://api.test/web/video/abc"][/video]' ) );

		$this->assertSame( LearnDash::PROVIDER, $block['videos_found_provider'] );
		$this->assertSame( LearnDash::PROVIDER, $embed['videos_found_provider'] );
		$this->assertSame( 'learndash-video-progress-abc', $block['video_cookie_key'] );
	}

	public function test_other_videos_keep_their_provider() {
		$integration = $this->integration();

		$local   = $integration->filter_video_data(
			array( 'videos_found_provider' => 'local' ),
			array( 'lesson_video_url' => '[video src="https://example.test/a.mp4"][/video]' )
		);
		$youtube = $integration->filter_video_data(
			array( 'videos_found_provider' => 'youtube' ),
			array( 'lesson_video_url' => LearnDash::BLOCK_MARKER )
		);

		$this->assertSame( 'local', $local['videos_found_provider'] );
		$this->assertSame( 'youtube', $youtube['videos_found_provider'] );
	}
}
