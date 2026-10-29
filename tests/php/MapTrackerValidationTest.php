<?php
/**
 * Unit tests for the request-shape checks behind `godam/v1/map-events`.
 *
 * These five static methods are the only thing standing between a public REST route
 * and a queue of jobs aimed at the customer's Marketo or HubSpot. They deliberately
 * repeat the rules godam-core applies in `utils/map_events/queue.py`, so that a
 * made-up cookie is dropped here rather than costing the customer a Marketo lead
 * lookup — which means the two sets of rules have to stay identical, and these tests
 * pin the WordPress half of that.
 *
 * Pure: no WordPress beyond the `wp_parse_url` stub in tests/bootstrap.php.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Map_Tracker;

/**
 * @covers \RTGODAM\Inc\Map_Tracker::normalize_milestone
 * @covers \RTGODAM\Inc\Map_Tracker::is_valid_media_id
 * @covers \RTGODAM\Inc\Map_Tracker::is_valid_session_id
 * @covers \RTGODAM\Inc\Map_Tracker::is_valid_page_url
 * @covers \RTGODAM\Inc\Map_Tracker::filter_visitor_ids
 */
class MapTrackerValidationTest extends TestCase {

	/**
	 * A well-formed Marketo cookie: `id:<munchkin>&token:_mch-<domain>-<ts>-<random>`.
	 */
	const MKTO = 'id:123-ABC-456&token:_mch-example.com-1760000000000-12345';

	/**
	 * A well-formed HubSpot cookie: 32 hex characters.
	 */
	const HUTK = '0123456789abcdef0123456789abcdef';

	/**
	 * Every milestone Central accepts survives, as an int, from either an int or
	 * the string a JSON body may carry.
	 *
	 * @return void
	 */
	public function test_accepts_every_known_milestone() {
		foreach ( array( 0, 25, 50, 75, 100 ) as $milestone ) {
			$this->assertSame( $milestone, Map_Tracker::normalize_milestone( $milestone ) );
			$this->assertSame( $milestone, Map_Tracker::normalize_milestone( (string) $milestone ) );
		}
	}

	/**
	 * Anything that is not one of the five is refused rather than coerced.
	 *
	 * The float and "50.9" cases are the ones that matter: a plain (int) cast would
	 * turn both into a valid 50 and record a milestone the viewer never reached.
	 *
	 * @return void
	 */
	public function test_rejects_values_that_are_not_milestones() {
		$rejected = array( 10, 99, -25, 101, 50.9, '50.9', '50abc', '', null, true, false, array( 50 ), ' 50' );

		foreach ( $rejected as $value ) {
			$this->assertNull(
				Map_Tracker::normalize_milestone( $value ),
				sprintf( 'Expected %s to be refused as a milestone.', var_export( $value, true ) ) // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_var_export
			);
		}
	}

	/**
	 * Media IDs are Central's `Transcoder Job` names: short and alphanumeric.
	 *
	 * @return void
	 */
	public function test_media_id_shape() {
		$this->assertTrue( Map_Tracker::is_valid_media_id( '4fh1irkem5' ) );
		$this->assertTrue( Map_Tracker::is_valid_media_id( 'abc_DEF-123' ) );
		$this->assertTrue( Map_Tracker::is_valid_media_id( str_repeat( 'a', 64 ) ) );

		$this->assertFalse( Map_Tracker::is_valid_media_id( '' ) );
		$this->assertFalse( Map_Tracker::is_valid_media_id( str_repeat( 'a', 65 ) ) );
		$this->assertFalse( Map_Tracker::is_valid_media_id( 'has space' ) );
		$this->assertFalse( Map_Tracker::is_valid_media_id( '../../etc/passwd' ) );
		$this->assertFalse( Map_Tracker::is_valid_media_id( 12345 ) );
		$this->assertFalse( Map_Tracker::is_valid_media_id( null ) );
	}

