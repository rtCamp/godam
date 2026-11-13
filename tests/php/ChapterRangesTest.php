<?php
/**
 * Tests how godam/set-chapters checks chapter times against the media's length.
 *
 * @package GoDAM
 */

declare( strict_types = 1 );

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Abilities\Chapter_Abilities;

/**
 * The media's length the ability knows is WordPress's stored `_video_duration`,
 * rounded to whole seconds, so a chapter may run up to a second past it before
 * it is refused.
 *
 * Runs in its own process because it loads the ability classes.
 *
 * @covers \RTGODAM\Inc\Abilities\Chapter_Abilities
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class ChapterRangesTest extends TestCase {

	/**
	 * Calls a private method of the ability group.
	 *
	 * @param string $method Method name.
	 * @param array  $args   Arguments.
	 *
	 * @return mixed
	 */
	private function call( $method, array $args ) {
		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-ability-group.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/abilities/class-chapter-abilities.php';

		$reflection = new \ReflectionClass( Chapter_Abilities::class );
		$target     = $reflection->getMethod( $method );

		if ( PHP_VERSION_ID < 80100 ) {
			$target->setAccessible( true );
		}

		return $target->invokeArgs( $reflection->newInstanceWithoutConstructor(), $args );
	}

	/**
	 * Resolves an intro and a last chapter on a file stored as 45 seconds long.
	 *
	 * @param float      $start The last chapter's start.
	 * @param float|null $end   The last chapter's end, or null to leave it open.
	 *
	 * @return array|\WP_Error
	 */
	private function resolve_on_45_seconds( $start, $end ) {
		$last = array(
			'title' => 'Outro',
			'start' => $start,
		);

		if ( null !== $end ) {
			$last['end'] = $end;
		}

		return $this->call(
			'resolve_ranges',
			array(
				array(
					array(
						'title' => 'Intro',
						'start' => 0,
						'end'   => 30,
					),
					$last,
				),
				45,
			)
		);
	}

	/**
	 * The stored length is rounded, so a last chapter ending a little past it is accepted.
	 *
	 * @return void
	 */
	public function test_an_end_within_a_second_of_the_stored_length_is_accepted() {
		$ranges = $this->resolve_on_45_seconds( 30, 45.4 );

		$this->assertIsArray( $ranges, 'A file stored as 45 can really be 45.4 seconds long.' );
		$this->assertSame( 45.4, $ranges[1]['end'] );

		$this->assertIsArray( $this->resolve_on_45_seconds( 30, 46 ), 'One whole second over is the limit.' );
	}

	/**
	 * A start within a second of the stored length is accepted too.
	 *
	 * @return void
	 */
	public function test_a_start_within_a_second_of_the_stored_length_is_accepted() {
		$this->assertIsArray( $this->resolve_on_45_seconds( 45.2, null ) );
	}

	/**
	 * More than a second past the stored length is still refused, naming the stored length.
	 *
	 * @return void
	 */
	public function test_an_end_more_than_a_second_past_the_stored_length_is_refused() {
		$result = $this->resolve_on_45_seconds( 30, 46.5 );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'rtgodam_invalid_chapters', $result->get_error_code() );
		$this->assertStringContainsString( 'ends after the end of the media', $result->get_error_message() );
		$this->assertStringContainsString( '45 seconds', $result->get_error_message(), 'The message still quotes the stored length.' );
	}

	/**
	 * A start more than a second past the stored length is refused.
	 *
	 * @return void
	 */
	public function test_a_start_more_than_a_second_past_the_stored_length_is_refused() {
		$result = $this->resolve_on_45_seconds( 47, null );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertStringContainsString( 'starts after the end of the media', $result->get_error_message() );
	}

	/**
	 * A last chapter with no end stays open, and an unknown length sets no limit.
	 *
	 * @return void
	 */
	public function test_an_open_last_end_stays_open() {
		$ranges = $this->resolve_on_45_seconds( 30, null );

		$this->assertIsArray( $ranges );
		$this->assertNull( $ranges[1]['end'] );

		$unknown = $this->call(
			'resolve_ranges',
			array(
				array(
					array(
						'title' => 'Late',
						'start' => 500,
						'end'   => 900,
					),
				),
				null,
			)
		);

		$this->assertIsArray( $unknown, 'With no stored length there is nothing to check against.' );
	}
}
