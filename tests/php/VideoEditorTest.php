<?php
/**
 * Unit tests for the Video_Editor list-view REST helpers.
 *
 * Covers the media-type-aware branching added for the image/audio editor:
 *   - build_filter_meta_query(): which filters apply per media type, and the
 *     meta_query shape each produces.
 *   - prepare_video_item(): per-type thumbnail resolution (video poster, image
 *     CDN/local/URL fallback chain, audio cover) and the derived item fields.
 *
 * Both methods are private, so they're exercised via reflection on an instance
 * built without the constructor (Base's constructor registers WP hooks we don't
 * want here). The handful of WP functions prepare_video_item() calls are stubbed
 * in tests/bootstrap.php and driven by $GLOBALS['rtgodam_stub'].
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Video_Editor;

/**
 * @covers \RTGODAM\Inc\REST_API\Video_Editor
 */
class VideoEditorTest extends TestCase {

	/**
	 * Invoke a private Video_Editor method on a constructor-less instance.
	 *
	 * @param string $method Method name.
	 * @param array  $args   Positional arguments.
	 * @return mixed
	 */
	private function invoke( $method, array $args ) {
		$ref    = new \ReflectionClass( Video_Editor::class );
		$object = $ref->newInstanceWithoutConstructor();
		$m      = $ref->getMethod( $method );
		$m->setAccessible( true );
		return $m->invokeArgs( $object, $args );
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		parent::tearDown();
	}

	/*
	 * -------------------------------------------------------------------
	 * build_filter_meta_query(): per-type gating.
	 * -------------------------------------------------------------------
	 */

	/** Transcode filters don't apply to images (never transcoded) → treated as "all". */
	public function test_transcode_filters_are_ignored_for_images() {
		$this->assertSame( array(), $this->invoke( 'build_filter_meta_query', array( 'transcoded', 'image' ) ) );
		$this->assertSame( array(), $this->invoke( 'build_filter_meta_query', array( 'non_transcoded', 'image' ) ) );
	}

	/** Edited/unedited derive from layers; audio has none → treated as "all". */
	public function test_layer_filters_are_ignored_for_audio() {
		$this->assertSame( array(), $this->invoke( 'build_filter_meta_query', array( 'edited', 'audio' ) ) );
		$this->assertSame( array(), $this->invoke( 'build_filter_meta_query', array( 'unedited', 'audio' ) ) );
	}

	/** The gates are type-specific: layer filters still apply to images, transcode filters to audio. */
	public function test_gates_do_not_over_apply() {
		$this->assertNotEmpty( $this->invoke( 'build_filter_meta_query', array( 'edited', 'image' ) ) );
		$this->assertNotEmpty( $this->invoke( 'build_filter_meta_query', array( 'unedited', 'image' ) ) );
		$this->assertNotEmpty( $this->invoke( 'build_filter_meta_query', array( 'transcoded', 'audio' ) ) );
		$this->assertNotEmpty( $this->invoke( 'build_filter_meta_query', array( 'non_transcoded', 'audio' ) ) );
	}

	/*
	 * -------------------------------------------------------------------
	 * build_filter_meta_query(): meta_query shapes (video is the default type).
	 * -------------------------------------------------------------------
	 */

	public function test_transcoded_query_shape() {
		$query = $this->invoke( 'build_filter_meta_query', array( 'transcoded', 'video' ) );
		$this->assertSame( 'rtgodam_transcoding_status', $query[0]['key'] );
		$this->assertSame( 'transcoded', $query[0]['value'] );
	}

	public function test_non_transcoded_query_is_an_or_clause() {
		$query = $this->invoke( 'build_filter_meta_query', array( 'non_transcoded', 'video' ) );
		$this->assertSame( 'OR', $query['relation'] );
	}

	public function test_edited_query_matches_non_empty_layers() {
		$query = $this->invoke( 'build_filter_meta_query', array( 'edited', 'video' ) );
		$this->assertSame( 'AND', $query['relation'] );
		// A LIKE on the serialized signature, excluding the empty-array form.
		$this->assertSame( 'LIKE', $query[0]['compare'] );
		$this->assertSame( '"layers";a:', $query[0]['value'] );
		$this->assertSame( 'NOT LIKE', $query[1]['compare'] );
		$this->assertSame( '"layers";a:0:', $query[1]['value'] );
	}

	public function test_unedited_query_is_an_or_clause() {
		$query = $this->invoke( 'build_filter_meta_query', array( 'unedited', 'video' ) );
		$this->assertSame( 'OR', $query['relation'] );
	}

	public function test_all_and_unknown_filters_are_empty() {
		$this->assertSame( array(), $this->invoke( 'build_filter_meta_query', array( 'all', 'video' ) ) );
		$this->assertSame( array(), $this->invoke( 'build_filter_meta_query', array( 'something-else', 'video' ) ) );
	}

	/*
	 * -------------------------------------------------------------------
	 * prepare_video_item(): per-type thumbnail resolution.
	 * -------------------------------------------------------------------
	 */

	/**
	 * Build a fake attachment post. Only the fields prepare_video_item() reads.
	 *
	 * @return object
	 */
	private function fake_post() {
		return (object) array(
			'ID'            => 10,
			'post_author'   => 3,
			'post_modified' => '2026-01-02 03:04:05',
		);
	}

