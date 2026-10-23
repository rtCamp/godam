<?php
/**
 * Unit tests for media visibility on GoDAM's public routes and pages.
 *
 * Media is shown to a visitor only where WordPress would show it: unattached, or
 * attached to a post that is published and has no password. Media used on a
 * publicly viewable post counts as public whichever post it was uploaded to, and
 * whoever can edit the media always sees it. Covers the helper, the gallery query,
 * the preview and embed pages, the ad tag route, the stored-settings REST field,
 * the video schema and the transcoding status route. The video shortcode route is
 * in MediaVisibilityShortcodeRouteTest.
 *
 * WordPress is stubbed (tests/bootstrap.php, tests/stubs/video-seo-functions.php and
 * tests/stubs/media-visibility-functions.php), driven by $GLOBALS['rtgodam_stub'].
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Media_Usage_Tracker;
use RTGODAM\Inc\REST_API\Ads;
use RTGODAM\Inc\REST_API\Meta_Rest_Fields;
use RTGODAM\Inc\REST_API\Transcoding;
use RTGODAM\Inc\Seo;

require_once dirname( __DIR__ ) . '/stubs/video-seo-functions.php';
require_once dirname( __DIR__ ) . '/stubs/form-layer-preview-functions.php';
require_once dirname( __DIR__ ) . '/stubs/media-visibility-functions.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/class-media-usage-tracker.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/class-seo.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/rest-api/class-ads.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/rest-api/class-meta-rest-fields.php';
require_once dirname( __DIR__, 2 ) . '/inc/templates/godam-video-gallery.php';

/**
 * @covers ::rtgodam_can_view_attachment
 * @covers ::rtgodam_usage_includes_public_post
 * @covers ::rtgodam_get_publicly_used_media_ids
 * @covers ::rtgodam_public_media_query_clauses
 * @covers ::godam_preview_page_content
 * @covers ::godam_embed_page_content
 * @covers \RTGODAM\Inc\REST_API\Ads
 * @covers \RTGODAM\Inc\REST_API\Meta_Rest_Fields
 * @covers \RTGODAM\Inc\REST_API\Transcoding
 * @covers \RTGODAM\Inc\Seo::add_video_seo_schema
 */
class MediaVisibilityTest extends TestCase {

	const USAGE_KEY = Media_Usage_Tracker::ATTACHMENT_META_KEY;

	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['rtgodam_stub']  = array(
			'posts'     => array(),
			'caps'      => array(),
			'wpdb_rows' => array(),
		);
		$GLOBALS['rtgodam_hooks'] = array();
		$GLOBALS['wpdb']          = new \wpdb();

