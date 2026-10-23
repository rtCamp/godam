<?php
/**
 * Unit tests for who may use the media library routes that act on one attachment.
 *
 * The routes behind the Media Editor's thumbnail picker and the Media Library's EXIF panel
 * used to ask only for `edit_posts`, which says nothing about whose media it is. They now
 * ask WordPress about the attachment itself:
 *  - changing a video's thumbnails needs `edit_post` on that video;
 *  - reading thumbnails or EXIF needs `read_post`, or the right to upload files, which is
 *    what lists every attachment in the Media Library;
 *  - a read that refreshes the stored thumbnails only saves them for someone who may edit
 *    the video.
 * The folder ZIP and the GoDAM (Central) listing stay behind `upload_files`: anyone who may
 * upload files can already list every item in the Media Library and open its file, so those
 * routes give them nothing more. A test pins that.
 *
 * The instance is built without the constructor (Base's constructor registers WP hooks we
 * don't want here). current_user_can() and the post/meta functions are stubbed in
 * tests/bootstrap.php and tests/stubs/media-library-functions.php, and driven per case by
 * $GLOBALS['rtgodam_stub'].
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Media_Library;

require_once dirname( __DIR__ ) . '/stubs/media-library-functions.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/rest-api/class-media-library.php';

/**
 * @covers \RTGODAM\Inc\REST_API\Media_Library::get_rest_routes
 * @covers \RTGODAM\Inc\REST_API\Media_Library::can_edit_attachment
 * @covers \RTGODAM\Inc\REST_API\Media_Library::can_read_attachment
 * @covers \RTGODAM\Inc\REST_API\Media_Library::get_video_thumbnails
 * @covers \RTGODAM\Inc\REST_API\Media_Library::upload_custom_video_thumbnail
 * @covers \RTGODAM\Inc\REST_API\Media_Library::remove_custom_video_thumbnail
 * @covers \RTGODAM\Inc\REST_API\Media_Library::set_video_thumbnail
 */
class MediaLibraryAttachmentAccessTest extends TestCase {

	/**
	 * The attachment every case acts on.
	 */
	const ATTACHMENT = 7;

	/**
	 * Another attachment, for a user who may edit or read that one only.
	 */
	const OTHER_ATTACHMENT = 8;

	/**
	 * Capabilities of a contributor.
	 */
	const CONTRIBUTOR_CAPS = array( 'read', 'edit_posts' );

	/**
	 * Capabilities of an author (the lowest role that can upload files).
	 */
	const AUTHOR_CAPS = array( 'read', 'edit_posts', 'upload_files' );

	/**
	 * Route args keyed by route path, e.g. '/media-library/get-exif-data'.
	 *
	 * @var array
	 */
	private $routes = array();

	/**
	 * @var Media_Library
	 */
	private $library;

	protected function setUp(): void {
		parent::setUp();

		$this->library = ( new \ReflectionClass( Media_Library::class ) )->newInstanceWithoutConstructor();

		$this->routes = array();
		foreach ( $this->library->get_rest_routes() as $route ) {
			$this->routes[ $route['route'] ] = $route['args'];
		}

		$GLOBALS['rtgodam_hooks'] = array();
		$GLOBALS['rtgodam_stub']  = array(
			'mime'    => 'video/mp4',
			'options' => array( 'rtgodam-api-key' => 'test-key' ),
		);
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		$GLOBALS['rtgodam_hooks'] = array();
		parent::tearDown();
	}

	/**
	 * Run a route's permission callback as the current stub user.
	 *
	 * @param string $route         Route path.
	 * @param int    $attachment_id Attachment id in the request, or null for none.
	 * @return bool
	 */
	private function permitted( $route, $attachment_id = self::ATTACHMENT ) {
		$params = null === $attachment_id ? array() : array( 'attachment_id' => $attachment_id );

		return call_user_func( $this->routes[ $route ]['permission_callback'], new \WP_REST_Request( $params ) );
	}

	/**
	 * Run the handler's own thumbnail meta calls against these stored values.
	 *
	 * @param array $meta Meta values keyed by meta key.
	 */
	private function stored_meta( array $meta ) {
		$GLOBALS['rtgodam_stub']['post_meta'] = $meta;
	}

