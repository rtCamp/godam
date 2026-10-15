<?php
/**
 * Unit tests for the VideoObject schema GoDAM outputs (issue #1622, v1).
 *
 * Pins down the four schema fixes:
 *
 * 1. contentUrl points at the HLS (.m3u8) stream, or the original file — never
 *    the DASH (.mpd) manifest, which Google can't index. This is resolved at
 *    output time, so pages cached before the fix are corrected without a re-save.
 * 2. embedUrl is the GoDAM player (video-embed page) URL.
 * 3. description is never output empty: transcript excerpt, then page excerpt,
 *    then the property is left out.
 * 4. isFamilyFriendly is a real JSON boolean, including for legacy string values.
 *
 * WordPress is stubbed (tests/bootstrap.php + tests/stubs/video-seo-functions.php),
 * driven by $GLOBALS['rtgodam_stub'].
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
class VideoSeoSchemaTest extends TestCase {

	/**
	 * Seo instance built without its constructor, so no hooks are registered.
	 *
	 * @var Seo
	 */
	private $seo;

	/**
	 * Temporary directories created by a test, removed in tearDown().
	 *
	 * @var string[]
	 */
	private $temp_dirs = array();

	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['rtgodam_stub']  = array();
		$GLOBALS['rtgodam_hooks'] = array();
		$this->seo                = ( new \ReflectionClass( Seo::class ) )->newInstanceWithoutConstructor();
	}

	protected function tearDown(): void {
		foreach ( $this->temp_dirs as $dir ) {
			$this->remove_dir( $dir );
		}
		unset( $GLOBALS['rtgodam_stub'] );
		$GLOBALS['rtgodam_hooks'] = array();
		parent::tearDown();
	}

	/**
	 * A cached SEO entry as Seo::get_seo_from_attachment() used to store it
	 * before 2.4.0: DASH contentUrl, empty description, no embedUrl.
	 *
	 * @param array $overrides Fields to override.
	 * @return array
	 */
	private function legacy_entry( array $overrides = array() ) {
		return array_merge(
			array(
				'contentUrl'       => 'https://cdn.example.test/job_1/manifest.mpd',
				'headline'         => 'Product demo',
				'description'      => '',
				'uploadDate'       => '2026-01-15T10:30:00+00:00',
				'duration'         => 'PT1M30S',
				'thumbnailUrl'     => 'https://cdn.example.test/job_1/thumb.jpg',
				'isFamilyFriendly' => true,
				'attachment_id'    => 42,
			),
			$overrides
		);
	}

	// -----------------------------------------------------------------------------------
	// contentUrl.
	// -----------------------------------------------------------------------------------

	public function test_content_url_uses_hls_stream_over_cached_dash_manifest() {
		rtgodam_stub_hls_url( 'https://cdn.example.test/job_1/index.m3u8', array( 42 ) );

		$schema = $this->seo->build_video_object_schema( $this->legacy_entry(), 0 );

		$this->assertSame( 'https://cdn.example.test/job_1/index.m3u8', $schema['contentUrl'] );
	}

	public function test_content_url_falls_back_to_original_file_without_hls() {
		$GLOBALS['rtgodam_stub']['attachment_url'] = 'https://example.test/wp-content/uploads/demo.mp4';

		$schema = $this->seo->build_video_object_schema( $this->legacy_entry(), 0 );

		$this->assertSame( 'https://example.test/wp-content/uploads/demo.mp4', $schema['contentUrl'] );
	}

	public function test_dash_manifest_is_never_output_as_content_url() {
		// No attachment to resolve, and the only stored URL is a DASH manifest.
		$entry = $this->legacy_entry( array( 'attachment_id' => 0 ) );

		$schema = $this->seo->build_video_object_schema( $entry, 0 );

		$this->assertArrayNotHasKey( 'contentUrl', $schema );
	}

	public function test_dash_url_is_ignored_even_when_it_is_the_hls_meta_value() {
		rtgodam_stub_hls_url( 'https://cdn.example.test/job_1/manifest.mpd?token=1', array( 42 ) );
		$GLOBALS['rtgodam_stub']['attachment_url'] = 'https://example.test/wp-content/uploads/demo.mp4';

		$this->assertSame( 'https://example.test/wp-content/uploads/demo.mp4', $this->seo->get_attachment_content_url( 42 ) );
	}

	public function test_non_dash_stored_url_is_kept_for_entries_without_an_attachment() {
		$entry = $this->legacy_entry(
			array(
				'attachment_id' => 0,
				'contentUrl'    => 'https://videos.example.test/clip.mp4',
			)
		);

		$schema = $this->seo->build_video_object_schema( $entry, 0 );

		$this->assertSame( 'https://videos.example.test/clip.mp4', $schema['contentUrl'] );
	}

	/**
	 * @dataProvider dash_url_provider
	 *
	 * @param string $url      URL.
	 * @param bool   $expected Whether it's a DASH manifest.
	 */
	public function test_is_dash_url( $url, $expected ) {
		$this->assertSame( $expected, Seo::is_dash_url( $url ) );
	}

	/**
	 * @return array
	 */
	public function dash_url_provider() {
		return array(
			'mpd'               => array( 'https://cdn.example.test/a/manifest.mpd', true ),
			'mpd upper case'    => array( 'https://cdn.example.test/a/MANIFEST.MPD', true ),
			'mpd with query'    => array( 'https://cdn.example.test/a/manifest.mpd?x=1', true ),
			'm3u8'              => array( 'https://cdn.example.test/a/index.m3u8', false ),
			'mp4'               => array( 'https://example.test/video.mp4', false ),
			'mpd only in query' => array( 'https://example.test/video.mp4?f=a.mpd', false ),
			'empty'             => array( '', false ),
		);
	}

	// -----------------------------------------------------------------------------------
	// embedUrl.
	// -----------------------------------------------------------------------------------

	public function test_embed_url_is_the_godam_player_page() {
		$schema = $this->seo->build_video_object_schema( $this->legacy_entry(), 0 );

		$this->assertSame( 'https://example.test?godam_page=video-embed&id=42', $schema['embedUrl'] );
	}

	public function test_no_embed_url_without_an_attachment() {
		$schema = $this->seo->build_video_object_schema( $this->legacy_entry( array( 'attachment_id' => 0 ) ), 0 );

		$this->assertArrayNotHasKey( 'embedUrl', $schema );
	}

	// -----------------------------------------------------------------------------------
	// description.
	// -----------------------------------------------------------------------------------

	public function test_own_description_is_used_when_present() {
		$schema = $this->seo->build_video_object_schema( $this->legacy_entry( array( 'description' => '<p>A <b>short</b> tour.</p>' ) ), 0 );

		$this->assertSame( 'A short tour.', $schema['description'] );
	}

	public function test_empty_description_is_left_out_not_output_empty() {
		$schema = $this->seo->build_video_object_schema( $this->legacy_entry(), 0 );

		$this->assertArrayNotHasKey( 'description', $schema );
		$this->assertStringNotContainsString( '"description"', wp_json_encode( $schema ) );
	}

	public function test_description_falls_back_to_cached_transcript_excerpt() {
		$GLOBALS['rtgodam_stub']['post_meta'] = array(
			'rtgodam_transcript_path'        => 'https://cdn.example.test/job_1/transcript.vtt',
			Seo::TRANSCRIPT_EXCERPT_META_KEY => array(
				'path' => 'https://cdn.example.test/job_1/transcript.vtt',
				'text' => 'Welcome to the product demo.',
			),
		);

		$schema = $this->seo->build_video_object_schema( $this->legacy_entry(), 0 );

		$this->assertSame( 'Welcome to the product demo.', $schema['description'] );
	}

	public function test_page_render_never_fetches_an_uncached_transcript() {
		$GLOBALS['rtgodam_stub']['post_meta'] = array(
			'rtgodam_transcript_path' => 'https://cdn.example.test/job_1/transcript.vtt',
		);

		$this->seo->build_video_object_schema( $this->legacy_entry(), 0 );

		$this->assertEmpty( $GLOBALS['rtgodam_stub']['remote_get_urls'] ?? array() );
	}

	public function test_description_falls_back_to_page_excerpt_after_transcript() {
		$GLOBALS['rtgodam_stub']['posts'][7] = (object) array(
			'post_type'    => 'page',
			'post_excerpt' => 'Everything you need to know about our product.',
			'post_content' => '',
		);

		$schema = $this->seo->build_video_object_schema( $this->legacy_entry(), 7 );

		$this->assertSame( 'Everything you need to know about our product.', $schema['description'] );
	}

	public function test_page_content_fallback_strips_blocks_and_shortcodes() {
		$GLOBALS['rtgodam_stub']['posts'][7] = (object) array(
			'post_type'    => 'page',
			'post_excerpt' => '',
			'post_content' => "<!-- wp:paragraph --><p>Hello &amp; welcome.</p><!-- /wp:paragraph -->\n[gallery ids=\"1,2\"]<!-- wp:godam/video {\"id\":42} /-->",
		);

		$schema = $this->seo->build_video_object_schema( $this->legacy_entry(), 7 );

		$this->assertSame( 'Hello & welcome.', $schema['description'] );
	}

	// -----------------------------------------------------------------------------------
	// isFamilyFriendly and other fields.
	// -----------------------------------------------------------------------------------

	/**
	 * @dataProvider family_friendly_provider
	 *
	 * @param mixed $stored   Stored value.
	 * @param bool  $expected Expected boolean.
	 */
	public function test_is_family_friendly_is_a_json_boolean( $stored, $expected ) {
		$schema = $this->seo->build_video_object_schema( $this->legacy_entry( array( 'isFamilyFriendly' => $stored ) ), 0 );

		$this->assertSame( $expected, $schema['isFamilyFriendly'] );
		$this->assertStringContainsString( '"isFamilyFriendly":' . ( $expected ? 'true' : 'false' ), wp_json_encode( $schema ) );
	}

	/**
	 * @return array
	 */
	public function family_friendly_provider() {
		return array(
			'bool true'     => array( true, true ),
			'bool false'    => array( false, false ),
			'string True'   => array( 'True', true ),
			'string false'  => array( 'false', false ),
			'string 0'      => array( '0', false ),
			'string 1'      => array( '1', true ),
			'string yes'    => array( 'yes', true ),
			'elementor off' => array( '', false ),
			'int 0'         => array( 0, false ),
		);
	}

	public function test_is_family_friendly_defaults_to_true_when_missing() {
		$entry = $this->legacy_entry();
		unset( $entry['isFamilyFriendly'] );

		$schema = $this->seo->build_video_object_schema( $entry, 0 );

		$this->assertTrue( $schema['isFamilyFriendly'] );
	}

	public function test_empty_upload_date_is_left_out() {
		$schema = $this->seo->build_video_object_schema( $this->legacy_entry( array( 'uploadDate' => '' ) ), 0 );

		$this->assertArrayNotHasKey( 'uploadDate', $schema );
	}

	public function test_full_schema_shape() {
		rtgodam_stub_hls_url( 'https://cdn.example.test/job_1/index.m3u8', array( 42 ) );

		$schema = $this->seo->build_video_object_schema( $this->legacy_entry( array( 'description' => 'A tour.' ) ), 0 );

		$this->assertSame(
			array(
				'@context'         => 'https://schema.org',
				'@type'            => 'VideoObject',
				'name'             => 'Product demo',
				'description'      => 'A tour.',
				'contentUrl'       => 'https://cdn.example.test/job_1/index.m3u8',
				'embedUrl'         => 'https://example.test?godam_page=video-embed&id=42',
				'uploadDate'       => '2026-01-15T10:30:00+00:00',
				'isFamilyFriendly' => true,
				'thumbnailUrl'     => 'https://cdn.example.test/job_1/thumb.jpg',
				'duration'         => 'PT1M30S',
			),
			$schema
		);
	}

	public function test_entry_without_headline_produces_no_schema() {
		$this->assertNull( $this->seo->build_video_object_schema( $this->legacy_entry( array( 'headline' => '' ) ), 0 ) );
	}

	// -----------------------------------------------------------------------------------
	// Transcript excerpt.
	// -----------------------------------------------------------------------------------

	public function test_transcript_is_fetched_once_on_save_and_cached() {
		$GLOBALS['rtgodam_stub']['post_meta'] = array(
			'rtgodam_transcript_path' => 'https://cdn.example.test/job_1/transcript.vtt',
		);
		$GLOBALS['rtgodam_stub']['http']      = array(
			'code' => 200,
			'body' => "WEBVTT\n\n1\n00:00:00.000 --> 00:00:02.000\nHello and welcome.\n\n2\n00:00:02.000 --> 00:00:04.000\nLet's get started.\n",
		);

		$this->assertSame( 'Hello and welcome. Let\'s get started.', $this->seo->get_transcript_excerpt( 42, true ) );
		$this->assertSame(
			array(
				'path' => 'https://cdn.example.test/job_1/transcript.vtt',
				'text' => 'Hello and welcome. Let\'s get started.',
			),
			$GLOBALS['rtgodam_stub']['meta_writes'][ Seo::TRANSCRIPT_EXCERPT_META_KEY ]
		);

		// Second call is served from the cache: no new request.
		$this->seo->get_transcript_excerpt( 42, true );
		$this->assertCount( 1, $GLOBALS['rtgodam_stub']['remote_get_urls'] );
	}

	public function test_failed_transcript_fetch_is_not_cached() {
		$GLOBALS['rtgodam_stub']['post_meta'] = array(
			'rtgodam_transcript_path' => 'https://cdn.example.test/job_1/transcript.vtt',
		);
		$GLOBALS['rtgodam_stub']['http']      = array(
			'code' => 500,
			'body' => '',
		);

		$this->assertSame( '', $this->seo->get_transcript_excerpt( 42, true ) );
		$this->assertArrayNotHasKey( 'meta_writes', $GLOBALS['rtgodam_stub'] );
	}

	public function test_deleted_transcript_is_not_used() {
		$GLOBALS['rtgodam_stub']['post_meta'] = array(
			'rtgodam_transcript_path'    => 'https://cdn.example.test/job_1/transcript.vtt',
			'rtgodam_transcript_deleted' => '1',
		);

		$this->assertSame( '', $this->seo->get_transcript_excerpt( 42, true ) );
	}

	public function test_stale_cache_for_an_older_transcript_is_ignored() {
		$GLOBALS['rtgodam_stub']['post_meta'] = array(
			'rtgodam_transcript_path'        => 'https://cdn.example.test/job_1/new.vtt',
			Seo::TRANSCRIPT_EXCERPT_META_KEY => array(
				'path' => 'https://cdn.example.test/job_1/old.vtt',
				'text' => 'Old text.',
			),
		);

		$this->assertSame( '', $this->seo->get_transcript_excerpt( 42, false ) );
	}

	public function test_transcript_to_text_handles_webvtt() {
		$vtt = "\xEF\xBB\xBFWEBVTT - Demo\nKind: captions\n\nNOTE This is a comment\n\nSTYLE\n::cue { color: red }\n\nintro\n00:00:00.000 --> 00:00:02.500 align:start\n<v Roo>Hi <b>there</b>,</v> &amp; welcome!\n\n00:00:02.500 --> 00:00:05.000\nThis is line one\nand line two.\n";

		// "intro" is a WebVTT cue identifier, not spoken text.
		$this->assertSame( 'Hi there, & welcome! This is line one and line two.', Seo::transcript_to_text( $vtt ) );
	}

	public function test_transcript_keeps_cue_text_that_looks_like_a_header_or_a_number() {
		$vtt = "WEBVTT\n\nchapter-1\n00:00:00.000 --> 00:00:02.000\nNote this down.\n\n2\n00:00:02.000 --> 00:00:04.000\n2024\nRegion four results.\n";

		$this->assertSame( 'Note this down. 2024 Region four results.', Seo::transcript_to_text( $vtt ) );
	}

	public function test_transcript_skips_note_style_and_region_blocks() {
		$vtt = "WEBVTT\n\nNOTE\nThis is a comment\nover two lines\n\nREGION\nid:fred width:40%\n\nSTYLE\n::cue { color: red }\n\n00:00:00.000 --> 00:00:02.000\nOnly this.\n";

		$this->assertSame( 'Only this.', Seo::transcript_to_text( $vtt ) );
	}

	public function test_transcript_in_uploads_is_read_from_disk() {
		$base = $this->make_uploads_dir();
		file_put_contents( $base . '/uploads/2026/t.vtt', "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nFrom disk.\n" );

		$GLOBALS['rtgodam_stub']['post_meta'] = array( 'rtgodam_transcript_path' => 'https://example.com/wp-content/uploads/2026/t.vtt' );

		$this->assertSame( 'From disk.', $this->seo->get_transcript_excerpt( 42, true ) );
		$this->assertEmpty( $GLOBALS['rtgodam_stub']['remote_get_urls'] ?? array() );
	}

	public function test_transcript_path_escaping_the_uploads_dir_is_not_read_from_disk() {
		$base = $this->make_uploads_dir();
		// A sibling directory whose name starts with "uploads".
		mkdir( $base . '/uploads-private' );
		file_put_contents( $base . '/uploads-private/secret.vtt', "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nSecret.\n" );

		$GLOBALS['rtgodam_stub']['post_meta'] = array( 'rtgodam_transcript_path' => 'https://example.com/wp-content/uploads/../uploads-private/secret.vtt' );

		$this->assertSame( '', $this->seo->get_transcript_excerpt( 42, true ) );
		// It fell through to the (stubbed, 404) remote fetch instead of reading the file.
		$this->assertCount( 1, $GLOBALS['rtgodam_stub']['remote_get_urls'] );
	}

	/**
	 * Recursively remove a temporary directory.
	 *
	 * @param string $dir Directory.
	 * @return void
	 */
	private function remove_dir( $dir ) {
		if ( ! is_dir( $dir ) ) {
			return;
		}
		foreach ( new \RecursiveIteratorIterator( new \RecursiveDirectoryIterator( $dir, \FilesystemIterator::SKIP_DOTS ), \RecursiveIteratorIterator::CHILD_FIRST ) as $item ) {
			$item->isDir() ? rmdir( $item->getPathname() ) : unlink( $item->getPathname() ); // phpcs:ignore WordPress.WP.AlternativeFunctions -- test cleanup.
		}
		rmdir( $dir ); // phpcs:ignore WordPress.WP.AlternativeFunctions -- test cleanup.
	}

	/**
	 * Create a temporary wp-content with an uploads dir and point the stubs at it.
	 *
	 * @return string wp-content path.
	 */
	private function make_uploads_dir() {
		$base = sys_get_temp_dir() . '/godam-seo-test-' . uniqid();
		mkdir( $base . '/uploads/2026', 0777, true );
		$this->temp_dirs[] = $base;

		$GLOBALS['rtgodam_stub']['uploads_baseurl'] = 'https://example.com/wp-content/uploads';
		$GLOBALS['rtgodam_stub']['uploads_basedir'] = $base . '/uploads';

		return $base;
	}

	public function test_transcript_to_text_handles_srt() {
		$srt = "1\r\n00:00:00,000 --> 00:00:02,000\r\nFirst cue.\r\n\r\n2\r\n00:00:02,000 --> 00:00:04,000\r\nSecond cue.\r\n";

		$this->assertSame( 'First cue. Second cue.', Seo::transcript_to_text( $srt ) );
	}

	public function test_trim_to_length_keeps_short_text() {
		$this->assertSame( 'Short text.', Seo::trim_to_length( "  Short \n text. ", 160 ) );
	}

	public function test_trim_to_length_cuts_at_a_word_boundary_within_the_limit() {
		$text   = str_repeat( 'word ', 60 ); // 300 characters.
		$result = Seo::trim_to_length( $text, Seo::DESCRIPTION_MAX_LENGTH );

		$this->assertLessThanOrEqual( 160, mb_strlen( $result ) );
		$this->assertStringEndsWith( 'word…', $result );
	}

	public function test_trim_to_length_is_multibyte_safe() {
		$result = Seo::trim_to_length( str_repeat( 'é', 200 ), 160 );

		$this->assertSame( 160, mb_strlen( $result ) );
		$this->assertTrue( mb_check_encoding( $result, 'UTF-8' ) );
	}

	/**
	 * @dataProvider to_bool_provider
	 *
	 * @param mixed $value    Value.
	 * @param bool  $expected Expected.
	 */
	public function test_to_bool( $value, $expected ) {
		$this->assertSame( $expected, Seo::to_bool( $value ) );
	}

	/**
	 * @return array
	 */
	public function to_bool_provider() {
		return array(
			array( 'True', true ),
			array( 'FALSE', false ),
			array( ' no ', false ),
			array( 'off', false ),
			array( 'on', true ),
			array( null, false ),
			array( 1, true ),
		);
	}
}
