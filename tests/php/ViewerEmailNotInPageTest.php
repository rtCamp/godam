<?php
/**
 * Unit tests for the values GoDAM prints into every front-end page.
 *
 * rtgodam_get_localize_array() builds the `videoAnalyticsParams` object that is
 * written into every front-end page. It is the same for everyone who loads the
 * page, so it carries the signed-in user's id and nothing else about them: no
 * email address.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * Each test runs in its own process: loading the transcoder functions file
 * registers hooks as it loads, and EarlyTranslationHooksTest checks exactly that
 * on the first load in the shared process.
 *
 * The page-tag stubs load there too, for the same reason.
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class ViewerEmailNotInPageTest extends TestCase {

	private const VIEWER_EMAIL = 'test-w1-viewer@example.com';

	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__ ) . '/stubs/template-tags.php';
		require_once dirname( __DIR__, 2 ) . '/admin/godam-transcoder-functions.php';

		$GLOBALS['rtgodam_stub'] = array(
			'user'    => array(
				'id'    => 7,
				'email' => self::VIEWER_EMAIL,
				'name'  => 'Viewer',
			),
			'options' => array(
				'rtgodam-account-token' => 'verified-account',
			),
		);
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		parent::tearDown();
	}

	public function test_signed_in_viewers_email_is_not_in_the_page_params(): void {
		$params = rtgodam_get_localize_array();

		$this->assertArrayNotHasKey( 'emailId', $params );
		$this->assertStringNotContainsString( self::VIEWER_EMAIL, (string) wp_json_encode( $params ) );
	}

	public function test_player_page_data_for_a_signed_in_viewer_has_no_email(): void {
		$data = rtgodam_get_current_user_data_for_page();

		$this->assertArrayNotHasKey( 'email', $data );
		$this->assertStringNotContainsString( self::VIEWER_EMAIL, (string) wp_json_encode( $data ) );
		$this->assertSame( 'Viewer', $data['name'] );
		$this->assertSame( 'user', $data['type'] );
	}

	public function test_the_server_side_user_data_still_has_the_email(): void {
		// The comments routes read the address on the server; only the page copy drops it.
		$this->assertSame( self::VIEWER_EMAIL, rtgodam_get_current_logged_in_user_data()['email'] );
	}

	public function test_page_params_keep_what_analytics_still_needs(): void {
		$params = rtgodam_get_localize_array();

		$this->assertSame( 7, $params['userId'] );
		$this->assertSame( 1, $params['siteId'] );
		$this->assertSame( 'https://analytics.test', $params['endpoint'] );
		$this->assertSame( 'verified-account', $params['token'] );
		$this->assertSame( 500, $params['postId'] );
	}
}
