<?php
/**
 * Layer API: GoDAM's core layer types, registered through the same API as add-ons (#2295).
 *
 * Each type reads its `layer.json` from `assets/src/layers/<type>/` and adds
 * its PHP part: the container it prints in the player (`render_callback`) and
 * whether it can run here (`is_available`). The markup is what
 * `inc/templates/godam-player.php` used to print inline.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Layers;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Core_Layer_Types
 */
class Core_Layer_Types {

	use Singleton;

	/**
	 * Register on `godam_init`, before add-ons (priority 10).
	 */
	final protected function __construct() {
		add_action( 'godam_init', array( $this, 'register' ), 5 );
		// After add-ons (priority 10), so an add-on that registers its own type wins.
		add_action( 'godam_init', array( Legacy_Layer_Types::class, 'register' ), 100 );
	}

	/**
	 * Register the core types. Skips any type something already registered.
	 *
	 * @return void
	 */
	public function register() {
		$registry = Layer_Type_Registry::get_instance();
		$types    = array(
			'cta'     => array( 'render_callback' => array( $this, 'render_cta' ) ),
			'form'    => array(
				'variationAttribute' => 'form_type',
				'render_callback'    => array( Form_Providers::class, 'render' ),
				'variations'         => Form_Providers::get_providers(),
			),
			'poll'    => array(
				'render_callback' => array( $this, 'render_poll' ),
				'is_available'    => array( self::class, 'is_wp_polls_active' ),
				'dependency_key'  => 'wpPolls',
			),
			'hotspot' => array(
				'render_callback' => array( $this, 'render_hotspot' ),
				'should_render'   => array( $this, 'has_hotspots' ),
			),
			// Ads play through the ad tag (IMA), so an ad layer prints no
			// container; `adTag` tells the player template to request one.
			'ad'      => array( 'supports' => array( 'adTag' => true ) ),
		);

		foreach ( $types as $name => $args ) {
			if ( null !== $registry->get( $name ) ) {
				continue;
			}
			// Core callbacks escape their own output, which includes the form
			// plugins' markup (forms, inputs, scripts) that wp_kses_post() strips.
			$args['supports'] = array_merge( array( 'rawHtml' => true ), $args['supports'] ?? array() );
			// Their layer.json files don't list every attribute they save yet, so
			// saving cleans declared attributes and keeps the rest (see Layer_Sanitizer).
			$args['keep_undeclared_attributes'] = true;
			$registry->register( RTGODAM_PATH . 'assets/src/layers/' . $name . '/layer.json', $args );
		}
	}

	/**
	 * The `<div id="layer-…" class="easydam-layer hidden">` every player layer sits in.
	 *
	 * @param array  $layer       Saved layer.
	 * @param string $instance_id Player instance id.
	 * @param string $inner_html  Markup inside the container (already escaped).
	 * @param array  $args        {
	 *     Optional.
	 *
	 *     @type string $class            Extra classes.
	 *     @type bool   $default_bg_color Use the default background when the layer sets none. Default true.
	 * }
	 * @return string The container.
	 */
	public static function container( $layer, $instance_id, $inner_html, $args = array() ) {
		$args     = array_merge(
			array(
				'class'            => '',
				'default_bg_color' => true,
			),
			$args
		);
		$bg_color = ! empty( $layer['bg_color'] ) ? $layer['bg_color'] : ( $args['default_bg_color'] ? '#FFFFFFB3' : '' );

		return sprintf(
			'<div id="%1$s" class="%2$s"%3$s>%4$s</div>',
			esc_attr( 'layer-' . $instance_id . '-' . ( $layer['id'] ?? '' ) ),
			esc_attr( trim( 'easydam-layer hidden ' . $args['class'] ) ),
			'' !== $bg_color ? ' style="' . esc_attr( 'background-color: ' . $bg_color ) . '"' : '',
			$inner_html
		);
	}

	/**
	 * CTA layer: an HTML CTA or a card (image) CTA.
	 *
	 * Only HTML and card CTAs are supported. Legacy "text" CTAs (and any other
	 * type) render nothing: an empty box would pause playback with no content,
	 * and the player skips a layer whose element is missing.
	 *
	 * @param array  $layer       Saved layer.
	 * @param string $instance_id Player instance id.
	 * @return string Markup.
	 */
	public function render_cta( $layer, $instance_id ) {
		$cta_type = $layer['cta_type'] ?? '';

		if ( 'html' === $cta_type && ! empty( $layer['html'] ) ) {
			$cta_html = do_shortcode( $layer['html'] );

			/**
			 * Filters the rendered CTA HTML content for a video layer, after
			 * shortcode expansion and before final sanitization.
			 *
			 * @since 2.2.0
			 *
			 * @param string $cta_html The CTA HTML content after shortcode expansion.
			 * @param array  $layer    The layer configuration array.
			 */
			$cta_html = apply_filters( 'rtgodam_cta_html_content', $cta_html, $layer );

			return self::container( $layer, $instance_id, '<div class="easydam-layer--cta-html">' . wp_kses_post( $cta_html ) . '</div>' );
		}

		if ( 'image' === $cta_type && function_exists( 'rtgodam_image_cta_html' ) ) {
			return self::container( $layer, $instance_id, wp_kses_post( rtgodam_image_cta_html( $layer ) ) );
		}

		return '';
	}

	/**
	 * Poll layer: a WP-Polls poll.
	 *
	 * @param array  $layer       Saved layer.
	 * @param string $instance_id Player instance id.
	 * @return string Markup.
	 */
	public function render_poll( $layer, $instance_id ) {
		$poll_id = ! empty( $layer['poll_id'] ) ? intval( $layer['poll_id'] ) : 0;
		return self::container(
			$layer,
			$instance_id,
			'<div class="form-container poll-container">' . do_shortcode( "[poll id='$poll_id']" ) . '</div>'
		);
	}

	/**
	 * Hotspot layer: an empty container the player fills.
	 *
	 * @param array  $layer       Saved layer.
	 * @param string $instance_id Player instance id.
	 * @return string Markup.
	 */
	public function render_hotspot( $layer, $instance_id ) {
		return self::container(
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
	 * Whether a hotspot layer has any hotspot to draw (the image block skips one that doesn't).
	 *
	 * @param array $layer Saved layer.
	 * @return bool
	 */
	public function has_hotspots( $layer ) {
		return ! empty( $layer['hotspots'] );
	}

	/**
	 * Whether WP-Polls is active.
	 *
	 * @return bool
	 */
	public static function is_wp_polls_active() {
		return self::is_plugin_active( 'wp-polls/wp-polls.php' );
	}

	/**
	 * `is_plugin_active()`, loading it outside the admin.
	 *
	 * @param string $plugin Plugin basename.
	 * @return bool
	 */
	public static function is_plugin_active( $plugin ) {
		if ( ! function_exists( 'is_plugin_active' ) ) {
			include_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
		return is_plugin_active( $plugin );
	}
}
