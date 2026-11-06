<?php
/**
 * Layer API (#2295): a layer type's scripts, its editor settings and cleaning on save.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Layers\Layer_Type_Registry;

require_once dirname( __DIR__ ) . '/stubs/layer-registry.php';
require_once dirname( __DIR__ ) . '/stubs/media-visibility-functions.php';

/**
 * @coversNothing
 */
class LayerAssetsTest extends TestCase {

	/**
	 * Core types plus the fixture add-on, with fresh script records.
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
		rtgodam_test_register_core_layer_types();
		godam_register_layer_type(
			RTGODAM_PATH . 'tests/fixtures/layers/acme-countdown',
			array(
				'render_callback' => function ( $layer ) {
					return empty( $layer['label'] ) ? '' : '<div class="acme"></div>';
				},
			)
		);
	}

	/**
	 * The registry.
	 *
	 * @return Layer_Type_Registry
	 */
	private function registry(): Layer_Type_Registry {
		return Layer_Type_Registry::get_instance();
	}

	/**
	 * `file:` scripts in layer.json are registered as handles; other values are used as handles.
	 */
	public function test_registers_the_scripts_layer_json_names(): void {
		$type = godam_get_layer_type( 'acme/countdown-file' );

		$this->assertSame( array( 'acme-countdown-file-editor-script' ), $type['editor_script_handles'] );
		$this->assertSame( array( 'acme-countdown-file-view-script', 'acme-shared-lib' ), $type['view_script_handles'] );
		$this->assertSame( array( 'acme-countdown-file-editor-script', 'acme-countdown-file-view-script' ), $GLOBALS['rtgodam_scripts']['registered'] );
	}

	/**
	 * A view script loads only once a layer of its type renders something.
	 */
	public function test_loads_the_view_script_only_when_a_layer_renders(): void {
		godam_render_layer(
			array(
				'id'   => 'a1',
				'type' => 'acme/countdown-file',
			),
			'video_1'
		);
		$this->assertSame( array(), $GLOBALS['rtgodam_scripts']['enqueued'] );

		godam_render_layer(
			array(
				'id'    => 'a1',
				'type'  => 'acme/countdown-file',
				'label' => 'Hi',
			),
			'video_1'
		);
		$this->assertSame( array( 'acme-countdown-file-view-script', 'acme-shared-lib' ), $GLOBALS['rtgodam_scripts']['enqueued'] );
	}

	/**
	 * An unprefixed (core) type's view script is registered as `godam-layer-<type>-view-script`.
	 */
	public function test_prefixes_core_view_script_handles(): void {
		godam_register_layer_type(
			RTGODAM_PATH . 'tests/fixtures/layers/built-core',
			array(
				'render_callback' => function () {
					return '<div></div>';
				},
			)
		);

		$this->assertSame( array( 'godam-layer-builtcore-view-script' ), godam_get_layer_type( 'builtcore' )['view_script_handles'] );
		godam_render_layer( array( 'type' => 'builtcore' ), 'video_1' );
		$this->assertContains( 'godam-layer-builtcore-view-script', $GLOBALS['rtgodam_scripts']['enqueued'] );
	}

	/**
	 * Editors that render previews over AJAX load every image-capable type's view scripts up front.
	 */
	public function test_loads_the_view_scripts_for_a_media_type(): void {
		$this->registry()->enqueue_view_scripts_for_media( 'image' );
		$this->assertSame( array( 'acme-countdown-file-view-script', 'acme-shared-lib' ), $GLOBALS['rtgodam_scripts']['enqueued'] );
	}

	/**
	 * A `file:` script that hasn't been built (no `*.asset.php`) isn't registered, as
	 * with the core layers' source folders: a page of them loads nothing from source.
	 */
	public function test_loads_nothing_extra_for_core_layers(): void {
		godam_render_layer(
			array(
				'id'   => 'h1',
				'type' => 'hotspot',
			),
			'video_1'
		);
		$this->assertSame( array(), $GLOBALS['rtgodam_scripts']['enqueued'] );
	}

	/**
	 * The image block loads the view script of each layer it sends, without private attributes.
	 */
	public function test_sends_image_layers_without_private_attributes_and_loads_their_script(): void {
		$sent = $this->registry()->filter_layers_for_media(
			array(
				array(
					'id'       => 'a1',
					'type'     => 'acme/countdown-file',
					'apiToken' => 'secret',
				),
			),
			'image'
		);

		$this->assertSame(
			array(
				array(
					'id'   => 'a1',
					'type' => 'acme/countdown-file',
				),
			),
			$sent
		);
		$this->assertSame( array( 'acme-countdown-file-view-script', 'acme-shared-lib' ), $GLOBALS['rtgodam_scripts']['enqueued'] );
	}

	/**
	 * The video editor loads every type's editor script.
	 */
	public function test_loads_editor_scripts_in_the_editor(): void {
		$this->registry()->enqueue_editor_scripts();
		$this->assertSame( array( 'acme-countdown-file-editor-script' ), $GLOBALS['rtgodam_scripts']['enqueued'] );
	}

	/**
	 * The editor gets each type's metadata (no callbacks or paths) and what can run here.
	 */
	public function test_gives_the_editor_metadata_and_availability(): void {
		$GLOBALS['rtgodam_stub']['active_plugins'] = array( 'wpforms-lite/wpforms.php' );
		$settings                                  = $this->registry()->get_editor_settings();
		$acme                                      = $settings['layerTypes']->{'acme/countdown-file'};
		$form                                      = $settings['layerAvailability']->form;

		$this->assertSame( 'Countdown from file', $acme['title'] );
		$this->assertArrayHasKey( 'attributes', $acme );
		$this->assertArrayNotHasKey( 'render_callback', $acme );
		$this->assertArrayNotHasKey( 'file', $acme );
		$this->assertSame( 'form_type', $settings['layerTypes']->form['variationAttribute'] );
		$this->assertTrue( $form['available'] );
		$this->assertTrue( $form['variations']->wpforms );
		$this->assertFalse( $form['variations']->gravity );
	}

	/**
	 * Saving `rtgodam_meta` through REST cleans its layers.
	 */
	public function test_cleans_layers_saved_through_rest(): void {
		require_once RTGODAM_PATH . 'inc/classes/rest-api/class-meta-rest-fields.php';
		\RTGODAM\Inc\REST_API\Meta_Rest_Fields::get_instance()->add_meta_rest_fields();
		$update = $GLOBALS['rtgodam_stub']['rest_fields']['attachment']['rtgodam_meta']['update_callback'];

		$post     = (object) array( 'ID' => 42 );
		$chapters = array( array( 'title' => 'Intro' ) );
		$update(
			array(
				'chapters' => $chapters,
				'layers'   => array(
					array(
						'id'     => 'a1',
						'type'   => 'acme/countdown-file',
						'label'  => 'Hi',
						'hacker' => 'dropped',
					),
				),
			),
			$post
		);

		$saved = $GLOBALS['rtgodam_stub']['meta_writes']['rtgodam_meta'] ?? null;
		$this->assertSame(
			array(
				'chapters' => $chapters,
				'layers'   => array(
					array(
						'id'    => 'a1',
						'type'  => 'acme/countdown-file',
						'label' => 'Hi',
					),
				),
			),
			$saved
		);
	}
}
