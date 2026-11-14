<?php
/**
 * Tests the order godam/update-video-settings saves its parts in.
 *
 * @package GoDAM
 */

declare( strict_types = 1 );

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Abilities\Video_Settings_Abilities;

/**
 * A call that fails must not leave the ad source changed. The thumbnail step
 * talks to GoDAM and is the likeliest to fail, so it runs first; the ad source
 * is a local save and goes last.
 *
 * Runs in its own process because it defines core functions.
 *
 * @covers \RTGODAM\Inc\Abilities\Video_Settings_Abilities::update_video_settings
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class VideoSettingsOrderTest extends TestCase {

	/**
	 * Returns the ability, with the routes it calls answered from a script.
	 *
	 * Every call to rest() is recorded as "METHOD route" in `$calls`. A route
	 * named in `$failing` answers with a WP_Error; the rest answer with success.
	 *
	 * @param string[] $failing Routes that fail, e.g. `/godam/v1/media-library/upload-custom-video-thumbnail`.
	 *
	 * @return Video_Settings_Abilities
	 */
	private function ability( array $failing = array() ) {
		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-ability-group.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-video-settings-abilities.php';

		$GLOBALS['rtgodam_stub'] = array();

		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		if ( ! function_exists( 'esc_url_raw' ) ) {
			eval( 'function esc_url_raw( $url, $protocols = null ) { return (string) $url; }' );
		}
		if ( ! function_exists( 'wp_attachment_is_image' ) ) {
			eval( 'function wp_attachment_is_image( $post = null ) { return true; }' );
		}
		// phpcs:enable Squiz.PHP.Eval.Discouraged

		return new class( $failing ) extends Video_Settings_Abilities {

			/**
			 * Every rest() call, as "METHOD route".
			 *
			 * @var string[]
			 */
			public $calls = array();

			/**
			 * Routes that fail.
			 *
			 * @var string[]
			 */
			private $failing;

			/**
			 * Sets the routes that fail.
			 *
			 * @param string[] $failing Routes that fail.
			 */
			public function __construct( array $failing ) {
				$this->failing = $failing;
			}

			/**
			 * Records the call and answers from the script.
			 *
			 * @param string $method HTTP method.
			 * @param string $route  Full route.
			 * @param array  $params Request parameters.
			 *
			 * @return mixed
			 */
			protected function rest( $method, $route, array $params = array() ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found -- signature mirrors the parent.
				$this->calls[] = $method . ' ' . $route;

				if ( in_array( $route, $this->failing, true ) ) {
					return new \WP_Error( 'godam_api_error', 'GoDAM refused the thumbnail.', array( 'status' => 502 ) );
				}

				if ( '/godam/v1/media-library/get-video-thumbnail' === $route ) {
					return array(
						'success' => true,
						'data'    => array(
							'selected'         => 'https://cdn.example.com/a.jpg',
							'thumbnails'       => array( 'https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg' ),
							'customThumbnails' => array(),
						),
					);
				}

				return array( 'success' => true );
			}

			/**
			 * Any ID is an attachment.
			 *
			 * @param int $attachment_id Attachment ID.
			 *
			 * @return object
			 */
			protected function get_attachment( $attachment_id ) {
				return (object) array(
					'ID'        => (int) $attachment_id,
					'post_type' => 'attachment',
				);
			}

			/**
			 * Every attachment is a video.
			 *
			 * @param int|\WP_Post $attachment Attachment ID or post.
			 *
			 * @return string
			 */
			protected function attachment_mime_type( $attachment ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found -- signature mirrors the parent.
				return 'video/mp4';
			}

			/**
			 * A fixed file URL for any image.
			 *
			 * @param int $attachment_id Attachment ID.
			 *
			 * @return string
			 */
			protected function attachment_url( $attachment_id ) {
				return 'https://example.com/uploads/image-' . $attachment_id . '.jpg';
			}
		};
	}

	/**
	 * Calls that match a route prefix, in order.
	 *
	 * @param string[] $calls  Recorded calls.
	 * @param string   $prefix Start of "METHOD route".
	 *
	 * @return int[] Their positions in the call list.
	 */
	private function positions( array $calls, $prefix ) {
		$found = array();

		foreach ( $calls as $position => $call ) {
			if ( 0 === strpos( $call, $prefix ) ) {
				$found[] = $position;
			}
		}

		return $found;
	}

	/**
	 * A thumbnail the route refuses leaves the ad source as it was.
	 *
	 * @dataProvider failing_thumbnail_calls
	 *
	 * @param array  $input   Ability input.
	 * @param string $failing The route that fails.
	 *
	 * @return void
	 */
	public function test_a_failed_thumbnail_leaves_the_ad_source_unchanged( array $input, $failing ) {
		$ability = $this->ability( array( $failing ) );
		$result  = $ability->update_video_settings( array_merge( array( 'id' => 55 ), $input ) );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'godam_api_error', $result->get_error_code() );
		$this->assertSame( array(), $this->positions( $ability->calls, 'POST /wp/v2/media/55' ), 'The ad source is not saved after the thumbnail failed.' );
	}

	/**
	 * The two ways to set a thumbnail, each with its route failing.
	 *
	 * @return array
	 */
	public function failing_thumbnail_calls() {
		return array(
			'library image as thumbnail'         => array(
				array(
					'ad_tag_url'         => 'https://ads.example.com/vast.xml',
					'thumbnail_image_id' => 9,
				),
				'/godam/v1/media-library/upload-custom-video-thumbnail',
			),
			'one of the video\'s own thumbnails' => array(
				array(
					'ad_tag_url'    => 'https://ads.example.com/vast.xml',
					'thumbnail_url' => 'https://cdn.example.com/b.jpg',
				),
				'/godam/v1/media-library/set-video-thumbnail',
			),
		);
	}

	/**
	 * When both parts succeed, GoDAM's thumbnail call goes first and the local ad save last.
	 *
	 * @return void
	 */
	public function test_the_thumbnail_is_saved_before_the_ad_source() {
		$ability = $this->ability();
		$result  = $ability->update_video_settings(
			array(
				'id'                 => 55,
				'ad_tag_url'         => 'https://ads.example.com/vast.xml',
				'thumbnail_image_id' => 9,
			)
		);

		$this->assertIsArray( $result );

		$thumbnail = $this->positions( $ability->calls, 'POST /godam/v1/media-library/upload-custom-video-thumbnail' );
		$ad_source = $this->positions( $ability->calls, 'POST /wp/v2/media/55' );

		$this->assertCount( 1, $thumbnail );
		$this->assertCount( 1, $ad_source );
		$this->assertLessThan( $ad_source[0], $thumbnail[0], 'The thumbnail call goes before the ad source save.' );
	}

	/**
	 * An ad-only update still saves the ad source.
	 *
	 * @return void
	 */
	public function test_an_ad_only_update_saves_the_ad_source() {
		$ability = $this->ability();
		$result  = $ability->update_video_settings(
			array(
				'id'         => 55,
				'ad_tag_url' => 'https://ads.example.com/vast.xml',
			)
		);

		$this->assertIsArray( $result );
		$this->assertCount( 1, $this->positions( $ability->calls, 'POST /wp/v2/media/55' ) );
		$this->assertSame( array(), $this->positions( $ability->calls, 'POST /godam/v1/media-library/' ), 'No thumbnail is written.' );
	}
}
