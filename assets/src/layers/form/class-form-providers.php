<?php
/**
 * Layer API: the form plugins GoDAM supports, as variations of the Form layer type (#2295).
 *
 * Each provider's PHP part: how it renders its form inside the layer
 * (`render_callback`, returning the inner markup or '' to print no layer), and
 * whether its plugin is active (`is_available`, reported to the player as
 * `godamPluginDependencies[ dependency_key ]`). The markup is what
 * `inc/templates/godam-player.php` used to print in its form `if/elseif` chain.
 * Loaded by `form.php` (it lives with the Form layer, outside the autoloader).
 *
 * An add-on adds a provider with
 * `godam_register_layer_variation( 'form', array( 'name' => …, 'render_callback' => … ) )`.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Layers;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Assets\Hubspot_Form_Assets;
use RTGODAM\Inc\Assets\Jetpack_Form_Assets;
use RTGODAM\Inc\Assets\Marketo_Form_Assets;
use RTGODAM\Inc\Hubspot;
use RTGODAM\Inc\Marketo;
use RTGODAM\Inc\REST_API\Jetpack;

/**
 * Class Form_Providers
 */
class Form_Providers {

	/**
	 * The core providers, in the editor's submenu order.
	 *
	 * @return array Variations.
	 */
	public static function get_providers() {
		return array(
			self::shortcode_provider( 'gravity', 'Gravity Forms', 'gravityforms', array( 'gravityforms/gravityforms.php' ), 'gf_id', array( self::class, 'render_gravity' ) ),
			self::shortcode_provider( 'wpforms', 'WPForms', 'wpforms', array( 'wpforms-lite/wpforms.php', 'wpforms/wpforms.php' ), 'wpform_id', "[wpforms id='%d' title='false' description='false' ajax='true']" ),
			self::shortcode_provider( 'cf7', 'Contact Form 7', 'cf7', array( 'contact-form-7/wp-contact-form-7.php' ), 'cf7_id', array( self::class, 'render_cf7' ) ),
			array(
				'name'            => 'jetpack',
				'title'           => 'Jetpack Forms',
				'dependency_key'  => 'jetpack',
				'is_available'    => self::plugin_check( array( 'jetpack/jetpack.php' ) ),
				'render_callback' => array( self::class, 'render_jetpack' ),
			),
			self::shortcode_provider( 'sureforms', 'SureForms', 'sureforms', array( 'sureforms/sureforms.php' ), 'sureform_id', "[sureforms id='%d']" ),
			self::shortcode_provider( 'forminator', 'Forminator Forms', 'forminator', array( 'forminator/forminator.php' ), 'forminator_id', "[forminator_form id='%d']" ),
			self::shortcode_provider( 'fluentforms', 'Fluent Forms', 'fluentForms', array( 'fluentform/fluentform.php' ), 'fluent_form_id', "[fluentform id='%d']" ),
			self::shortcode_provider( 'everestforms', 'Everest Forms', 'everestForms', array( 'everest-forms/everest-forms.php' ), 'everest_form_id', "[everest_form id='%d' title='false' description='false']", 'everest-form' ),
			self::shortcode_provider( 'ninjaforms', 'Ninja Forms', 'ninjaForms', array( 'ninja-forms/ninja-forms.php' ), 'ninja_form_id', "[ninja_form id='%d']", '', 'ninjaforms' ),
			self::shortcode_provider( 'metform', 'MetForm', 'metform', array( 'metform/metform.php' ), 'metform_id', "[metform form_id='%d']", '', 'metform' ),
			array(
				'name'            => 'marketo',
				'title'           => 'Marketo',
				'dependency_key'  => 'marketo',
				'container_class' => 'marketo',
				// Marketo has no WP plugin; it is available when enabled and connected on GoDAM Central.
				'is_available'    => array( Marketo::class, 'is_configured' ),
				'render_callback' => array( self::class, 'render_marketo' ),
			),
			array(
				'name'            => 'hubspot',
				'title'           => 'HubSpot',
				'dependency_key'  => 'hubspot',
				'container_class' => 'hubspot',
				// Available when enabled and the chosen source (GoDAM Central or the HubSpot plugin) is connected.
				'is_available'    => array( Hubspot::class, 'is_configured' ),
				'render_callback' => array( self::class, 'render_hubspot' ),
			),
		);
	}

