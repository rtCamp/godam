<?php
/**
 * The Poll layer type: a WP-Polls poll over the video.
 *
 * Registered like an add-on's layer type, from this folder's layer.json.
 * Built to `assets/build/layers/poll/`, where GoDAM loads it from.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Layers\Core;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Layers\Core_Layer_Types;

/**
 * Register the Poll layer type.
 *
 * @return void
 */
function register_poll() {
	godam_register_layer_type(
		__DIR__ . '/layer.json',
		array(
			'render_callback'            => __NAMESPACE__ . '\\render_poll',
			'is_available'               => __NAMESPACE__ . '\\is_wp_polls_active',
			'dependency_key'             => 'wpPolls',
			// WP-Polls prints a form, which wp_kses_post() would strip.
			'supports'                   => array( 'rawHtml' => true ),
			'keep_undeclared_attributes' => true,
		)
	);
}

/**
 * The Poll layer's container: WP-Polls' shortcode.
 *
 * @param array  $layer       Saved layer.
 * @param string $instance_id Player instance id.
 * @return string Markup.
 */
function render_poll( $layer, $instance_id ) {
	$poll_id = ! empty( $layer['poll_id'] ) ? intval( $layer['poll_id'] ) : 0;
	return Core_Layer_Types::container(
		$layer,
		$instance_id,
		'<div class="form-container poll-container">' . do_shortcode( "[poll id='$poll_id']" ) . '</div>'
	);
}

/**
 * Whether WP-Polls is active.
 *
 * @return bool
 */
function is_wp_polls_active() {
	return Core_Layer_Types::is_plugin_active( 'wp-polls/wp-polls.php' );
}