	/**
	 * The capability names checked so far, in order, with the lookup hooks as `hook:before` / `hook:after`.
	 *
	 * @return string[]
	 */
	private function checks() {
		return array_map(
			function ( $check ) {
				return implode( ':', $check );
			},
			$GLOBALS['rtgodam_stub']['cap_checks'] ?? array()
		);
	}

	/**
	 * Record the attachment-lookup hooks in the same list as the capability checks.
	 */
	private function record_lookup_hooks() {
		add_action(
			'rtgodam_before_attachment_lookup',
			function () {
				$GLOBALS['rtgodam_stub']['cap_checks'][] = array( 'hook', 'before' );
			}
		);
		add_action(
			'rtgodam_after_attachment_lookup',
			function () {
				$GLOBALS['rtgodam_stub']['cap_checks'][] = array( 'hook', 'after' );
			}
		);
	}

	// ------------------------------------------------------------------ the routes.

	/** The three routes that change a video's thumbnails check edit access to the video. */
	public function test_thumbnail_write_routes_check_edit_access() {
		foreach ( array( 'set-video-thumbnail', 'upload-custom-video-thumbnail', 'delete-custom-video-thumbnail' ) as $name ) {
			$this->assertSame( array( $this->library, 'can_edit_attachment' ), $this->routes[ '/media-library/' . $name ]['permission_callback'], $name );
		}
	}

	/** The two routes that read a video's thumbnails or an image's EXIF data check read access. */
	public function test_thumbnail_and_exif_read_routes_check_read_access() {
		foreach ( array( 'get-video-thumbnail', 'get-exif-data' ) as $name ) {
			$this->assertSame( array( $this->library, 'can_read_attachment' ), $this->routes[ '/media-library/' . $name ]['permission_callback'], $name );
		}
	}

	/** The folder ZIP and the Central listing need the right to upload files, as the Media Library does. */
	public function test_folder_zip_and_central_listing_stay_behind_upload_files() {
		foreach ( array( '/media-library/download-folder/(?P<folder_id>\d+)', '/media-library/get-godam-cmm-files' ) as $route ) {
			$GLOBALS['rtgodam_stub']['caps'] = self::AUTHOR_CAPS;
			$this->assertTrue( call_user_func( $this->routes[ $route ]['permission_callback'] ), $route );

			$GLOBALS['rtgodam_stub']['caps'] = self::CONTRIBUTOR_CAPS;
			$this->assertFalse( call_user_func( $this->routes[ $route ]['permission_callback'] ), $route );
		}
	}

	// ------------------------------------------------------------------ edit access.

	/** Someone who may edit this attachment passes, and WordPress was asked about this attachment. */
	public function test_editor_of_the_attachment_may_change_thumbnails() {
		$GLOBALS['rtgodam_stub']['caps']        = self::AUTHOR_CAPS;
		$GLOBALS['rtgodam_stub']['object_caps'] = array( 'edit_post' => array( self::ATTACHMENT ) );

		$this->assertTrue( $this->permitted( '/media-library/set-video-thumbnail' ) );
		$this->assertContains( 'edit_post:' . self::ATTACHMENT, $this->checks() );
	}

	/** An author editing someone else's video is refused, though they hold `edit_posts`. */
	public function test_user_who_may_only_edit_another_attachment_is_refused() {
		$GLOBALS['rtgodam_stub']['caps']        = self::AUTHOR_CAPS;
		$GLOBALS['rtgodam_stub']['object_caps'] = array( 'edit_post' => array( self::OTHER_ATTACHMENT ) );

		foreach ( array( 'set-video-thumbnail', 'upload-custom-video-thumbnail', 'delete-custom-video-thumbnail' ) as $name ) {
			$this->assertFalse( $this->permitted( '/media-library/' . $name ), $name );
		}
	}

	/** Without `edit_posts` the route is closed, and the attachment is not even looked at. */
	public function test_user_without_edit_posts_is_refused_before_the_attachment_is_checked() {
		$GLOBALS['rtgodam_stub']['caps']        = array( 'read' );
		$GLOBALS['rtgodam_stub']['object_caps'] = array( 'edit_post' => array( self::ATTACHMENT ) );

		$this->assertFalse( $this->permitted( '/media-library/set-video-thumbnail' ) );
		$this->assertNotContains( 'edit_post:' . self::ATTACHMENT, $this->checks() );
	}

