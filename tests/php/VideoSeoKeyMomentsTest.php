<?php
/**
 * Unit tests for Google "key moments" in the VideoObject schema (#1597).
 *
 * Each GoDAM chapter becomes a schema.org Clip in `hasPart`, with a deep link
 * that seeks the player on the host page: `<page>?t=<seconds>#godam-video-<id>`.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Seo;

require_once dirname( __DIR__ ) . '/stubs/video-seo-functions.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/class-seo.php';

/**
 * @covers \RTGODAM\Inc\Seo
 */
class VideoSeoKeyMomentsTest extends TestCase {

	const PAGE = 'https://example.test/demo/';

	/**
	 * @var Seo
	 */
	private $seo;

	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['rtgodam_stub']  = array();
		$GLOBALS['rtgodam_hooks'] = array();
		$this->seo                = ( new \ReflectionClass( Seo::class ) )->newInstanceWithoutConstructor();
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		$GLOBALS['rtgodam_hooks'] = array();
		parent::tearDown();
	}

	/**
	 * Chapters as the video editor stores them in rtgodam_meta.
	 *
	 * @return array
	 */
	private function chapters() {
		return array(
			array(
				'id'        => 'c2',
				'text'      => 'On-page basics',
				'startTime' => '60',
			),
			array(
				'id'        => 'c1',
				'text'      => 'Introduction',
				'startTime' => '0',
			),
			array(
				'id'        => 'c3',
				'text'      => 'Technical SEO',
				'startTime' => '300.5',
			),
		);
	}

	// -----------------------------------------------------------------------------------
	// chapters_to_clips().
	// -----------------------------------------------------------------------------------

	public function test_chapters_become_sorted_clips_with_deep_links() {
		$clips = Seo::chapters_to_clips( $this->chapters(), self::PAGE, 42, 600 );

		$this->assertSame(
			array(
				array(
					'@type'       => 'Clip',
					'name'        => 'Introduction',
					'startOffset' => 0,
					'endOffset'   => 60,
					'url'         => 'https://example.test/demo/?t=0#godam-video-42',
				),
				array(
					'@type'       => 'Clip',
					'name'        => 'On-page basics',
					'startOffset' => 60,
					'endOffset'   => 300,
					'url'         => 'https://example.test/demo/?t=60#godam-video-42',
				),
				array(
					'@type'       => 'Clip',
					'name'        => 'Technical SEO',
					'startOffset' => 300,
					'endOffset'   => 600,
					'url'         => 'https://example.test/demo/?t=300#godam-video-42',
				),
			),
			$clips
		);
	}

	public function test_explicit_end_time_is_used() {
		$chapters = array(
			array(
				'text'      => 'Intro',
				'startTime' => '0',
				'endTime'   => '25',
			),
			array(
				'text'      => 'Main',
				'startTime' => '40',
			),
		);

		$clips = Seo::chapters_to_clips( $chapters, self::PAGE, 1, 100 );

		$this->assertSame( 25, $clips[0]['endOffset'] );
		$this->assertSame( 100, $clips[1]['endOffset'] );
	}

	public function test_last_clip_has_no_end_when_duration_is_unknown() {
		$clips = Seo::chapters_to_clips( $this->chapters(), self::PAGE, 42, 0 );

		$this->assertArrayNotHasKey( 'endOffset', $clips[2] );
		$this->assertSame( 300, $clips[2]['startOffset'] );
	}

	public function test_end_is_clamped_to_the_video_duration() {
		$chapters = array(
			array(
				'text'      => 'Only',
				'startTime' => '10',
				'endTime'   => '999',
			),
		);

		$this->assertSame( 50, Seo::chapters_to_clips( $chapters, self::PAGE, 1, 50 )[0]['endOffset'] );
	}

	public function test_invalid_chapters_are_skipped() {
		$chapters = array(
			array(
				'text'      => '',
				'startTime' => '5',
			),
			array(
				'text'      => 'No start',
				'startTime' => 'abc',
			),
			array(
				'text'      => 'After the end',
				'startTime' => '120',
			),
			array(
				'text'      => 'Valid',
				'startTime' => '10',
			),
			array(
				'text'      => 'Zero length',
				'startTime' => '20',
				'endTime'   => '20',
			),
		);

		$clips = Seo::chapters_to_clips( $chapters, self::PAGE, 1, 100 );

		$this->assertSame( array( 'Valid' ), array_column( $clips, 'name' ) );
	}

	public function test_duplicate_start_times_keep_the_first_chapter() {
		$chapters = array(
			array(
				'text'      => 'First',
				'startTime' => '0',
			),
			array(
				'text'      => 'Duplicate',
				'startTime' => '0.4',
			),
			array(
				'text'      => 'Second',
				'startTime' => '30',
			),
		);

		$clips = Seo::chapters_to_clips( $chapters, self::PAGE, 1, 60 );

		$this->assertSame( array( 'First', 'Second' ), array_column( $clips, 'name' ) );
	}

	public function test_duplicate_is_dropped_before_ends_are_worked_out() {
		// "Recap" floors to the same second as "Intro" and is dropped. Intro must
		// still end at Main's start, not at the dropped row's start (0).
		$chapters = array(
			array(
				'text'      => 'Intro',
				'startTime' => '0',
			),
			array(
				'text'      => 'Recap',
				'startTime' => '0.4',
			),
			array(
				'text'      => 'Main',
				'startTime' => '30',
			),
		);

		$clips = Seo::chapters_to_clips( $chapters, self::PAGE, 1, 120 );

		$this->assertSame( array( 'Intro', 'Main' ), array_column( $clips, 'name' ) );
		$this->assertSame( array( 0, 30 ), array_column( $clips, 'startOffset' ) );
		$this->assertSame( array( 30, 120 ), array_column( $clips, 'endOffset' ) );
	}

	public function test_neighbouring_clips_never_overlap() {
		$chapters = array(
			array(
				'text'      => 'A',
				'startTime' => '10.2',
				'endTime'   => '20.7',
			),
			array(
				'text'      => 'B',
				'startTime' => '20.5',
			),
			array(
				'text'      => 'C',
				'startTime' => '40',
				'endTime'   => '90',
			),
			array(
				'text'      => 'D',
				'startTime' => '60',
			),
		);

		$clips = Seo::chapters_to_clips( $chapters, self::PAGE, 1, 100 );

		$this->assertSame( array( 10, 20, 40, 60 ), array_column( $clips, 'startOffset' ) );
		// A's end rounds down; C's explicit end is capped at D's start.
		$this->assertSame( array( 20, 40, 60, 100 ), array_column( $clips, 'endOffset' ) );

		$count = count( $clips );
		for ( $i = 1; $i < $count; $i++ ) {
			$this->assertLessThanOrEqual( $clips[ $i ]['startOffset'], $clips[ $i - 1 ]['endOffset'] );
		}
	}

	public function test_chapter_names_are_stripped_of_html() {
		$chapters = array(
			array(
				'text'      => '<b>Intro</b> &amp; welcome',
				'startTime' => '0',
			),
		);

		$this->assertSame( 'Intro &amp; welcome', Seo::chapters_to_clips( $chapters, self::PAGE, 1, 10 )[0]['name'] );
	}

	public function test_original_time_is_used_when_start_time_is_missing() {
		$chapters = array(
			array(
				'text'         => 'From original time',
				'originalTime' => '01:30',
			),
		);

		$this->assertSame( 90, Seo::chapters_to_clips( $chapters, self::PAGE, 1, 200 )[0]['startOffset'] );
	}

	public function test_url_uses_ampersand_for_plain_permalinks_and_drops_existing_fragment() {
		$chapters = array(
			array(
				'text'      => 'Intro',
				'startTime' => '15',
			),
		);

		$this->assertSame(
			'https://example.test/?p=10&t=15#godam-video-7',
			Seo::chapters_to_clips( $chapters, 'https://example.test/?p=10#comments', 7, 60 )[0]['url']
		);
	}

	/**
	 * @dataProvider time_provider
	 *
	 * @param mixed      $value    Input.
	 * @param float|null $expected Seconds.
	 */
	public function test_parse_time_to_seconds( $value, $expected ) {
		$this->assertSame( $expected, Seo::parse_time_to_seconds( $value ) );
	}

	/**
	 * @return array
	 */
	public function time_provider() {
		return array(
			'seconds'     => array( '90', 90.0 ),
			'decimal'     => array( '12.5', 12.5 ),
			'int'         => array( 30, 30.0 ),
			'mm:ss'       => array( '01:30', 90.0 ),
			'hh:mm:ss'    => array( '1:02:03', 3723.0 ),
			'hh:mm:ss.ms' => array( '00:00:05.250', 5.25 ),
			'empty'       => array( '', null ),
			'null'        => array( null, null ),
			'garbage'     => array( 'soon', null ),
			'array'       => array( array( 1 ), null ),
		);
	}

	public function test_iso8601_to_seconds() {
		$this->assertSame( 3723, Seo::iso8601_to_seconds( 'PT1H2M3S' ) );
		$this->assertSame( 0, Seo::iso8601_to_seconds( 'nope' ) );
	}

	// -----------------------------------------------------------------------------------
	// In the schema.
	// -----------------------------------------------------------------------------------

	/**
	 * A cached SEO entry for attachment 42.
	 *
	 * @return array
	 */
	private function entry() {
		return array(
			'headline'      => 'SEO basics',
			'description'   => 'Learn SEO.',
			'duration'      => 'PT10M',
			'thumbnailUrl'  => 'https://cdn.example.test/t.jpg',
			'uploadDate'    => '2026-01-15T08:00:00+00:00',
			'attachment_id' => 42,
		);
	}

	public function test_schema_has_part_lists_chapters_as_clips() {
		$GLOBALS['rtgodam_stub']['post_meta']['rtgodam_meta'] = array( 'chapters' => $this->chapters() );

		$schema = $this->seo->build_video_object_schema( $this->entry(), 10 );

		$this->assertCount( 3, $schema['hasPart'] );
		$this->assertSame( 'Clip', $schema['hasPart'][0]['@type'] );
		$this->assertSame( 'https://shop.test/?p=10&t=60#godam-video-42', $schema['hasPart'][1]['url'] );
		// Last clip ends at the video duration (PT10M).
		$this->assertSame( 600, $schema['hasPart'][2]['endOffset'] );
	}

	public function test_no_has_part_for_videos_under_30_seconds() {
		$GLOBALS['rtgodam_stub']['post_meta']['rtgodam_meta'] = array( 'chapters' => $this->chapters() );

		$entry             = $this->entry();
		$entry['duration'] = 'PT29S';

		$this->assertArrayNotHasKey( 'hasPart', $this->seo->build_video_object_schema( $entry, 10 ) );

		$entry['duration'] = 'PT30S';
		$schema            = $this->seo->build_video_object_schema( $entry, 10 );

		// 30 seconds is enough; the 60s and 300s chapters are past the end.
		$this->assertSame( array( 'Introduction' ), array_column( $schema['hasPart'], 'name' ) );
	}

	public function test_has_part_kept_when_duration_is_unknown() {
		$GLOBALS['rtgodam_stub']['post_meta']['rtgodam_meta'] = array( 'chapters' => $this->chapters() );

		$entry = $this->entry();
		unset( $entry['duration'] );

		$this->assertCount( 3, $this->seo->build_video_object_schema( $entry, 10 )['hasPart'] );
	}

	public function test_no_has_part_without_chapters() {
		$schema = $this->seo->build_video_object_schema( $this->entry(), 10 );

		$this->assertArrayNotHasKey( 'hasPart', $schema );
	}

	public function test_no_has_part_without_a_host_page() {
		$GLOBALS['rtgodam_stub']['post_meta']['rtgodam_meta'] = array( 'chapters' => $this->chapters() );

		// Render-time output on an archive / 404: no page to deep-link into.
		$schema = $this->seo->build_video_object_schema( $this->entry(), 0 );

		$this->assertArrayNotHasKey( 'hasPart', $schema );
	}

	public function test_no_has_part_without_an_attachment() {
		$GLOBALS['rtgodam_stub']['post_meta']['rtgodam_meta'] = array( 'chapters' => $this->chapters() );

		$entry = $this->entry();
		unset( $entry['attachment_id'] );

		$this->assertArrayNotHasKey( 'hasPart', $this->seo->build_video_object_schema( $entry, 10 ) );
	}

	public function test_key_moments_can_be_turned_off_with_a_filter() {
		$GLOBALS['rtgodam_stub']['post_meta']['rtgodam_meta'] = array( 'chapters' => $this->chapters() );
		add_filter(
			'godam_video_seo_key_moments_enabled',
			function () {
				return false;
			}
		);

		$this->assertArrayNotHasKey( 'hasPart', $this->seo->build_video_object_schema( $this->entry(), 10 ) );
	}

	public function test_clips_filter_can_change_the_output() {
		$GLOBALS['rtgodam_stub']['post_meta']['rtgodam_meta'] = array( 'chapters' => $this->chapters() );
		add_filter(
			'godam_video_seo_key_moments',
			function ( $clips ) {
				return array_slice( $clips, 0, 1 );
			}
		);

		$this->assertCount( 1, $this->seo->build_video_object_schema( $this->entry(), 10 )['hasPart'] );
	}

	public function test_has_part_is_valid_json() {
		$GLOBALS['rtgodam_stub']['post_meta']['rtgodam_meta'] = array( 'chapters' => $this->chapters() );

		$json    = wp_json_encode( $this->seo->build_video_object_schema( $this->entry(), 10 ) );
		$decoded = json_decode( $json, true );

		$this->assertSame( 0, $decoded['hasPart'][0]['startOffset'] );
		$this->assertIsInt( $decoded['hasPart'][0]['endOffset'] );
	}
}
