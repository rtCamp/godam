<?php
/**
 * Unit tests for the recording the SureForms entry screen shows.
 *
 * The stored recording URL reaches the player as an attribute value and never as shortcode
 * syntax.
 *
 * Each test runs in its own process because it loads the player-entry stubs, which declare
 * SureForms' entries table class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Sureforms\Form_Submit;

/**
 * @covers \RTGODAM\Inc\Sureforms\Form_Submit::render_custom_field_markup
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class SureFormsRecorderEntryPlayerAttributesTest extends TestCase {

	private const RECORDING_URL = 'https://example.test/wp-content/uploads/godam/sureforms/rec.webm';

	private const PAYLOAD_URL = "https://example.test/wp-content/uploads/godam/sureforms/rec'][gx_marker]['.webm";

	/**
	 * @var Form_Submit
	 */
	private $submit;

	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__ ) . '/stubs/player-entry-stubs.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/sureforms/class-form-submit.php';

		$GLOBALS['rtgodam_stub'] = array(
			'srfm_entry' => array( 'form_id' => 3 ),
		);
		rtgodam_stub_register_player_and_marker();

		// The entry screen.
		$_GET['entry_id'] = '5';

		$this->submit = ( new \ReflectionClass( Form_Submit::class ) )->newInstanceWithoutConstructor();
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'], $_GET['entry_id'] );
		parent::tearDown();
	}

	/** @return array[] Attributes each player render received. */
	private function player_atts() {
		return $GLOBALS['rtgodam_stub']['player_atts'];
	}

	/** A normal entry shows the player with the recording and the same attributes as before. */
	public function test_a_normal_entry_shows_the_player_with_the_recording() {
		$html = $this->submit->render_custom_field_markup( 'unchanged', self::RECORDING_URL );

		$this->assertCount( 1, $this->player_atts() );
		$this->assertSame( self::RECORDING_URL, $this->player_atts()[0]['src'] );
		$this->assertSame( '', $this->player_atts()[0]['transcoded_url'] ?? '' );
		$this->assertStringContainsString( 'srfm-godam-video-preview', $html );
		$this->assertStringContainsString( 'data-src="' . self::RECORDING_URL . '"', $html );
	}

	/** A transcoded copy stored with the form is passed to the player and noted above it. */
	public function test_a_transcoded_copy_is_passed_to_the_player() {
		$GLOBALS['rtgodam_stub']['post_meta']['rtgodam_transcoded_url_sureforms_3_5'] = 'https://cdn.example.test/rec.mpd';

		$html = $this->submit->render_custom_field_markup( 'unchanged', self::RECORDING_URL );

		$this->assertSame( 'https://cdn.example.test/rec.mpd', $this->player_atts()[0]['transcoded_url'] );
		$this->assertStringContainsString( 'godam-transcoded-url-info', $html );
	}

	/** Shortcode text in the stored recording is not run. */
	public function test_shortcode_text_in_the_recording_is_not_run() {
		$html = $this->submit->render_custom_field_markup( 'unchanged', self::PAYLOAD_URL );

		$this->assertSame( 0, $GLOBALS['rtgodam_stub']['marker_runs'] );
		$this->assertStringNotContainsString( 'GX-MARKER', $html );
		$this->assertCount( 1, $this->player_atts() );
		$this->assertSame( self::PAYLOAD_URL, $this->player_atts()[0]['src'] );
		$this->assertArrayNotHasKey( 'shortcodes', $GLOBALS['rtgodam_stub'] );
	}

	/** Shortcode text in the stored transcoded URL is not run. */
	public function test_shortcode_text_in_the_transcoded_url_is_not_run() {
		$GLOBALS['rtgodam_stub']['post_meta']['rtgodam_transcoded_url_sureforms_3_5'] = "https://cdn.example.test/rec'][gx_marker]['.mpd";

		$this->submit->render_custom_field_markup( 'unchanged', self::RECORDING_URL );

		$this->assertSame( 0, $GLOBALS['rtgodam_stub']['marker_runs'] );
	}

	/** An audio recording is still shown with an audio element, not the player. */
	public function test_an_audio_recording_still_uses_the_audio_element() {
		$GLOBALS['rtgodam_stub']['post_meta']['rtgodam_transcoded_url_sureforms_3_5'] = 'https://cdn.example.test/audio.mp3';

		$html = $this->submit->render_custom_field_markup( 'unchanged', 'https://example.test/wp-content/uploads/godam/sureforms/audio-1.webm' );

		$this->assertSame( array(), $this->player_atts() );
		$this->assertStringContainsString( '<source src="https://cdn.example.test/audio.mp3" type="audio/mpeg">', $html );
	}
}