	/** A request that names no attachment is refused without a capability check on it. */
	public function test_request_without_an_attachment_is_refused() {
		$GLOBALS['rtgodam_stub']['caps']        = array( 'read', 'edit_posts', 'edit_post' );
		$GLOBALS['rtgodam_stub']['object_caps'] = array( 'edit_post' => array( 0 ) );

		$this->assertFalse( $this->permitted( '/media-library/set-video-thumbnail', null ) );
		$this->assertFalse( $this->permitted( '/media-library/set-video-thumbnail', 0 ) );
		$this->assertFalse( $this->permitted( '/media-library/get-exif-data', 0 ) );
		$this->assertNotContains( 'edit_post:0', $this->checks() );
	}

	/** The check runs between the lookup hooks, so a plugin that centralizes media resolves the attachment on its site. */
	public function test_attachment_check_runs_inside_the_lookup_hooks() {
		$this->record_lookup_hooks();
		$GLOBALS['rtgodam_stub']['caps']        = self::AUTHOR_CAPS;
		$GLOBALS['rtgodam_stub']['object_caps'] = array( 'edit_post' => array( self::ATTACHMENT ) );

		$this->permitted( '/media-library/set-video-thumbnail' );

		$checks = $this->checks();
		$before = array_search( 'hook:before', $checks, true );
		$edit   = array_search( 'edit_post:' . self::ATTACHMENT, $checks, true );
		$after  = array_search( 'hook:after', $checks, true );

		$this->assertNotFalse( $edit );
		$this->assertLessThan( $edit, $before );
		$this->assertGreaterThan( $edit, $after );
	}

	// ------------------------------------------------------------------ read access.

	/** A contributor reads media WordPress lets them read (attached to a published post, or to nothing). */
	public function test_user_who_can_read_the_attachment_may_read_it() {
		$GLOBALS['rtgodam_stub']['caps']        = self::CONTRIBUTOR_CAPS;
		$GLOBALS['rtgodam_stub']['object_caps'] = array( 'read_post' => array( self::ATTACHMENT ) );

		$this->assertTrue( $this->permitted( '/media-library/get-video-thumbnail' ) );
		$this->assertTrue( $this->permitted( '/media-library/get-exif-data' ) );
	}

	/** A contributor is refused media they cannot read, such as an upload attached to someone's draft. */
	public function test_contributor_is_refused_media_they_cannot_read() {
		$GLOBALS['rtgodam_stub']['caps']        = self::CONTRIBUTOR_CAPS;
		$GLOBALS['rtgodam_stub']['object_caps'] = array( 'read_post' => array( self::OTHER_ATTACHMENT ) );
		$GLOBALS['rtgodam_stub']['post_fields'] = array( 'post_status' => 'inherit' );

		$this->assertFalse( $this->permitted( '/media-library/get-video-thumbnail' ) );
		$this->assertFalse( $this->permitted( '/media-library/get-exif-data' ) );
	}

	/** Someone who can upload files keeps the media the Media Library lists them, whatever it is attached to. */
	public function test_user_who_can_upload_files_keeps_every_listed_attachment() {
		$GLOBALS['rtgodam_stub']['caps']        = self::AUTHOR_CAPS;
		$GLOBALS['rtgodam_stub']['object_caps'] = array( 'read_post' => array( self::OTHER_ATTACHMENT ) );
		$GLOBALS['rtgodam_stub']['post_fields'] = array( 'post_status' => 'inherit' );

		$this->assertTrue( $this->permitted( '/media-library/get-video-thumbnail' ) );
		$this->assertTrue( $this->permitted( '/media-library/get-exif-data' ) );
	}

	/** A private attachment is not listed to others, so the right to upload files does not open it. */
	public function test_private_attachment_needs_wordpress_read_access() {
		$GLOBALS['rtgodam_stub']['caps']        = self::AUTHOR_CAPS;
		$GLOBALS['rtgodam_stub']['object_caps'] = array( 'read_post' => array( self::OTHER_ATTACHMENT ) );
		$GLOBALS['rtgodam_stub']['post_fields'] = array( 'post_status' => 'private' );

		$this->assertFalse( $this->permitted( '/media-library/get-video-thumbnail' ) );
		$this->assertFalse( $this->permitted( '/media-library/get-exif-data' ) );

		$GLOBALS['rtgodam_stub']['object_caps'] = array( 'read_post' => array( self::ATTACHMENT ) );
		$this->assertTrue( $this->permitted( '/media-library/get-exif-data' ), 'read_post is still enough' );
	}