		// Forget the media IDs a previous test left in this request's copy.
		rtgodam_get_publicly_used_media_ids( true );
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'], $GLOBALS['wpdb'] );
		$GLOBALS['rtgodam_hooks'] = array();
		parent::tearDown();
	}

	// -----------------------------------------------------------------------------------
	// Fixtures.
	// -----------------------------------------------------------------------------------

	/**
	 * Register a post.
	 *
	 * @param int   $id    Post ID.
	 * @param array $props Properties to override.
	 * @return void
	 */
	private function add_post( $id, array $props = array() ) {
		$GLOBALS['rtgodam_stub']['posts'][ $id ] = new \WP_Post(
			array_merge(
				array(
					'ID'             => $id,
					'post_type'      => 'page',
					'post_status'    => 'publish',
					'post_password'  => '',
					'post_parent'    => 0,
					'post_author'    => 2,
					'post_mime_type' => '',
				),
				$props
			)
		);
	}

	/**
	 * Register a video attachment, attached to a post when a parent is given.
	 *
	 * @param int        $id        Attachment ID.
	 * @param int        $parent_id Parent post ID, or 0 for unattached.
	 * @param array|null $usage     Posts the usage index lists for it, or null for none.
	 * @return void
	 */
	private function add_video( $id, $parent_id = 0, $usage = null ) {
		$this->add_post(
			$id,
			array(
				'post_type'      => 'attachment',
				'post_status'    => 'inherit',
				'post_parent'    => $parent_id,
				'post_mime_type' => 'video/mp4',
			)
		);

		if ( null !== $usage ) {
			$GLOBALS['rtgodam_stub']['post_meta_by_id'][ $id ][ self::USAGE_KEY ] = $usage;
		}
	}

	/**
	 * A video 10 attached to post 5, which has the given properties.
	 *
	 * @param array|null $parent_props Parent post properties, or null for an unattached video.
	 * @param array|null $usage        Usage index entry for the video.
	 * @return void
	 */
	private function add_video_with_parent( $parent_props, $usage = null ) {
		if ( null === $parent_props ) {
			$this->add_video( 10, 0, $usage );
			return;
		}

		$this->add_post( 5, $parent_props );
		$this->add_video( 10, 5, $usage );
	}

	/**
	 * Every state a post can be in, and whether its media shows to a visitor.
	 *
	 * @return array
	 */
	public function parent_state_provider() {
		return array(
			'unattached'         => array( null, true ),
			'published'          => array( array( 'post_status' => 'publish' ), true ),
			'draft'              => array( array( 'post_status' => 'draft' ), false ),
			'pending'            => array( array( 'post_status' => 'pending' ), false ),
			'private'            => array( array( 'post_status' => 'private' ), false ),
			'scheduled'          => array( array( 'post_status' => 'future' ), false ),
			'trashed'            => array( array( 'post_status' => 'trash' ), false ),
			'password protected' => array( array( 'post_password' => 'secret' ), false ),
		);
	}

	/**
	 * Whether a text contains another.
	 *
	 * @param string $haystack Text.
	 * @param string $needle   Fragment.
	 * @return bool
	 */
	private function contains( $haystack, $needle ) {
		return false !== strpos( $haystack, $needle );
	}

	// -----------------------------------------------------------------------------------
	// rtgodam_can_view_attachment().
	// -----------------------------------------------------------------------------------

	/**
	 * @dataProvider parent_state_provider
	 *
	 * @param array|null $parent_props Parent post properties.
	 * @param bool       $visible      Whether a visitor sees the media.
	 */
	public function test_visitor_sees_media_only_where_the_parent_is_public( $parent_props, $visible ) {
		$this->add_video_with_parent( $parent_props );

		$this->assertSame( $visible, rtgodam_can_view_attachment( 10 ) );
	}

	public function test_media_whose_parent_no_longer_exists_counts_as_unattached() {
		$this->add_video( 10, 999 );

		$this->assertTrue( rtgodam_can_view_attachment( 10 ) );
	}

	public function test_a_missing_id_and_a_post_that_is_not_media_are_refused() {
		$this->add_post( 7 );

		$this->assertFalse( rtgodam_can_view_attachment( 404 ) );
		$this->assertFalse( rtgodam_can_view_attachment( 7 ) );
		$this->assertFalse( rtgodam_can_view_attachment( 0 ) );
		$this->assertFalse( rtgodam_can_view_attachment( 'abc' ) );
	}

	/**
	 * @dataProvider parent_state_provider
	 *
	 * @param array|null $parent_props Parent post properties.
	 */
	public function test_whoever_can_edit_the_media_always_sees_it( $parent_props ) {
		$this->add_video_with_parent( $parent_props );
		$GLOBALS['rtgodam_stub']['caps'] = array( 'edit_post:10' );

		$this->assertTrue( rtgodam_can_view_attachment( 10 ) );
	}

	public function test_editing_other_media_does_not_show_this_one() {
		$this->add_video_with_parent( array( 'post_status' => 'draft' ) );
		$GLOBALS['rtgodam_stub']['caps'] = array( 'edit_post:11' );

		$this->assertFalse( rtgodam_can_view_attachment( 10 ) );
	}

	public function test_a_user_who_can_read_a_private_parent_sees_its_media() {
		$this->add_video_with_parent( array( 'post_status' => 'private' ) );
		$GLOBALS['rtgodam_stub']['caps'] = array( 'read_post:5' );

		$this->assertTrue( rtgodam_can_view_attachment( 10 ) );
	}

	public function test_a_user_who_can_read_a_draft_parent_sees_its_media() {
		$this->add_video_with_parent( array( 'post_status' => 'draft' ) );
		$GLOBALS['rtgodam_stub']['caps'] = array( 'read_post:5' );

		$this->assertTrue( rtgodam_can_view_attachment( 10 ) );
	}

	public function test_a_user_who_can_edit_a_password_protected_parent_sees_its_media() {
		$this->add_video_with_parent( array( 'post_password' => 'secret' ) );
		$GLOBALS['rtgodam_stub']['caps'] = array( 'edit_post:5' );

		$this->assertTrue( rtgodam_can_view_attachment( 10 ) );
	}

	public function test_a_visitor_who_entered_the_password_sees_the_media_of_that_page() {
		$this->add_video_with_parent( array( 'post_password' => 'secret' ) );
		$GLOBALS['rtgodam_stub']['unlocked'] = array( 5 );

		$this->assertTrue( rtgodam_can_view_attachment( 10 ) );
	}

	public function test_a_readable_parent_does_not_unlock_its_password() {
		$this->add_video_with_parent(
			array(
				'post_status'   => 'private',
				'post_password' => 'secret',
			)
		);
		$GLOBALS['rtgodam_stub']['caps'] = array( 'read_post:5' );

		$this->assertFalse( rtgodam_can_view_attachment( 10 ) );
	}

	public function test_lookup_hooks_are_balanced_however_the_check_ends() {
		$depth   = 0;
		$deepest = 0;
		add_action(
			'rtgodam_before_attachment_lookup',
			function () use ( &$depth, &$deepest ) {
				$deepest = max( $deepest, ++$depth );
			}
		);
		add_action(
			'rtgodam_after_attachment_lookup',
			function () use ( &$depth ) {
				--$depth;
			}
		);
		$this->add_video_with_parent( array( 'post_status' => 'draft' ), array( 7 ) );
		$this->add_post( 7 );

		rtgodam_can_view_attachment( 10 );
		rtgodam_can_view_attachment( 404 );
		rtgodam_can_view_attachment( 7 );

		$this->assertSame( 0, $depth );
		$this->assertGreaterThan( 0, $deepest );
	}

	// -----------------------------------------------------------------------------------
	// Media used on a public post.
	// -----------------------------------------------------------------------------------

	/**
	 * @dataProvider parent_state_provider
	 *
	 * @param array|null $parent_props Parent post properties.
	 */
	public function test_media_used_on_a_published_page_is_public_whatever_its_parent( $parent_props ) {
		$this->add_video_with_parent( $parent_props, array( 7 ) );
		$this->add_post( 7 );

		$this->assertTrue( rtgodam_can_view_attachment( 10 ) );
	}

	/**
	 * Posts that do not make the media public.
	 *
	 * @return array
	 */
	public function non_public_usage_provider() {
		return array(
			'draft'              => array( array( 'post_status' => 'draft' ) ),
			'private'            => array( array( 'post_status' => 'private' ) ),
			'scheduled'          => array( array( 'post_status' => 'future' ) ),
			'trashed'            => array( array( 'post_status' => 'trash' ) ),
			'password protected' => array( array( 'post_password' => 'secret' ) ),
		);
	}

	/**
	 * @dataProvider non_public_usage_provider
	 *
	 * @param array $usage_props Properties of the post using the media.
	 */
	public function test_media_used_only_on_a_non_public_post_stays_hidden( $usage_props ) {
		$this->add_video_with_parent( array( 'post_status' => 'draft' ), array( 7 ) );
		$this->add_post( 7, $usage_props );

		$this->assertFalse( rtgodam_can_view_attachment( 10 ) );
	}

	public function test_one_public_post_among_the_non_public_ones_is_enough() {
		$this->add_video_with_parent( array( 'post_status' => 'draft' ), array( 7, 8, 9 ) );
		$this->add_post( 7, array( 'post_status' => 'draft' ) );
		$this->add_post( 8, array( 'post_password' => 'secret' ) );
		$this->add_post( 9 );

		$this->assertTrue( rtgodam_can_view_attachment( 10 ) );
	}

	public function test_a_usage_post_that_is_gone_does_not_make_the_media_public() {
		$this->add_video_with_parent( array( 'post_status' => 'draft' ), array( 404 ) );

		$this->assertFalse( rtgodam_can_view_attachment( 10 ) );
	}

	public function test_media_in_a_site_wide_block_widget_is_public() {
		$this->add_video_with_parent( array( 'post_status' => 'draft' ), array( 0 ) );

		$this->assertTrue( rtgodam_can_view_attachment( 10 ) );
	}

	public function test_filter_can_tighten_the_answer() {
		add_filter(
			'rtgodam_can_view_attachment',
			function () {
				return false;
			}
		);
		$this->add_video_with_parent( array( 'post_status' => 'publish' ) );

		$this->assertFalse( rtgodam_can_view_attachment( 10 ) );
	}

	public function test_filter_can_relax_the_answer_and_gets_the_attachment() {
		$seen = null;
		add_filter(
			'rtgodam_can_view_attachment',
			function ( $can_view, $attachment ) use ( &$seen ) {
				$seen = $attachment;
				return true;
			},
			10,
			2
		);
		$this->add_video_with_parent( array( 'post_status' => 'draft' ) );

		$this->assertTrue( rtgodam_can_view_attachment( 10 ) );
		$this->assertSame( 10, $seen->ID );
	}

	// -----------------------------------------------------------------------------------
	// Gallery listing.
	// -----------------------------------------------------------------------------------

	/**
	 * A query object that carries the flag, as WP_Query does.
	 *
	 * @param bool $flagged Whether the query asks for public media only.
	 * @return object
	 */
	private function query( $flagged = true ) {
		return new class( $flagged ) {

			/**
			 * @var bool
			 */
			private $flagged;

			/**
			 * @param bool $flagged Flag value.
			 */
			public function __construct( $flagged ) {
				$this->flagged = $flagged;
			}

			/**
			 * @param string $var_name Query var.
			 * @return mixed
			 */
			public function get( $var_name ) {
				return 'rtgodam_public_media_only' === $var_name ? $this->flagged : null;
			}
		};
	}

	/**
	 * A row of the query that finds the non-public media that has a usage record.
	 *
	 * @param int   $id    Attachment ID.
	 * @param mixed $usage Value of its usage meta.
	 * @return object
	 */
	private function usage_row( $id, $usage ) {
		return (object) array(
			'ID'         => $id,
			'meta_value' => is_array( $usage ) ? serialize( $usage ) : $usage, // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.serialize_serialize -- how post meta is stored.
		);
	}

	public function test_gallery_query_asks_for_public_media_only() {
		$args = rtgodam_gallery_v2_build_query_args( array() );

		$this->assertTrue( $args['rtgodam_public_media_only'] );
		$this->assertSame( 'attachment', $args['post_type'] );
	}

	public function test_gallery_query_keeps_the_flag_whatever_the_ordering_or_filters() {
		$args = rtgodam_gallery_v2_build_query_args(
			array(
				'orderby'   => 'duration',
				'author'    => '3',
				'dateRange' => '30days',
			),
			2
		);

		$this->assertTrue( $args['rtgodam_public_media_only'] );
	}

	public function test_clauses_are_left_alone_for_other_queries() {
		$clauses = array(
			'join'  => '',
			'where' => ' AND 1=1',
		);

		$this->assertSame( $clauses, rtgodam_public_media_query_clauses( $clauses, $this->query( false ) ) );
	}

	public function test_clauses_limit_the_listing_to_media_of_public_parents() {
		$clauses = rtgodam_public_media_query_clauses(
			array(
				'join'  => '',
				'where' => ' AND 1=1',
			),
			$this->query()
		);

		$this->assertStringContainsString( 'LEFT JOIN wp_posts AS rtgodam_media_parent ON ( rtgodam_media_parent.ID = wp_posts.post_parent )', $clauses['join'] );
		$this->assertStringStartsWith( ' AND 1=1 AND (', $clauses['where'] );
		$this->assertStringContainsString( 'rtgodam_media_parent.ID IS NULL', $clauses['where'] );
		$this->assertStringContainsString( "rtgodam_media_parent.post_status IN ( 'publish' )", $clauses['where'] );
		$this->assertStringContainsString( "rtgodam_media_parent.post_password = ''", $clauses['where'] );
		$this->assertStringNotContainsString( 'wp_posts.ID IN', $clauses['where'] );
	}

	public function test_clauses_keep_the_media_used_on_a_public_post() {
		$GLOBALS['rtgodam_stub']['wpdb_rows'] = array(
			$this->usage_row( 21, array( 7 ) ),
			$this->usage_row( 22, array( 8 ) ),
		);
		$this->add_post( 7 );
		$this->add_post( 8, array( 'post_status' => 'draft' ) );
		rtgodam_get_publicly_used_media_ids( true );

		$clauses = rtgodam_public_media_query_clauses(
			array(
				'join'  => '',
				'where' => '',
			),
			$this->query()
		);

		$this->assertStringContainsString( 'OR wp_posts.ID IN ( 21 )', $clauses['where'] );
		$this->assertStringNotContainsString( '22', $clauses['where'] );
	}

	public function test_the_used_media_query_targets_videos_with_a_non_public_parent_and_usage() {
		rtgodam_get_publicly_used_media_ids( true );

		$query = end( $GLOBALS['rtgodam_stub']['wpdb_queries'] );

		$this->assertStringContainsString( "usage_meta.meta_key = '" . self::USAGE_KEY . "'", $query );
		$this->assertStringContainsString( "media.post_mime_type LIKE 'video/%'", $query );
		$this->assertStringContainsString( "media_parent.post_status NOT IN ( 'publish' )", $query );
		$this->assertStringContainsString( "media_parent.post_password <> ''", $query );
	}

	public function test_only_media_used_on_a_public_post_makes_the_set() {
		$GLOBALS['rtgodam_stub']['wpdb_rows'] = array(
			$this->usage_row( 21, array( 7 ) ),
			$this->usage_row( 22, array( 8 ) ),
			$this->usage_row( 23, array( 9 ) ),
			$this->usage_row( 24, array( 0 ) ),
			$this->usage_row( 25, array() ),
			$this->usage_row( 26, 'not an array' ),
			$this->usage_row( 27, array( 8, 7 ) ),
		);
		$this->add_post( 7 );
		$this->add_post( 8, array( 'post_status' => 'private' ) );
		$this->add_post( 9, array( 'post_password' => 'secret' ) );

		$this->assertSame( array( 21, 24, 27 ), rtgodam_get_publicly_used_media_ids( true ) );
	}

	public function test_the_used_media_set_is_read_once_per_request() {
		$this->add_post( 7 );
		$GLOBALS['rtgodam_stub']['wpdb_rows'] = array( $this->usage_row( 21, array( 7 ) ) );
		rtgodam_get_publicly_used_media_ids( true );
		$queries = count( $GLOBALS['rtgodam_stub']['wpdb_queries'] );

		$GLOBALS['rtgodam_stub']['wpdb_rows'] = array();
		$this->assertSame( array( 21 ), rtgodam_get_publicly_used_media_ids() );
		$this->assertSame( $queries, count( $GLOBALS['rtgodam_stub']['wpdb_queries'] ) );

		$this->assertSame( array(), rtgodam_get_publicly_used_media_ids( true ) );
	}

	// -----------------------------------------------------------------------------------
	// Preview and embed pages.
	// -----------------------------------------------------------------------------------

	/**
	 * Fixtures the two pages read: the media type and the title.
	 *
	 * @return void
	 */
	private function stub_media_for_pages() {
		$GLOBALS['rtgodam_stub']['mime']  = 'video/mp4';
		$GLOBALS['rtgodam_stub']['title'] = 'Quarterly update';
	}

	/**
	 * @dataProvider parent_state_provider
	 *
	 * @param array|null $parent_props Parent post properties.
	 * @param bool       $visible      Whether a visitor sees the media.
	 */
	public function test_preview_page_shows_media_only_where_wordpress_would( $parent_props, $visible ) {
		$this->add_video_with_parent( $parent_props );
		$this->stub_media_for_pages();

		$html = godam_preview_page_content( 10 );

		$this->assertSame( $visible, $this->contains( $html, 'Quarterly update' ) );
		$this->assertSame( ! $visible, $this->contains( $html, 'We could not locate your video' ) );
	}

	public function test_preview_page_shows_an_editor_their_unpublished_media() {
		$this->add_video_with_parent( array( 'post_status' => 'draft' ) );
		$this->stub_media_for_pages();
		$GLOBALS['rtgodam_stub']['caps'] = array( 'edit_post:10' );

		$this->assertStringContainsString( 'Quarterly update', godam_preview_page_content( 10 ) );
	}

	public function test_preview_page_shows_media_used_on_a_published_page() {
		$this->add_video_with_parent( array( 'post_status' => 'draft' ), array( 7 ) );
		$this->add_post( 7 );
		$this->stub_media_for_pages();

		$this->assertStringContainsString( 'Quarterly update', godam_preview_page_content( 10 ) );
	}

	/**
	 * @dataProvider parent_state_provider
	 *
	 * @param array|null $parent_props Parent post properties.
	 * @param bool       $visible      Whether a visitor sees the media.
	 */
	public function test_embed_page_shows_media_only_where_wordpress_would( $parent_props, $visible ) {
		$this->add_video_with_parent( $parent_props );

		$html = godam_embed_page_content( 10 );

		$this->assertSame( $visible, $this->contains( $html, 'godam-video-embed"' ) );
		$this->assertSame( ! $visible, $this->contains( $html, 'Video not found' ) );
	}

	public function test_embed_page_shows_an_editor_their_unpublished_media() {
		$this->add_video_with_parent( array( 'post_status' => 'private' ) );
		$GLOBALS['rtgodam_stub']['caps'] = array( 'edit_post:10' );

		$this->assertStringContainsString( 'godam-video-embed"', godam_embed_page_content( 10 ) );
	}

	public function test_embed_page_keeps_working_for_a_video_used_on_a_published_page() {
		$this->add_video_with_parent( array( 'post_status' => 'draft' ), array( 7 ) );
		$this->add_post( 7 );

		$this->assertStringContainsString( 'godam-video-embed"', godam_embed_page_content( 10 ) );
	}

	public function test_embed_page_still_refuses_media_that_is_not_a_video() {
		$this->add_post(
			10,
			array(
				'post_type'      => 'attachment',
				'post_mime_type' => 'image/png',
			)
		);

		$this->assertStringContainsString( 'Video not found', godam_embed_page_content( 10 ) );
	}

	// -----------------------------------------------------------------------------------
	// Ad tag route.
	// -----------------------------------------------------------------------------------

	/**
	 * The ad tag route, without its constructor.
	 *
	 * @return Ads
	 */
	private function ads_route() {
		return ( new \ReflectionClass( Ads::class ) )->newInstanceWithoutConstructor();
	}

	/**
	 * A video with one ad layer.
	 *
	 * @return array
	 */
	private function ad_meta() {
		return array(
			'layers' => array(
				array(
					'type'        => 'ad',
					'displayTime' => 0,
					'ad_url'      => 'https://ads.example.test/spot.mp4',
					'click_link'  => 'https://ads.example.test/offer',
				),
			),
		);
	}

	/**
	 * @dataProvider parent_state_provider
	 *
	 * @param array|null $parent_props Parent post properties.
	 * @param bool       $visible      Whether a visitor sees the media.
	 */
	public function test_ad_tag_route_answers_only_for_media_a_visitor_may_see( $parent_props, $visible ) {
		$this->add_video_with_parent( $parent_props );
		$GLOBALS['rtgodam_stub']['post_meta_by_id'][10]['rtgodam_meta'] = $this->ad_meta();

		$xml = $this->ads_route()->get_video_ad_tag_url( new \WP_REST_Request( array( 'id' => 10 ) ) );

		if ( $visible ) {
			$this->assertStringContainsString( '<vmap:VMAP', $xml );
			$this->assertStringContainsString( 'ads.example.test', $xml );
		} else {
			$this->assertSame( '', $xml );
		}
	}

	public function test_ad_tag_route_keeps_the_ads_of_a_video_used_on_a_published_page() {
		$this->add_video_with_parent( array( 'post_status' => 'draft' ), array( 7 ) );
		$this->add_post( 7 );
		$GLOBALS['rtgodam_stub']['post_meta_by_id'][10]['rtgodam_meta'] = $this->ad_meta();

		$this->assertStringContainsString( '<vmap:VMAP', $this->ads_route()->get_video_ad_tag_url( new \WP_REST_Request( array( 'id' => 10 ) ) ) );
	}

	public function test_ad_tag_route_answers_a_missing_and_a_refused_id_alike() {
		$this->add_video_with_parent( array( 'post_status' => 'draft' ) );
		$GLOBALS['rtgodam_stub']['post_meta_by_id'][10]['rtgodam_meta'] = $this->ad_meta();

		$this->assertSame(
			$this->ads_route()->get_video_ad_tag_url( new \WP_REST_Request( array( 'id' => 404 ) ) ),
			$this->ads_route()->get_video_ad_tag_url( new \WP_REST_Request( array( 'id' => 10 ) ) )
		);
	}

	// -----------------------------------------------------------------------------------
	// Stored settings REST field.
	// -----------------------------------------------------------------------------------

	/**
	 * The get callback of the rtgodam_meta field.
	 *
	 * @return callable
	 */
	private function meta_field_getter() {
		( new \ReflectionClass( Meta_Rest_Fields::class ) )->newInstanceWithoutConstructor()->add_meta_rest_fields();

		return $GLOBALS['rtgodam_stub']['rest_fields']['attachment']['rtgodam_meta']['get_callback'];
	}

	public function test_stored_settings_go_to_whoever_can_edit_the_media() {
		$this->add_video_with_parent( null );
		$stored = array( 'layers' => array( array( 'type' => 'ad' ) ) );
		$GLOBALS['rtgodam_stub']['post_meta_by_id'][10]['rtgodam_meta'] = $stored;
		$GLOBALS['rtgodam_stub']['caps']                                = array( 'edit_post:10' );

		$this->assertSame( $stored, call_user_func( $this->meta_field_getter(), array( 'id' => 10 ) ) );
	}

	/**
	 * Authors and Contributors placing someone else's video keep its settings for the editor preview.
	 */
	public function test_stored_settings_go_to_people_who_write_posts() {
		$this->add_video_with_parent( null );
		$stored = array( 'layers' => array( array( 'type' => 'hotspot' ) ) );
		$GLOBALS['rtgodam_stub']['post_meta_by_id'][10]['rtgodam_meta'] = $stored;
		$GLOBALS['rtgodam_stub']['caps']                                = array( 'edit_posts' );

		$this->assertSame( $stored, call_user_func( $this->meta_field_getter(), array( 'id' => 10 ) ) );
	}

	/**
	 * Media that is public: visitors and Subscribers still get no settings.
	 *
	 * @dataProvider parent_state_provider
	 *
	 * @param array|null $parent_props Parent post properties.
	 */
	public function test_stored_settings_are_null_for_everyone_else( $parent_props ) {
		$this->add_video_with_parent( $parent_props );
		$GLOBALS['rtgodam_stub']['post_meta_by_id'][10]['rtgodam_meta'] = array( 'layers' => array() );

		$this->assertNull( call_user_func( $this->meta_field_getter(), array( 'id' => 10 ) ) );
	}

	public function test_stored_settings_of_other_media_do_not_count() {
		$this->add_video_with_parent( null );
		$GLOBALS['rtgodam_stub']['post_meta_by_id'][10]['rtgodam_meta'] = array( 'layers' => array() );
		$GLOBALS['rtgodam_stub']['caps']                                = array( 'edit_post:11' );

		$this->assertNull( call_user_func( $this->meta_field_getter(), array( 'id' => 10 ) ) );
	}

	// -----------------------------------------------------------------------------------
	// Video schema.
	// -----------------------------------------------------------------------------------

	/**
	 * What add_video_seo_schema() prints for post 30.
	 *
	 * @param array $post_props Properties of the post being viewed.
	 * @return string
	 */
	private function schema_output_for( array $post_props ) {
		$seo = ( new \ReflectionClass( Seo::class ) )->newInstanceWithoutConstructor();
		$this->add_post( 30, $post_props );
		$GLOBALS['rtgodam_stub']['queried_object_id']                           = 30;
		$GLOBALS['rtgodam_stub']['post_meta'][ Seo::VIDEO_SEO_SCHEMA_META_KEY ] = array(
			array(
				'contentUrl'       => 'https://cdn.example.test/job_1/index.m3u8',
				'headline'         => 'Quarterly update',
				'description'      => 'What changed this quarter.',
				'uploadDate'       => '2026-01-15T10:30:00+00:00',
				'duration'         => 'PT1M30S',
				'thumbnailUrl'     => 'https://cdn.example.test/job_1/thumb.jpg',
				'isFamilyFriendly' => true,
				'attachment_id'    => 0,
			),
		);

		ob_start();
		$seo->add_video_seo_schema();

		return (string) ob_get_clean();
	}

	public function test_schema_is_printed_on_a_published_page() {
		$this->assertStringContainsString( 'Quarterly update', $this->schema_output_for( array( 'post_status' => 'publish' ) ) );
	}

	/**
	 * Pages whose content is not public.
	 *
	 * @return array
	 */
	public function non_public_page_provider() {
		return array(
			'draft'              => array( array( 'post_status' => 'draft' ) ),
			'private'            => array( array( 'post_status' => 'private' ) ),
			'scheduled'          => array( array( 'post_status' => 'future' ) ),
			'password protected' => array( array( 'post_password' => 'secret' ) ),
		);
	}

	/**
	 * @dataProvider non_public_page_provider
	 *
	 * @param array $post_props Properties of the post being viewed.
	 */
	public function test_schema_is_not_printed_on_a_page_whose_content_is_not_public( $post_props ) {
		$this->assertSame( '', $this->schema_output_for( $post_props ) );
	}

	/**
	 * What the render-time output (the schema of videos rendered in the page) prints
	 * for post 30, with one video collected.
	 *
	 * @param array $post_props Properties of the post being viewed.
	 * @param bool  $singular   Whether the view is a single post.
	 * @return string
	 */
	private function render_time_schema_output_for( array $post_props, $singular = true ) {
		$seo = ( new \ReflectionClass( Seo::class ) )->newInstanceWithoutConstructor();
		$this->add_post( 30, $post_props );
		$GLOBALS['rtgodam_stub']['queried_object_id'] = 30;
		$GLOBALS['rtgodam_stub']['is_singular']       = $singular;

		$collected = new \ReflectionProperty( Seo::class, 'render_collected_schemas' );
		$collected->setAccessible( true );
		$collected->setValue(
			$seo,
			array(
				'url:collected' => array(
					'contentUrl'       => 'https://cdn.example.test/job_1/index.m3u8',
					'headline'         => 'Quarterly update',
					'description'      => 'What changed this quarter.',
					'uploadDate'       => '2026-01-15T10:30:00+00:00',
					'isFamilyFriendly' => true,
					'attachment_id'    => 0,
				),
			)
		);

		ob_start();
		$seo->output_render_time_video_seo_schema();

		return (string) ob_get_clean();
	}

	public function test_render_time_schema_is_printed_on_a_published_page() {
		$this->assertStringContainsString( 'Quarterly update', $this->render_time_schema_output_for( array( 'post_status' => 'publish' ) ) );
	}

	/**
	 * @dataProvider non_public_page_provider
	 *
	 * @param array $post_props Properties of the post being viewed.
	 */
	public function test_render_time_schema_is_not_printed_on_a_page_whose_content_is_not_public( $post_props ) {
		$this->assertSame( '', $this->render_time_schema_output_for( $post_props ) );
	}

	public function test_render_time_schema_is_still_printed_where_there_is_no_post_to_check() {
		$this->assertStringContainsString( 'Quarterly update', $this->render_time_schema_output_for( array( 'post_status' => 'draft' ), false ) );
	}

	public function test_schema_is_not_printed_on_a_page_whose_password_the_visitor_entered() {
		$GLOBALS['rtgodam_stub']['unlocked'] = array( 30 );

		$this->assertSame( '', $this->schema_output_for( array( 'post_password' => 'secret' ) ) );
	}

	// -----------------------------------------------------------------------------------
	// Transcoding status route.
	// -----------------------------------------------------------------------------------

	/**
	 * The transcoding route, without its constructor.
	 *
	 * @return Transcoding
	 */
	private function transcoding_route() {
		return ( new \ReflectionClass( Transcoding::class ) )->newInstanceWithoutConstructor();
	}

	/**
	 * The `ids` argument of the public status route.
	 *
	 * @return array
	 */
	private function status_ids_arg() {
		foreach ( $this->transcoding_route()->get_rest_routes() as $route ) {
			if ( '/transcoding/transcoding-status/' === $route['route'] ) {
				return $route['args']['args']['ids'];
			}
		}

		$this->fail( 'The status route is not registered.' );
	}

	/**
	 * Give an attachment a transcoding status.
	 *
	 * @param int   $id   Attachment ID.
	 * @param array $meta Meta to set on top of a transcoded video's.
	 * @return void
	 */
	private function set_status_meta( $id, array $meta = array() ) {
		$GLOBALS['rtgodam_stub']['post_meta_by_id'][ $id ] = array_merge(
			array(
				'rtgodam_transcoding_job_id'   => 'job-' . $id,
				'rtgodam_transcoding_status'   => 'Transcoding',
				'rtgodam_transcoding_progress' => 40,
			),
			$GLOBALS['rtgodam_stub']['post_meta_by_id'][ $id ] ?? array(),
			$meta
		);
	}

	public function test_status_route_takes_up_to_one_hundred_ids() {
		$arg = $this->status_ids_arg();

		$this->assertSame( 100, $arg['maxItems'] );
		$this->assertTrue( call_user_func( $arg['validate_callback'], range( 1, 100 ) ) );
		$this->assertTrue( call_user_func( $arg['validate_callback'], array() ) );
	}

	public function test_status_route_refuses_a_longer_list_and_anything_that_is_not_a_list() {
		$validate = $this->status_ids_arg()['validate_callback'];

		$this->assertFalse( call_user_func( $validate, range( 1, 101 ) ) );
		$this->assertFalse( call_user_func( $validate, '1,2,3' ) );
	}

	public function test_status_route_leaves_out_ids_the_user_may_not_see() {
		$this->add_post( 5, array( 'post_status' => 'draft' ) );
		$this->add_post( 6, array( 'post_status' => 'private' ) );
		$this->add_post( 7, array( 'post_status' => 'future' ) );
		$this->add_video( 10, 0 );
		$this->add_video( 11, 5 );
		$this->add_video( 12, 6 );
		$this->add_video( 13, 7 );
		$this->add_video( 14, 5, array( 8 ) );
		$this->add_post( 8 );
		$this->add_post( 15, array( 'post_type' => 'page' ) );
		foreach ( array( 10, 11, 12, 13 ) as $id ) {
			$this->set_status_meta( $id );
		}
		$this->set_status_meta( 14 );

		$response = $this->transcoding_route()->get_transcoding_status( new \WP_REST_Request( array( 'ids' => array( 10, 11, 12, 13, 14, 15, 404, 'abc', 0 ) ) ) );

		$this->assertSame( array( 10, 14 ), array_keys( $response->get_data() ) );
		$this->assertSame( 'transcoding', $response->get_data()[10]['status'] );
	}

	public function test_status_route_shows_an_editor_the_status_of_their_unpublished_media() {
		$this->add_post( 5, array( 'post_status' => 'draft' ) );
		$this->add_video( 11, 5 );
		$this->set_status_meta( 11 );
		$GLOBALS['rtgodam_stub']['caps'] = array( 'edit_post:11' );

		$response = $this->transcoding_route()->get_transcoding_status( new \WP_REST_Request( array( 'ids' => array( 11 ) ) ) );

		$this->assertSame( array( 11 ), array_keys( $response->get_data() ) );
	}

	/**
	 * The status a transcoded video without a thumbnail reports.
	 *
	 * @param array $meta Meta to set on the video.
	 * @return array
	 */
	private function transcoded_status( array $meta ) {
		$this->add_video( 20, 0 );
		$this->set_status_meta( 20, array_merge( array( 'rtgodam_transcoding_status' => 'Transcoded' ), $meta ) );

		return $this->transcoding_route()->get_transcoding_status( new \WP_REST_Request( array( 'ids' => array( 20 ) ) ) )->get_data()[20];
	}

	public function test_reading_the_status_writes_nothing_while_the_thumbnail_is_awaited() {
		$status = $this->transcoded_status( array( 'rtgodam_transcoding_status_updated' => time() - 2 ) );

		$this->assertSame( 'transcoding', $status['status'] );
		$this->assertSame( 95, $status['progress'] );
		$this->assertEmpty( $GLOBALS['rtgodam_stub']['meta_writes'] ?? array() );
	}

	public function test_reading_the_status_again_does_not_use_up_the_wait() {
		$this->add_video( 20, 0 );
		$this->set_status_meta(
			20,
			array(
				'rtgodam_transcoding_status'         => 'Transcoded',
				'rtgodam_transcoding_status_updated' => time() - 2,
			)
		);
		$request = new \WP_REST_Request( array( 'ids' => array( 20 ) ) );

		for ( $read = 0; $read < 6; $read++ ) {
			$status = $this->transcoding_route()->get_transcoding_status( $request )->get_data()[20];
			$this->assertSame( 'transcoding', $status['status'] );
		}

		$this->assertEmpty( $GLOBALS['rtgodam_stub']['meta_writes'] ?? array() );
	}

	public function test_a_transcoded_video_is_reported_done_once_the_wait_is_over() {
		$status = $this->transcoded_status( array( 'rtgodam_transcoding_status_updated' => time() - 60 ) );

		$this->assertSame( 'transcoded', $status['status'] );
		$this->assertEmpty( $GLOBALS['rtgodam_stub']['meta_writes'] ?? array() );
	}

	public function test_a_transcoded_video_with_no_recorded_update_is_reported_done() {
		$this->assertSame( 'transcoded', $this->transcoded_status( array() )['status'] );
		$this->assertEmpty( $GLOBALS['rtgodam_stub']['meta_writes'] ?? array() );
	}

	public function test_a_transcoded_video_with_a_thumbnail_is_reported_done_at_once() {
		$status = $this->transcoded_status(
			array(
				'rtgodam_transcoding_status_updated' => time() - 2,
				'rtgodam_media_video_thumbnail'      => 'https://cdn.example.test/thumb.jpg',
			)
		);

		$this->assertSame( 'transcoded', $status['status'] );
		$this->assertSame( 'https://cdn.example.test/thumb.jpg', $status['thumbnail'] );
	}
}
