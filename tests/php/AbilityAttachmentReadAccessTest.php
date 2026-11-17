<?php
/**
 * Tests that abilities only hand out attachments the caller may read.
 *
 * @package GoDAM
 */

declare( strict_types = 1 );

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Abilities\Media_Abilities;

/**
 * Every ability that takes a media ID loads it through get_attachment(). It
 * must refuse an attachment the caller cannot read (an administrator's private
 * attachment asked for by an Author), with the same "not found" answer as a
 * missing ID, and keep returning media the Media Library already lists.
 *
 * Runs in its own process because it sets the bootstrap's stub globals.
 *
 * @covers \RTGODAM\Inc\Abilities\Ability_Group::get_attachment
 * @covers \RTGODAM\Inc\Abilities\Ability_Group::can_read_attachment
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class AbilityAttachmentReadAccessTest extends TestCase {

	/**
	 * Returns Media_Abilities with the bootstrap stubs set up for one post and one user.
	 *
	 * @param array $caps Capabilities of the current user, in the bootstrap's `caps` shape.
	 * @param array $post Fields of the one post get_post() knows.
	 *
	 * @return Media_Abilities
	 */
	private function ability( array $caps, array $post ) {
		require_once dirname( __DIR__ ) . '/stubs/post-functions.php';

		$GLOBALS['rtgodam_stub']['caps']  = $caps;
		$GLOBALS['rtgodam_stub']['posts'] = array( (int) $post['ID'] => (object) $post );

		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-ability-group.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-media-abilities.php';

		return new class() extends Media_Abilities {

			/**
			 * Skips the parent's hooks.
			 */
			public function __construct() {}

			/**
			 * Exposes the protected lookup.
			 *
			 * @param int $id Attachment ID.
			 *
			 * @return mixed
			 */
			public function lookup( $id ) {
				return $this->get_attachment( $id );
			}
		};
	}

	/**
	 * Private attachment of another user, caller without read access.
	 *
	 * @return array
	 */
	private function private_attachment() {
		return array(
			'ID'          => 65,
			'post_type'   => 'attachment',
			'post_status' => 'private',
			'post_author' => 1,
		);
	}

	/**
	 * The reported leak: an Author asks for an administrator's private attachment.
	 */
	public function test_an_author_cannot_load_a_private_attachment_they_cannot_read() {
		$result = $this->ability(
			array( 'upload_files' ),
			$this->private_attachment()
		)->lookup( 65 );

		$this->assertInstanceOf( \WP_Error::class, $result, 'A private attachment the user cannot read is not returned.' );
		$this->assertSame( 'rtgodam_media_not_found', $result->get_error_code(), 'Same answer as a missing ID, so IDs cannot be probed.' );
		$this->assertSame( array( 'status' => 404 ), $result->get_error_data() );
	}

	/**
	 * Refused and missing IDs look the same.
	 */
	public function test_a_refused_id_answers_like_a_missing_one() {
		$ability = $this->ability(
			array( 'upload_files' ),
			$this->private_attachment()
		);

		$refused = $ability->lookup( 65 );
		$missing = $ability->lookup( 66 );

		$this->assertSame( $missing->get_error_code(), $refused->get_error_code() );
		$this->assertSame( $missing->get_error_data(), $refused->get_error_data() );
	}

	/**
	 * Someone WordPress lets read it (an administrator, or the owner) still gets it.
	 */
	public function test_a_user_who_can_read_the_private_attachment_gets_it() {
		$result = $this->ability(
			array( 'upload_files', 'read_post' ),
			$this->private_attachment()
		)->lookup( 65 );

		$this->assertIsObject( $result );
		$this->assertSame( 65, $result->ID );
	}

	/**
	 * Ordinary media the Media Library lists to any uploader stays available,
	 * even when it is attached to a post the user cannot read.
	 */
	public function test_an_uploader_still_gets_inherit_media_from_the_library() {
		$result = $this->ability(
			array( 'upload_files' ),
			array(
				'ID'          => 70,
				'post_type'   => 'attachment',
				'post_status' => 'inherit',
				'post_author' => 1,
			)
		)->lookup( 70 );

		$this->assertIsObject( $result );
		$this->assertSame( 70, $result->ID );
	}

	/**
	 * A user without upload_files gets nothing that read_post does not allow.
	 */
	public function test_inherit_media_needs_read_access_without_upload_files() {
		$result = $this->ability(
			array(),
			array(
				'ID'          => 70,
				'post_type'   => 'attachment',
				'post_status' => 'inherit',
				'post_author' => 1,
			)
		)->lookup( 70 );

		$this->assertInstanceOf( \WP_Error::class, $result );
	}

	/**
	 * A non-attachment ID is still "not found".
	 */
	public function test_a_post_that_is_not_an_attachment_is_not_found() {
		$result = $this->ability(
			array( 'upload_files', 'read_post' ),
			array(
				'ID'          => 80,
				'post_type'   => 'post',
				'post_status' => 'publish',
				'post_author' => 1,
			)
		)->lookup( 80 );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'rtgodam_media_not_found', $result->get_error_code() );
	}
}
