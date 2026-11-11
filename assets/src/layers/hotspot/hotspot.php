<?php
/**
 * The Hotspot layer type: clickable points over a video or an image.
 *
 * Registered like an add-on's layer type, from this folder's layer.json.
 * Built to `assets/build/layers/hotspot/`, where GoDAM loads it from.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Layers\Core;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Layers\Core_Layer_Types;

/**
 * Register the Hotspot layer type.
 *
 * @return void
 */
function register_hotspot() {
	godam_register_layer_type(
		Core_Layer_Types::get_layers_dir() . '/hotspot/layer.json',
		array(
			'render_callback'            => __NAMESPACE__ . '\\render_hotspot',
			// The image block skips a hotspot layer with nothing to draw.
			'should_render'              => __NAMESPACE__ . '\\has_hotspots',
			'supports'                   => array( 'rawHtml' => true ),
			'keep_undeclared_attributes' => true,
		)
	);
}

/**
 * The Hotspot layer's container: empty, the view script draws the hotspots.
 *
 * @param array  $layer       Saved layer.
 * @param string $instance_id Player instance id.
 * @return string Markup.
 */
function render_hotspot( $layer, $instance_id ) {
	return Core_Layer_Types::container(
		$layer,
		$instance_id,
		'',
		array(
			'class'            => 'hotspot-layer',
			'default_bg_color' => false,
		)
	);
}

/**
 * Whether a hotspot layer has any hotspot to draw.
 *
 * @param array $layer Saved layer.
 * @return bool
 */
function has_hotspots( $layer ) {
	return ! empty( $layer['hotspots'] );
}
