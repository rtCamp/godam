<?php
/**
 * Tests that abilities taking an image ID only use images the caller may read.
 *
 * @package GoDAM
 */

declare( strict_types = 1 );

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Abilities\Layer_Abilities;
use RTGODAM\Inc\Abilities\Video_Settings_Abilities;

/**
 * godam/update-video-settings (thumbnail_image_id) and godam/add-layer
 * (cta.image_id) turn an image ID into a public URL: the video's poster, or
 * the CTA image every visitor sees. An Author must not be able to pass an
 * administrator's private image and get its URL back or onto the player.
 *
 * Runs in its own process because it sets the bootstrap's stub globals.
 *
 * @covers \RTGODAM\Inc\Abilities\Ability_Group::get_image
 * @covers \RTGODAM\Inc\Abilities\Video_Settings_Abilities::update_video_settings
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class AbilityImageReadAccessTest extends TestCase {

	/**
	 * The Author's own video.
	 */
	const VIDEO_ID = 81;

	/**
	 * An image attachment.
	 */
	const IMAGE_ID = 88;

	/**
	 * Sets up the stubs: the Author's video plus one image with the given status.
	 *
	 * @param array  $caps         Capabilities of the current user, in the bootstrap's `caps` shape.
	 * @param string $image_status Status of the image attachment.
	 * @param bool   $is_image     What wp_attachment_is_image() answers for the image.
	 *
	 * @return void
	 */
	private function stubs( array $caps, $image_status, $is_image = true ) {
		require_once dirname( __DIR__ ) . '/stubs/post-functions.php';

		$GLOBALS['rtgodam_stub']['caps']     = $caps;
		$GLOBALS['rtgodam_stub']['is_image'] = $is_image;
		$GLOBALS['rtgodam_stub']['mime']     = 'video/mp4';
		$GLOBALS['rtgodam_stub']['posts']    = array(
			self::VIDEO_ID => (object) array(
				'ID'             => self::VIDEO_ID,
				'post_type'      => 'attachment',
				'post_status'    => 'inherit',
				'post_author'    => 4,
				'post_mime_type' => 'video/mp4',
			),
			self::IMAGE_ID => (object) array(
				'ID'             => self::IMAGE_ID,
				'post_type'      => 'attachment',
				'post_status'    => $image_status,
				'post_author'    => 1,
				'post_mime_type' => 'image/jpeg',
			),
		);

		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-ability-group.php';
	}

	/**
	 * Video_Settings_Abilities that records REST calls instead of running them.
	 *
	 * @return Video_Settings_Abilities
	 */
	private function video_settings() {
		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-video-settings-abilities.php';

		return new class() extends Video_Settings_Abilities {

			/**
			 * REST calls the ability made.
			 *
			 * @var array
			 */
			public $calls = array();

			/**
			 * Skips the parent's hooks.
			 */
			public function __construct() {}

			/**
			 * Records the call.
			 *
			 * @param string $method HTTP method.
			 * @param string $route  Route.
			 * @param array  $params Parameters.
			 *
			 * @return array
			 */
			protected function rest( $method, $route, array $params = array() ) {
				$this->calls[] = array( $method, $route, $params );

				return array();
			}

			/**
			 * Exposes the protected helper.
			 *
			 * @param int $id Image ID.
			 *
			 * @return mixed
			 */
			public function image( $id ) {
				return $this->get_image( $id, 'thumbnail_image_id' );
			}
		};
	}

	/**
	 * The reported leak: an Author sets an administrator's private image as their video's thumbnail.
	 */
	public function test_an_author_cannot_use_a_private_image_as_thumbnail() {
		$this->stubs( array( 'upload_files', 'edit_post:' . self::VIDEO_ID ), 'private' );
		$ability = $this->video_settings();

		$result = $ability->update_video_settings(
			array(
				'id'                 => self::VIDEO_ID,
				'thumbnail_image_id' => self::IMAGE_ID,
			)
		);

		$this->assertInstanceOf( \WP_Error::class, $result, 'A private image the user cannot read is refused.' );
		$this->assertSame( 'rtgodam_media_not_found', $result->get_error_code(), 'Same answer as a missing ID, so IDs cannot be probed.' );
		$this->assertSame( array(), $ability->calls, 'Nothing is sent to GoDAM, so the image URL is never saved as the poster.' );
	}

	/**
	 * Someone WordPress lets read the image (its owner, an administrator) can use it.
	 */
	public function test_a_user_who_can_read_the_image_gets_it() {
		$this->stubs( array( 'upload_files', 'read_post' ), 'private' );

		$result = $this->video_settings()->image( self::IMAGE_ID );

		$this->assertIsObject( $result );
		$this->assertSame( self::IMAGE_ID, $result->ID );
	}

	/**
	 * Library images any uploader can pick in the Media Library stay usable.
	 */
	public function test_an_uploader_can_use_an_inherit_image() {
		$this->stubs( array( 'upload_files' ), 'inherit' );

		$result = $this->video_settings()->image( self::IMAGE_ID );

		$this->assertIsObject( $result );
		$this->assertSame( self::IMAGE_ID, $result->ID );
	}

	/**
	 * A readable attachment that is not an image is still refused, as before.
	 */
	public function test_a_readable_attachment_that_is_not_an_image_is_refused() {
		$this->stubs( array( 'upload_files' ), 'inherit', false );

		$result = $this->video_settings()->image( self::IMAGE_ID );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'rtgodam_not_an_image', $result->get_error_code() );
	}

	/**
	 * godam/add-layer: a card CTA with someone else's private image is refused.
	 */
	public function test_a_cta_layer_cannot_use_a_private_image() {
		$this->stubs( array( 'upload_files' ), 'private' );
		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-layer-abilities.php';

		$ability = new class() extends Layer_Abilities {

			/**
			 * Skips the parent's hooks.
			 */
			public function __construct() {}
		};

		$build = new \ReflectionMethod( Layer_Abilities::class, 'build_cta' );
		if ( PHP_VERSION_ID < 80100 ) {
			$build->setAccessible( true );
		}

		$result = $build->invoke(
			$ability,
			array(
				'style'    => 'card',
				'heading'  => 'Buy now',
				'image_id' => self::IMAGE_ID,
			),
			false
		);

		$this->assertInstanceOf( \WP_Error::class, $result, 'The private image is not saved on the layer.' );
		$this->assertSame( 'rtgodam_media_not_found', $result->get_error_code() );
	}
}
