<?php
/**
 * Layer API (#2295): the PHP layer type registry and the core types' render callbacks.
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
class LayerTypeRegistryTest extends TestCase {

	/**
	 * Fresh hooks, stubs and core types.
	 */
	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['rtgodam_hooks'] = array();
		$GLOBALS['rtgodam_stub']  = array();
		rtgodam_test_register_core_layer_types();
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
	 * Core types register from their layer.json, in the editor's order.
	 */
	public function test_registers_the_core_types_from_their_layer_json(): void {
		$this->assertSame( array( 'cta', 'form', 'poll', 'hotspot', 'ad', 'woo' ), array_keys( $this->registry()->get_all() ) );
		$this->assertSame( 'Hotspot', godam_get_layer_type( 'hotspot' )['title'] );
		$this->assertSame( array( 'video', 'image' ), godam_get_layer_type( 'hotspot' )['supports']['media'] );
		$this->assertSame( array( 'video' ), godam_get_layer_type( 'cta' )['supports']['media'] );
		$this->assertTrue( godam_get_layer_type( 'cta' )['supports']['rawHtml'] );
	}

	/**
	 * An add-on registers from a folder or a metadata array, and the metadata filter runs.
	 */
	public function test_registers_an_add_on_type_and_filters_its_metadata(): void {
		add_filter(
			'godam_layer_type_metadata',
			function ( $metadata ) {
				$metadata['title'] = 'Filtered ' . ( $metadata['title'] ?? '' );
				return $metadata;
			}
		);

		$type = godam_register_layer_type(
			array(
				'name'  => 'acme/countdown',
				'title' => 'Countdown',
			),
			array(
				'render_callback' => function () {
					return '';
				},
			)
		);

		$this->assertSame( 'Filtered Countdown', $type['title'] );
		$this->assertSame( array( 'video' ), $type['supports']['media'] );

		$from_file = godam_register_layer_type( RTGODAM_PATH . 'tests/fixtures/layers/acme-countdown' );
		$this->assertSame( 'Filtered Countdown from file', $from_file['title'] );
		$this->assertSame( array( 'video', 'image' ), $from_file['supports']['media'] );
	}

	/**
	 * A nameless or duplicate type is rejected with a notice.
	 */
	public function test_rejects_a_nameless_or_duplicate_type(): void {
		$this->assertFalse( godam_register_layer_type( array( 'title' => 'No name' ) ) );
		$this->assertFalse( godam_register_layer_type( array( 'name' => 'cta' ) ) );
		$this->assertFalse( godam_register_layer_type( '/no/such/layer.json' ) );
		$this->assertSame(
			array( 'A layer type needs a name.', 'Layer type &quot;cta&quot; is already registered.', 'Layer type metadata could not be read.' ),
			$GLOBALS['rtgodam_stub']['doing_it_wrong']
		);
	}

	/**
	 * Form providers are variations selected by form_type; an old layer with none uses Gravity Forms.
	 */
	public function test_selects_the_form_provider_by_form_type(): void {
		$form = godam_get_layer_type( 'form' );
		$this->assertSame(
			array( 'gravity', 'wpforms', 'cf7', 'jetpack', 'sureforms', 'forminator', 'fluentforms', 'everestforms', 'ninjaforms', 'metform', 'marketo', 'hubspot' ),
			array_column( $form['variations'], 'name' )
		);
		$this->assertSame( 'WPForms', $this->registry()->get_layer_variation( $form, array( 'form_type' => 'wpforms' ) )['title'] );
		$this->assertSame( 'gravity', $this->registry()->get_layer_variation( $form, array() )['name'] );
		$this->assertNull( $this->registry()->get_layer_variation( $form, array( 'form_type' => 'mystery' ) ) );
	}

	/**
	 * A variation registered before its type is added once the type registers.
	 */
	public function test_keeps_a_variation_registered_before_its_type(): void {
		godam_register_layer_variation( 'acme/form', array( 'name' => 'early' ) );
		godam_register_layer_type(
			array(
				'name'               => 'acme/form',
				'variationAttribute' => 'kind',
			)
		);

		$this->assertSame( array( 'kind' => 'early' ), godam_get_layer_type( 'acme/form' )['variations'][0]['attributes'] );
		$this->assertFalse( godam_register_layer_variation( 'acme/form', array( 'name' => 'early' ) ) );
	}

	/**
	 * The player's dependency flags come from each type's and provider's is_available.
	 */
	public function test_reports_availability_under_each_dependency_key(): void {
		$GLOBALS['rtgodam_stub']['active_plugins'] = array( 'wpforms-lite/wpforms.php', 'wp-polls/wp-polls.php' );
		godam_unregister_layer_type( 'form' );
		godam_register_layer_type(
			array( 'name' => 'acme/x' ),
			array(
				'dependency_key' => 'acmeX',
				'is_available'   => function () {
					return false;
				},
			)
		);

		$this->assertSame(
			array(
				'wpPolls' => true,
				'acmeX'   => false,
			),
			$this->registry()->get_dependency_flags() 
		);

		rtgodam_test_register_core_layer_types();
		$form = godam_get_layer_type( 'form' );
		$this->assertTrue( $this->registry()->is_available( $this->registry()->get_layer_variation( $form, array( 'form_type' => 'wpforms' ) ) ) );
		$this->assertFalse( $this->registry()->is_available( $this->registry()->get_layer_variation( $form, array( 'form_type' => 'cf7' ) ) ) );
	}

	/**
	 * A layer with no type, or not an array, renders nothing.
	 */
	public function test_renders_nothing_for_a_typeless_layer(): void {
		$this->assertSame( '', godam_render_layer( array( 'id' => 'x' ), 'video_1' ) );
		$this->assertSame( '', godam_render_layer( 'nope', 'video_1' ) );
	}

	/**
	 * A type with no PHP registration renders through the old godam_player_render_layer action, on video only.
	 */
	public function test_renders_an_unregistered_type_through_the_old_action(): void {
		add_action(
			'godam_player_render_layer',
			function ( $layer, $instance_id ) {
				echo '<div data-legacy="' . esc_attr( $instance_id . ':' . $layer['id'] ) . '"></div>';
			},
			10,
			2
		);
		$layer = array(
			'id'   => 'a1',
			'type' => 'acme',
		);

		$this->assertSame( '<div data-legacy="video_1:a1"></div>', godam_render_layer( $layer, 'video_1' ) );
		$this->assertSame( array( 'godam_player_render_layer@2.7.0' ), $GLOBALS['rtgodam_stub']['deprecated_hooks'] );
		$this->assertSame( '', godam_render_layer( $layer, 'img_1', array( 'media' => 'image' ) ) );
	}

	/**
	 * An add-on's output goes through wp_kses_post() unless it sets supports.rawHtml.
	 */
	public function test_escapes_add_on_output_unless_it_opts_out(): void {
		$GLOBALS['rtgodam_stub']['kses_strip_disallowed'] = true;
		$render = function () {
			return '<div class="easydam-layer"><script>alert(1)</script></div>';
		};
		godam_register_layer_type( array( 'name' => 'acme/safe' ), array( 'render_callback' => $render ) );
		godam_register_layer_type(
			array(
				'name'     => 'acme/raw',
				'supports' => array( 'rawHtml' => true ),
			),
			array( 'render_callback' => $render )
		);

		$this->assertSame( '<div class="easydam-layer">alert(1)</div>', godam_render_layer( array( 'type' => 'acme/safe' ), 'v' ) );
		$this->assertStringContainsString( '<script>', godam_render_layer( array( 'type' => 'acme/raw' ), 'v' ) );
	}

	/**
	 * Hotspot: an empty container the player fills, with a background only when the layer sets one.
	 */
	public function test_renders_a_hotspot_layer(): void {
		$this->assertSame(
			'<div id="layer-video_1-h1" class="easydam-layer hidden hotspot-layer"></div>',
			godam_render_layer(
				array(
					'id'   => 'h1',
					'type' => 'hotspot',
				),
				'video_1'
			)
		);
		$this->assertStringContainsString(
			'style="background-color: #000"',
			godam_render_layer(
				array(
					'id'       => 'h1',
					'type'     => 'hotspot',
					'bg_color' => '#000',
				),
				'video_1'
			)
		);
	}

	/**
	 * A layer's background colour goes into its style attribute only when it is a
	 * plain colour; otherwise the overlay default, or none for a hotspot (#2246).
	 */
	public function test_prints_only_a_plain_background_colour(): void {
		$poll    = array(
			'id'      => 'p1',
			'type'    => 'poll',
			'poll_id' => '4',
		);
		$hotspot = array(
			'id'   => 'h1',
			'type' => 'hotspot',
		);
		$unsafe  = '#000; background-image: url(https://example.test/x)';

		$this->assertStringContainsString( 'style="background-color: rgba(0, 0, 0, 0.5)"', godam_render_layer( $poll + array( 'bg_color' => 'rgba(0, 0, 0, 0.5)' ), 'video_1' ) );
		$this->assertStringContainsString( 'style="background-color: #FFFFFFB3"', godam_render_layer( $poll + array( 'bg_color' => $unsafe ), 'video_1' ) );
		$this->assertStringNotContainsString( 'url(', godam_render_layer( $poll + array( 'bg_color' => $unsafe ), 'video_1' ) );
		$this->assertSame( '<div id="layer-video_1-h1" class="easydam-layer hidden hotspot-layer"></div>', godam_render_layer( $hotspot + array( 'bg_color' => $unsafe ), 'video_1' ) );
	}

	/**
	 * CTA: HTML CTAs render their HTML; legacy text CTAs render nothing.
	 */
	public function test_renders_an_html_cta_and_skips_a_text_cta(): void {
		// The bootstrap's do_shortcode() stub returns '' while no shortcode is
		// registered; WordPress returns the content as is, so register one.
		$GLOBALS['shortcode_tags'] = array_merge( (array) ( $GLOBALS['shortcode_tags'] ?? array() ), array( 'godam_test_noop' => '__return_empty_string' ) );

		$html = godam_render_layer(
			array(
				'id'       => 'c1',
				'type'     => 'cta',
				'cta_type' => 'html',
				'html'     => '<p>Buy now</p>',
			),
			'video_1'
		);

		$this->assertSame( '<div id="layer-video_1-c1" class="easydam-layer hidden" style="background-color: #FFFFFFB3"><div class="easydam-layer--cta-html"><p>Buy now</p></div></div>', $html );
		$this->assertSame(
			'',
			godam_render_layer(
				array(
					'id'       => 'c2',
					'type'     => 'cta',
					'cta_type' => 'text',
					'text'     => 'Old',
				),
				'video_1'
			)
		);
	}

	/**
	 * Poll: WP-Polls' shortcode in a poll container.
	 */
	public function test_renders_a_poll_layer(): void {
		$html = godam_render_layer(
			array(
				'id'      => 'p1',
				'type'    => 'poll',
				'poll_id' => '4',
			),
			'video_1'
		);

		$this->assertStringStartsWith( '<div id="layer-video_1-p1" class="easydam-layer hidden" style="background-color: #FFFFFFB3"><div class="form-container poll-container">', $html );
		$this->assertContains( "[poll id='4']", $GLOBALS['rtgodam_stub']['shortcodes'] );
	}

	/**
	 * Form providers render their shortcode, with the same classes the template printed.
	 *
	 * @dataProvider shortcode_providers
	 *
	 * @param array  $layer       Saved layer.
	 * @param string $shortcode   Shortcode the provider renders.
	 * @param string $layer_class Classes on the layer container.
	 * @param string $form_class  Classes on `.form-container`.
	 */
	public function test_renders_a_form_through_its_provider( array $layer, string $shortcode, string $layer_class, string $form_class ): void {
		$html = godam_render_layer(
			array_merge(
				array(
					'id'   => 'f1',
					'type' => 'form',
				),
				$layer 
			),
			'video_1' 
		);

		$this->assertStringStartsWith( '<div id="layer-video_1-f1" class="' . $layer_class . '" style="background-color: #FFFFFFB3"><div class="' . $form_class . '">', $html );
		$this->assertSame( $shortcode, end( $GLOBALS['rtgodam_stub']['shortcodes'] ) );
	}

	/**
	 * Saved form layers and what they render.
	 *
	 * @return array
	 */
	public function shortcode_providers(): array {
		return array(
			'gravity, theme'        => array(
				array(
					'gf_id' => '3',
					'theme' => 'orbital',
				),
				"[gravityform id='3' title='false' description='false' ajax='true' theme='orbital']",
				'easydam-layer hidden',
				'form-container',
			),
			'no form_type'          => array( array( 'gf_id' => '3' ), "[gravityform id='3' title='false' description='false' ajax='true']", 'easydam-layer hidden', 'form-container' ),
			// The theme is reduced to a slug before it goes into the shortcode (#2246).
			'gravity, unsafe theme' => array(
				array(
					'gf_id' => '3',
					'theme' => "Orbital' ajax='false",
				),
				"[gravityform id='3' title='false' description='false' ajax='true' theme='orbitalajaxfalse']",
				'easydam-layer hidden',
				'form-container',
			),
			'cf7, godam theme'      => array(
				array(
					'form_type' => 'cf7',
					'cf7_id'    => '9',
				),
				"[contact-form-7 id='9' title='false' ajax='true']",
				'easydam-layer hidden',
				'form-container rtgodam-wpcf7-form',
			),
			'cf7, plugin theme'     => array(
				array(
					'form_type' => 'cf7',
					'cf7_id'    => '9',
					'theme'     => 'default',
				),
				"[contact-form-7 id='9' title='false' ajax='true']",
				'easydam-layer hidden',
				'form-container',
			),
			'wpforms'               => array(
				array(
					'form_type' => 'wpforms',
					'wpform_id' => '5',
				),
				"[wpforms id='5' title='false' description='false' ajax='true']",
				'easydam-layer hidden',
				'form-container',
			),
			'sureforms'             => array(
				array(
					'form_type'   => 'sureforms',
					'sureform_id' => '5',
				),
				"[sureforms id='5']",
				'easydam-layer hidden',
				'form-container',
			),
			'forminator'            => array(
				array(
					'form_type'     => 'forminator',
					'forminator_id' => '5',
				),
				"[forminator_form id='5']",
				'easydam-layer hidden',
				'form-container',
			),
			'fluentforms'           => array(
				array(
					'form_type'      => 'fluentforms',
					'fluent_form_id' => '5',
				),
				"[fluentform id='5']",
				'easydam-layer hidden',
				'form-container',
			),
			'everestforms'          => array(
				array(
					'form_type'       => 'everestforms',
					'everest_form_id' => '5',
				),
				"[everest_form id='5' title='false' description='false']",
				'easydam-layer hidden',
				'form-container everest-form',
			),
			'ninjaforms'            => array(
				array(
					'form_type'     => 'ninjaforms',
					'ninja_form_id' => '5',
				),
				"[ninja_form id='5']",
				'easydam-layer hidden ninjaforms',
				'form-container',
			),
			'metform'               => array(
				array(
					'form_type'  => 'metform',
					'metform_id' => '5',
				),
				"[metform form_id='5']",
				'easydam-layer hidden metform',
				'form-container',
			),
		);
	}

	/**
	 * A form layer with no form picked, or a provider nobody registered, renders nothing.
	 */
	public function test_renders_no_form_layer_without_a_form_or_provider(): void {
		$this->assertSame(
			'',
			godam_render_layer(
				array(
					'id'        => 'f1',
					'type'      => 'form',
					'form_type' => 'wpforms',
				),
				'video_1'
			)
		);
		$this->assertSame(
			'',
			godam_render_layer(
				array(
					'id'        => 'f1',
					'type'      => 'form',
					'form_type' => 'mystery',
					'form_id'   => 2,
				),
				'video_1'
			)
		);
	}

	/**
	 * An add-on form provider renders inside the standard layer container.
	 */
	public function test_renders_an_add_on_form_provider(): void {
		godam_register_layer_variation(
			'form',
			array(
				'name'            => 'acme',
				'render_callback' => function ( $layer ) {
					return '<form data-acme="' . esc_attr( $layer['acme_id'] ) . '"></form>';
				},
			)
		);

		$this->assertSame(
			'<div id="layer-video_1-f1" class="easydam-layer hidden" style="background-color: #FFFFFFB3"><form data-acme="7"></form></div>',
			godam_render_layer(
				array(
					'id'        => 'f1',
					'type'      => 'form',
					'form_type' => 'acme',
					'acme_id'   => 7,
				),
				'video_1'
			)
		);
	}

	/**
	 * The ad tag is requested for layers whose type supports `adTag`, and typeless layers don't warn.
	 */
	public function test_finds_ad_layers_by_support(): void {
		$ad = array(
			'id'   => 'a1',
			'type' => 'ad',
		);

		$this->assertSame( array( $ad ), $this->registry()->filter_layers_by_support( array( array( 'id' => 'x' ), 'junk', $ad, array( 'type' => 'cta' ) ), 'adTag' ) );
		$this->assertSame( '', godam_render_layer( $ad, 'video_1' ) );
	}

	/**
	 * An add-on that registers `woo` itself takes over from the legacy registration.
	 */
	public function test_lets_an_add_on_register_woo_itself(): void {
		Layer_Type_Registry::get_instance()->reset();
		\RTGODAM\Inc\Layers\Core_Layer_Types::get_instance()->register( RTGODAM_PATH . 'assets/src/layers' );
		godam_register_layer_type(
			array(
				'name'  => 'woo',
				'title' => 'WooCommerce (add-on)',
			)
		);
		\RTGODAM\Inc\Layers\Legacy_Layer_Types::register();

		$this->assertSame( 'WooCommerce (add-on)', godam_get_layer_type( 'woo' )['title'] );
		$this->assertArrayNotHasKey( 'doing_it_wrong', $GLOBALS['rtgodam_stub'] );
	}

	/**
	 * The legacy Woo type renders through the add-on's action.
	 */
	public function test_renders_the_legacy_woo_layer_through_the_add_on_action(): void {
		add_action(
			'godam_player_render_layer',
			function ( $layer ) {
				echo '<div class="woo-layer">' . esc_attr( $layer['id'] ) . '</div>';
			}
		);

		$this->assertSame(
			'<div class="woo-layer">w1</div>',
			godam_render_layer(
				array(
					'id'   => 'w1',
					'type' => 'woo',
				),
				'video_1'
			)
		);
	}
}
