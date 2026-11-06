<?php
/**
 * The Form layer type: a form from one of the supported form plugins over the video.
 *
 * Registered like an add-on's layer type, from this folder's layer.json, with
 * one variation per form plugin (`class-form-providers.php`), selected by `form_type`.
 * Built to `assets/build/layers/form/`, where GoDAM loads it from.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Layers\Core;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Layers\Form_Providers;

require_once __DIR__ . '/class-form-providers.php';

/**
 * Register the Form layer type and the core form providers.
 *
 * @return void
 */
function register_form() {
	godam_register_layer_type(
		__DIR__ . '/layer.json',
		array(
			'variationAttribute'         => 'form_type',
			'render_callback'            => array( Form_Providers::class, 'render' ),
			'variations'                 => Form_Providers::get_providers(),
			// Form plugins print forms, inputs and scripts, which wp_kses_post() strips.
			'supports'                   => array( 'rawHtml' => true ),
			// Each provider saves its form ID under its own key.
			'keep_undeclared_attributes' => true,
		)
	);
}
