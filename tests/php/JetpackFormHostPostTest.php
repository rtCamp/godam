<?php
/**
 * Unit tests for which posts' Jetpack forms the player shows and accepts entries for.
 *
 * A Jetpack form lives in a post. The player shows it in a video, and posts a
 * visitor's entry to a public route, only when the post that holds the form is
 * one visitors can see: published, of a viewable type, and without a password.
 * The Media Editor's preview of the form also skips a post its user could not
 * open, and shows any post that user can edit.
 *
 * Jetpack itself is stubbed (tests/stubs/form-routes.php): the host post is
 * `post_content` 'form' for a post with one contact form, '' for one without.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use Automattic\Jetpack\Forms\ContactForm\Contact_Form;
use RTGODAM\Inc\REST_API\Jetpack;

/**
 * @covers \RTGODAM\Inc\REST_API\Jetpack::is_host_post_public
 * @covers \RTGODAM\Inc\REST_API\Jetpack::get_rendered_form_html_static
 * @covers \RTGODAM\Inc\REST_API\Jetpack::get_jetpack_form
 * @covers \RTGODAM\Inc\REST_API\Jetpack::submit_jetpack_form
 */
class JetpackFormHostPostTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__ ) . '/stubs/video-seo-functions.php';
		require_once dirname( __DIR__ ) . '/stubs/form-routes.php';
		require_once dirname( __DIR__ ) . '/stubs/class-wp-rest-request.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/rest-api/class-jetpack.php';

		$GLOBALS['rtgodam_stub'] = array( 'posts' => array() );
		Contact_Form::$forms     = array();
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'], $GLOBALS['godam_correct_form_hash'] );
		Contact_Form::$forms = array();
		$_POST               = array();
		parent::tearDown();
	}

	/**
	 * Put a post that holds one Jetpack form in the site.
	 *
	 * @param int    $id       Post ID.
	 * @param string $status   Post status.
	 * @param string $password Post password.
	 * @return \WP_Post
	 */
	private function host_post( $id, $status = 'publish', $password = '' ) {
		$post = new \WP_Post(
			array(
				'ID'            => $id,
				'post_type'     => 'post',
				'post_status'   => $status,
				'post_password' => $password,
				'post_content'  => 'form',
			)
		);

		$GLOBALS['rtgodam_stub']['posts'][ $id ] = $post;
		return $post;
	}

	/**
	 * Host posts visitors cannot see: [ status, password ].
	 *
	 * @return array
	 */
	public function non_public_hosts() {
		return array(
			'draft'              => array( 'draft', '' ),
			'private'            => array( 'private', '' ),
			'pending review'     => array( 'pending', '' ),
			'scheduled'          => array( 'future', '' ),
			'trashed'            => array( 'trash', '' ),
			'password protected' => array( 'publish', 'secret' ),
		);
	}

	/** A published post without a password is one visitors can see. */
	public function test_published_post_is_a_public_host() {
		$this->assertTrue( Jetpack::is_host_post_public( $this->host_post( 10 ) ) );
	}

	/**
	 * Anything else is not.
	 *
	 * @dataProvider non_public_hosts
	 *
	 * @param string $status   Post status.
	 * @param string $password Post password.
	 */
	public function test_other_posts_are_not_public_hosts( $status, $password ) {
		$this->assertFalse( Jetpack::is_host_post_public( $this->host_post( 10, $status, $password ) ) );
	}

	/** A missing post is not a host. */
	public function test_missing_post_is_not_a_public_host() {
		$this->assertFalse( Jetpack::is_host_post_public( null ) );
		$this->assertFalse( Jetpack::is_host_post_public( false ) );
	}

	/** The player shows the form from a published post. */
	public function test_player_renders_form_from_published_post() {
		$this->host_post( 10 );

		$this->assertSame( '<form data-form-id="10"></form>', Jetpack::get_rendered_form_html_static( '10-1' ) );
	}

	/**
	 * The player shows nothing for a form in any other post.
	 *
	 * @dataProvider non_public_hosts
	 *
	 * @param string $status   Post status.
	 * @param string $password Post password.
	 */
	public function test_player_skips_form_in_other_posts( $status, $password ) {
		$this->host_post( 10, $status, $password );

		$this->assertFalse( Jetpack::get_rendered_form_html_static( '10-1' ) );
	}

	/**
	 * A visitor's entry for a form in a post visitors cannot see is refused, and nothing is stored.
	 *
	 * @dataProvider non_public_hosts
	 *
	 * @param string $status   Post status.
	 * @param string $password Post password.
	 */
	public function test_submission_for_form_in_other_posts_is_refused( $status, $password ) {
		$this->host_post( 10, $status, $password );
		$route = ( new \ReflectionClass( Jetpack::class ) )->newInstanceWithoutConstructor();

		$by_origin = $route->submit_jetpack_form( $this->submission( array( 'origin-post-id' => '10' ) ) );
		$by_form   = $route->submit_jetpack_form( $this->submission( array( 'contact-form-id' => '10-1' ) ) );

		foreach ( array( $by_origin, $by_form ) as $result ) {
			$this->assertInstanceOf( \WP_Error::class, $result );
			$this->assertSame( 'form_not_found', $result->get_error_code() );
		}
		$this->assertArrayNotHasKey( 'jetpack_submissions', $GLOBALS['rtgodam_stub'] );
		$this->assertSame( array(), Contact_Form::$forms );
	}

	/**
	 * A visitor's entry for a form in a published post is processed, as the player sends it.
	 *
	 * Runs in its own process: processing a submission defines DOING_AJAX.
	 *
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_submission_for_form_in_published_post_is_processed() {
		$this->host_post( 10 );
		$route = ( new \ReflectionClass( Jetpack::class ) )->newInstanceWithoutConstructor();

		$result = $route->submit_jetpack_form( $this->submission( array( 'origin-post-id' => '10' ) ) );

		$this->assertInstanceOf( \WP_REST_Response::class, $result );
		$this->assertTrue( $result->get_data()['success'] );
		$this->assertSame( array( '10' ), array_map( 'strval', $GLOBALS['rtgodam_stub']['jetpack_submissions'] ) );
	}

	/** The Media Editor previews a form from a published post for any user who can open the editor. */
	public function test_editor_preview_shows_form_from_published_post() {
		$this->host_post( 10 );

		$this->assertSame( '<form data-form-id="10"></form>', $this->preview( '10-1' )->get_data() );
	}

	/**
	 * It skips a post its user cannot edit.
	 *
	 * @dataProvider non_public_hosts
	 *
	 * @param string $status   Post status.
	 * @param string $password Post password.
	 */
	public function test_editor_preview_skips_other_posts_the_user_cannot_edit( $status, $password ) {
		$this->host_post( 10, $status, $password );
		$GLOBALS['rtgodam_stub']['caps'] = array( 'read', 'edit_posts', 'upload_files' );

		$result = $this->preview( '10-1' );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'post_not_found', $result->get_error_code() );
	}

	/**
	 * It shows any post its user can edit.
	 *
	 * @dataProvider non_public_hosts
	 *
	 * @param string $status   Post status.
	 * @param string $password Post password.
	 */
	public function test_editor_preview_shows_other_posts_the_user_can_edit( $status, $password ) {
		$this->host_post( 10, $status, $password );
		$GLOBALS['rtgodam_stub']['caps'] = array( 'read', 'edit_posts', 'upload_files', 'edit_post' );

		$this->assertSame( '<form data-form-id="10"></form>', $this->preview( '10-1' )->get_data() );
	}

	/**
	 * A request the way the player sends a form entry.
	 *
	 * @param array $overrides Params to change.
	 * @return \WP_REST_Request
	 */
	private function submission( array $overrides = array() ) {
		return new \WP_REST_Request(
			array_merge(
				array(
					'contact-form-id'   => '10',
					'contact-form-hash' => 'a-hash',
					'fields'            => wp_json_encode( array( 'name' => 'Visitor' ) ),
				),
				$overrides
			)
		);
	}

	/**
	 * Call the single-form route the way the Media Editor does.
	 *
	 * @param string $form_id Form ID, "{post id}-{form number}".
	 * @return mixed
	 */
	private function preview( $form_id ) {
		$route = ( new \ReflectionClass( Jetpack::class ) )->newInstanceWithoutConstructor();
		return $route->get_jetpack_form( new \WP_REST_Request( array( 'id' => $form_id ) ) );
	}
}
