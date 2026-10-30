<?php
/**
 * Unit tests for the values GoDAM prints into every front-end page.
 *
 * rtgodam_get_localize_array() builds the `videoAnalyticsParams` object that is
 * written into every front-end page. It is the same for everyone who loads the
 * page, so it carries no location field: the analytics service works out the
 * location from the request the browser sends it.
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
class VisitorLocationParamTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__ ) . '/stubs/template-tags.php';
		require_once dirname( __DIR__, 2 ) . '/admin/godam-transcoder-functions.php';

		$GLOBALS['rtgodam_stub'] = array(
			'user'    => array(
				'id'    => 7,
				'email' => 'test-w1-viewer@example.com',
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

	public function test_page_params_carry_no_location_field(): void {
		$params = rtgodam_get_localize_array();

		$this->assertArrayNotHasKey( 'locationIP', $params );
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
