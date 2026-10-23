<?php
/**
 * Unit tests for the Gravity Forms shortcode a form layer renders.
 *
 * The layer's theme is stored data and is written into a shortcode string. Only
 * a slug may get there, so a stored theme cannot close the shortcode or open
 * another one, and the themes the editor offers keep working.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * @covers ::rtgodam_get_gravityform_layer_shortcode
 */
class GravityFormLayerShortcodeTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__ ) . '/stubs/form-layer-preview-functions.php';
	}

	/**
	 * The themes the video editor offers, and Gravity Forms' own legacy slug.
	 *
	 * @return array<string, array{0: string}>
	 */
	public function theme_slugs() {
		return array(
			'orbital'       => array( 'orbital' ),
			'gravity'       => array( 'gravity' ),
			'gravity-theme' => array( 'gravity-theme' ),
			'with a number' => array( 'theme_2' ),
		);
	}

	/**
	 * A theme slug is written into the shortcode as it was stored.
	 *
	 * @dataProvider theme_slugs
	 *
	 * @param string $theme Stored theme.
	 */
	public function test_theme_slug_is_kept( $theme ) {
		$this->assertSame(
			"[gravityform id='7' title='false' description='false' ajax='true' theme='$theme']",
			rtgodam_get_gravityform_layer_shortcode(
				array(
					'gf_id' => 7,
					'theme' => $theme,
				)
			)
		);
	}

	/** A layer with no theme builds the shortcode without one. */
	public function test_missing_theme_is_left_out() {
		$expected = "[gravityform id='7' title='false' description='false' ajax='true']";

		$this->assertSame( $expected, rtgodam_get_gravityform_layer_shortcode( array( 'gf_id' => '7' ) ) );
		$this->assertSame(
			$expected,
			rtgodam_get_gravityform_layer_shortcode(
				array(
					'gf_id' => 7,
					'theme' => '',
				)
			)
		);
	}

	/** A theme that tries to close the shortcode and open another one is reduced to a slug. */
	public function test_theme_cannot_open_another_shortcode() {
		$shortcode = rtgodam_get_gravityform_layer_shortcode(
			array(
				'gf_id' => 7,
				'theme' => "orbital'][gd1_marker][gravityform id='1",
			)
		);

		$this->assertSame( "[gravityform id='7' title='false' description='false' ajax='true' theme='orbitalgd1_markergravityformid1']", $shortcode );
		$this->assertSame( 1, substr_count( $shortcode, '[' ), 'Only the one shortcode is opened.' );
		$this->assertSame( 1, substr_count( $shortcode, ']' ), 'Only the one shortcode is closed.' );
	}

	/** A theme that is not text, or has no slug characters in it, leaves the theme out. */
	public function test_unusable_theme_is_left_out() {
		foreach ( array( array( 'orbital' ), "']\"[]", true, null ) as $theme ) {
			$this->assertSame(
				"[gravityform id='7' title='false' description='false' ajax='true']",
				rtgodam_get_gravityform_layer_shortcode(
					array(
						'gf_id' => 7,
						'theme' => $theme,
					)
				)
			);
		}
	}

	/** The form ID is a whole number whatever is stored. */
	public function test_form_id_is_a_whole_number() {
		$this->assertSame(
			"[gravityform id='7' title='false' description='false' ajax='true']",
			rtgodam_get_gravityform_layer_shortcode( array( 'gf_id' => "7'][gd1_marker]" ) )
		);
	}
}
