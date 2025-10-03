<?php
/**
 * Layers Class - Handles global video layer management.
 *
 * @package GoDAM.
 * @since   n.e.x.t.
 */

defined( 'ABSPATH' ) || exit;


/**
 * Class Layers.
 *
 * Supports multiple layer types: CTA (text, html, image), forms, and future extensions.
 *
 * @since n.e.x.t.
 */
class Layers {

	/**
	 * Placement constants for better maintainability.
	 */
	const PLACEMENT_START  = 'start';
	const PLACEMENT_MIDDLE = 'middle';
	const PLACEMENT_END    = 'end';

	/**
	 * Layer type constants.
	 */
	const LAYER_TYPE_CTA  = 'cta';
	const LAYER_TYPE_FORM = 'form';

	/**
	 * CTA type constants.
	 */
	const CTA_TYPE_TEXT  = 'text';
	const CTA_TYPE_HTML  = 'html';
	const CTA_TYPE_IMAGE = 'image';

	/**
	 * Default values for different layer types.
	 *
	 * @var array
	 */
	private static $defaults = array(
		'cta'  => array(
			'text'                => '',
			'html'                => '',
			'image'               => 0,
			'imageText'           => '',
			'imageLink'           => '',
			'imageDescription'    => '',
			'imageCtaOrientation' => 'landscape',
			'imageCtaButtonText'  => 'Buy Now',
		),
		'form' => array(
			'formId'     => '',
			'formTitle'  => '',
			'formFields' => array(),
		),
	);

	/**
	 * Calculate placement time based on placement setting and video duration.
	 *
	 * @param string $placement The placement setting ('start', 'middle', 'end').
	 * @param int    $video_duration The video duration in seconds.
	 * @return int The calculated display time in seconds.
	 */
	public static function get_placement_time( $placement, $video_duration = 0 ) {
		switch ( $placement ) {
			case self::PLACEMENT_START:
				return 0;

			case self::PLACEMENT_MIDDLE:
				return $video_duration > 0 ? intval( $video_duration / 2 ) : 5;

			case self::PLACEMENT_END:
				return $video_duration - 0.5;

			default:
				return 0;
		}
	}

	/**
	 * Merge layers with global settings.
	 *
	 * @param array $layers Existing layers array.
	 * @param array $global_settings Global settings.
	 * @param array $attachment_settings Attachment specific settings.
	 * @param int   $video_duration Video duration in seconds.
	 * @return array Merged layers array.
	 */
	public static function merge_layers( $layers, $global_settings, $attachment_settings, $video_duration ) {
		if ( ! is_array( $layers ) ) {
			$layers = array();
		}

		if ( ! is_array( $global_settings ) ) {
			return $layers;
		}

		$merged_layers = $layers;

		$existing_global_layers = self::get_existing_global_layers( $layers );

		// Remove global layers that are not disabled first.
		$merged_layers = self::remove_global_layers( $merged_layers, $existing_global_layers );

		// Process global layer.
		if ( isset( $global_settings['global_layers'] ) && is_array( $global_settings['global_layers'] ) ) {
			$global_layers = $global_settings['global_layers'];

			// Add CTA layer if configured.
			if ( isset( $global_layers['cta'] ) && is_array( $global_layers['cta'] ) ) {
				if ( ! self::should_skip_global_layer( 'cta', $existing_global_layers ) ) {
					$cta_layer = self::create_cta_layer( $global_layers['cta'], $video_duration );
					if ( ! empty( $cta_layer ) ) {
						$merged_layers[] = $cta_layer;
					}
				}
			}

			// Add form layer if configured.
			if ( isset( $global_layers['forms'] ) && is_array( $global_layers['forms'] ) ) {
				if ( ! self::should_skip_global_layer( 'form', $existing_global_layers ) ) {
					$form_layer = self::create_form_layer( $global_layers['forms'], $video_duration );
					if ( ! empty( $form_layer ) ) {
						$merged_layers[] = $form_layer;
					}
				}
			}
		}

		return $merged_layers;
	}

