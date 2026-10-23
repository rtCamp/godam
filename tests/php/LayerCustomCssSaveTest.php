<?php
/**
 * Unit tests for who can change a layer's custom CSS when saving a video's layer data.
 *
 * A layer's custom CSS is printed as a style element on the page the video is
 * on. WordPress keeps a style element in post content only for users with the
 * `unfiltered_html` capability, so the same rule applies here: other users can
 * save everything else about a layer, but not add to or change its CSS. CSS
 * that is already saved stays, and users with the capability are unaffected.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Meta_Rest_Fields;

/**
 * @covers \RTGODAM\Inc\REST_API\Meta_Rest_Fields::limit_layer_custom_css
 * @covers \RTGODAM\Inc\REST_API\Meta_Rest_Fields::add_meta_rest_fields
 */
class LayerCustomCssSaveTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__, 2 ) . '/inc/classes/rest-api/class-meta-rest-fields.php';

		require_once dirname( __DIR__ ) . '/stubs/rest-field-functions.php';

		$GLOBALS['rtgodam_hooks'] = array();
		$GLOBALS['rtgodam_stub']  = array(
			'caps'      => array(),
			'post_meta' => array(),
		);
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'], $GLOBALS['rtgodam_hooks'] );
		parent::tearDown();
	}

	/**
	 * Meta_Rest_Fields without its constructor (it registers WP hooks).
	 *
	 * @return Meta_Rest_Fields
	 */
	private function fields() {
		return ( new \ReflectionClass( Meta_Rest_Fields::class ) )->newInstanceWithoutConstructor();
	}

	/**
	 * Give the current user the capability, or take it away.
	 *
	 * @param bool $unfiltered_html Whether the user has `unfiltered_html`.
	 */
	private function sign_in_with_unfiltered_html( $unfiltered_html ) {
		$GLOBALS['rtgodam_stub']['caps'] = $unfiltered_html ? array( 'unfiltered_html' ) : array( 'edit_posts', 'upload_files' );
	}

	/**
	 * Set the layer data that is already saved for the attachment.
	 *
	 * @param array $layers The saved layers.
	 */
	private function saved_layers( array $layers ) {
		$GLOBALS['rtgodam_stub']['post_meta']['rtgodam_meta'] = array( 'layers' => $layers );
	}

	/**
	 * Build a form layer.
	 *
	 * @param string $id  Layer ID.
	 * @param mixed  $css Custom CSS.
	 * @param array  $extra More layer fields.
	 * @return array
	 */
	private function layer( $id, $css, array $extra = array() ) {
		return array_merge(
			array(
				'id'         => $id,
				'type'       => 'form',
				'custom_css' => $css,
			),
			$extra
		);
	}

	/** A site administrator without `unfiltered_html` (as on multisite) still saves layer CSS. */
	public function test_site_admin_without_unfiltered_html_saves_css_as_sent() {
		$GLOBALS['rtgodam_stub']['caps'] = array( 'manage_options', 'edit_posts', 'upload_files' );

		$value = array(
			'layers' => array(
				array(
					'id'         => 'layer-1',
					'custom_css' => '.godam-layer { color: red; }',
				),
			),
		);

		$this->assertSame( $value, $this->fields()->limit_layer_custom_css( $value, 10 ) );
	}

	/** A user with `unfiltered_html` saves whatever CSS they send. */
	public function test_user_with_unfiltered_html_saves_css_as_sent() {
		$this->sign_in_with_unfiltered_html( true );
		$this->saved_layers( array( $this->layer( 'a', '.old{}' ) ) );

		$value = array( 'layers' => array( $this->layer( 'a', '.new{}' ), $this->layer( 'b', '.added{}' ) ) );

		$this->assertSame( $value, $this->fields()->limit_layer_custom_css( $value, 12 ) );
	}

	/** Without the capability, CSS on a new layer is not saved and the rest of the layer is. */
	public function test_css_on_a_new_layer_is_not_saved_without_the_capability() {
		$this->sign_in_with_unfiltered_html( false );

		$value  = array(
			'videoConfig' => array( 'controlBar' => array( 'appearanceColor' => '#2b333fb3' ) ),
			'layers'      => array( $this->layer( 'new', 'body{display:none}', array( 'bg_color' => '#fff' ) ) ),
		);
		$result = $this->fields()->limit_layer_custom_css( $value, 12 );

		$expected                            = $value;
		$expected['layers'][0]['custom_css'] = '';

		$this->assertSame( $expected, $result );
	}

	/** Saving the video again with the CSS untouched keeps the saved CSS, whoever saves it. */
	public function test_saved_css_stays_when_it_is_sent_back_unchanged() {
		$this->sign_in_with_unfiltered_html( false );
		$this->saved_layers( array( $this->layer( 'a', '.form-container input{color:red}' ) ) );

		$value = array( 'layers' => array( $this->layer( 'a', '.form-container input{color:red}', array( 'bg_color' => '#abcdef' ) ) ) );

		$this->assertSame( $value, $this->fields()->limit_layer_custom_css( $value, 12 ) );
	}

	/** A changed CSS goes back to what is saved; a layer with nothing saved gets none. */
	public function test_changed_css_goes_back_to_the_saved_css() {
		$this->sign_in_with_unfiltered_html( false );
		$this->saved_layers( array( $this->layer( 'a', '.saved{}' ), $this->layer( 'b', '' ) ) );

		$value  = array(
			'layers' => array(
				$this->layer( 'a', 'body{display:none}' ),
				$this->layer( 'b', 'body{display:none}' ),
			),
		);
		$result = $this->fields()->limit_layer_custom_css( $value, 12 );

		$this->assertSame( '.saved{}', $result['layers'][0]['custom_css'] );
		$this->assertSame( '', $result['layers'][1]['custom_css'] );
	}

	/** Removing a layer's CSS is not blocked. */
	public function test_css_can_be_removed_without_the_capability() {
		$this->sign_in_with_unfiltered_html( false );
		$this->saved_layers( array( $this->layer( 'a', '.saved{}' ) ) );

		$value = array( 'layers' => array( $this->layer( 'a', '' ) ) );

		$this->assertSame( $value, $this->fields()->limit_layer_custom_css( $value, 12 ) );
	}

	/** A layer is matched to its saved CSS by ID, not by position. */
	public function test_layers_are_matched_by_id_not_position() {
		$this->sign_in_with_unfiltered_html( false );
		$this->saved_layers( array( $this->layer( 'a', '.a{}' ), $this->layer( 'b', '.b{}' ) ) );

		$value  = array( 'layers' => array( $this->layer( 'b', '.b{}' ), $this->layer( 'a', '.b{}' ) ) );
		$result = $this->fields()->limit_layer_custom_css( $value, 12 );

		$this->assertSame( '.b{}', $result['layers'][0]['custom_css'] );
		$this->assertSame( '.a{}', $result['layers'][1]['custom_css'] );
	}

	/** CSS that is not text, or sits on a layer with no ID, is not saved. */
	public function test_unusable_css_is_not_saved() {
		$this->sign_in_with_unfiltered_html( false );
		$this->saved_layers( array( $this->layer( 'a', '.saved{}' ) ) );

		$no_id = $this->layer( 'x', '.x{}' );
		unset( $no_id['id'] );

		$value  = array( 'layers' => array( $this->layer( 'a', array( '.x{}' ) ), $no_id ) );
		$result = $this->fields()->limit_layer_custom_css( $value, 12 );

		$this->assertSame( '.saved{}', $result['layers'][0]['custom_css'] );
		$this->assertSame( '', $result['layers'][1]['custom_css'] );
	}

	/** Layers without CSS, and values that are not layer data, pass through as sent. */
	public function test_everything_else_is_left_alone() {
		$this->sign_in_with_unfiltered_html( false );

		$no_css = array(
			'layers' => array(
				array(
					'id'   => 'a',
					'type' => 'poll',
				),
				'not-a-layer',
			),
		);
		$this->assertSame( $no_css, $this->fields()->limit_layer_custom_css( $no_css, 12 ) );

		foreach ( array( null, 'text', array(), array( 'layers' => 'text' ), array( 'videoConfig' => array() ) ) as $value ) {
			$this->assertSame( $value, $this->fields()->limit_layer_custom_css( $value, 12 ) );
		}
	}

	/**
	 * Run the REST field's update callback, as the REST API does for /wp/v2/media/<id>.
	 *
	 * @param mixed $value The submitted `rtgodam_meta`.
	 */
	private function save_through_rest_field( $value ) {
		$this->fields()->add_meta_rest_fields();

		$callback = $GLOBALS['rtgodam_stub']['rest_fields']['rtgodam_meta']['update_callback'];

		$callback( $value, (object) array( 'ID' => 12 ) );
	}

	/** The REST field saves the limited value for a user without the capability. */
	public function test_rest_field_saves_the_limited_value() {
		$this->sign_in_with_unfiltered_html( false );
		$this->saved_layers( array() );

		$this->save_through_rest_field( array( 'layers' => array( $this->layer( 'a', 'body{display:none}', array( 'bg_color' => '#fff' ) ) ) ) );

		$written = $GLOBALS['rtgodam_stub']['meta_writes']['rtgodam_meta'];
		$this->assertSame( '', $written['layers'][0]['custom_css'] );
		$this->assertSame( '#fff', $written['layers'][0]['bg_color'] );
	}

	/** The REST field saves the CSS as sent for a user with the capability. */
	public function test_rest_field_saves_css_as_sent_with_the_capability() {
		$this->sign_in_with_unfiltered_html( true );
		$this->saved_layers( array() );

		$this->save_through_rest_field( array( 'layers' => array( $this->layer( 'a', '.form-container input{color:red}' ) ) ) );

		$written = $GLOBALS['rtgodam_stub']['meta_writes']['rtgodam_meta'];
		$this->assertSame( '.form-container input{color:red}', $written['layers'][0]['custom_css'] );
	}
}
