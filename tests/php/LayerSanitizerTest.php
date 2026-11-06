<?php
/**
 * Layer API (#2295, RFC D3): saved layers are cleaned against their type's declared attributes.
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
class LayerSanitizerTest extends TestCase {

	/**
	 * Core types, plus a strict add-on type.
	 */
	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['rtgodam_hooks'] = array();
		$GLOBALS['rtgodam_stub']  = array( 'kses_strip_disallowed' => true );
		rtgodam_test_register_core_layer_types();

		godam_register_layer_type(
			array(
				'name'       => 'acme/countdown',
				'attributes' => array(
					'label'    => array(
						'type'    => 'string',
						'default' => '',
					),
					'seconds'  => array(
						'type'    => 'integer',
						'default' => 10,
					),
					'loop'     => array( 'type' => 'boolean' ),
					'link'     => array(
						'type'   => 'string',
						'format' => 'url',
					),
					'note'     => array(
						'type'   => 'string',
						'format' => 'html',
					),
					'accent'   => array(
						'type'    => 'string',
						'format'  => 'color',
						'default' => '#000',
					),
					'items'    => array( 'type' => 'array' ),
					'iconId'   => array( 'type' => array( 'integer', 'null' ) ),
					'duration' => array( 'default' => 3 ),
				),
			)
		);
	}

	/**
	 * Clean one layer.
	 *
	 * @param array $layer Saved layer.
	 * @return mixed
	 */
	private function clean( $layer ) {
		return Layer_Type_Registry::get_instance()->sanitize_layers( array( $layer ) )[0];
	}

	/**
	 * An add-on type: declared attributes are sanitized and converted, undeclared keys dropped.
	 */
	public function test_cleans_an_add_on_layer_strictly(): void {
		$this->assertSame(
			array(
				'id'          => 'a1',
				'type'        => 'acme/countdown',
				'displayTime' => '4.5',
				'label'       => 'Sale ends',
				'seconds'     => 30,
				'loop'        => true,
				'link'        => 'https://example.com/sale',
				'note'        => '<b>Hi</b>alert(1)',
				'items'       => array( 1, 2 ),
				'iconId'      => null,
				'duration'    => 5,
				'allow_skip'  => false,
			),
			$this->clean(
				array(
					'id'          => 'a1',
					'type'        => 'acme/countdown',
					'displayTime' => '4.5',
					'label'       => "  <b>Sale</b>\tends ",
					'seconds'     => '30',
					'loop'        => 'true',
					'link'        => 'https://example.com/sale',
					'note'        => '<b>Hi</b><script>alert(1)</script>',
					'items'       => array( 1, 2 ),
					'iconId'      => 'abc',
					'duration'    => '5',
					'allow_skip'  => 0,
					'secretField' => 'dropped',
				)
			)
		);
	}

	/**
	 * A value of the wrong type falls back to the attribute's default, or is removed.
	 */
	public function test_replaces_wrong_types_with_the_default(): void {
		$clean = $this->clean(
			array(
				'type'    => 'acme/countdown',
				'label'   => array( 'not', 'a', 'string' ),
				'seconds' => 2.5,
				'accent'  => 'red; background: url(x)',
				'loop'    => 'maybe',
				'items'   => 'nope',
			)
		);

		$this->assertSame(
			array(
				'type'    => 'acme/countdown',
				'label'   => '',
				'seconds' => 10,
				'accent'  => '#000',
			),
			$clean
		);
	}

	/**
	 * Valid colors are kept.
	 */
	public function test_keeps_valid_colors(): void {
		foreach ( array( '#FFFFFFB3', '#abc', 'rgba(0, 0, 0, 0.5)', 'transparent' ) as $color ) {
			$this->assertSame(
				$color,
				$this->clean(
					array(
						'type'   => 'acme/countdown',
						'accent' => $color,
					)
				)['accent']
			);
		}
	}

	/**
	 * A color must be one plain colour: anything that would add CSS declarations
	 * where it is printed into a style attribute falls back to the default.
	 */
	public function test_rejects_colors_that_carry_extra_css(): void {
		foreach ( array( 'rgb(0);position:fixed;top:0;left:0;width:100%;height:100%)', 'red;background:url(x)', '#12345', 'hsl(var(--x))' ) as $color ) {
			$this->assertSame(
				'#000',
				$this->clean(
					array(
						'type'   => 'acme/countdown',
						'accent' => $color,
					)
				)['accent'],
				$color
			);
		}
	}

	/**
	 * Core types are lenient: declared values of the right type are sanitized, everything else
	 * (including HTML, which is escaped when it renders) is kept.
	 */
	public function test_keeps_undeclared_and_mismatched_values_on_core_layers(): void {
		$layer = array(
			'id'         => 'c1',
			'type'       => 'cta',
			'cta_type'   => 'html',
			'html'       => '<p>Buy</p><script>x()</script>',
			'link'       => 'https://example.com/buy',
			'imageText'  => 'Undeclared, kept',
			'bg_color'   => '#FFFFFFB3',
			'watchDepth' => 'not a number',
		);

		$this->assertSame(
			array(
				'id'         => 'c1',
				'type'       => 'cta',
				'cta_type'   => 'html',
				'html'       => '<p>Buy</p><script>x()</script>',
				'link'       => 'https://example.com/buy',
				'imageText'  => 'Undeclared, kept',
				'bg_color'   => '#FFFFFFB3',
				'watchDepth' => 'not a number',
			),
			$this->clean( $layer )
		);
	}

	/**
	 * A poll layer's numeric poll_id stays a number: lenient types don't convert.
	 */
	public function test_does_not_convert_core_values(): void {
		$this->assertSame(
			4,
			$this->clean(
				array(
					'type'    => 'poll',
					'poll_id' => 4,
				)
			)['poll_id']
		);
	}

	/**
	 * Layers of an unregistered type, typeless layers and junk entries are kept unchanged.
	 */
	public function test_keeps_unregistered_and_malformed_layers(): void {
		$layers = array(
			array(
				'type'  => 'acme/gone',
				'stuff' => '<script>kept</script>',
			),
			array( 'id' => 'no-type' ),
			'junk',
		);

		$this->assertSame( $layers, Layer_Type_Registry::get_instance()->sanitize_layers( $layers ) );
		$this->assertSame( 'not-a-list', Layer_Type_Registry::get_instance()->sanitize_layers( 'not-a-list' ) );
	}

	/**
	 * A variation can declare the attributes it adds, e.g. a form provider's ID field.
	 */
	public function test_uses_the_variation_attribute_schema(): void {
		godam_register_layer_type(
			array(
				'name'               => 'acme/form',
				'variationAttribute' => 'provider',
				'attributes'         => array( 'provider' => array( 'type' => 'string' ) ),
			)
		);
		godam_register_layer_variation(
			'acme/form',
			array(
				'name'            => 'acme',
				'attributeSchema' => array( 'acme_id' => array( 'type' => 'integer' ) ),
			)
		);

		$this->assertSame(
			array(
				'type'     => 'acme/form',
				'provider' => 'acme',
				'acme_id'  => 7,
			),
			$this->clean(
				array(
					'type'     => 'acme/form',
					'provider' => 'acme',
					'acme_id'  => '7',
					'other_id' => 9,
				)
			)
		);
	}

	/**
	 * Attributes marked private never reach the page.
	 */
	public function test_strips_private_attributes_for_the_page(): void {
		godam_register_layer_type( RTGODAM_PATH . 'tests/fixtures/layers/acme-countdown' );

		$this->assertSame(
			array(
				'id'    => 'a1',
				'type'  => 'acme/countdown-file',
				'label' => 'Hi',
			),
			Layer_Type_Registry::get_instance()->get_public_layer(
				array(
					'id'       => 'a1',
					'type'     => 'acme/countdown-file',
					'label'    => 'Hi',
					'apiToken' => 'secret',
				)
			)
		);
	}
}
