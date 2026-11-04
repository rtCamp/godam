<?php
/**
 * Layer API: layer types core used to hard-code for add-ons that predate the API (#2295).
 *
 * The godam-for-woo `woo` layer renders its player container through the
 * `godam_player_render_layer` action and was hard-coded into the
 * `godam/image` block. Registering it here keeps both working through the
 * registry until #2296 moves godam-for-woo to `godam_register_layer_type()`.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Layers;

defined( 'ABSPATH' ) || exit;

/**
 * Class Legacy_Layer_Types
 */
class Legacy_Layer_Types {

	/**
	 * Register the legacy types, unless an add-on already registered them.
	 *
	 * @return void
	 */
	public static function register() {
		$registry = Layer_Type_Registry::get_instance();
		if ( null !== $registry->get( 'woo' ) ) {
			return;
		}

		$registry->register(
			array(
				'apiVersion' => 1,
				'name'       => 'woo',
				'title'      => 'WooCommerce',
				'supports'   => array(
					'media'   => array( 'video', 'image' ),
					// The add-on escapes its own markup, as it did before.
					'rawHtml' => true,
				),
			),
			array(
				'render_callback'            => array( self::class, 'render_with_action' ),
				// Core has no schema for the add-on's attributes, so saving keeps them as they are.
				'keep_undeclared_attributes' => true,
				'should_render'              => function ( $layer ) {
					return ! empty( $layer['productHotspots'] );
				},
			)
		);
	}

	/**
	 * Render through the older `godam_player_render_layer` action.
	 *
	 * @param array  $layer       Saved layer.
	 * @param string $instance_id Player instance id.
	 * @return string Markup.
	 */
	public static function render_with_action( $layer, $instance_id ) {
		ob_start();
		/** This action is documented in inc/classes/layers/class-layer-type-registry.php */
		do_action( 'godam_player_render_layer', $layer, $instance_id );
		return (string) ob_get_clean();
	}
}