	/**
	 * Create CTA layer based on configuration.
	 *
	 * @param array $cta_config CTA layer configuration.
	 * @param int   $video_duration Video duration in seconds.
	 * @return array CTA layer data or empty array if disabled.
	 */
	public static function create_cta_layer( $cta_config, $video_duration ) {
		if ( ! is_array( $cta_config ) || empty( $cta_config['enabled'] ) ) {
			return array();
		}

		$cta_type  = isset( $cta_config['cta_type'] ) ? $cta_config['cta_type'] : self::CTA_TYPE_TEXT;
		$placement = isset( $cta_config['placement'] ) ? $cta_config['placement'] : self::PLACEMENT_START;

		$base_layer = array(
			'type'        => self::LAYER_TYPE_CTA,
			'cta_type'    => $cta_type,
			'id'          => 'global_' . self::LAYER_TYPE_CTA . '_' . $cta_type,
			'displayTime' => self::get_placement_time( $placement, $video_duration ),
		);

		return self::build_cta_layer_by_type( $base_layer, $cta_type, $cta_config );
	}

	/**
	 * Build CTA layer data based on type.
	 *
	 * @param array  $base_layer Base layer configuration.
	 * @param string $cta_type CTA type.
	 * @param array  $cta_config CTA configuration.
	 * @return array Complete CTA layer data.
	 */
	private static function build_cta_layer_by_type( $base_layer, $cta_type, $cta_config ) {
		$defaults = isset( self::$defaults['cta'] ) ? self::$defaults['cta'] : array();

		switch ( $cta_type ) {
			case self::CTA_TYPE_TEXT:
				return array_merge(
					$base_layer,
					array(
						'text' => isset( $cta_config['text'] ) ? $cta_config['text'] : ( isset( $defaults['text'] ) ? $defaults['text'] : '' ),
					)
				);

			case self::CTA_TYPE_HTML:
				return array_merge(
					$base_layer,
					array(
						'html' => isset( $cta_config['html'] ) ? $cta_config['html'] : ( isset( $defaults['html'] ) ? $defaults['html'] : '' ),
					)
				);

			case self::CTA_TYPE_IMAGE:
				return array_merge(
					$base_layer,
					array(
						'image'               => isset( $cta_config['image'] ) ? $cta_config['image'] : ( isset( $defaults['image'] ) ? $defaults['image'] : 0 ),
						'imageText'           => isset( $cta_config['imageText'] ) ? $cta_config['imageText'] : ( isset( $defaults['imageText'] ) ? $defaults['imageText'] : '' ),
						'imageLink'           => isset( $cta_config['imageLink'] ) ? $cta_config['imageLink'] : ( isset( $defaults['imageLink'] ) ? $defaults['imageLink'] : '' ),
						'imageDescription'    => isset( $cta_config['imageDescription'] ) ? $cta_config['imageDescription'] : ( isset( $defaults['imageDescription'] ) ? $defaults['imageDescription'] : '' ),
						'imageCtaOrientation' => isset( $cta_config['imageCtaOrientation'] ) ? $cta_config['imageCtaOrientation'] : ( isset( $defaults['imageCtaOrientation'] ) ? $defaults['imageCtaOrientation'] : 'landscape' ),
						'imageCtaButtonText'  => isset( $cta_config['imageCtaButtonText'] ) ? $cta_config['imageCtaButtonText'] : ( isset( $defaults['imageCtaButtonText'] ) ? $defaults['imageCtaButtonText'] : 'Buy Now' ),
					)
				);

			default:
				return $base_layer;
		}
	}

