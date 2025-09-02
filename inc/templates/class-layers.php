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
				return $video_duration > 0 ? intval( $video_duration / 2 ) : 30;

			case self::PLACEMENT_END:
				return $video_duration > 10
					? $video_duration - 10
					: max( 0, $video_duration - 5 );

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

		// Process global layer.
		if ( isset( $global_settings['global_layers'] ) && is_array( $global_settings['global_layers'] ) ) {
			$global_layers = $global_settings['global_layers'];

			// Add CTA layer if configure.
			if ( isset( $global_layers['cta'] ) && is_array( $global_layers['cta'] ) ) {
				$cta_layer = self::create_cta_layer( $global_layers['cta'], $video_duration );
				if ( ! empty( $cta_layer ) ) {
					$merged_layers[] = $cta_layer;
				}
			}

			// Add form layer if configure.
			if ( isset( $global_layers['form'] ) && is_array( $global_layers['form'] ) ) {
				$form_layer = self::create_form_layer( $global_layers['form'], $video_duration );
				if ( ! empty( $form_layer ) ) {
					$merged_layers[] = $form_layer;
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
			'id'          => self::generate_uuid_v4(),
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

		$defaults  = isset( self::$defaults['form'] ) ? self::$defaults['form'] : array();
		$placement = isset( $form_config['placement'] ) ? $form_config['placement'] : self::PLACEMENT_START;

		return array(
			'type'        => self::LAYER_TYPE_FORM,
			'id'          => self::generate_uuid_v4(),
			'displayTime' => self::get_placement_time( $placement, $video_duration ),
			'formId'      => isset( $form_config['formId'] ) ? $form_config['formId'] : ( isset( $defaults['formId'] ) ? $defaults['formId'] : '' ),
			'formTitle'   => isset( $form_config['formTitle'] ) ? $form_config['formTitle'] : ( isset( $defaults['formTitle'] ) ? $defaults['formTitle'] : '' ),
			'formFields'  => isset( $form_config['formFields'] ) ? $form_config['formFields'] : ( isset( $defaults['formFields'] ) ? $defaults['formFields'] : array() ),
			'formAction'  => isset( $form_config['formAction'] ) ? $form_config['formAction'] : '',
			'formMethod'  => isset( $form_config['formMethod'] ) ? $form_config['formMethod'] : 'POST',
		);
	}

	/**
	 * Create a custom layer (extensible for future layer types).
	 *
	 * @param string $layer_type Layer type identifier.
	 * @param array  $layer_config Layer configuration.
	 * @param int    $video_duration Video duration in seconds.
	 * @return array Layer data or empty array if disabled/invalid.
	 */
	public static function create_custom_layer( $layer_type, $layer_config, $video_duration ) {
		if ( ! is_array( $layer_config ) || empty( $layer_config['enabled'] ) ) {
			return array();
		}

		$placement = isset( $layer_config['placement'] ) ? $layer_config['placement'] : self::PLACEMENT_START;

		$base_layer = array(
			'type'        => $layer_type,
			'id'          => self::generate_uuid_v4(),
			'displayTime' => self::get_placement_time( $placement, $video_duration ),
		);

		// Apply custom configuration, excluding standard key.
		$excluded_keys = array( 'enabled', 'placement' );
		$custom_config = array();

		foreach ( $layer_config as $key => $value ) {
			if ( ! in_array( $key, $excluded_keys, true ) ) {
				$custom_config[ $key ] = $value;
			}
		}

		return array_merge( $base_layer, $custom_config );
	}

	/**
	 * Generate UUID v4.
	 *
	 * @return string UUID v4 string.
	 */
	public static function generate_uuid_v4() {
		try {
			if ( function_exists( 'random_bytes' ) ) {
				$data = random_bytes( 16 );

				// Set version to 0100 (UUID v4.
				$data[6] = chr( ( ord( $data[6] ) & 0x0f ) | 0x40 );

				// Set variant to 10x.
				$data[8] = chr( ( ord( $data[8] ) & 0x3f ) | 0x80 );

				return vsprintf( '%s%s-%s-%s-%s-%s%s%s', str_split( bin2hex( $data ), 4 ) );
			}
		} catch ( Exception $e ) {
			return uniqid( '', true );
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
}
