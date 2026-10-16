<?php
/**
 * Unit tests for the GoDAM video sitemap (issue #1622, v1).
 *
 * Covers the generated XML (well-formed, right namespaces, required video
 * fields, escaping), the request routing, and every exclusion rule:
 * drafts / private / password-protected pages (query arguments), pages the
 * SEO plugin marks noindex, and videos the editor excludes.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Seo;
use RTGODAM\Inc\Video_Sitemap;

require_once dirname( __DIR__ ) . '/stubs/video-seo-functions.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/class-seo.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/class-video-sitemap.php';

/**
 * @covers \RTGODAM\Inc\Video_Sitemap
 */
class VideoSitemapTest extends TestCase {

	const SITEMAP_NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';
	const VIDEO_NS   = 'http://www.google.com/schemas/sitemap-video/1.1';

	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['rtgodam_stub']  = array();
		$GLOBALS['rtgodam_hooks'] = array();
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		$GLOBALS['rtgodam_hooks'] = array();
		parent::tearDown();
	}

	/**
	 * A sitemap whose database reads are replaced by fixtures.
	 *
	 * @param array $pages Post ID => list of cached SEO entries.
	 * @return Video_Sitemap
	 */
	private function sitemap_with_pages( array $pages ) {
		return new class( $pages ) extends Video_Sitemap {

			/**
			 * @var array
			 */
			private $pages;

			/**
			 * @param array $pages Fixtures.
			 */
			public function __construct( array $pages ) { // phpcs:ignore -- no parent constructor: it would register hooks.
				$this->pages = $pages;
			}

			/**
			 * @param int $page Page.
			 * @return int[]
			 */
			protected function query_post_ids( $page ) {
				return array_keys( $this->pages );
			}

			/**
			 * @param int $post_id Post ID.
			 * @return array
			 */
			protected function get_cached_videos( $post_id ) {
				return $this->pages[ $post_id ];
			}

			/**
			 * @param int $post_id Post ID.
			 * @return string
			 */
			protected function get_post_url( $post_id ) {
				return 'https://example.test/?p=' . $post_id;
			}

			/**
			 * @param int $post_id Post ID.
			 * @return string
			 */
			protected function get_post_lastmod( $post_id ) {
				return '2026-10-01T08:00:00+00:00';
			}
		};
	}

	/**
	 * A cached SEO entry as Seo saves it.
	 *
	 * @param int   $attachment_id Attachment ID.
	 * @param array $overrides     Fields to override.
	 * @return array
	 */
	private function video( $attachment_id, array $overrides = array() ) {
		return array_merge(
			array(
				'contentUrl'       => 'https://cdn.example.test/job_' . $attachment_id . '/manifest.mpd',
				'headline'         => 'Video ' . $attachment_id,
				'description'      => 'About video ' . $attachment_id . '.',
				'uploadDate'       => '2026-01-15T10:30:00+00:00',
				'duration'         => 'PT2M5S',
				'thumbnailUrl'     => 'https://cdn.example.test/job_' . $attachment_id . '/thumb.jpg',
				'isFamilyFriendly' => true,
				'attachment_id'    => $attachment_id,
			),
			$overrides
		);
	}

	/**
	 * Parse XML and fail on any well-formedness error.
	 *
	 * @param string $xml XML.
	 * @return \DOMXPath
	 */
	private function parse( $xml ) {
		$doc = new \DOMDocument();
		$this->assertTrue( $doc->loadXML( $xml ), 'Sitemap XML must be well-formed.' );

		$xpath = new \DOMXPath( $doc );
		$xpath->registerNamespace( 's', self::SITEMAP_NS );
		$xpath->registerNamespace( 'video', self::VIDEO_NS );

		return $xpath;
	}

	// -----------------------------------------------------------------------------------
	// XML output.
	// -----------------------------------------------------------------------------------

	public function test_urlset_xml_is_well_formed_with_one_url_per_page_and_one_video_per_video() {
		rtgodam_stub_hls_url( 'https://cdn.example.test/index.m3u8', array( 1, 2, 3 ) );

		$sitemap = $this->sitemap_with_pages(
			array(
				10 => array( $this->video( 1 ), $this->video( 2 ) ),
				11 => array( $this->video( 3 ) ),
			)
		);

		$xpath = $this->parse( Video_Sitemap::build_urlset_xml( $sitemap->get_url_entries( 1 ) ) );

		$this->assertSame( 2, $xpath->query( '/s:urlset/s:url' )->length );
		$this->assertSame( 2, $xpath->query( '/s:urlset/s:url[1]/video:video' )->length );
		$this->assertSame( 1, $xpath->query( '/s:urlset/s:url[2]/video:video' )->length );
		$this->assertSame( 'https://example.test/?p=10', $xpath->evaluate( 'string(/s:urlset/s:url[1]/s:loc)' ) );
		$this->assertSame( '2026-10-01T08:00:00+00:00', $xpath->evaluate( 'string(/s:urlset/s:url[1]/s:lastmod)' ) );
	}

	public function test_video_element_carries_every_field_from_the_schema() {
		rtgodam_stub_hls_url( 'https://cdn.example.test/job_1/index.m3u8', array( 1, 2, 3 ) );

		$sitemap = $this->sitemap_with_pages( array( 10 => array( $this->video( 1 ) ) ) );
		$xpath   = $this->parse( Video_Sitemap::build_urlset_xml( $sitemap->get_url_entries( 1 ) ) );
		$base    = '/s:urlset/s:url[1]/video:video[1]/';

		$this->assertSame( 'https://cdn.example.test/job_1/thumb.jpg', $xpath->evaluate( "string({$base}video:thumbnail_loc)" ) );
		$this->assertSame( 'Video 1', $xpath->evaluate( "string({$base}video:title)" ) );
		$this->assertSame( 'About video 1.', $xpath->evaluate( "string({$base}video:description)" ) );
		// HLS, the same URL the schema uses — never the cached .mpd.
		$this->assertSame( 'https://cdn.example.test/job_1/index.m3u8', $xpath->evaluate( "string({$base}video:content_loc)" ) );
		$this->assertSame( 'https://example.test?godam_page=video-embed&id=1', $xpath->evaluate( "string({$base}video:player_loc)" ) );
		$this->assertSame( '125', $xpath->evaluate( "string({$base}video:duration)" ) );
		$this->assertSame( '2026-01-15T10:30:00+00:00', $xpath->evaluate( "string({$base}video:publication_date)" ) );
		$this->assertSame( 0, $xpath->query( "{$base}video:family_friendly" )->length );
	}

	public function test_sitemap_and_schema_agree() {
		rtgodam_stub_hls_url( 'https://cdn.example.test/job_1/index.m3u8', array( 1, 2, 3 ) );
		$entry = $this->video( 1 );

		$schema  = Seo::get_instance()->build_video_object_schema( $entry, 10 );
		$sitemap = $this->sitemap_with_pages( array( 10 => array( $entry ) ) );
		$video   = $sitemap->get_url_entries( 1 )[0]['videos'][0];

		$this->assertSame( $schema['contentUrl'], $video['content_loc'] );
		$this->assertSame( $schema['embedUrl'], $video['player_loc'] );
		$this->assertSame( $schema['name'], $video['title'] );
		$this->assertSame( $schema['description'], $video['description'] );
		$this->assertSame( $schema['thumbnailUrl'], $video['thumbnail_loc'] );
	}

	public function test_values_are_xml_escaped() {
		$xml = Video_Sitemap::build_urlset_xml(
			array(
				array(
					'loc'    => 'https://example.test/?p=1&lang=en',
					'videos' => array(
						array(
							'thumbnail_loc' => 'https://cdn.example.test/t.jpg?a=1&b=2',
							'title'         => 'Tips & "tricks" <live>',
							'description'   => "Control char \x07 removed. Ünïcödé kept.",
							'player_loc'    => 'https://example.test/?godam_page=video-embed&id=1',
						),
					),
				),
			)
		);

		$xpath = $this->parse( $xml );

		$this->assertSame( 'https://example.test/?p=1&lang=en', $xpath->evaluate( 'string(//s:loc)' ) );
		$this->assertSame( 'Tips & "tricks" <live>', $xpath->evaluate( 'string(//video:title)' ) );
		$this->assertSame( 'Control char  removed. Ünïcödé kept.', $xpath->evaluate( 'string(//video:description)' ) );
	}

	public function test_family_friendly_no_is_output_when_not_family_friendly() {
		$sitemap = $this->sitemap_with_pages( array( 10 => array( $this->video( 1, array( 'isFamilyFriendly' => 'false' ) ) ) ) );
		$xpath   = $this->parse( Video_Sitemap::build_urlset_xml( $sitemap->get_url_entries( 1 ) ) );

		$this->assertSame( 'no', $xpath->evaluate( 'string(//video:family_friendly)' ) );
	}

	public function test_duration_outside_googles_range_is_left_out() {
		$xml = Video_Sitemap::build_urlset_xml(
			array(
				array(
					'loc'    => 'https://example.test/?p=1',
					'videos' => array(
						array(
							'thumbnail_loc' => 'https://cdn.example.test/t.jpg',
							'title'         => 'Long stream',
							'description'   => 'Nine hours.',
							'content_loc'   => 'https://cdn.example.test/index.m3u8',
							'duration'      => 9 * 3600,
						),
					),
				),
			)
		);

		$this->assertSame( 0, $this->parse( $xml )->query( '//video:duration' )->length );
	}

	public function test_empty_sitemap_is_still_valid_xml() {
		$xpath = $this->parse( Video_Sitemap::build_urlset_xml( array() ) );

		$this->assertSame( 1, $xpath->query( '/s:urlset' )->length );
		$this->assertSame( 0, $xpath->query( '//s:url' )->length );
	}

	public function test_description_falls_back_to_title_because_google_requires_one() {
		$sitemap = $this->sitemap_with_pages( array( 10 => array( $this->video( 1, array( 'description' => '' ) ) ) ) );
		$video   = $sitemap->get_url_entries( 1 )[0]['videos'][0];

		$this->assertSame( 'Video 1', $video['description'] );
	}

	public function test_missing_thumbnail_falls_back_to_featured_image() {
		$GLOBALS['rtgodam_stub']['featured_image'][10] = 'https://example.test/featured.jpg';

		$sitemap = $this->sitemap_with_pages( array( 10 => array( $this->video( 1, array( 'thumbnailUrl' => '' ) ) ) ) );
		$video   = $sitemap->get_url_entries( 1 )[0]['videos'][0];

		$this->assertSame( 'https://example.test/featured.jpg', $video['thumbnail_loc'] );
	}

	public function test_video_without_thumbnail_is_dropped_and_empty_page_is_not_listed() {
		$sitemap = $this->sitemap_with_pages( array( 10 => array( $this->video( 1, array( 'thumbnailUrl' => '' ) ) ) ) );

		$this->assertSame( array(), $sitemap->get_url_entries( 1 ) );
	}

	public function test_same_video_twice_on_a_page_is_listed_once() {
		$sitemap = $this->sitemap_with_pages( array( 10 => array( $this->video( 1 ), $this->video( 1 ) ) ) );

		$this->assertCount( 1, $sitemap->get_url_entries( 1 )[0]['videos'] );
	}

	public function test_long_titles_are_cut_to_googles_100_character_limit() {
		$sitemap = $this->sitemap_with_pages( array( 10 => array( $this->video( 1, array( 'headline' => str_repeat( 'Long title ', 20 ) ) ) ) ) );
		$title   = $sitemap->get_url_entries( 1 )[0]['videos'][0]['title'];

		$this->assertLessThanOrEqual( 100, mb_strlen( $title ) );
		$this->assertStringEndsWith( '…', $title );
	}

	public function test_index_skips_pages_that_end_up_empty_and_reports_real_counts() {
		// Page 1: one listable page. Page 2: only a noindexed page.
		$GLOBALS['rtgodam_stub']['posts'][10]                             = (object) array( 'post_type' => 'page' );
		$GLOBALS['rtgodam_stub']['posts'][20]                             = (object) array( 'post_type' => 'page' );
		$GLOBALS['rtgodam_stub']['yoast_meta'][20]['meta-robots-noindex'] = '1';

		$sitemap = new class( array(
			1 => array( 10 => array( $this->video( 1 ) ) ),
			2 => array( 20 => array( $this->video( 2 ) ) ),
		) ) extends Video_Sitemap {

			/**
			 * @var array
			 */
			private $pages_by_number;

			/**
			 * @param array $pages_by_number Page number => post ID => entries.
			 */
			public function __construct( array $pages_by_number ) { // phpcs:ignore -- no parent constructor: it would register hooks.
				$this->pages_by_number = $pages_by_number;
			}

			/**
			 * @return int
			 */
			public function get_max_pages() {
				return 2;
			}

			/**
			 * @return string
			 */
			public function get_last_modified() {
				return '2026-10-01T08:00:00+00:00';
			}

			/**
			 * @param int $page Page.
			 * @return int[]
			 */
			protected function query_post_ids( $page ) {
				return array_keys( $this->pages_by_number[ $page ] );
			}

			/**
			 * @param int $post_id Post ID.
			 * @return array
			 */
			protected function get_cached_videos( $post_id ) {
				foreach ( $this->pages_by_number as $posts ) {
					if ( isset( $posts[ $post_id ] ) ) {
						return $posts[ $post_id ];
					}
				}
				return array();
			}

			/**
			 * @param int $post_id Post ID.
			 * @return string
			 */
			protected function get_post_url( $post_id ) {
				return 'https://example.test/?p=' . $post_id;
			}

			/**
			 * @param int $post_id Post ID.
			 * @return string
			 */
			protected function get_post_lastmod( $post_id ) {
				return '';
			}
		};

		$GLOBALS['rtgodam_stub']['options']['permalink_structure'] = '';
		$items = $sitemap->get_index_items();

		$this->assertCount( 1, $items );
		$this->assertSame( 'https://example.test?godam_video_sitemap=1', $items[0]['loc'] );
		$this->assertSame( 1, $items[0]['count'] );

		// The WordPress core sitemap index (no SEO plugin) lists the same pages.
		require_once dirname( __DIR__, 2 ) . '/inc/classes/class-video-sitemap-core-provider.php';
		$provider = new \RTGODAM\Inc\Video_Sitemap_Core_Provider( $sitemap );

		$this->assertSame(
			array( array( 'loc' => 'https://example.test?godam_video_sitemap=1' ) ),
			$provider->get_sitemap_entries()
		);
	}

	// -----------------------------------------------------------------------------------
	// Cache invalidation.
	// -----------------------------------------------------------------------------------

	/**
	 * Current cache version.
	 *
	 * @return int
	 */
	private function cache_version() {
		return (int) ( $GLOBALS['rtgodam_stub']['options'][ Video_Sitemap::CACHE_VERSION_OPTION ] ?? 1 );
	}

	public function test_settings_save_invalidates_only_when_seo_settings_change() {
		$sitemap = $this->sitemap_with_pages( array() );

		$sitemap->maybe_invalidate_on_settings_update(
			array(
				'seo'          => array( 'enable_video_sitemap' => true ),
				'video_player' => array( 'brand_color' => '#000' ),
			),
			array(
				'seo'          => array( 'enable_video_sitemap' => true ),
				'video_player' => array( 'brand_color' => '#fff' ),
			)
		);
		$this->assertSame( 1, $this->cache_version() );

		$sitemap->maybe_invalidate_on_settings_update(
			array( 'seo' => array( 'enable_video_sitemap' => false ) ),
			array( 'seo' => array( 'enable_video_sitemap' => true ) )
		);
		$this->assertSame( 2, $this->cache_version() );
	}

	public function test_attachment_edit_invalidates_only_for_videos_in_use() {
		$sitemap = $this->sitemap_with_pages( array() );

		// An image edit (e.g. alt text): no invalidation.
		$GLOBALS['rtgodam_stub']['mime'] = 'image/jpeg';
		$GLOBALS['rtgodam_stub']['meta_exists'][5][ Seo::ATTACHMENT_POSTS_MAP_META_KEY ] = true;
		$sitemap->maybe_invalidate_on_attachment_edit( 5 );
		$this->assertSame( 1, $this->cache_version() );

		// A video no page uses: no invalidation.
		$GLOBALS['rtgodam_stub']['mime'] = 'video/mp4';
		$sitemap->maybe_invalidate_on_attachment_edit( 6 );
		$this->assertSame( 1, $this->cache_version() );

		// A video a listed page uses: invalidated.
		$sitemap->maybe_invalidate_on_attachment_edit( 5 );
		$this->assertSame( 2, $this->cache_version() );
	}

	public function test_hls_url_update_on_a_used_video_invalidates() {
		$sitemap = $this->sitemap_with_pages( array() );
		$GLOBALS['rtgodam_stub']['meta_exists'][5][ Seo::ATTACHMENT_POSTS_MAP_META_KEY ] = true;

		// Unrelated meta on a used video: no invalidation.
		$sitemap->maybe_invalidate_on_attachment_meta( 1, 5, '_wp_attachment_image_alt' );
		$this->assertSame( 1, $this->cache_version() );

		// HLS URL on a video no page uses: no invalidation.
		$sitemap->maybe_invalidate_on_attachment_meta( 1, 6, 'rtgodam_hls_transcoded_url' );
		$this->assertSame( 1, $this->cache_version() );

		// HLS URL written by the transcoding callback on a used video: invalidated.
		$sitemap->maybe_invalidate_on_attachment_meta( 1, 5, 'rtgodam_hls_transcoded_url' );
		$this->assertSame( 2, $this->cache_version() );
	}

	// -----------------------------------------------------------------------------------
	// Exclusion rules.
	// -----------------------------------------------------------------------------------

	public function test_query_only_lists_published_unprotected_pages_with_videos() {
		$args = $this->sitemap_with_pages( array() )->get_base_query_args();

		// Drafts, pending, scheduled and private posts are all excluded by status.
		$this->assertSame( 'publish', $args['post_status'] );
		$this->assertFalse( $args['has_password'] );
		$this->assertSame( Seo::VIDEO_SEO_SCHEMA_META_KEY, $args['meta_key'] );
		$this->assertNotContains( 'attachment', $args['post_type'] );
	}

	public function test_video_excluded_by_the_editor_is_left_out() {
		$sitemap = $this->sitemap_with_pages(
			array(
				10 => array( $this->video( 1, array( 'excludeFromSitemap' => true ) ), $this->video( 2 ) ),
			)
		);

		$videos = $sitemap->get_url_entries( 1 )[0]['videos'];

		$this->assertCount( 1, $videos );
		$this->assertSame( 'Video 2', $videos[0]['title'] );
	}

	public function test_page_whose_only_video_is_excluded_is_left_out() {
		$sitemap = $this->sitemap_with_pages( array( 10 => array( $this->video( 1, array( 'excludeFromSitemap' => true ) ) ) ) );

		$this->assertSame( array(), $sitemap->get_url_entries( 1 ) );
	}

	public function test_page_noindexed_in_yoast_is_left_out() {
		$GLOBALS['rtgodam_stub']['posts'][10]                             = (object) array( 'post_type' => 'page' );
		$GLOBALS['rtgodam_stub']['posts'][11]                             = (object) array( 'post_type' => 'page' );
		$GLOBALS['rtgodam_stub']['yoast_meta'][10]['meta-robots-noindex'] = '1';

		$sitemap = $this->sitemap_with_pages(
			array(
				10 => array( $this->video( 1 ) ),
				11 => array( $this->video( 2 ) ),
			)
		);

		$entries = $sitemap->get_url_entries( 1 );

		$this->assertCount( 1, $entries );
		$this->assertSame( 'https://example.test/?p=11', $entries[0]['loc'] );
	}

	public function test_yoast_post_type_noindex_applies_unless_the_page_overrides_it() {
		$GLOBALS['rtgodam_stub']['posts'][10]                             = (object) array( 'post_type' => 'page' );
		$GLOBALS['rtgodam_stub']['posts'][11]                             = (object) array( 'post_type' => 'page' );
		$GLOBALS['rtgodam_stub']['yoast_options']['noindex-page']         = true;
		$GLOBALS['rtgodam_stub']['yoast_meta'][11]['meta-robots-noindex'] = '2'; // Explicit "index".

		$sitemap = $this->sitemap_with_pages( array() );

		$this->assertTrue( $sitemap->is_post_noindex( 10 ) );
		$this->assertFalse( $sitemap->is_post_noindex( 11 ) );
	}

	public function test_page_noindexed_in_rank_math_is_left_out() {
		$GLOBALS['rtgodam_stub']['posts'][10]         = (object) array( 'post_type' => 'post' );
		$GLOBALS['rtgodam_stub']['rank_math_noindex'] = array( 10 );

		$this->assertTrue( $this->sitemap_with_pages( array() )->is_post_noindex( 10 ) );
	}

	public function test_indexable_page_is_kept() {
		$GLOBALS['rtgodam_stub']['posts'][10] = (object) array( 'post_type' => 'post' );

		$this->assertFalse( $this->sitemap_with_pages( array() )->is_post_excluded( 10 ) );
	}

	public function test_exclusion_filter_can_drop_a_page() {
		add_filter(
			'godam_video_sitemap_exclude_post',
			function ( $excluded, $post_id ) {
				return 11 === $post_id ? true : $excluded;
			},
			10,
			2
		);

		$sitemap = $this->sitemap_with_pages(
			array(
				10 => array( $this->video( 1 ) ),
				11 => array( $this->video( 2 ) ),
			)
		);

		$this->assertCount( 1, $sitemap->get_url_entries( 1 ) );
	}

	// -----------------------------------------------------------------------------------
	// Routing, settings and helpers.
	// -----------------------------------------------------------------------------------

	/**
	 * @dataProvider path_provider
	 *
	 * @param string   $path     Request path.
	 * @param int|null $expected Page number.
	 */
	public function test_parse_page_from_path( $path, $expected ) {
		$this->assertSame( $expected, Video_Sitemap::parse_page_from_path( $path ) );
	}

	/**
	 * @return array
	 */
	public function path_provider() {
		return array(
			'page 1'           => array( 'godam-video-sitemap.xml', 1 ),
			'page 3'           => array( 'godam-video-sitemap3.xml', 3 ),
			'leading slash'    => array( '/godam-video-sitemap2.xml', 2 ),
			'page 0 is page 1' => array( 'godam-video-sitemap0.xml', 1 ),
			'other sitemap'    => array( 'post-sitemap.xml', null ),
			'subdirectory'     => array( 'blog/godam-video-sitemap.xml', null ),
			'suffix'           => array( 'godam-video-sitemap.xml.gz', null ),
			'empty'            => array( '', null ),
		);
	}

	public function test_requested_page_from_plain_permalink_query_var() {
		$wp             = new \stdClass();
		$wp->query_vars = array( Video_Sitemap::QUERY_VAR => '2' );
		$wp->request    = '';

		$this->assertSame( 2, Video_Sitemap::get_requested_page( $wp ) );
	}

	public function test_plain_permalink_sites_get_a_query_string_url() {
		$GLOBALS['rtgodam_stub']['options']['permalink_structure'] = '';

		$this->assertSame( 'https://example.test?godam_video_sitemap=2', Video_Sitemap::get_sitemap_url( 2 ) );
	}

	public function test_sitemap_is_off_by_default() {
		$this->assertFalse( Video_Sitemap::is_enabled() );

		$GLOBALS['rtgodam_stub']['options']['rtgodam-settings'] = array( 'seo' => array( 'enable_video_sitemap' => true ) );
		$this->assertTrue( Video_Sitemap::is_enabled() );
	}

	/**
	 * @dataProvider duration_provider
	 *
	 * @param string $iso      ISO 8601 duration.
	 * @param int    $expected Seconds.
	 */
	public function test_iso8601_duration_to_seconds( $iso, $expected ) {
		$this->assertSame( $expected, Video_Sitemap::iso8601_duration_to_seconds( $iso ) );
	}

	/**
	 * @return array
	 */
	public function duration_provider() {
		return array(
			array( 'PT1H2M3S', 3723 ),
			array( 'PT45S', 45 ),
			array( 'PT2M', 120 ),
			array( 'PT1.6S', 2 ),
			array( 'P1DT1S', 86401 ),
			array( 'pt10m', 600 ),
			array( 'garbage', 0 ),
			array( '', 0 ),
		);
	}

	public function test_format_gmt_date() {
		$this->assertSame( '2026-10-13T09:30:00+00:00', Video_Sitemap::format_gmt_date( '2026-10-13 09:30:00' ) );
		$this->assertSame( '', Video_Sitemap::format_gmt_date( '0000-00-00 00:00:00' ) );
	}
}
