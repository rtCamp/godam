<?php
/**
 * Unit tests for the recording the Fluent Forms entry screen shows.
 *
 * The stored recorder value reaches the player as an attribute value and never as shortcode
 * syntax.
 *
 * Each test runs in its own process because it loads the player-entry stubs, which declare
 * Fluent Forms' base field class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\FluentForms\Fields\Recorder_Field;

/**
 * @covers \RTGODAM\Inc\FluentForms\Fields\Recorder_Field::render_recorder_field_markup
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class FluentFormsRecorderEntryPlayerAttributesTest extends TestCase {

	private const RECORDING_URL = 'https://example.test/wp-content/uploads/godam-ff/rec.webm';

	private const PAYLOAD_URL = "https://example.test/wp-content/uploads/godam-ff/rec'][gx_marker]['.webm";

	/**
	 * @var Recorder_Field
	 */
	private $field;

	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__ ) . '/stubs/player-entry-stubs.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/fluentforms/fields/class-recorder-field.php';

		$GLOBALS['rtgodam_stub'] = array();
		rtgodam_stub_register_player_and_marker();

		// The admin screen reads the entry through this REST route.
		$GLOBALS['wp']             = new \stdClass();
		$GLOBALS['wp']->query_vars = array( 'rest_route' => '/fluentform/v1/submissions/9' );

		$this->field = ( new \ReflectionClass( Recorder_Field::class ) )->newInstanceWithoutConstructor();
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'], $GLOBALS['wp'] );
		parent::tearDown();
	}

	/**
	 * Render the entry the way Fluent Forms' admin screen asks for it.
	 *
	 * @param array $response The stored recorder value.
	 * @return string
	 */
	private function entry_markup( array $response ) {
		return $this->field->render_recorder_field_markup( $response, array(), 3, true );
	}

	/** @return array[] Attributes each player render received. */
	private function player_atts() {
		return $GLOBALS['rtgodam_stub']['player_atts'];
	}

	/** A normal entry shows the player with the recording URL and the same attributes as before. */
	public function test_a_normal_entry_shows_the_player_with_the_recording() {
		$html = $this->entry_markup( array( self::RECORDING_URL ) );

		$this->assertSame(
			array(
				array(
					'src'            => self::RECORDING_URL,
					'transcoded_url' => '',
					'aspectratio'    => '',
				),
			),
			$this->player_atts()
		);
		$this->assertStringContainsString( 'class="gf-godam-video-preview"', $html );
		$this->assertStringContainsString( 'data-src="' . self::RECORDING_URL . '"', $html );
		$this->assertStringContainsString( 'href="' . self::RECORDING_URL . '"', $html );
	}

	/** The entry uses the first value of the stored array. */
	public function test_the_first_value_of_the_stored_array_is_used() {
		$this->entry_markup( array( self::RECORDING_URL, 'https://example.test/other.webm' ) );

		$this->assertSame( self::RECORDING_URL, $this->player_atts()[0]['src'] );
	}

	/** A transcoded copy is passed to the player and noted above it. */
	public function test_a_transcoded_copy_is_passed_to_the_player() {
		$GLOBALS['rtgodam_stub']['fluent_meta'] = (object) array( 'value' => 'https://cdn.example.test/rec.mpd' );

		$html = $this->entry_markup( array( self::RECORDING_URL ) );

		$this->assertSame( 'https://cdn.example.test/rec.mpd', $this->player_atts()[0]['transcoded_url'] );
		$this->assertStringContainsString( 'godam-transcoded-url-info', $html );
	}

	/** Shortcode text in the stored recording is not run. */
	public function test_shortcode_text_in_the_recording_is_not_run() {
		$html = $this->entry_markup( array( self::PAYLOAD_URL ) );

		$this->assertSame( 0, $GLOBALS['rtgodam_stub']['marker_runs'] );
		$this->assertStringNotContainsString( 'GX-MARKER', $html );
		$this->assertCount( 1, $this->player_atts() );
		$this->assertSame( self::PAYLOAD_URL, $this->player_atts()[0]['src'] );
		$this->assertArrayNotHasKey( 'shortcodes', $GLOBALS['rtgodam_stub'] );
	}

	/** Shortcode text in the stored transcoded URL is not run either. */
	public function test_shortcode_text_in_the_transcoded_url_is_not_run() {
		$GLOBALS['rtgodam_stub']['fluent_meta'] = (object) array( 'value' => "https://cdn.example.test/rec'][gx_marker]['.mpd" );

		$this->entry_markup( array( self::RECORDING_URL ) );

		$this->assertSame( 0, $GLOBALS['rtgodam_stub']['marker_runs'] );
	}
}