	/** Video: the poster comes from the prepared `image.src` GoDAM injects. */
	public function test_video_thumbnail_uses_prepared_poster() {
		$GLOBALS['rtgodam_stub'] = array(
			'mime'      => 'video/mp4',
			'prepared'  => array(
				'image'              => array( 'src' => 'https://cdn.example/poster.jpg' ),
				'title'              => 'Clip',
				'url'                => 'https://cdn.example/clip.mp4',
				'fileLength'         => '1:23',
				'transcoding_status' => 'transcoded',
			),
			'post_meta' => array(
				'rtgodam_meta'       => array( 'layers' => array( array( 'id' => 1 ), array( 'id' => 2 ) ) ),
				'_godam_original_id' => '',
			),
		);

		$item = $this->invoke( 'prepare_video_item', array( $this->fake_post() ) );

		$this->assertSame( 'video', $item['type'] );
		$this->assertSame( 'https://cdn.example/poster.jpg', $item['thumbnail'] );
		$this->assertSame( 'transcoded', $item['transcodeStatus'] );
		$this->assertTrue( $item['isEdited'] );
		$this->assertSame( 2, $item['layersCount'] );
		$this->assertFalse( $item['godamCentral'] );
	}

	/** Image: GoDAM CDN sub-sizes win, and thumbnail is preferred over medium. */
	public function test_image_thumbnail_prefers_cdn_sizes() {
		$GLOBALS['rtgodam_stub'] = array(
			'mime'      => 'image/png',
			'prepared'  => array( 'sizes' => array( 'medium' => array( 'url' => 'https://local/med.png' ) ) ),
			'post_meta' => array(
				'rtgodam_image_sizes' => array(
					'thumbnail' => array( 'url' => 'https://cdn.example/thumb.png' ),
					'medium'    => array( 'url' => 'https://cdn.example/med.png' ),
				),
				'rtgodam_meta'        => '',
				'_godam_original_id'  => '42',
			),
		);

		$item = $this->invoke( 'prepare_video_item', array( $this->fake_post() ) );

		$this->assertSame( 'image', $item['type'] );
		$this->assertSame( 'https://cdn.example/thumb.png', $item['thumbnail'] );
		$this->assertTrue( $item['godamCentral'] );
		$this->assertFalse( $item['isEdited'] );
		$this->assertSame( 0, $item['layersCount'] );
	}

	/** Image: with no CDN sizes, fall back to a locally generated size. */
	public function test_image_thumbnail_falls_back_to_local_sizes() {
		$GLOBALS['rtgodam_stub'] = array(
			'mime'      => 'image/jpeg',
			'prepared'  => array( 'sizes' => array( 'medium' => array( 'url' => 'https://local/med.jpg' ) ) ),
			'post_meta' => array(
				'rtgodam_image_sizes' => '',
				'rtgodam_meta'        => '',
			),
		);

		$item = $this->invoke( 'prepare_video_item', array( $this->fake_post() ) );

		$this->assertSame( 'https://local/med.jpg', $item['thumbnail'] );
	}

	/**
	 * Image: with neither CDN nor local sizes, fall back to the attachment URL —
	 * NOT the prepared `image.src`, which for a size-less image is WordPress'
	 * generic mime icon.
	 */
	public function test_image_thumbnail_ignores_generic_mime_icon() {
		$GLOBALS['rtgodam_stub'] = array(
			'mime'           => 'image/png',
			'prepared'       => array( 'image' => array( 'src' => 'https://wp/wp-includes/images/media/default.png' ) ),
			'post_meta'      => array(
				'rtgodam_image_sizes' => '',
				'rtgodam_meta'        => '',
			),
			'attachment_url' => 'https://cdn.example/original.png',
		);

		$item = $this->invoke( 'prepare_video_item', array( $this->fake_post() ) );

		$this->assertSame( 'https://cdn.example/original.png', $item['thumbnail'] );
		$this->assertNotSame( 'https://wp/wp-includes/images/media/default.png', $item['thumbnail'] );
	}

	/** Audio: use the GoDAM cover, ignoring the prepared audio mime icon. */
	public function test_audio_thumbnail_uses_godam_cover() {
		$GLOBALS['rtgodam_stub'] = array(
			'mime'      => 'audio/mpeg',
			'prepared'  => array( 'image' => array( 'src' => 'https://wp/wp-includes/images/media/audio.png' ) ),
			'post_meta' => array(
				'rtgodam_media_audio_thumbnail' => 'https://cdn.example/cover.jpg',
				'rtgodam_meta'                  => '',
			),
		);

		$item = $this->invoke( 'prepare_video_item', array( $this->fake_post() ) );

		$this->assertSame( 'audio', $item['type'] );
		$this->assertSame( 'https://cdn.example/cover.jpg', $item['thumbnail'] );
	}

	/** Audio: with no cover, the thumbnail is left empty (client shows an icon tile). */
	public function test_audio_thumbnail_empty_without_cover() {
		$GLOBALS['rtgodam_stub'] = array(
			'mime'      => 'audio/wav',
			'prepared'  => array( 'image' => array( 'src' => 'https://wp/wp-includes/images/media/audio.png' ) ),
			'post_meta' => array(
				'rtgodam_media_audio_thumbnail' => '',
				'rtgodam_meta'                  => '',
			),
		);

		$item = $this->invoke( 'prepare_video_item', array( $this->fake_post() ) );

		$this->assertSame( '', $item['thumbnail'] );
	}
}
