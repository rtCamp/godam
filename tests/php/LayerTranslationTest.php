<?php
/**
 * Layer API: translating a layer type's `layer.json` strings and pointing its
 * scripts at the right translation files.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Layers\Layer_Type_Registry;

require_once dirname( __DIR__ ) . '/stubs/layer-registry.php';

/**
 * @coversNothing
 */
class LayerTranslationTest extends TestCase {

	/**
	 * A copy of the fixture add-on outside GoDAM's folder, as an add-on plugin is.
	 *
	 * @var string
	 */
	private $addon_dir = '';

	/**
	 * An empty registry and fresh script, style and translation records.
	 */
	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['rtgodam_hooks']   = array();
		$GLOBALS['rtgodam_stub']    = array();
		$GLOBALS['rtgodam_scripts'] = array(
			'registered' => array(),
			'enqueued'   => array(),
			'inline'     => array(),
		);
		Layer_Type_Registry::get_instance()->reset();
	}

	/**
	 * Remove the add-on copy.
	 */
	protected function tearDown(): void {
		if ( '' !== $this->addon_dir ) {
			$this->remove_dir( $this->addon_dir );
		}
		parent::tearDown();
	}

	/**
	 * Translations for the fixture's text domain.
	 *
	 * @param array<string, string> $strings Translations, keyed as gettext keys them (`"context\4text"` with a context).
	 * @return void
	 */
	private function translations( array $strings ): void {
		$GLOBALS['rtgodam_stub']['gettext']['acme-countdown'] = $strings;
	}

	/**
	 * Title and description are translated with the type's text domain and their
	 * gettext context, as core translates block.json, and reach the editor.
	 */
	public function test_translates_layer_json_strings_with_their_context(): void {
		$this->translations(
			array(
				"layer title\4Countdown from file"        => 'Compte à rebours',
				"layer description\4Count down to a date" => 'Jusqu’à une date',
			)
		);

		$type     = godam_register_layer_type( RTGODAM_PATH . 'tests/fixtures/layers/acme-countdown' );
		$settings = Layer_Type_Registry::get_instance()->get_editor_settings();

		$this->assertSame( 'Compte à rebours', $type['title'] );
		$this->assertSame( 'Jusqu’à une date', $type['description'] );
		$this->assertSame( 'Compte à rebours', $settings['layerTypes']->{'acme/countdown-file'}['title'] );
	}

	/**
	 * A string with no translation in its context uses the domain's translation
	 * of the same string without one, e.g. from the add-on's editor script.
	 */
	public function test_falls_back_to_the_translation_without_a_context(): void {
		$this->translations( array( 'Countdown from file' => 'Cuenta atrás' ) );

		$type = godam_register_layer_type( RTGODAM_PATH . 'tests/fixtures/layers/acme-countdown' );

		$this->assertSame( 'Cuenta atrás', $type['title'] );
		$this->assertSame( 'Count down to a date', $type['description'] );
	}

	/**
	 * Variations in layer.json are translated too.
	 */
	public function test_translates_variation_titles(): void {
		$this->translations(
			array(
				"layer variation title\4Sale" => 'Soldes',
				"layer variation description\4Ends at noon" => 'Finit à midi',
			)
		);

		godam_register_layer_type(
			array(
				'name'       => 'acme/sale',
				'title'      => 'Sale',
				'textdomain' => 'acme-countdown',
				'variations' => array(
					array(
						'name'        => 'sale',
						'title'       => 'Sale',
						'description' => 'Ends at noon',
					),
				),
			)
		);
		$variation = godam_get_layer_type( 'acme/sale' )['variations'][0];

		$this->assertSame( 'Soldes', $variation['title'] );
		$this->assertSame( 'Finit à midi', $variation['description'] );
	}

	/**
	 * A title passed to `godam_register_layer_type()` still wins, and a type
	 * without a text domain isn't translated.
	 */
	public function test_args_win_and_no_textdomain_means_no_translation(): void {
		$this->translations( array( "layer title\4Countdown from file" => 'Compte à rebours' ) );
		$type = godam_register_layer_type( RTGODAM_PATH . 'tests/fixtures/layers/acme-countdown', array( 'title' => 'Mine' ) );
		$this->assertSame( 'Mine', $type['title'] );

		$GLOBALS['rtgodam_translated'] = array();
		godam_register_layer_type(
			array(
				'name'  => 'acme/plain',
				'title' => 'Plain',
			)
		);
		$this->assertSame( 'Plain', godam_get_layer_type( 'acme/plain' )['title'] );
		$this->assertNotContains( 'Plain', array_column( $GLOBALS['rtgodam_translated'], 'text' ) );
	}

	/**
	 * An add-on's scripts load translations through WordPress's own lookup for
	 * its text domain, not from GoDAM's languages folder.
	 */
	public function test_addon_script_translations_use_the_default_lookup(): void {
		godam_register_layer_type( $this->copy_addon_outside_godam() );

		$translations = $GLOBALS['rtgodam_scripts']['translations'];
		$this->assertSame(
			array(
				'domain' => 'acme-countdown',
				'path'   => '',
			),
			$translations['acme-countdown-file-editor-script']
		);
		$this->assertSame( '', $translations['acme-countdown-file-view-script']['path'] );
	}

	/**
	 * GoDAM's own layers keep loading their script translations from its languages folder.
	 */
	public function test_godam_layer_script_translations_use_godams_languages_folder(): void {
		godam_register_layer_type( RTGODAM_PATH . 'tests/fixtures/layers/built-core' );

		$this->assertSame(
			array(
				'domain' => 'godam',
				'path'   => RTGODAM_PATH . 'languages',
			),
			$GLOBALS['rtgodam_scripts']['translations']['godam-layer-builtcore-view-script']
		);
	}

	/**
	 * Copy the fixture add-on to a temporary folder.
	 *
	 * @return string The copy's folder.
	 */
	private function copy_addon_outside_godam(): string {
		$source          = RTGODAM_PATH . 'tests/fixtures/layers/acme-countdown';
		$this->addon_dir = sys_get_temp_dir() . '/godam-layer-addon-' . uniqid();
		mkdir( $this->addon_dir . '/build', 0777, true );
		copy( $source . '/layer.json', $this->addon_dir . '/layer.json' );
		foreach ( glob( $source . '/build/*' ) as $file ) {
			copy( $file, $this->addon_dir . '/build/' . basename( $file ) );
		}
		return $this->addon_dir;
	}

	/**
	 * Delete a folder and its files.
	 *
	 * @param string $dir Folder.
	 * @return void
	 */
	private function remove_dir( string $dir ): void {
		foreach ( glob( $dir . '/{,.}*', GLOB_BRACE ) as $item ) {
			if ( in_array( basename( $item ), array( '.', '..' ), true ) ) {
				continue;
			}
			is_dir( $item ) ? $this->remove_dir( $item ) : unlink( $item );
		}
		rmdir( $dir );
	}
}