	/**
	 * Session IDs match Central's `SESSION_ID_RE` exactly: 8-64 of [A-Za-z0-9-].
	 *
	 * @return void
	 */
	public function test_session_id_shape() {
		$this->assertTrue( Map_Tracker::is_valid_session_id( 'abcd1234' ) );
		$this->assertTrue( Map_Tracker::is_valid_session_id( '3f7a1c02-9b4e-4a11-8f2d-6c5e0d9a7b31' ) );

		$this->assertFalse( Map_Tracker::is_valid_session_id( 'short7' ) );
		$this->assertFalse( Map_Tracker::is_valid_session_id( str_repeat( 'a', 65 ) ) );
		$this->assertFalse( Map_Tracker::is_valid_session_id( 'has_underscore_x' ) );
		$this->assertFalse( Map_Tracker::is_valid_session_id( 'has space here' ) );
		$this->assertFalse( Map_Tracker::is_valid_session_id( null ) );
	}

	/**
	 * Page URLs must be absolute http(s). A relative path or a `javascript:` URL is
	 * refused: Central stores this string and shows it on the lead's activity.
	 *
	 * @return void
	 */
	public function test_page_url_shape() {
		$this->assertTrue( Map_Tracker::is_valid_page_url( 'https://example.com/watch' ) );
		$this->assertTrue( Map_Tracker::is_valid_page_url( 'http://example.com/' ) );
		$this->assertTrue( Map_Tracker::is_valid_page_url( 'HTTPS://Example.com/Upper' ) );

		$this->assertFalse( Map_Tracker::is_valid_page_url( '/relative/path' ) );
		$this->assertFalse( Map_Tracker::is_valid_page_url( 'javascript:alert(1)' ) ); // phpcs:ignore
		$this->assertFalse( Map_Tracker::is_valid_page_url( 'ftp://example.com/x' ) );
		$this->assertFalse( Map_Tracker::is_valid_page_url( '' ) );
		$this->assertFalse( Map_Tracker::is_valid_page_url( 'https://example.com/' . str_repeat( 'a', 2000 ) ) );
		$this->assertFalse( Map_Tracker::is_valid_page_url( null ) );
	}

	/**
	 * Both cookies pass when both are well formed, and HubSpot's is lower-cased so
	 * the same visitor always produces the same value.
	 *
	 * @return void
	 */
	public function test_keeps_well_formed_cookies() {
		$ids = Map_Tracker::filter_visitor_ids(
			array(
				'mkto_trk'   => self::MKTO,
				'hubspotutk' => strtoupper( self::HUTK ),
			)
		);

		$this->assertSame(
			array(
				'mkto_trk'   => self::MKTO,
				'hubspotutk' => self::HUTK,
			),
			$ids
		);
	}

	/**
	 * A cookie that is not in the tool's own format can never match a record, so it
	 * is dropped before it can cost an API lookup.
	 *
	 * @return void
	 */
	public function test_drops_malformed_cookies() {
		$cases = array(
			'marketo token missing'  => array( 'mkto_trk' => 'id:123-ABC-456' ),
			'marketo munchkin shape' => array( 'mkto_trk' => 'id:12-AB-45&token:_mch-example.com-1-2' ),
			'marketo prefix missing' => array( 'mkto_trk' => '123-ABC-456' ),
			'hubspot too short'      => array( 'hubspotutk' => '0123456789abcdef' ),
			'hubspot not hex'        => array( 'hubspotutk' => 'zzzz56789abcdef0123456789abcdef0' ),
			'values are not strings' => array(
				'mkto_trk'   => array( self::MKTO ),
				'hubspotutk' => 12345,
			),
			'unrelated keys'         => array( 'ga_cookie' => 'GA1.2.3.4' ),
		);

		foreach ( $cases as $label => $ids ) {
			$this->assertSame( array(), Map_Tracker::filter_visitor_ids( $ids ), $label );
		}
	}

	/**
	 * One good cookie alongside one bad one keeps the good one only.
	 *
	 * @return void
	 */
	public function test_keeps_the_good_half_of_a_mixed_pair() {
		$ids = Map_Tracker::filter_visitor_ids(
			array(
				'mkto_trk'   => 'not-a-marketo-cookie',
				'hubspotutk' => self::HUTK,
			)
		);

		$this->assertSame( array( 'hubspotutk' => self::HUTK ), $ids );
	}

	/**
	 * Anything that is not an array of cookies yields no cookies, rather than a
	 * PHP warning on a public route.
	 *
	 * @return void
	 */
	public function test_non_array_ids_yield_nothing() {
		foreach ( array( null, '', 'mkto_trk=x', 42, true ) as $value ) {
			$this->assertSame( array(), Map_Tracker::filter_visitor_ids( $value ) );
		}
	}
}
