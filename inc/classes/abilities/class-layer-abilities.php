<?php
/**
 * Abilities for the interactive layers on a GoDAM video.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Abilities;

defined( 'ABSPATH' ) || exit;

/**
 * Class Layer_Abilities
 *
 * Layers live in the attachment's `rtgodam_meta['layers']`, the same list the
 * media editor saves. Writes go through the attachment's REST field, so they
 * keep that field's own rules (such as the custom-CSS limit for non-admins),
 * and each new layer starts from the same defaults the editor gives it.
 *
 * Images take layers too: the media editor places hotspots on an image, and
 * the GoDAM Image block shows them. An image has no timeline, so its layers
 * are always on screen and are saved at 0 seconds, as the editor saves them.
 *
 * @since 2.8.0
 */
class Layer_Abilities extends Ability_Group {

	/**
	 * Form plugins a form layer can show, mapped to the layer field holding the
	 * form ID and the shortcode the player renders it with. Marketo and HubSpot
	 * forms are embedded by script, so there is no shortcode to check.
	 *
	 * Jetpack forms are left out: they also need the post the form lives in.
	 *
	 * @since 2.8.0
	 *
	 * @var array<string, array{field: string, shortcode: string|null, label: string}>
	 */
	const FORM_PLUGINS = array(
		'gravity'      => array(
			'field'     => 'gf_id',
			'shortcode' => 'gravityform',
			'label'     => 'Gravity Forms',
		),
		'cf7'          => array(
			'field'     => 'cf7_id',
			'shortcode' => 'contact-form-7',
			'label'     => 'Contact Form 7',
		),
		'wpforms'      => array(
			'field'     => 'wpform_id',
			'shortcode' => 'wpforms',
			'label'     => 'WPForms',
		),
		'sureforms'    => array(
			'field'     => 'sureform_id',
			'shortcode' => 'sureforms',
			'label'     => 'SureForms',
		),
		'forminator'   => array(
			'field'     => 'forminator_id',
			'shortcode' => 'forminator_form',
			'label'     => 'Forminator',
		),
		'fluentforms'  => array(
			'field'     => 'fluent_form_id',
			'shortcode' => 'fluentform',
			'label'     => 'Fluent Forms',
		),
		'everestforms' => array(
			'field'     => 'everest_form_id',
			'shortcode' => 'everest_form',
			'label'     => 'Everest Forms',
		),
		'ninjaforms'   => array(
			'field'     => 'ninja_form_id',
			'shortcode' => 'ninja_form',
			'label'     => 'Ninja Forms',
		),
		'metform'      => array(
			'field'     => 'metform_id',
			'shortcode' => 'metform',
			'label'     => 'MetForm',
		),
		'marketo'      => array(
			'field'     => 'marketo_id',
			'shortcode' => null,
			'label'     => 'Marketo',
		),
		'hubspot'      => array(
			'field'     => 'hubspot_id',
			'shortcode' => null,
			'label'     => 'HubSpot',
		),
	);

	/**
	 * Layer types the media editor offers on an image. Product hotspots belong
	 * to GoDAM for WooCommerce.
	 *
	 * @since 2.8.0
	 *
	 * @var string[]
	 */
	const IMAGE_LAYER_TYPES = array( 'hotspot' );

	/**
	 * CTA card layouts the player supports.
	 *
	 * @since 2.8.0
	 *
	 * @var string[]
	 */
	const CARD_LAYOUTS = array(
		'card-layout--imagecover-text',
		'card-layout--text-imagecover',
		'card-layout--image-text',
		'card-layout--text-image',
		'card-layout--image-top',
		'card-layout--image-bottom',
		'card-layout--image-background',
	);

