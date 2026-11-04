<?php
/**
 * The Ad layer type: a video ad played through the ad tag (IMA).
 *
 * Registered like an add-on's layer type, from this folder's layer.json.
 * Built to `assets/build/layers/ad/`, where GoDAM loads it from. An ad layer
 * prints no container and has no view script: `supports.adTag` tells the
 * player template to request the ad tag instead.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Layers\Core;

defined( 'ABSPATH' ) || exit;

/**
 * Register the Ad layer type.
 *
 * @return void
 */
function register_ad() {
	godam_register_layer_type(
		__DIR__ . '/layer.json',
		array(
			'supports'                   => array(
				'adTag'   => true,
				'rawHtml' => true,
			),
			'keep_undeclared_attributes' => true,
		)
	);
}