	/**
	 * Create form layer based on configuration.
	 *
	 * @param array $form_config Form layer configuration.
	 * @param int   $video_duration Video duration in seconds.
	 * @return array Form layer data or empty array if disabled.
	 */
	public static function create_form_layer( $form_config, $video_duration ) {
		if ( ! is_array( $form_config ) || empty( $form_config['enabled'] ) ) {
			return array();
		}

		$placement = isset( $form_config['placement'] ) ? $form_config['placement'] : self::PLACEMENT_START;
		$plugin    = isset( $form_config['plugin'] ) ? $form_config['plugin'] : 'gravity';

		$base_layer = array(
			'type'        => self::LAYER_TYPE_FORM,
			'id'          => 'global_' . self::LAYER_TYPE_FORM . '_' . $plugin,
			'displayTime' => self::get_placement_time( $placement, $video_duration ),
		);

		return self::build_form_layer_by_type( $base_layer, $plugin, $form_config );
	}

	/**
	 * Build form layer data based on type.
	 *
	 * @param array  $base_layer Base layer configuration.
	 * @param string $form_type Form type.
	 * @param array  $form_config Form configuration.
	 * @return array Complete form layer data.
	 */
	private static function build_form_layer_by_type( $base_layer, $form_type, $form_config ) {
		$defaults = isset( self::$defaults['form'] ) ? self::$defaults['form'] : array();

		switch ( $form_type ) {
			case 'gravity_forms':
				return array_merge(
					$base_layer,
					array(
						'form_type' => 'gravity',
						'gf_id'     => isset( $form_config['form_id'] ) ? $form_config['form_id'] : ( isset( $defaults['form_id'] ) ? $defaults['form_id'] : '' ),
					)
				);
			case 'wpforms':
				return array_merge(
					$base_layer,
					array(
						'form_type' => 'wpforms',
						'wpform_id' => isset( $form_config['form_id'] ) ? $form_config['form_id'] : ( isset( $defaults['form_id'] ) ? $defaults['form_id'] : '' ),
					)
				);
			case 'contact_form_7':
				return array_merge(
					$base_layer,
					array(
						'form_type' => 'cf7',
						'cf7_id'    => isset( $form_config['form_id'] ) ? $form_config['form_id'] : ( isset( $defaults['form_id'] ) ? $defaults['form_id'] : '' ),
					)
				);
			case 'sure_forms':
				return array_merge(
					$base_layer,
					array(
						'form_type'   => 'sureforms',
						'sureform_id' => isset( $form_config['form_id'] ) ? $form_config['form_id'] : ( isset( $defaults['form_id'] ) ? $defaults['form_id'] : '' ),
					)
				);
			case 'forminator':
				return array_merge(
					$base_layer,
					array(
						'form_type'     => 'forminator',
						'forminator_id' => isset( $form_config['form_id'] ) ? $form_config['form_id'] : ( isset( $defaults['form_id'] ) ? $defaults['form_id'] : '' ),
					)
				);
			case 'everest_forms':
				return array_merge(
					$base_layer,
					array(
						'form_type'       => 'everestforms',
						'everest_form_id' => isset( $form_config['form_id'] ) ? $form_config['form_id'] : ( isset( $defaults['form_id'] ) ? $defaults['form_id'] : '' ),
					)
				);
			case 'fluent_forms':
				return array_merge(
					$base_layer,
					array(
						'form_type'      => 'fluentforms',
						'fluent_form_id' => isset( $form_config['form_id'] ) ? $form_config['form_id'] : ( isset( $defaults['form_id'] ) ? $defaults['form_id'] : '' ),
					)
				);
			case 'ninja_forms':
				return array_merge(
					$base_layer,
					array(
						'form_type'     => 'ninjaforms',
						'ninja_form_id' => isset( $form_config['form_id'] ) ? $form_config['form_id'] : ( isset( $defaults['form_id'] ) ? $defaults['form_id'] : '' ),
					)
				);
			case 'metform':
				return array_merge(
					$base_layer,
					array(
						'form_type'  => 'metform',
						'metform_id' => isset( $form_config['form_id'] ) ? $form_config['form_id'] : ( isset( $defaults['form_id'] ) ? $defaults['form_id'] : '' ),
					)
				);

			// Future form types can be added here.

			default:
				return $base_layer;
		}
	}

