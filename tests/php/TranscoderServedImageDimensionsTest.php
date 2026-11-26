<?php
/**
 * The image size the transcoder callback saves for the GoDAM Image block (#2401).
 *
 * GoDAM Central does not send an image's width and height as their own fields. It sends
 * `version_history`, where it saves the current version's size before the callback goes
 * out. The callback reads the size from there (or from top-level `width` and `height`
 * when they are sent) and stores it in `rtgodam_image_dimensions`.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * @covers \RTGODAM_Transcoder_Rest_Routes::save_served_image_dimensions
 * @covers \RTGODAM_Transcoder_Rest_Routes::get_served_image_dimensions
 * @covers \RTGODAM_Transcoder_Rest_Routes::positive_dimensions
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class TranscoderServedImageDimensionsTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__ ) . '/stubs/media-library-functions.php';
		require_once dirname( __DIR__, 2 ) . '/admin/class-rtgodam-transcoder-rest-routes.php';

		$GLOBALS['rtgodam_stub'] = array( 'post_meta' => array() );
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		parent::tearDown();
	}

	/**
	 * Run the callback's save step on these parameters.
	 *
	 * @param array $params Callback parameters.
	 */
	private function save( array $params ): void {
		$routes = ( new \ReflectionClass( \RTGODAM_Transcoder_Rest_Routes::class ) )->newInstanceWithoutConstructor();
		$method = new \ReflectionMethod( $routes, 'save_served_image_dimensions' );
		$method->setAccessible( true );
		$method->invoke( $routes, 42, $params );
	}

	/**
	 * The version history Central sends, as the JSON string it is in a form-encoded callback.
	 *
	 * @param mixed $current  `current_version`.
	 * @param array $versions Versions keyed by number.
	 * @return string
	 */
	private function history( $current, array $versions ): string {
		return (string) wp_json_encode(
			array(
				'current_version' => $current,
				'versions'        => $versions,
			)
		);
	}

	private function saved(): array {
		$this->assertArrayHasKey( 'rtgodam_image_dimensions', $GLOBALS['rtgodam_stub']['meta_writes'] ?? array(), 'No size was saved.' );
		return $GLOBALS['rtgodam_stub']['meta_writes']['rtgodam_image_dimensions'];
	}

	public function test_saves_the_current_versions_size_from_the_version_history(): void {
		$this->save(
			array(
				'version_history' => $this->history(
					3,
					array(
						'1' => array(
							'width'  => 1030,
							'height' => 207,
						),
						'3' => array(
							'width'  => 2560,
							'height' => 1800,
						),
					)
				),
			)
		);

		$this->assertSame(
			array(
				'width'  => 2560,
				'height' => 1800,
			),
			$this->saved()
		);
	}

	public function test_reads_a_version_history_sent_as_an_array(): void {
		$this->save(
			array(
				'version_history' => array(
					'current_version' => 2,
					'versions'        => array(
						'2' => array(
							'width'  => '640',
							'height' => '480',
						),
					),
				),
			)
		);

		$this->assertSame(
			array(
				'width'  => 640,
				'height' => 480,
			),
			$this->saved()
		);
	}

	public function test_top_level_width_and_height_win_over_the_version_history(): void {
		$this->save(
			array(
				'width'           => 1920,
				'height'          => 1080,
				'version_history' => $this->history(
					1,
					array(
						'1' => array(
							'width'  => 1030,
							'height' => 207,
						),
					)
				),
			)
		);

		$this->assertSame(
			array(
				'width'  => 1920,
				'height' => 1080,
			),
			$this->saved()
		);
	}

	public function test_an_invalid_current_version_is_read_as_version_one(): void {
		$this->save(
			array(
				'version_history' => $this->history(
					'../2',
					array(
						'1' => array(
							'width'  => 800,
							'height' => 600,
						),
					)
				),
			)
		);

		$this->assertSame(
			array(
				'width'  => 800,
				'height' => 600,
			),
			$this->saved()
		);
	}

	/**
	 * Without a usable size the old one is removed, so it is never printed for a newer image.
	 *
	 * @dataProvider callbacks_without_a_size
	 *
	 * @param array $params Callback parameters.
	 */
	public function test_removes_the_saved_size_when_the_callback_has_none( array $params ): void {
		$GLOBALS['rtgodam_stub']['post_meta']['rtgodam_image_dimensions'] = array(
			'width'  => 1030,
			'height' => 207,
		);

		$this->save( $params );

		$this->assertArrayNotHasKey( 'rtgodam_image_dimensions', $GLOBALS['rtgodam_stub']['meta_writes'] ?? array() );
		$this->assertContains( 'rtgodam_image_dimensions', $GLOBALS['rtgodam_stub']['meta_deletes'] ?? array() );
	}

	/**
	 * @return array<string, array{0: array}>
	 */
	public function callbacks_without_a_size(): array {
		return array(
			'no version history'            => array( array() ),
			'version history not JSON'      => array( array( 'version_history' => 'not json' ) ),
			'current version missing'       => array(
				array(
					'version_history' => $this->history(
						4,
						array(
							'3' => array(
								'width'  => 2560,
								'height' => 1800,
							),
						)
					),
				),
			),
			'zero size, as an unprobed job' => array(
				array(
					'version_history' => $this->history(
						1,
						array(
							'1' => array(
								'width'  => 0,
								'height' => 0,
							),
						)
					),
				),
			),
		);
	}
}
