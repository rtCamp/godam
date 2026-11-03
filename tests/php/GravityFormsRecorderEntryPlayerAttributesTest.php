<?php
/**
 * Unit tests for the recording the Gravity Forms entry detail screen shows.
 *
 * The stored recording URL reaches the player as an attribute value and never as shortcode
 * syntax.
 *
 * Each test runs in its own process because it loads the player-entry stubs.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Gravity_Forms\GF_Field_GoDAM_Video;

/**
 * @covers \RTGODAM\Inc\Gravity_Forms\GF_Field_GoDAM_Video::get_value_entry_detail
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class GravityFormsRecorderEntryPlayerAttributesTest extends TestCase {

	private const RECORDING_URL = 'https://example.test/wp-content/uploads/gravity_forms/rec.webm';

	private const PAYLOAD_URL = "https://example.test/wp-content/uploads/gravity_forms/rec'][gx_marker]['.webm";

	/**
	 * @var GF_Field_GoDAM_Video
	 */
	private $field;

	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__ ) . '/stubs/player-entry-stubs.php';
		require_once dirname( __DIR__ ) . '/stubs/gravity-forms-fields.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/gravity-forms/class-gf-field-godam-video.php';

		$GLOBALS['rtgodam_stub'] = array();
		rtgodam_stub_register_player_and_marker();

		$this->field     = new GF_Field_GoDAM_Video();
		$this->field->id = 4;
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'], $_GET['lid'] );
		parent::tearDown();
	}

	/** @return array[] Attributes each player render received. */
	private function player_atts() {
		return $GLOBALS['rtgodam_stub']['player_atts'];
	}

	/** A normal entry shows the player with the recording and the same attributes as before. */
	public function test_a_normal_entry_shows_the_player_with_the_recording() {
		$html = $this->field->get_value_entry_detail( self::RECORDING_URL );

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
		$this->assertStringContainsString( 'gf-godam-video-preview', $html );
		$this->assertStringContainsString( 'data-src="' . self::RECORDING_URL . '"', $html );
	}

	/** A transcoded copy stored with the entry is passed to the player and noted above it. */
	public function test_a_transcoded_copy_is_passed_to_the_player() {
		$_GET['lid']                           = '5';
		$GLOBALS['rtgodam_stub']['gform_meta'] = array( 'rtgodam_transcoded_url_4_0' => 'https://cdn.example.test/rec.mpd' );

		$html = $this->field->get_value_entry_detail( self::RECORDING_URL );

		$this->assertSame( 'https://cdn.example.test/rec.mpd', $this->player_atts()[0]['transcoded_url'] );
		$this->assertStringContainsString( 'godam-transcoded-url-info', $html );
	}

	/** Shortcode text in the stored recording is not run. */
	public function test_shortcode_text_in_the_recording_is_not_run() {
		$html = $this->field->get_value_entry_detail( self::PAYLOAD_URL );

		$this->assertSame( 0, $GLOBALS['rtgodam_stub']['marker_runs'] );
		$this->assertStringNotContainsString( 'GX-MARKER', $html );
		$this->assertCount( 1, $this->player_atts() );
		$this->assertSame( self::PAYLOAD_URL, $this->player_atts()[0]['src'] );
		$this->assertArrayNotHasKey( 'shortcodes', $GLOBALS['rtgodam_stub'] );
	}

	/** Shortcode text in the stored transcoded URL is not run. */
	public function test_shortcode_text_in_the_transcoded_url_is_not_run() {
		$_GET['lid']                           = '5';
		$GLOBALS['rtgodam_stub']['gform_meta'] = array( 'rtgodam_transcoded_url_4_0' => "https://cdn.example.test/rec'][gx_marker]['.mpd" );

		$this->field->get_value_entry_detail( self::RECORDING_URL );

		$this->assertSame( 0, $GLOBALS['rtgodam_stub']['marker_runs'] );
	}

	/** A recording stored as a JSON list with one file shows the player for it. */
	public function test_a_json_list_with_one_file_shows_the_player() {
		$this->field->get_value_entry_detail( wp_json_encode( array( self::RECORDING_URL ) ) );

		$this->assertSame( array( self::RECORDING_URL ), array_column( $this->player_atts(), 'src' ) );
	}
}