	/**
	 * Get default configuration for a layer type.
	 *
	 * @param string $layer_type Layer type.
	 * @return array Default configuration.
	 */
	public static function get_default_config( $layer_type ) {
		return isset( self::$defaults[ $layer_type ] ) ? self::$defaults[ $layer_type ] : array();
	}

	/**
	 * Get existing global layers from the layers array
	 *
	 * @param array $layers Existing layers array.
	 * @return array Array with information about existing global layers.
	 */
	private static function get_existing_global_layers( $layers ) {
		$existing = array();

		foreach ( $layers as $layer ) {
			if ( ! is_array( $layer ) ) {
				continue;
			}

			$layer_type = isset( $layer['type'] ) ? $layer['type'] : '';
			if ( ! $layer_type ) {
				continue;
			}

			$is_global_layer     = isset( $layer['isGlobalLayer'] ) && $layer['isGlobalLayer'];
			$has_global_metadata = isset( $layer['globalLayerSource'] ) || isset( $layer['globalLayerConfig'] );
			$is_disabled         = isset( $layer['isDisabled'] ) && $layer['isDisabled'];

			// Consider it a global layer if it has the flag OR global metadata.
			if ( $is_global_layer || $has_global_metadata ) {
				$existing[ $layer_type ] = array(
					'exists'              => true,
					'disabled'            => $is_disabled,
					'layer'               => $layer,
					'is_marked_global'    => $is_global_layer,
					'has_global_metadata' => $has_global_metadata,
				);
			}

			// Also track layers that are explicitly disabled with global characteristics.
			// This handles cases where a user disabled a global layer.
			if ( $is_disabled && ( $has_global_metadata || strpos( $layer['id'] ?? '', 'global_' ) === 0 ) ) {
				$existing[ $layer_type ] = array(
					'exists'              => true,
					'disabled'            => true,
					'layer'               => $layer,
					'is_marked_global'    => $is_global_layer,
					'has_global_metadata' => $has_global_metadata,
				);
			}
		}

		return $existing;
	}

	/**
	 * Remove non-disabled global layers from merged layers
	 *
	 * @param array $merged_layers Current merged layers array.
	 * @param array $existing_global_layers Info about existing global layers.
	 * @return array Updated merged layers with non-disabled global layers removed.
	 */
	private static function remove_global_layers( $merged_layers, $existing_global_layers ) {
		return array_filter(
			$merged_layers,
			function ( $layer ) use ( $existing_global_layers ) {
				if ( ! is_array( $layer ) || ! isset( $layer['type'] ) ) {
					return true;
				}

				$layer_type = $layer['type'];

				// Check if this is a global layer.
				$is_global_layer     = isset( $layer['isGlobalLayer'] ) && $layer['isGlobalLayer'];
				$has_global_metadata = isset( $layer['globalLayerSource'] ) || isset( $layer['globalLayerConfig'] );
				$has_global_id       = isset( $layer['id'] ) && strpos( $layer['id'], 'global_' ) === 0;

				// If it's not a global layer, keep it.
				if ( ! ( $is_global_layer || $has_global_metadata || $has_global_id ) ) {
					return true;
				}

				// If no info found, remove it (it's a global layer).
				return false;
			}
		);
	}

	/**
	 * Check if a global layer should be skipped (already exists or is disabled)
	 *
	 * @param string $layer_type Layer type to check.
	 * @param array  $existing_global_layers Existing global layers info.
	 * @return bool True if the layer should be skipped.
	 */
	private static function should_skip_global_layer( $layer_type, $existing_global_layers ) {
		if ( isset( $existing_global_layers[ $layer_type ] ) && $existing_global_layers[ $layer_type ]['disabled'] ) {
			return true;
		}

		return false;
	}
}