	/**
	 * The Form type's `render_callback`: the layer's provider renders its form.
	 *
	 * @param array  $layer       Saved layer.
	 * @param string $instance_id Player instance id.
	 * @param array  $context     Render context.
	 * @return string Markup, or '' when the provider renders nothing.
	 */
	public static function render( $layer, $instance_id, $context = array() ) {
		$registry = Layer_Type_Registry::get_instance();
		$provider = $registry->get_layer_variation( $registry->get( 'form' ), $layer );

		if ( null === $provider || empty( $provider['render_callback'] ) || ! is_callable( $provider['render_callback'] ) ) {
			return '';
		}

		$inner = (string) call_user_func( $provider['render_callback'], $layer, $instance_id, $context );
		if ( '' === $inner ) {
			return '';
		}

		return Core_Layer_Types::container( $layer, $instance_id, $inner, array( 'class' => $provider['container_class'] ?? '' ) );
	}

	/**
	 * A provider that renders the form through the plugin's shortcode.
	 *
	 * @param string          $name           Provider name (`form_type`).
	 * @param string          $title          Label.
	 * @param string          $dependency_key `godamPluginDependencies` key.
	 * @param array           $plugins        Plugin basenames; any active one makes it available.
	 * @param string          $id_field       Layer attribute holding the form ID.
	 * @param string|callable $shortcode      `sprintf()` pattern taking the form ID, or a render callback.
	 * @param string          $form_class     Extra class on `.form-container`.
	 * @param string          $layer_class    Extra class on the layer container.
	 * @return array The variation.
	 */
	private static function shortcode_provider( $name, $title, $dependency_key, $plugins, $id_field, $shortcode, $form_class = '', $layer_class = '' ) {
		return array(
			'name'            => $name,
			'title'           => $title,
			'id_field'        => $id_field,
			'dependency_key'  => $dependency_key,
			'container_class' => $layer_class,
			'is_available'    => self::plugin_check( $plugins ),
			'render_callback' => is_callable( $shortcode )
				? $shortcode
				: function ( $layer ) use ( $id_field, $shortcode, $form_class ) {
					if ( empty( $layer[ $id_field ] ) ) {
						return '';
					}
					return self::form_container( do_shortcode( sprintf( $shortcode, intval( $layer[ $id_field ] ) ) ), $form_class );
				},
		);
	}

	/**
	 * `is_available` for providers backed by a WordPress plugin.
	 *
	 * @param array $plugins Plugin basenames.
	 * @return callable
	 */
	private static function plugin_check( $plugins ) {
		return function () use ( $plugins ) {
			foreach ( $plugins as $plugin ) {
				if ( Core_Layer_Types::is_plugin_active( $plugin ) ) {
					return true;
				}
			}
			return false;
		};
	}

	/**
	 * Wrap a form in `.form-container`.
	 *
	 * @param string $html    Form markup (from the plugin).
	 * @param string $classes Extra classes.
	 * @param string $attrs   Extra attributes (already escaped).
	 * @return string Markup.
	 */
	private static function form_container( $html, $classes = '', $attrs = '' ) {
		return sprintf( '<div class="%1$s"%2$s>%3$s</div>', esc_attr( trim( 'form-container ' . $classes ) ), $attrs, $html );
	}

	/**
	 * Gravity Forms, with the layer's theme.
	 *
	 * @param array $layer Saved layer.
	 * @return string Markup.
	 */
	public static function render_gravity( $layer ) {
		if ( empty( $layer['gf_id'] ) ) {
			return '';
		}
		// The theme is reduced to a slug before it goes into the shortcode.
		return self::form_container( do_shortcode( rtgodam_get_gravityform_layer_shortcode( $layer ) ) );
	}

	/**
	 * Contact Form 7, styled by GoDAM unless the layer picks the plugin's theme.
	 *
	 * @param array $layer Saved layer.
	 * @return string Markup.
	 */
	public static function render_cf7( $layer ) {
		if ( empty( $layer['cf7_id'] ) ) {
			return '';
		}
		$theme = ! empty( $layer['theme'] ) ? $layer['theme'] : 'godam';
		return self::form_container(
			do_shortcode( sprintf( "[contact-form-7 id='%d' title='false' ajax='true']", intval( $layer['cf7_id'] ) ) ),
			'godam' === $theme ? 'rtgodam-wpcf7-form' : ''
		);
	}

