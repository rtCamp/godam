<?php
/**
 * Layer API: public PHP functions (#2295).
 *
 * Register a layer type from an add-on:
 *
 *     add_action( 'godam_init', function () {
 *         godam_register_layer_type( __DIR__ . '/layer.json', array(
 *             'render_callback' => function ( $layer, $instance_id, $context ) {
 *                 return sprintf( '<div id="%s" class="easydam-layer hidden"></div>', esc_attr( "layer-{$instance_id}-{$layer['id']}" ) );
 *             },
 *         ) );
 *     } );
 *
 * @package GoDAM
 */

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Layers\Layer_Type_Registry;

/**
 * Register a layer type. Call it on the `godam_init` action.
 *
 * @since n.e.x.t
 *
 * @param string|array $path_or_metadata Path to a `layer.json` (or its folder), or the metadata array.
 * @param array        $args             `render_callback`, `is_available`, `should_render`, `variations`.
 * @return array|false The registered type, or false when it was rejected.
 */
function godam_register_layer_type( $path_or_metadata, $args = array() ) {
	return Layer_Type_Registry::get_instance()->register( $path_or_metadata, $args );
}

/**
 * Remove a layer type.
 *
 * @since n.e.x.t
 *
 * @param string $name Layer type name.
 * @return array|false The removed type, or false.
 */
function godam_unregister_layer_type( $name ) {
	return Layer_Type_Registry::get_instance()->unregister( $name );
}

/**
 * A registered layer type.
 *
 * @since n.e.x.t
 *
 * @param string $name Layer type name.
 * @return array|null The type.
 */
function godam_get_layer_type( $name ) {
	return Layer_Type_Registry::get_instance()->get( $name );
}

/**
 * Add a variation to a layer type, e.g. a form provider to `form`.
 *
 * @since n.e.x.t
 *
 * @param string $name      Layer type name.
 * @param array  $variation `name`, `title`, `render_callback`, `is_available`, `dependency_key`.
 * @return array|false The variation, or false when it was rejected.
 */
function godam_register_layer_variation( $name, $variation ) {
	return Layer_Type_Registry::get_instance()->register_variation( $name, $variation );
}

/**
 * The container markup for one saved layer.
 *
 * @since n.e.x.t
 *
 * @param array  $layer       Saved layer.
 * @param string $instance_id Player instance id.
 * @param array  $context     `{ media: 'video' | 'image' }`.
 * @return string The markup.
 */
function godam_render_layer( $layer, $instance_id, $context = array() ) {
	return Layer_Type_Registry::get_instance()->render( $layer, $instance_id, $context );
}
