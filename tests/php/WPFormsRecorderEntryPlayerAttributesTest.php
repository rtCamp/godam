<?php
/**
 * Unit tests for the recording the WPForms entry view and edit screens show.
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

/**
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class WPFormsRecorderEntryPlayerAttributesTest extends TestCase {

	private const RECORDING_URL = 'https://example.test/wp-content/uploads/godam/wpforms/rec.webm';

	private const PAYLOAD_URL = "https://example.test/wp-content/uploads/godam/wpforms/rec'][gx_marker]['.webm";

	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__ ) . '/stubs/player-entry-stubs.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/wpforms/class-wpforms-integration-helper.php';

		// An entry always carries a transcoding status; the view lowercases it.
		$GLOBALS['rtgodam_stub'] = array(
			'wpforms_meta' => array( 'rtgodam_transcoded_status_5_0' => 'in-progress' ),
		);
		rtgodam_stub_register_player_and_marker();
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'], $_GET['entry_id'] );
		parent::tearDown();
	}

	/**
	 * Render the template WPForms includes on the View Entry page.
	 *
	 * @param string $value Stored recording URL.
	 * @return string
	 */
	private function render_entry_view( $value ) {
		$form_data = array( 'id' => 3 );
		$field     = array( 'id' => 5 );
		$mime_type = 'video/webm';

		$_GET['entry_id'] = '9';

		ob_start();
		include dirname( __DIR__, 2 ) . '/inc/classes/wpforms/wpforms-field-godam-record-entry-view.php';

		return ob_get_clean();
	}

	/**
	 * Render the template WPForms includes on the Edit Entry page.
	 *
	 * @param string $value Stored recording URL.
	 * @return string
	 */
	private function render_entry_edit( $value ) {
		$field     = array(
			'type'       => 'godam_record',
			'properties' => array(
				'inputs' => array(
					'primary' => array(
						'id'       => 'wpforms-field-5',
						'class'    => array(),
						'data'     => array(),
						'required' => '',
						'attr'     => array( 'value' => $value ),
					),
				),
			),
		);
		$mime_type = 'video/webm';

		ob_start();
		include dirname( __DIR__, 2 ) . '/inc/classes/wpforms/wpforms-field-godam-record-entry-edit.php';

		return ob_get_clean();
	}

	/** @return array[] Attributes each player render received. */
	private function player_atts() {
		return $GLOBALS['rtgodam_stub']['player_atts'];
	}

	/** The View Entry page shows the player with the recording and the same attributes as before. */
	public function test_the_entry_view_shows_the_player_with_the_recording() {
		$html = $this->render_entry_view( self::RECORDING_URL );

		$this->assertSame(
			array(
				array(
					'poster'         => '',
					'src'            => self::RECORDING_URL,
					'transcoded_url' => '',
				),
			),
			$this->player_atts()
		);
		$this->assertStringContainsString( 'data-src="' . self::RECORDING_URL . '"', $html );
	}

	/** A transcoded copy stored with the entry is passed to the player. */
	public function test_the_entry_view_passes_the_transcoded_copy() {
		$GLOBALS['rtgodam_stub']['wpforms_meta']['rtgodam_transcoded_url_5_0'] = 'https://cdn.example.test/rec.mpd';

		$this->render_entry_view( self::RECORDING_URL );

		$this->assertSame( 'https://cdn.example.test/rec.mpd', $this->player_atts()[0]['transcoded_url'] );
	}

	/** Shortcode text in the stored recording is not run on the View Entry page. */
	public function test_shortcode_text_in_the_recording_is_not_run_on_the_entry_view() {
		$html = $this->render_entry_view( self::PAYLOAD_URL );

		$this->assertSame( 0, $GLOBALS['rtgodam_stub']['marker_runs'] );
		$this->assertStringNotContainsString( 'GX-MARKER', $html );
		$this->assertCount( 1, $this->player_atts() );
		$this->assertSame( self::PAYLOAD_URL, $this->player_atts()[0]['src'] );
		$this->assertArrayNotHasKey( 'shortcodes', $GLOBALS['rtgodam_stub'] );
	}

	/** Shortcode text in the stored transcoded URL is not run on the View Entry page. */
	public function test_shortcode_text_in_the_transcoded_url_is_not_run_on_the_entry_view() {
		$GLOBALS['rtgodam_stub']['wpforms_meta']['rtgodam_transcoded_url_5_0'] = "https://cdn.example.test/rec'][gx_marker]['.mpd";

		$this->render_entry_view( self::RECORDING_URL );

		$this->assertSame( 0, $GLOBALS['rtgodam_stub']['marker_runs'] );
	}

	/** The Edit Entry page shows the player with the recording and the same attributes as before. */
	public function test_the_entry_edit_shows_the_player_with_the_recording() {
		$html = $this->render_entry_edit( self::RECORDING_URL );

		$this->assertSame(
			array(
				array(
					'poster'         => '',
					'src'            => self::RECORDING_URL,
					'transcoded_url' => '',
				),
			),
			$this->player_atts()
		);
		$this->assertStringContainsString( 'data-src="' . self::RECORDING_URL . '"', $html );
	}

	/** Shortcode text in the stored recording is not run on the Edit Entry page. */
	public function test_shortcode_text_in_the_recording_is_not_run_on_the_entry_edit() {
		$html = $this->render_entry_edit( self::PAYLOAD_URL );

		$this->assertSame( 0, $GLOBALS['rtgodam_stub']['marker_runs'] );
		$this->assertStringNotContainsString( 'GX-MARKER', $html );
		$this->assertCount( 1, $this->player_atts() );
		$this->assertSame( self::PAYLOAD_URL, $this->player_atts()[0]['src'] );
	}
}