	/** Reading needed `edit_posts` before and still does: a subscriber is not let in by `read_post`. */
	public function test_subscriber_is_refused_a_read() {
		$GLOBALS['rtgodam_stub']['caps']        = array( 'read' );
		$GLOBALS['rtgodam_stub']['object_caps'] = array( 'read_post' => array( self::ATTACHMENT ) );

		$this->assertFalse( $this->permitted( '/media-library/get-video-thumbnail' ) );
		$this->assertFalse( $this->permitted( '/media-library/get-exif-data' ) );
	}

	// ------------------------------------------------------------------ the thumbnail read.

	/**
	 * A Central-hosted video with nothing stored yet, so the read asks Central for its thumbnails.
	 */
	private function central_video_without_stored_thumbnails() {
		$this->stored_meta( array( '_godam_original_id' => 'central-1' ) );
		$GLOBALS['rtgodam_stub']['http'] = array(
			'code' => 200,
			'body' => wp_json_encode(
				array(
					'message' => array(
						'thumbnail_url' => 'https://cdn.example.test/t1.jpg',
						'thumbnails'    => array(
							array(
								'thumbnail_url'         => 'https://cdn.example.test/t1.jpg',
								'placeholder_thumbnail' => 'https://cdn.example.test/p1.jpg',
							),
							array( 'thumbnail_url' => 'https://cdn.example.test/t2.jpg' ),
						),
					),
				)
			),
		);
	}

	/**
	 * Call the thumbnail read and return the response data.
	 *
	 * @return array
	 */
	private function read_thumbnails() {
		$response = $this->library->get_video_thumbnails( new \WP_REST_Request( array( 'attachment_id' => self::ATTACHMENT ) ) );

		$this->assertInstanceOf( \WP_REST_Response::class, $response );
		return $response->get_data()['data'];
	}

	/** Someone who may edit the video still gets Central's thumbnails saved by the read, as before. */
	public function test_editor_read_saves_the_thumbnails_from_central() {
		$this->central_video_without_stored_thumbnails();
		$GLOBALS['rtgodam_stub']['object_caps'] = array( 'edit_post' => array( self::ATTACHMENT ) );

		$data = $this->read_thumbnails();

		$this->assertSame( array( 'https://cdn.example.test/t1.jpg', 'https://cdn.example.test/t2.jpg' ), $data['thumbnails'] );
		$writes = $GLOBALS['rtgodam_stub']['meta_writes'];
		$this->assertSame( array( 'https://cdn.example.test/t1.jpg', 'https://cdn.example.test/t2.jpg' ), $writes['rtgodam_media_thumbnails'] );
		$this->assertSame( array( 'https://cdn.example.test/t1.jpg' => 'https://cdn.example.test/p1.jpg' ), $writes['rtgodam_media_placeholder_thumbnails'] );
		$this->assertSame( 'https://cdn.example.test/t1.jpg', $writes['rtgodam_media_video_thumbnail'] );
	}

	/** A reader who may not edit the video gets the same answer, and nothing is written. */
	public function test_reader_gets_the_same_answer_without_a_write() {
		$this->central_video_without_stored_thumbnails();
		$GLOBALS['rtgodam_stub']['object_caps'] = array( 'edit_post' => array( self::OTHER_ATTACHMENT ) );

		$data = $this->read_thumbnails();

		$this->assertSame( array( 'https://cdn.example.test/t1.jpg', 'https://cdn.example.test/t2.jpg' ), $data['thumbnails'] );
		$this->assertSame( 'https://cdn.example.test/t1.jpg', $data['selected'] );
		$this->assertSame( array( 'https://cdn.example.test/t1.jpg' => 'https://cdn.example.test/p1.jpg' ), $data['placeholderThumbnails'] );
		$this->assertArrayNotHasKey( 'meta_writes', $GLOBALS['rtgodam_stub'] );
		$this->assertArrayNotHasKey( 'meta_deletes', $GLOBALS['rtgodam_stub'] );
	}