	/**
	 * Jetpack Forms: the form block's rendered HTML.
	 *
	 * @param array $layer Saved layer.
	 * @return string Markup.
	 */
	public static function render_jetpack( $layer ) {
		if ( empty( $layer['jp_id'] ) ) {
			return '';
		}

		// Enqueue GoDAM's Jetpack form script only when a Jetpack form is on the page.
		Jetpack_Form_Assets::get_instance();

		$html = Jetpack::get_rendered_form_html_static( $layer['jp_id'] );
		if ( ! $html || is_wp_error( $html ) ) {
			return '';
		}

		$origin_post_id = isset( $layer['origin_post_id'] ) ? $layer['origin_post_id'] : '';
		return self::form_container(
			$html,
			'jetpack-form-container',
			! empty( $origin_post_id ) ? ' data-origin-post-id="' . esc_attr( $origin_post_id ) . '"' : ''
		);
	}

	/**
	 * Marketo: an empty form node the forms2 library fills on the front end.
	 *
	 * Skipped unless Marketo is connected and enabled, so a disconnected
	 * Marketo never shows an empty overlay on the video.
	 *
	 * @param array  $layer       Saved layer.
	 * @param string $instance_id Player instance id.
	 * @return string Markup.
	 */
	public static function render_marketo( $layer, $instance_id ) {
		if ( empty( $layer['marketo_id'] ) || ! Marketo::is_configured() ) {
			return '';
		}

		// Load the forms2 library only when a Marketo layer is on the page.
		Marketo_Form_Assets::get_instance();

		// A unique id per node plus the form id in a data attribute: two layers
		// with the same Marketo form never share a `mktoForm_<id>` element
		// (marketo-form.js loads them one at a time).
		return self::form_container(
			sprintf(
				'<form id="%1$s" data-marketo-form-id="%2$s"></form>',
				esc_attr( 'godam-mkto-' . $instance_id . '-' . ( $layer['id'] ?? '' ) ),
				esc_attr( intval( $layer['marketo_id'] ) )
			),
			'marketo-form-container'
		);
	}

	/**
	 * HubSpot: through GoDAM Central (an empty node HubSpot's forms library
	 * fills) or the HubSpot plugin's `[hubspot]` shortcode, whichever source
	 * the admin picked and connected.
	 *
	 * @param array $layer Saved layer.
	 * @return string Markup.
	 */
	public static function render_hubspot( $layer ) {
		// A HubSpot form GUID, or the numeric id the HubSpot plugin also accepts.
		// Rejects anything else, including a `]` that would close the shortcode
		// early (esc_attr does not escape it).
		$form_id = isset( $layer['hubspot_id'] ) ? (string) $layer['hubspot_id'] : '';
		if ( ! preg_match( '/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i', $form_id ) || ! Hubspot::is_configured() ) {
			return '';
		}

		$source = Hubspot::get_active_source();

		if ( 'central' === $source ) {
			// The `hubspotutk` cookie that ties a submission to a contact comes
			// from HubSpot's tracking code, injected separately by Map_Tracker.
			Hubspot_Form_Assets::get_instance();
			return sprintf(
				'<div class="form-container hubspot-form" data-portal-id="%1$s" data-form-id="%2$s" data-region="%3$s"></div>',
				esc_attr( Hubspot::get_effective_portal_id() ),
				esc_attr( $form_id ),
				esc_attr( Hubspot::get_effective_region() )
			);
		}

		if ( 'leadin' === $source && shortcode_exists( 'hubspot' ) ) {
			// The portal ID comes from the connected plugin, never the layer.
			$portal_id = get_option( 'leadin_portalId', '' );
			if ( ! empty( $portal_id ) ) {
				return self::form_container(
					do_shortcode( sprintf( "[hubspot type='form' portal='%s' id='%s']", esc_attr( $portal_id ), esc_attr( $form_id ) ) )
				);
			}
		}

		return '';
	}
}
