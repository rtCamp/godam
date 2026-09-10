<?php
/**
 * Unit tests for Analytics::validate_iso_date — the REST proxy's date-range guard.
 *
 * The /analytics/* range endpoints accept optional start_date / end_date params
 * and forward them to the analytics microservice. This validate_callback is the
 * gate that a malformed date 400s at the WordPress proxy rather than being
 * passed through: a value, when present, must parse as a strict calendar date in
 * Y-m-d form (so month/day overflow like 2026-13-40 is rejected, not silently
 * rolled over).
 *
 * The method is exercised on a constructor-less instance (Base's constructor
 * registers WP hooks we don't want here). It uses only \DateTime, so no WP
 * stubs are needed.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Analytics;

/**
 * @covers \RTGODAM\Inc\REST_API\Analytics::validate_iso_date
 */
class AnalyticsValidateIsoDateTest extends TestCase {

	/**
	 * Call validate_iso_date on an Analytics instance built without the constructor.
	 *
	 * @param mixed $param The submitted value.
	 * @return bool
	 */
	private function validate( $param ) {
		$object = ( new \ReflectionClass( Analytics::class ) )->newInstanceWithoutConstructor();
		return $object->validate_iso_date( $param );
	}

	/**
	 * A well-formed YYYY-MM-DD date passes.
	 *
	 * @dataProvider valid_dates
	 * @param string $date A strict Y-m-d calendar date.
	 */
	public function test_valid_iso_date_passes( $date ) {
		$this->assertTrue( $this->validate( $date ), "{$date} should validate" );
	}

	/**
	 * @return array<string, array{0:string}>
	 */
	public function valid_dates() {
		return array(
			'first of year'      => array( '2026-01-01' ),
			'last of year'       => array( '2026-12-31' ),
			'mid-month'          => array( '2026-08-19' ),
			'valid leap day'     => array( '2024-02-29' ),
		);
	}

	/**
	 * A malformed or non-calendar value is rejected.
	 *
	 * @dataProvider malformed_dates
	 * @param mixed $value The submitted value.
	 */
	public function test_malformed_date_is_rejected( $value ) {
		$this->assertFalse( $this->validate( $value ), 'malformed value should be rejected' );
	}

	/**
	 * @return array<string, array{0:mixed}>
	 */
	public function malformed_dates() {
		return array(
			'month/day overflow'   => array( '2026-13-40' ),
			'not a date'           => array( 'abc' ),
			'wrong separators'     => array( '2026/01/01' ),
			'invalid calendar day' => array( '2026-02-30' ),
			'non-leap Feb 29'      => array( '2025-02-29' ),
			'datetime not date'    => array( '2026-01-01 00:00:00' ),
			'trailing text'        => array( '2026-01-01x' ),
		);
	}

	/**
	 * Empty is intentionally allowed: the params are optional, and the docblock
	 * states an empty value validates (all-time requests send no range). This
	 * is deliberate, not a gap — the "reject malformed" contract applies only to
	 * non-empty values.
	 */
	public function test_empty_value_is_allowed() {
		$this->assertTrue( $this->validate( '' ), 'empty string is an optional-param no-op and must validate' );
	}
}