	/** A selected poster that is in no list is replaced by the first thumbnail, saved only for someone who may edit. */
	public function test_stale_selected_poster_is_only_repaired_for_an_editor() {
		$stored = array(
			'rtgodam_media_thumbnails'      => array( 'https://cdn.example.test/g1.jpg' ),
			'rtgodam_media_video_thumbnail' => 'https://cdn.example.test/gone.jpg',
		);

		$this->stored_meta( $stored );
		$GLOBALS['rtgodam_stub']['object_caps'] = array( 'edit_post' => array( self::OTHER_ATTACHMENT ) );
		$data                                   = $this->read_thumbnails();
		$this->assertSame( 'https://cdn.example.test/g1.jpg', $data['selected'] );
		$this->assertSame( 'https://cdn.example.test/gone.jpg', $GLOBALS['rtgodam_stub']['post_meta']['rtgodam_media_video_thumbnail'], 'a reader leaves the stored poster alone' );

		$this->stored_meta( $stored );
		$GLOBALS['rtgodam_stub']['object_caps'] = array( 'edit_post' => array( self::ATTACHMENT ) );
		$data                                   = $this->read_thumbnails();
		$this->assertSame( 'https://cdn.example.test/g1.jpg', $data['selected'] );
		$this->assertSame( 'https://cdn.example.test/g1.jpg', $GLOBALS['rtgodam_stub']['post_meta']['rtgodam_media_video_thumbnail'] );
	}

	// ------------------------------------------------------------------ removing a custom thumbnail.

	/**
	 * Call the delete handler for a custom thumbnail.
	 *
	 * @param string $url Thumbnail URL in the request.
	 * @return mixed
	 */
	private function remove_thumbnail( $url ) {
		return $this->library->remove_custom_video_thumbnail(
			new \WP_REST_Request(
				array(
					'attachment_id' => self::ATTACHMENT,
					'thumbnail_url' => $url,
				)
			)
		);
	}

	/** Removing the last custom thumbnail also clears the poster when that thumbnail was the poster. */
	public function test_removing_the_last_custom_thumbnail_clears_it_as_the_poster() {
		$this->stored_meta(
			array(
				'rtgodam_custom_media_thumbnails' => array( 'https://example.com/only.jpg' ),
				'rtgodam_media_video_thumbnail'   => 'https://example.com/only.jpg',
			)
		);

		$response = $this->remove_thumbnail( 'https://example.com/only.jpg' );

		$this->assertTrue( $response->get_data()['success'] );
		$this->assertArrayNotHasKey( 'rtgodam_custom_media_thumbnails', $GLOBALS['rtgodam_stub']['post_meta'] );
		$this->assertArrayNotHasKey( 'rtgodam_media_video_thumbnail', $GLOBALS['rtgodam_stub']['post_meta'] );
	}

	/** Removing the last custom thumbnail leaves a poster that is something else alone. */
	public function test_removing_the_last_custom_thumbnail_keeps_another_poster() {
		$this->stored_meta(
			array(
				'rtgodam_custom_media_thumbnails' => array( 'https://example.com/only.jpg' ),
				'rtgodam_media_video_thumbnail'   => 'https://cdn.example.test/g1.jpg',
			)
		);

		$this->remove_thumbnail( 'https://example.com/only.jpg' );

		$this->assertArrayNotHasKey( 'rtgodam_custom_media_thumbnails', $GLOBALS['rtgodam_stub']['post_meta'] );
		$this->assertSame( 'https://cdn.example.test/g1.jpg', $GLOBALS['rtgodam_stub']['post_meta']['rtgodam_media_video_thumbnail'] );
	}

	/** With others left, removing the poster clears it and keeps the rest, as before. */
	public function test_removing_the_poster_with_others_left_keeps_the_rest() {
		$this->stored_meta(
			array(
				'rtgodam_custom_media_thumbnails' => array( 'https://example.com/a.jpg', 'https://example.com/b.jpg' ),
				'rtgodam_media_video_thumbnail'   => 'https://example.com/a.jpg',
			)
		);

		$this->remove_thumbnail( 'https://example.com/a.jpg' );

		// Stored as a list (keys 0..n), so the picker gets a JSON array back, not an object.
		$this->assertSame( array( 'https://example.com/b.jpg' ), $GLOBALS['rtgodam_stub']['post_meta']['rtgodam_custom_media_thumbnails'] );
		$this->assertArrayNotHasKey( 'rtgodam_media_video_thumbnail', $GLOBALS['rtgodam_stub']['post_meta'] );
	}