	/**
	 * Registers this group's abilities.
	 *
	 * @since 2.8.0
	 *
	 * @return void
	 */
	public function register() {
		$this->add(
			'godam/list-layers',
			array(
				'label'               => __( 'List layers', 'godam' ),
				'description'         => __( 'List the interactive layers on a video — CTAs, hotspots, forms, polls and ads — with when each appears, or the hotspots on an image.', 'godam' ),
				'category'            => 'godam-player',
				'input_schema'        => $this->media_id_input(),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'media_id'   => array( 'type' => 'integer' ),
						'media_type' => array(
							'type' => 'string',
							'enum' => array( 'video', 'image' ),
						),
						'count'      => array( 'type' => 'integer' ),
						'layers'     => array(
							'type'  => 'array',
							'items' => array( 'type' => 'object' ),
						),
					),
				),
				'execute_callback'    => array( $this, 'list_layers' ),
				'permission_callback' => array( $this, 'can_edit_media' ),
			)
		);

		$this->add(
			'godam/add-layer',
			array(
				'label'               => __( 'Add a layer', 'godam' ),
				'description'         => __( 'Add an interactive layer to a video at a given second. Types: cta (a card with heading, text and button, or custom HTML), hotspot (clickable points on the video), form (a form from godam/list-forms), poll (a poll from godam/list-polls) and ad (a VAST ad tag). Give the settings object matching the type. Two layers on a video cannot share the same second. Images take hotspot layers only; they have no timeline, so display_time is not needed and the hotspots are always shown.', 'godam' ),
				'category'            => 'godam-player',
				'input_schema'        => $this->add_layer_input(),
				'output_schema'       => array( 'type' => 'object' ),
				'execute_callback'    => array( $this, 'add_layer' ),
				'permission_callback' => array( $this, 'can_edit_media' ),
			),
			true
		);

		$this->add(
			'godam/remove-layer',
			array(
				'label'               => __( 'Remove a layer', 'godam' ),
				'description'         => __( 'Remove one layer from a video or image. Get layer IDs from godam/list-layers.', 'godam' ),
				'category'            => 'godam-player',
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'id'       => array(
							'type'        => 'integer',
							'minimum'     => 1,
							'description' => __( 'Media (attachment) ID of the video or image.', 'godam' ),
						),
						'layer_id' => array( 'type' => 'string' ),
					),
					'required'   => array( 'id', 'layer_id' ),
				),
				'output_schema'       => array( 'type' => 'object' ),
				'execute_callback'    => array( $this, 'remove_layer' ),
				'permission_callback' => array( $this, 'can_edit_media' ),
				'meta'                => array(
					'annotations' => array(
						'destructive' => true,
						'idempotent'  => true,
					),
				),
			),
			true
		);
	}

	/**
	 * Input schema for godam/add-layer.
	 *
	 * @since 2.8.0
	 *
	 * @return array
	 */
	private function add_layer_input() {
		return array(
			'type'       => 'object',
			'properties' => array(
				'id'           => array(
					'type'        => 'integer',
					'minimum'     => 1,
					'description' => __( 'Media (attachment) ID of the video, or of the image for a hotspot layer.', 'godam' ),
				),
				'type'         => array(
					'type' => 'string',
					'enum' => array( 'cta', 'hotspot', 'form', 'poll', 'ad' ),
				),
				'display_time' => array(
					'type'        => 'number',
					'minimum'     => 0,
					'description' => __( 'Second of the video at which the layer appears. Required for videos; not used for images.', 'godam' ),
				),
				'name'         => array(
					'type'        => 'string',
					'description' => __( 'Name shown in the video editor. Defaults to the type, e.g. "CTA Layer".', 'godam' ),
				),
				'allow_skip'   => array(
					'type'        => 'boolean',
					'default'     => true,
					'description' => __( 'Let viewers skip the layer and keep watching. Applies to cta, form and poll.', 'godam' ),
				),
				'cta'          => array(
					'type'        => 'object',
					'description' => __( 'Settings when type is cta.', 'godam' ),
					'properties'  => array(
						'style'       => array(
							'type'    => 'string',
							'enum'    => array( 'card', 'html' ),
							'default' => 'card',
						),
						'heading'     => array( 'type' => 'string' ),
						'description' => array( 'type' => 'string' ),
						'button_text' => array( 'type' => 'string' ),
						'link'        => array(
							'type'   => 'string',
							'format' => 'uri',
						),
						'image_id'    => array(
							'type'        => 'integer',
							'minimum'     => 1,
							'description' => __( 'Image media ID for the card. Without one the card shows text only.', 'godam' ),
						),
						'layout'      => array(
							'type' => 'string',
							'enum' => self::CARD_LAYOUTS,
						),
						'html'        => array(
							'type'        => 'string',
							'description' => __( 'Markup when style is html.', 'godam' ),
						),
					),
				),
				'hotspot'      => array(
					'type'        => 'object',
					'description' => __( 'Settings when type is hotspot.', 'godam' ),
					'properties'  => array(
						'points'         => array(
							'type'     => 'array',
							'minItems' => 1,
							'items'    => array(
								'type'       => 'object',
								'properties' => array(
									'text' => array( 'type' => 'string' ),
									'link' => array(
										'type'   => 'string',
										'format' => 'uri',
									),
									'x'    => array(
										'type'        => 'number',
										'minimum'     => 0,
										'maximum'     => 100,
										'description' => __( 'Horizontal position, percent from the left.', 'godam' ),
									),
									'y'    => array(
										'type'        => 'number',
										'minimum'     => 0,
										'maximum'     => 100,
										'description' => __( 'Vertical position, percent from the top.', 'godam' ),
									),
								),
								'required'   => array( 'text' ),
							),
						),
						'duration'       => array(
							'type'        => 'number',
							'minimum'     => 1,
							'default'     => 5,
							'description' => __( 'Seconds the hotspots stay on screen.', 'godam' ),
						),
						'pause_on_hover' => array(
							'type'    => 'boolean',
							'default' => false,
						),
					),
					'required'    => array( 'points' ),
				),
				'form'         => array(
					'type'        => 'object',
					'description' => __( 'Settings when type is form.', 'godam' ),
					'properties'  => array(
						'plugin'  => array(
							'type' => 'string',
							'enum' => array_keys( self::FORM_PLUGINS ),
						),
						'form_id' => array(
							'type'        => array( 'string', 'integer' ),
							'description' => __( 'The form\'s ID in that plugin.', 'godam' ),
						),
					),
					'required'    => array( 'plugin', 'form_id' ),
				),
				'poll'         => array(
					'type'        => 'object',
					'description' => __( 'Settings when type is poll.', 'godam' ),
					'properties'  => array(
						'poll_id' => array(
							'type'    => 'integer',
							'minimum' => 1,
						),
					),
					'required'    => array( 'poll_id' ),
				),
				'ad'           => array(
					'type'        => 'object',
					'description' => __( 'Settings when type is ad.', 'godam' ),
					'properties'  => array(
						'tag_url'     => array(
							'type'        => 'string',
							'format'      => 'uri',
							'description' => __( 'VAST ad tag URL.', 'godam' ),
						),
						'skippable'   => array(
							'type'    => 'boolean',
							'default' => false,
						),
						'skip_offset' => array(
							'type'        => 'integer',
							'minimum'     => 0,
							'default'     => 5,
							'description' => __( 'Seconds before a skippable ad can be skipped.', 'godam' ),
						),
					),
					'required'    => array( 'tag_url' ),
				),
			),
			'required'   => array( 'id', 'type' ),
		);
	}

	/**
	 * Executes godam/list-layers.
	 *
	 * @since 2.8.0
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function list_layers( $input = array() ) {
		$post = $this->get_layer_media( $input['id'] ?? 0 );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		$meta   = $this->get_meta( $post->ID );
		$layers = array_map( array( $this, 'describe_layer' ), $meta['layers'] );

		usort(
			$layers,
			static function ( $a, $b ) {
				return $a['display_time'] <=> $b['display_time'];
			}
		);

		return array(
			'media_id'   => $post->ID,
			'media_type' => $this->media_type( $this->attachment_mime_type( $post ) ),
			'count'      => count( $layers ),
			'layers'     => $layers,
		);
	}

	/**
	 * Executes godam/add-layer.
	 *
	 * @since 2.8.0
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function add_layer( $input = array() ) {
		$post = $this->get_layer_media( $input['id'] ?? 0 );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		$meta     = $this->get_meta( $post->ID );
		$is_image = 'image' === $this->media_type( $this->attachment_mime_type( $post ) );

		if ( $is_image ) {
			if ( ! in_array( $input['type'], self::IMAGE_LAYER_TYPES, true ) ) {
				return new \WP_Error(
					'rtgodam_layer_type_not_for_images',
					__( 'Images take hotspot layers only. Other layer types need a video.', 'godam' ),
					array( 'status' => 400 )
				);
			}

			// The editor adds image layers at 0:00; an image has no timeline.
			$display_time = 0.0;
		} elseif ( ! isset( $input['display_time'] ) ) {
			return new \WP_Error( 'rtgodam_display_time_missing', __( 'Give display_time: the second of the video at which the layer appears.', 'godam' ), array( 'status' => 400 ) );
		} else {
			$display_time = (float) $input['display_time'];
		}

		// The editor turns off the Ad layer while the video uses an ad server's ads.
		if ( 'ad' === $input['type'] && 'ad-server' === ( $meta['videoConfig']['adServer'] ?? '' ) ) {
			return new \WP_Error(
				'rtgodam_ad_server_in_use',
				__( 'This video shows ads from an ad server, so ad layers are turned off. Use godam/update-video-settings with an empty ad_tag_url to switch back to ad layers.', 'godam' ),
				array( 'status' => 409 )
			);
		}

		foreach ( $meta['layers'] as $existing ) {
			if ( ! $is_image && isset( $existing['displayTime'] ) && (float) $existing['displayTime'] === $display_time ) {
				return new \WP_Error(
					'rtgodam_layer_time_taken',
					/* translators: %s: second of the video. */
					sprintf( __( 'A layer already appears at %ss. Pick another second, or remove that layer first.', 'godam' ), $display_time ),
					array( 'status' => 409 )
				);
			}
		}

		$layer = $this->build_layer( $input['type'], $input );

		if ( is_wp_error( $layer ) ) {
			return $layer;
		}

		$layer = array_merge(
			array(
				'id'          => wp_generate_uuid4(),
				'displayTime' => $display_time,
				'type'        => $input['type'],
				'name'        => ! empty( $input['name'] ) ? sanitize_text_field( $input['name'] ) : $this->default_name( $input ),
			),
			$layer
		);

		$meta['layers'][] = $layer;

		$saved = $this->save_godam_meta( $post->ID, $meta );

		if ( is_wp_error( $saved ) ) {
			return $saved;
		}

		return array(
			'media_id'   => $post->ID,
			'layer'      => $this->describe_layer( $layer ),
			'editor_url' => $this->editor_url( $post->ID ),
		);
	}

	/**
	 * Executes godam/remove-layer.
	 *
	 * @since 2.8.0
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function remove_layer( $input = array() ) {
		$post = $this->get_layer_media( $input['id'] ?? 0 );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		$meta     = $this->get_meta( $post->ID );
		$layer_id = (string) ( $input['layer_id'] ?? '' );
		$kept     = array_values(
			array_filter(
				$meta['layers'],
				static function ( $layer ) use ( $layer_id ) {
					return ! isset( $layer['id'] ) || (string) $layer['id'] !== $layer_id;
				}
			)
		);

		if ( count( $kept ) === count( $meta['layers'] ) ) {
			return new \WP_Error(
				'rtgodam_layer_not_found',
				__( 'That media item has no layer with this ID. Use godam/list-layers to see its layers.', 'godam' ),
				array( 'status' => 404 )
			);
		}

		$meta['layers'] = $kept;

		$saved = $this->save_godam_meta( $post->ID, $meta );

		if ( is_wp_error( $saved ) ) {
			return $saved;
		}

		return array(
			'media_id'         => $post->ID,
			'removed'          => $layer_id,
			'remaining_layers' => count( $kept ),
		);
	}

	/**
	 * Builds the type-specific part of a new layer, starting from the editor's defaults.
	 *
	 * @since 2.8.0
	 *
	 * @param string $type  Layer type.
	 * @param array  $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	private function build_layer( $type, array $input ) {
		$allow_skip = isset( $input['allow_skip'] ) ? (bool) $input['allow_skip'] : true;

		switch ( $type ) {
			case 'cta':
				return $this->build_cta( (array) ( $input['cta'] ?? array() ), $allow_skip );

			case 'hotspot':
				return $this->build_hotspot( (array) ( $input['hotspot'] ?? array() ) );

			case 'form':
				return $this->build_form( (array) ( $input['form'] ?? array() ), $allow_skip );

			case 'poll':
				$poll_id = absint( $input['poll']['poll_id'] ?? 0 );

				if ( ! $poll_id ) {
					return $this->missing_settings( 'poll' );
				}

				if ( ! shortcode_exists( 'poll' ) ) {
					return new \WP_Error( 'rtgodam_poll_plugin_missing', __( 'Poll layers need the WP-Polls plugin, which is not active on this site.', 'godam' ), array( 'status' => 400 ) );
				}

				return array(
					// A string, as the editor stores it: WP-Polls lists its IDs as strings,
					// and the editor's poll picker only shows a poll whose ID matches exactly.
					'poll_id'    => (string) $poll_id,
					'allow_skip' => $allow_skip,
					'custom_css' => '',
				);

			case 'ad':
				$tag_url = esc_url_raw( $input['ad']['tag_url'] ?? '' );

				if ( ! $tag_url ) {
					return $this->missing_settings( 'ad' );
				}

				return array(
					'adTagUrl'    => $tag_url,
					'ad_url'      => '',
					'skippable'   => (bool) ( $input['ad']['skippable'] ?? false ),
					'skip_offset' => absint( $input['ad']['skip_offset'] ?? 5 ),
				);
		}

		return new \WP_Error( 'rtgodam_unknown_layer_type', __( 'Unknown layer type.', 'godam' ), array( 'status' => 400 ) );
	}

	/**
	 * Builds a CTA layer.
	 *
	 * @since 2.8.0
	 *
	 * @param array $cta        CTA settings.
	 * @param bool  $allow_skip Whether viewers can skip it.
	 *
	 * @return array|\WP_Error
	 */
	private function build_cta( array $cta, $allow_skip ) {
		$style = $cta['style'] ?? 'card';
		$layer = array(
			'cta_type'   => 'html' === $style ? 'html' : 'image',
			'trigger'    => 'timestamp',
			'watchDepth' => 50,
			'html'       => '',
			'link'       => '',
			'allow_skip' => $allow_skip,
		);

		if ( 'html' === $style ) {
			if ( empty( $cta['html'] ) ) {
				return new \WP_Error( 'rtgodam_cta_html_missing', __( 'An html CTA needs cta.html.', 'godam' ), array( 'status' => 400 ) );
			}

			// The player prints this through wp_kses_post(), so save what it will show.
			$layer['html'] = wp_kses_post( $cta['html'] );

			return $layer;
		}

		if ( empty( $cta['heading'] ) && empty( $cta['button_text'] ) ) {
			return new \WP_Error( 'rtgodam_cta_empty', __( 'A card CTA needs at least cta.heading or cta.button_text.', 'godam' ), array( 'status' => 400 ) );
		}

		$image_id = absint( $cta['image_id'] ?? 0 );

		if ( $image_id && ! wp_attachment_is_image( $image_id ) ) {
			return new \WP_Error( 'rtgodam_cta_image_invalid', __( 'cta.image_id is not an image in the media library.', 'godam' ), array( 'status' => 400 ) );
		}

		return array_merge(
			$layer,
			array(
				'cardLayout'         => in_array( $cta['layout'] ?? '', self::CARD_LAYOUTS, true ) ? $cta['layout'] : 'card-layout--imagecover-text',
				'image'              => $image_id,
				'imageUrlExt'        => '',
				'imageText'          => sanitize_text_field( $cta['heading'] ?? '' ),
				'imageDescription'   => sanitize_text_field( $cta['description'] ?? '' ),
				'imageCtaButtonText' => sanitize_text_field( $cta['button_text'] ?? '' ),
				'imageLink'          => esc_url_raw( $cta['link'] ?? '' ),
			)
		);
	}

	/**
	 * Builds a hotspot layer.
	 *
	 * @since 2.8.0
	 *
	 * @param array $hotspot Hotspot settings.
	 *
	 * @return array|\WP_Error
	 */
	private function build_hotspot( array $hotspot ) {
		if ( empty( $hotspot['points'] ) || ! is_array( $hotspot['points'] ) ) {
			return $this->missing_settings( 'hotspot' );
		}

		$points = array();

		foreach ( $hotspot['points'] as $point ) {
			$position = array(
				'x' => (float) ( $point['x'] ?? 50 ),
				'y' => (float) ( $point['y'] ?? 50 ),
			);

			// The editor sizes a new hotspot at 48px of the player it is shown in;
			// 6% is that size on a typical 800px-wide player.
			$size = array( 'diameter' => 6 );

			$points[] = array(
				'id'          => wp_generate_uuid4(),
				'tooltipText' => sanitize_text_field( $point['text'] ?? '' ),
				'link'        => esc_url_raw( $point['link'] ?? '' ),
				'position'    => $position,
				'size'        => $size,
				'oSize'       => $size,
				'oPosition'   => $position,
				'unit'        => 'percent',
			);
		}

		return array(
			'duration'      => (float) ( $hotspot['duration'] ?? 5 ),
			'pauseOnHover'  => (bool) ( $hotspot['pause_on_hover'] ?? false ),
			'hotspots'      => $points,
			'styleType'     => 'pulse',
			'icon'          => '',
			'customIconUrl' => null,
			'customIconId'  => null,
		);
	}

	/**
	 * Builds a form layer.
	 *
	 * @since 2.8.0
	 *
	 * @param array $form       Form settings.
	 * @param bool  $allow_skip Whether viewers can skip it.
	 *
	 * @return array|\WP_Error
	 */
	private function build_form( array $form, $allow_skip ) {
		$plugin = $form['plugin'] ?? '';

		if ( ! isset( self::FORM_PLUGINS[ $plugin ] ) || empty( $form['form_id'] ) ) {
			return $this->missing_settings( 'form' );
		}

		$config = self::FORM_PLUGINS[ $plugin ];

		if ( $config['shortcode'] && ! shortcode_exists( $config['shortcode'] ) ) {
			return new \WP_Error(
				'rtgodam_form_plugin_missing',
				/* translators: %s: form plugin name. */
				sprintf( __( '%s is not active on this site, so its forms cannot be shown in a layer.', 'godam' ), $config['label'] ),
				array( 'status' => 400 )
			);
		}

		$form_id = sanitize_text_field( (string) $form['form_id'] );

		// The editor stores the ID as the plugin's form list gives it: a number,
		// except Marketo's typed IDs and HubSpot's GUIDs, which are strings.
		if ( 'marketo' !== $plugin && ctype_digit( $form_id ) ) {
			$form_id = (int) $form_id;
		}

		return array(
			'form_type'      => $plugin,
			$config['field'] => $form_id,
			'submitted'      => false,
			'allow_skip'     => $allow_skip,
			'custom_css'     => '',
			'theme'          => '',
		);
	}

	/**
	 * Error for a layer whose type-specific settings are missing.
	 *
	 * @since 2.8.0
	 *
	 * @param string $type Layer type.
	 *
	 * @return \WP_Error
	 */
	private function missing_settings( $type ) {
		return new \WP_Error(
			'rtgodam_layer_settings_missing',
			/* translators: %s: layer type, which is also the name of its settings object. */
			sprintf( __( 'A %1$s layer needs its settings in the "%1$s" object; see the input schema.', 'godam' ), $type ),
			array( 'status' => 400 )
		);
	}

	/**
	 * The name the video editor would give a new layer of this type.
	 *
	 * @since 2.8.0
	 *
	 * @param array $input Ability input.
	 *
	 * @return string
	 */
	private function default_name( array $input ) {
		$labels = array(
			'cta'     => 'CTA',
			'hotspot' => 'Hotspot',
			'poll'    => 'Poll',
			'ad'      => 'Ad',
		);

		$label = 'form' === $input['type']
			? ( self::FORM_PLUGINS[ $input['form']['plugin'] ?? '' ]['label'] ?? 'Form' )
			: $labels[ $input['type'] ];

		/* translators: %s: layer type label, e.g. "CTA". */
		return sprintf( __( '%s Layer', 'godam' ), $label );
	}

	/**
	 * A compact description of a stored layer.
	 *
	 * @since 2.8.0
	 *
	 * @param array $layer Stored layer.
	 *
	 * @return array
	 */
	private function describe_layer( $layer ) {
		$layer       = (array) $layer;
		$type        = $layer['type'] ?? 'unknown';
		$description = array(
			'id'           => (string) ( $layer['id'] ?? '' ),
			'type'         => $type,
			'name'         => $layer['name'] ?? '',
			'display_time' => (float) ( $layer['displayTime'] ?? 0 ),
		);

		switch ( $type ) {
			case 'cta':
				// The same fields godam/add-layer takes, so an agent can confirm what it saved.
				$description['cta'] = 'html' === ( $layer['cta_type'] ?? '' )
					? array(
						'style' => 'html',
						'html'  => $layer['html'] ?? '',
					)
					: array(
						'style'       => 'card',
						'heading'     => $layer['imageText'] ?? '',
						'description' => $layer['imageDescription'] ?? '',
						'button_text' => $layer['imageCtaButtonText'] ?? '',
						'link'        => $layer['imageLink'] ?? '',
						'image_id'    => is_numeric( $layer['image'] ?? '' ) && (int) $layer['image'] > 0 ? (int) $layer['image'] : null,
						'layout'      => $layer['cardLayout'] ?? '',
					);
				break;

			case 'hotspot':
				$description['hotspot'] = array(
					'points'   => count( (array) ( $layer['hotspots'] ?? array() ) ),
					'duration' => (float) ( $layer['duration'] ?? 0 ),
				);
				break;

			case 'form':
				$plugin              = $layer['form_type'] ?? 'gravity';
				$field               = self::FORM_PLUGINS[ $plugin ]['field'] ?? '';
				$description['form'] = array(
					'plugin'  => $plugin,
					'form_id' => $field ? ( $layer[ $field ] ?? null ) : null,
				);
				break;

			case 'poll':
				$description['poll'] = array( 'poll_id' => ( isset( $layer['poll_id'] ) && '' !== $layer['poll_id'] ) ? (int) $layer['poll_id'] : null );
				break;

			case 'ad':
				$description['ad'] = array( 'tag_url' => $layer['adTagUrl'] ?? '' );
				break;
		}

		return $description;
	}

	/**
	 * Returns the attachment if it can carry layers: a video, or an image.
	 *
	 * @since 2.8.0
	 *
	 * @param int $attachment_id Attachment ID.
	 *
	 * @return \WP_Post|\WP_Error
	 */
	private function get_layer_media( $attachment_id ) {
		$post = $this->get_attachment( $attachment_id );

		if ( is_wp_error( $post ) ) {
			return $post;
		}

		if ( ! in_array( $this->media_type( $this->attachment_mime_type( $post ) ), array( 'video', 'image' ), true ) ) {
			return new \WP_Error( 'rtgodam_no_layers_for_type', __( 'Layers can only be added to videos, and hotspot layers to images.', 'godam' ), array( 'status' => 400 ) );
		}

		return $post;
	}

	/**
	 * The media item's stored GoDAM settings, with a layers list to work on.
	 *
	 * @since 2.8.0
	 *
	 * @param int $attachment_id Attachment ID.
	 *
	 * @return array
	 */
	private function get_meta( $attachment_id ) {
		$meta = $this->godam_meta( $attachment_id );

		$meta['layers'] = ( isset( $meta['layers'] ) && is_array( $meta['layers'] ) ) ? array_values( $meta['layers'] ) : array();

		return $meta;
	}
}
