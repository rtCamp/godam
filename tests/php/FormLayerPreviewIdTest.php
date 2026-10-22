<?php
/**
 * Unit tests for the id handed to the form layer preview.
 *
 * The preview page reads `rtgodam-layer-id` from the address. Whatever the
 * address holds, the Ninja Forms and MetForm integrations must only ever build
 * their shortcode from a whole number. The template is rendered for real and
 * its output hooks drive the real integration callbacks; only the WordPress
 * template tags and do_shortcode() are stubbed.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Metform\Metform_Integration;
use RTGODAM\Inc\Ninja_Forms\Ninja_Forms_Integration;

/**
 * @covers \RTGODAM\Inc\Metform\Metform_Integration::render_layer_form_for_video_editor
 * @covers \RTGODAM\Inc\Ninja_Forms\Ninja_Forms_Integration::render_layer_form_for_video_editor
 */
class FormLayerPreviewIdTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__ ) . '/stubs/form-layer-preview-functions.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/metform/class-metform-integration.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/ninja-forms/class-ninja-forms-integration.php';

		$GLOBALS['rtgodam_hooks'] = array();
		$GLOBALS['rtgodam_stub']  = array( 'shortcodes' => array() );

		// Register only the preview callbacks, on constructor-less instances.
		foreach ( array( Metform_Integration::class, Ninja_Forms_Integration::class ) as $class ) {
			$object = ( new \ReflectionClass( $class ) )->newInstanceWithoutConstructor();
			add_action( 'rtgodam_render_layer_for_video_editor_before', array( $object, 'add_css_for_the_layer_inside_iframe' ), 10, 2 );
			add_action( 'rtgodam_render_layer_for_video_editor', array( $object, 'render_layer_form_for_video_editor' ), 10, 2 );
		}
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'], $GLOBALS['rtgodam_hooks'] );
		parent::tearDown();
	}

	/**
	 * Render the preview template for the given query vars and return the
	 * shortcode strings that reached do_shortcode().
	 *
	 * @param string $layer    Value of `rtgodam-render-layer`.
	 * @param mixed  $layer_id Value of `rtgodam-layer-id`.
	 * @return string[]
	 */
	private function render_preview( $layer, $layer_id ) {
		$GLOBALS['rtgodam_stub']['query_vars'] = array(
			'rtgodam-render-layer' => $layer,
			'rtgodam-layer-id'     => $layer_id,
		);
		$GLOBALS['rtgodam_stub']['shortcodes'] = array();

		ob_start();
		include dirname( __DIR__, 2 ) . '/inc/templates/render-video-editor-form-layer.php';
		ob_end_clean();

		return $GLOBALS['rtgodam_stub']['shortcodes'];
	}

	/** A plain numeric id still builds the same shortcodes as before. */
	public function test_numeric_id_builds_the_expected_shortcodes() {
		$this->assertSame( array( "[ninja_form id='42']" ), $this->render_preview( 'ninja-forms', '42' ) );
		$this->assertSame( array( "[metform form_id='42']" ), $this->render_preview( 'metform', '42' ) );
	}

	/** Anything after the leading digits never reaches the shortcode. */
	public function test_non_numeric_id_reaches_the_shortcode_as_an_integer() {
		$value = "7'][gd1_marker]x";

		$this->assertSame( array( "[ninja_form id='7']" ), $this->render_preview( 'ninja-forms', $value ) );
		$this->assertSame( array( "[metform form_id='7']" ), $this->render_preview( 'metform', $value ) );
	}

	/** An id with no leading digits becomes 0 and renders nothing. */
	public function test_id_without_digits_renders_no_shortcode() {
		$this->assertSame( array(), $this->render_preview( 'ninja-forms', "'][gd1_marker]" ) );
		$this->assertSame( array(), $this->render_preview( 'metform', "'][gd1_marker]" ) );
	}

	/** The callbacks also cast on their own, for callers other than the template. */
	public function test_callbacks_cast_a_string_id_when_called_directly() {
		$ninja   = ( new \ReflectionClass( Ninja_Forms_Integration::class ) )->newInstanceWithoutConstructor();
		$metform = ( new \ReflectionClass( Metform_Integration::class ) )->newInstanceWithoutConstructor();

		$ninja->render_layer_form_for_video_editor( 'ninja-forms', "9'][gd1_marker]" );
		$metform->render_layer_form_for_video_editor( 'metform', "9'][gd1_marker]" );

		$this->assertSame( array( "[ninja_form id='9']", "[metform form_id='9']" ), $GLOBALS['rtgodam_stub']['shortcodes'] );
	}
}