	/** On an https site the poster is matched on the https form, as the thumbnail list is. */
	public function test_removing_the_poster_matches_across_http_and_https() {
		$GLOBALS['rtgodam_stub']['ssl'] = true;
		$this->stored_meta(
			array(
				'rtgodam_custom_media_thumbnails' => array( 'http://example.com/only.jpg' ),
				'rtgodam_media_video_thumbnail'   => 'http://example.com/only.jpg',
			)
		);

		$this->remove_thumbnail( 'http://example.com/only.jpg' );

		$this->assertArrayNotHasKey( 'rtgodam_media_video_thumbnail', $GLOBALS['rtgodam_stub']['post_meta'] );
	}

	// ------------------------------------------------------------------ thumbnail URLs.

	/**
	 * URLs that are not an absolute http(s) address.
	 *
	 * @return array
	 */
	public function rejected_urls() {
		return array(
			'script scheme'           => array( 'javascript:alert(1)' ),
			'script scheme with host' => array( 'javascript://example.com/%0Aalert(1)' ),
			'data URL'                => array( 'data:text/html;base64,PHNjcmlwdD4=' ),
			'ftp'                     => array( 'ftp://files.example.test/x.jpg' ),
			'no scheme'               => array( 'not a url' ),
			'relative path'           => array( '/wp-content/uploads/x.jpg' ),
			'empty'                   => array( '' ),
			'not a string'            => array( array( 'https://example.com/x.jpg' ) ),
		);
	}

	/**
	 * @dataProvider rejected_urls
	 *
	 * @param mixed $url Thumbnail URL in the request.
	 */
	public function test_custom_thumbnail_rejects_a_url_that_is_not_http( $url ) {
		$response = $this->library->upload_custom_video_thumbnail(
			new \WP_REST_Request(
				array(
					'attachment_id' => self::ATTACHMENT,
					'thumbnail_url' => $url,
				)
			)
		);

		$this->assertInstanceOf( \WP_Error::class, $response );
		$this->assertSame( 'invalid_thumbnail_url', $response->get_error_code() );
		$this->assertSame( 400, $response->get_error_data()['status'] );
		$this->assertArrayNotHasKey( 'meta_writes', $GLOBALS['rtgodam_stub'] );
	}

	/**
	 * @dataProvider rejected_urls
	 *
	 * @param mixed $url Thumbnail URL in the request.
	 */
	public function test_selecting_a_poster_rejects_a_url_that_is_not_http( $url ) {
		$response = $this->library->set_video_thumbnail(
			new \WP_REST_Request(
				array(
					'attachment_id' => self::ATTACHMENT,
					'thumbnail_url' => $url,
				)
			)
		);

		$this->assertInstanceOf( \WP_Error::class, $response );
		$this->assertSame( 'invalid_thumbnail_url', $response->get_error_code() );
		$this->assertArrayNotHasKey( 'meta_writes', $GLOBALS['rtgodam_stub'] );
	}

	/** An uploads URL and a CDN URL, including a file name with non-Latin letters, are still accepted. */
	public function test_custom_thumbnail_accepts_uploads_and_cdn_urls() {
		foreach ( array( 'https://example.com/wp-content/uploads/2026/10/thumb.jpg', 'https://cdn.example.test/t.jpg?v=2', 'https://example.com/wp-content/uploads/2026/10/миниатюра.jpg' ) as $url ) {
			$this->stored_meta( array() );

			$response = $this->library->upload_custom_video_thumbnail(
				new \WP_REST_Request(
					array(
						'attachment_id' => self::ATTACHMENT,
						'thumbnail_url' => ' ' . $url . ' ',
					)
				)
			);

			$this->assertTrue( $response->get_data()['success'], $url );
			$this->assertSame( array( $url ), $GLOBALS['rtgodam_stub']['post_meta']['rtgodam_custom_media_thumbnails'], $url );
			$this->assertSame( $url, $GLOBALS['rtgodam_stub']['post_meta']['rtgodam_media_video_thumbnail'], $url );
		}
	}

	/** Selecting one of a video's own thumbnails still works. */
	public function test_selecting_a_poster_accepts_an_http_url() {
		$this->stored_meta( array() );

		$response = $this->library->set_video_thumbnail(
			new \WP_REST_Request(
				array(
					'attachment_id' => self::ATTACHMENT,
					'thumbnail_url' => 'https://cdn.example.test/g2.jpg',
				)
			)
		);

		$this->assertTrue( $response->get_data()['success'] );
		$this->assertSame( 'https://cdn.example.test/g2.jpg', $GLOBALS['rtgodam_stub']['post_meta']['rtgodam_media_video_thumbnail'] );
	}
}
