<?php
/**
 * Unit tests for the recording the Everest Forms entry screen shows.
 *
 * The stored recording URL reaches the player as an attribute value and never as shortcode
 * syntax.
 *
 * Each test runs in its own process because it loads the player-entry stubs, which declare
 * Everest Forms' upload field class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Everest_Forms\Everest_Forms_Field_GoDAM_Video;

/**
 * @covers \RTGODAM\Inc\Everest_Forms\Everest_Forms_Field_GoDAM_Video::update_entry_meta_display_godam_recorder
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class EverestFormsRecorderEntryPlayerAttributesTest extends TestCase {

	private const RECORDING_URL = 'https://example.test/wp-content/uploads/godam/everest/rec.webm';

	private const PAYLOAD_URL = "https://example.test/wp-content/uploads/godam/everest/rec'][gx_marker]['.webm";

	/**
	 * @var Everest_Forms_Field_GoDAM_Video
	 */
	private $field;

	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__ ) . '/stubs/player-entry-stubs.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/everest-forms/class-everest-forms-field-godam-video.php';

		$GLOBALS['rtgodam_stub'] = array(
			'evf_entry' => (object) array( 'meta' => array() ),
		);
		rtgodam_stub_register_player_and_marker();

		// The single-entry screen.
		$_GET['view-entry'] = '5';
		$_GET['form_id']    = '3';

		$this->field = ( new \ReflectionClass( Everest_Forms_Field_GoDAM_Video::class ) )->newInstanceWithoutConstructor();
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'], $_GET['view-entry'], $_GET['form_id'] );
		parent::tearDown();
	}

	/**
	 * Render the entry value the way Everest Forms asks for it.
	 *
	 * @param string $value Stored recording URL.
	 * @return string
	 */
	private function entry_markup( $value ) {
		return $this->field->update_entry_meta_display_godam_recorder( 'unchanged', $value, array( 'godam_record_1' => $value ), 'entry-single' );
	}

	/** @return array[] Attributes each player render received. */
	private function player_atts() {
		return $GLOBALS['rtgodam_stub']['player_atts'];
	}

	/** A normal entry shows the player with the recording and the same attributes as before. */
	public function test_a_normal_entry_shows_the_player_with_the_recording() {
		$html = $this->entry_markup( self::RECORDING_URL );

		$this->assertCount( 1, $this->player_atts() );
		$this->assertSame( self::RECORDING_URL, $this->player_atts()[0]['src'] );
		$this->assertSame( '', $this->player_atts()[0]['transcoded_url'] ?? '' );
		$this->assertStringContainsString( 'evf-godam-video-preview', $html );
		$this->assertStringContainsString( 'data-src="' . self::RECORDING_URL . '"', $html );
	}

	/** A transcoded copy stored with the entry is passed to the player and noted above it. */
	public function test_a_transcoded_copy_is_passed_to_the_player() {
		$GLOBALS['rtgodam_stub']['evf_entry']->meta['rtgodam_transcoded_url_everestforms_3_5'] = 'https://cdn.example.test/rec.mpd';

		$html = $this->entry_markup( self::RECORDING_URL );

		$this->assertSame( 'https://cdn.example.test/rec.mpd', $this->player_atts()[0]['transcoded_url'] );
		$this->assertStringContainsString( 'godam-transcoded-url-info', $html );
	}

	/** Shortcode text in the stored recording is not run. */
	public function test_shortcode_text_in_the_recording_is_not_run() {
		$html = $this->entry_markup( self::PAYLOAD_URL );

		$this->assertSame( 0, $GLOBALS['rtgodam_stub']['marker_runs'] );
		$this->assertStringNotContainsString( 'GX-MARKER', $html );
		$this->assertCount( 1, $this->player_atts() );
		$this->assertSame( self::PAYLOAD_URL, $this->player_atts()[0]['src'] );
		$this->assertArrayNotHasKey( 'shortcodes', $GLOBALS['rtgodam_stub'] );
	}

	/** Shortcode text in the stored transcoded URL is not run. */
	public function test_shortcode_text_in_the_transcoded_url_is_not_run() {
		$GLOBALS['rtgodam_stub']['evf_entry']->meta['rtgodam_transcoded_url_everestforms_3_5'] = "https://cdn.example.test/rec'][gx_marker]['.mpd";

		$this->entry_markup( self::RECORDING_URL );

		$this->assertSame( 0, $GLOBALS['rtgodam_stub']['marker_runs'] );
	}

	/** An audio recording is still shown with an audio element, not the player. */
	public function test_an_audio_recording_still_uses_the_audio_element() {
		$GLOBALS['rtgodam_stub']['evf_entry']->meta['rtgodam_transcoded_url_everestforms_3_5'] = 'https://cdn.example.test/audio.mp3';

		$html = $this->entry_markup( 'https://example.test/wp-content/uploads/godam/everest/audio-1.webm' );

		$this->assertSame( array(), $this->player_atts() );
		$this->assertStringContainsString( '<source src="https://cdn.example.test/audio.mp3" type="audio/mpeg">', $html );
	}
}
