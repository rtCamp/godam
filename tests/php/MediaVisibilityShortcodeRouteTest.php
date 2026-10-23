<?php
/**
 * The video shortcode route answers for media a visitor may see, and answers
 * exactly like a missing ID for media they may not (see MediaVisibilityTest).
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Media_Usage_Tracker;
use RTGODAM\Inc\REST_API\Dynamic_Shortcode;

/**
 * Runs in separate processes: the route calls the transcoded-URL helpers that live in
 * admin/godam-transcoder-functions.php, which EarlyTranslationHooksTest needs to be the
 * first to load, so they are stubbed here.
 *
 * @covers \RTGODAM\Inc\REST_API\Dynamic_Shortcode
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class MediaVisibilityShortcodeRouteTest extends TestCase {

	/**
	 * Load the code under test and stub what it calls.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub'] = array(
			'posts' => array(),
			'caps'  => array(),
			'mime'  => 'video/mp4',
			'title' => 'Quarterly update',
		);

		$root = dirname( __DIR__, 2 );
		require_once $root . '/tests/stubs/video-seo-functions.php';
		require_once $root . '/tests/stubs/form-layer-preview-functions.php';
		require_once $root . '/tests/stubs/media-visibility-functions.php';
		require_once $root . '/inc/classes/class-media-usage-tracker.php';
		require_once $root . '/inc/classes/rest-api/class-dynamic-shortcode.php';

		$stubs = array(
			'rtgodam_get_transcoded_url_from_attachment' => 'function rtgodam_get_transcoded_url_from_attachment( $attachment ) { return ""; }',
			'rtgodam_get_hls_transcoded_url_from_attachment' => 'function rtgodam_get_hls_transcoded_url_from_attachment( $attachment ) { return ""; }',
			'get_the_date'                               => 'function get_the_date( $format = "", $post = 0 ) { return "January 15, 2026"; }',
		);

		foreach ( $stubs as $name => $code ) {
			if ( ! function_exists( $name ) ) {
				eval( $code ); // phpcs:ignore Squiz.PHP.Eval.Discouraged -- test-only stub, isolated process.
			}
		}
	}

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
	 * Register video 10, attached to post 5 when that has properties.
	 *
	 * @param array|null $parent_props Parent post properties, or null for an unattached video.
	 * @param array|null $usage        Posts the usage index lists for it.
	 * @return void
	 */
	private function add_video( $parent_props, $usage = null ) {
		if ( null !== $parent_props ) {
			$this->add_post( 5, $parent_props );
		}

		$this->add_post(
			10,
			array(
				'post_type'      => 'attachment',
				'post_status'    => 'inherit',
				'post_parent'    => null === $parent_props ? 0 : 5,
				'post_mime_type' => 'video/mp4',
			)
		);

		$GLOBALS['rtgodam_stub']['attachment_url'] = 'https://example.test/uploads/update.mp4';

		if ( null !== $usage ) {
			$GLOBALS['rtgodam_stub']['post_meta_by_id'][10][ Media_Usage_Tracker::ATTACHMENT_META_KEY ] = $usage;
		}
	}

	/**
	 * Call the route.
	 *
	 * @param int $id Attachment ID.
	 * @return \WP_REST_Response
	 */
	private function render( $id ) {
		$route = ( new \ReflectionClass( Dynamic_Shortcode::class ) )->newInstanceWithoutConstructor();

		return $route->render_shortcode(
			new \WP_REST_Request(
				array(
					'id'            => $id,
					'engagements'   => '',
					'godam_context' => '',
				)
			)
		);
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
			'private'            => array( array( 'post_status' => 'private' ), false ),
			'scheduled'          => array( array( 'post_status' => 'future' ), false ),
			'trashed'            => array( array( 'post_status' => 'trash' ), false ),
			'password protected' => array( array( 'post_password' => 'secret' ), true ),
		);
	}

	/**
	 * @dataProvider parent_state_provider
	 *
	 * @param array|null $parent_props Parent post properties.
	 * @param bool       $visible      Whether a visitor sees the media.
	 */
	public function test_route_renders_only_media_a_visitor_may_see( $parent_props, $visible ) {
		$this->add_video( $parent_props );

		$response = $this->render( 10 );

		if ( $visible ) {
			$this->assertSame( 200, $response->get_status() );
			$this->assertSame( 'Quarterly update', $response->get_data()['title'] );
		} else {
			$this->assertSame( 404, $response->get_status() );
			$this->assertArrayNotHasKey( 'title', $response->get_data() );
			$this->assertArrayNotHasKey( 'shortcodes', $GLOBALS['rtgodam_stub'] );
		}
	}

	public function test_route_answers_a_refused_id_exactly_like_a_missing_one() {
		$this->add_video( array( 'post_status' => 'draft' ) );

		$refused = $this->render( 10 );
		$missing = $this->render( 404 );

		$this->assertSame( $missing->get_status(), $refused->get_status() );
		$this->assertSame( $missing->get_data(), $refused->get_data() );
	}

	public function test_route_renders_an_editors_own_unpublished_media() {
		$this->add_video( array( 'post_status' => 'draft' ) );
		$GLOBALS['rtgodam_stub']['caps'] = array( 'edit_post:10' );

		$this->assertSame( 200, $this->render( 10 )->get_status() );
	}

	public function test_route_keeps_rendering_a_video_used_on_a_published_page() {
		$this->add_video( array( 'post_status' => 'draft' ), array( 7 ) );
		$this->add_post( 7 );

		$this->assertSame( 200, $this->render( 10 )->get_status() );
	}

	public function test_route_refuses_a_video_used_only_on_a_draft() {
		$this->add_video( array( 'post_status' => 'draft' ), array( 7 ) );
		$this->add_post( 7, array( 'post_status' => 'draft' ) );

		$this->assertSame( 404, $this->render( 10 )->get_status() );
	}
}
