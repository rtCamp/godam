<?php
/**
 * Render template for the GoDAM Player.
 *
 * This file dynamically renders the video player block on the frontend.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( isset( $is_shortcode ) && $is_shortcode ) {
	$is_shortcode = true;
} else {
	$is_shortcode = false;
}

if ( isset( $is_elementor_widget ) && $is_elementor_widget ) {
	$is_elementor_widget = true;
} else {
	$is_elementor_widget = false;
}

// prevent default behavior of Gravity Forms autoscroll on submission.
add_filter( 'gform_confirmation_anchor', '__return_false' );

// Check if the block attributes are set and is an array.
if ( ! isset( $attributes ) || ! is_array( $attributes ) ) {
	$attributes = array();
}

// Create filter for the block attributes.
$attributes = apply_filters(
	'godam_player_block_attributes',
	$attributes
);

// attributes.
$autoplay       = ! empty( $attributes['autoplay'] );
$controls       = isset( $attributes['controls'] ) ? $attributes['controls'] : true;
$loop           = ! empty( $attributes['loop'] );
$muted          = ! empty( $attributes['muted'] );
$poster         = ! empty( $attributes['poster'] ) ? esc_url( $attributes['poster'] ) : '';
$preload        = ! empty( $attributes['preload'] ) ? esc_attr( $attributes['preload'] ) : 'auto';
$hover_select   = isset( $attributes['hoverSelect'] ) ? $attributes['hoverSelect'] : 'none';
$caption        = ! empty( $attributes['caption'] ) ? esc_html( $attributes['caption'] ) : '';
$tracks         = ! empty( $attributes['tracks'] ) ? $attributes['tracks'] : array();
$show_share_btn = ! empty( $attributes['showShareButton'] );

// Resolve the attachment ID (could be WordPress or virtual media).
$attachment_id = '';

// Prefer "id" if available.
if ( ! empty( $attributes['id'] ) ) {
	$attachment_id = is_numeric( $attributes['id'] )
		? intval( $attributes['id'] )   // WordPress media ID.
		: sanitize_text_field( $attributes['id'] ); // Virtual media ID.
} elseif ( ! empty( $attributes['cmmId'] ) ) { // Fallback to "cmmId" for backward compatibility.
	$attachment_id = sanitize_text_field( $attributes['cmmId'] );
}

// Determine whether the attachment ID refers to a virtual (GoDAM) media item.
// If it's not numeric, we assume it's a virtual reference (e.g., a GoDAM ID).
$is_virtual  = ! empty( $attachment_id ) && ! is_numeric( $attachment_id );
$original_id = $attachment_id;

if ( $is_virtual ) {
	// Query the WordPress Media Library to find an attachment post that has
	// a meta key `_godam_original_id` matching this virtual media ID.
	$query = new \WP_Query(
		array(
			'post_type'      => 'attachment',
			'posts_per_page' => 1,
			'post_status'    => 'any',
			'meta_key'       => '_godam_original_id',
			'meta_value'     => sanitize_text_field( $attachment_id ), // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
			'fields'         => 'ids',
		)
	);

	// If a matching media attachment exists, use its actual WordPress ID.
	if ( $query->have_posts() ) {
		$original_id = $query->posts[0];
	}
}

$video_preview      = isset( $attributes['preview'] ) ? $attributes['preview'] : false;
$overlay_time_range = ! empty( $attributes['overlayTimeRange'] ) ? floatval( $attributes['overlayTimeRange'] ) : 0;
$show_overlay       = isset( $attributes['showOverlay'] ) ? $attributes['showOverlay'] : false;
$vertical_alignment = ! empty( $attributes['verticalAlignment'] ) ? esc_attr( $attributes['verticalAlignment'] ) : 'center';
$aspect_ratio       = ! empty( $attributes['aspectRatio'] ) && 'responsive' === $attributes['aspectRatio']
	? ( ! empty( $attributes['videoWidth'] ) && ! empty( $attributes['videoHeight'] )
		? $attributes['videoWidth'] . ':' . $attributes['videoHeight']
		: '16:9'
	)
	: '16:9';

$src                = ! empty( $attributes['src'] ) ? esc_url( $attributes['src'] ) : '';
$transcoded_url     = ! empty( $attributes['transcoded_url'] ) ? esc_url( $attributes['transcoded_url'] ) : '';
$hls_transcoded_url = ! empty( $attributes['hls_transcoded_url'] ) ? esc_url( $attributes['hls_transcoded_url'] ) : '';

// Retrieve 'rtgodam_meta' for the given attachment ID, defaulting to an empty array if not found.
$easydam_meta_data = $attachment_id ? get_post_meta( $attachment_id, 'rtgodam_meta', true ) : array();
$easydam_meta_data = is_array( $easydam_meta_data ) ? $easydam_meta_data : array();

if ( $is_virtual ) {
	$easydam_meta_data = $original_id ? get_post_meta( $original_id, 'rtgodam_meta', true ) : array();
}
// Extract control bar settings with a fallback to an empty array.
$control_bar_settings = $easydam_meta_data['videoConfig']['controlBar'] ?? array();

$poster_image = get_post_meta( $attachment_id, 'rtgodam_media_video_thumbnail', true );
$poster_image = ! empty( $poster_image ) ? $poster_image : '';

$job_id = '';

$sources = array();

if ( empty( $attachment_id ) ) {
	$job_id = ! empty( $attributes['cmmId'] ) ? sanitize_text_field( $attributes['cmmId'] ) : '';
}

if ( ( empty( $attachment_id ) || ( $is_virtual && ! empty( $original_id ) ) ) &&
	! empty( $attributes['sources'] ) 
) {
	// If media is virtual media.
	$sources = $attributes['sources'];
} elseif ( empty( $attachment_id ) &&
	! ( empty( $src ) && empty( $transcoded_url ) && empty( $hls_transcoded_url ) )
) {
	// in case of shortcode with src or transcoded_url or hls_transcoded_url attribute.
	$sources = array();

	if ( ! empty( $hls_transcoded_url ) ) {
		$sources[] = array(
			'src'  => $hls_transcoded_url,
			'type' => 'application/x-mpegURL',
		);
	}
	if ( ! empty( $transcoded_url ) ) {
		$sources[] = array(
			'src'  => $transcoded_url,
			'type' => 'application/dash+xml',
		);
	}
	if ( ! empty( $src ) ) {
		$sources[] = array(
			'src'  => $src,
			'type' => 'video/mp4',
		);
	}
} else {

	if ( $is_virtual ) {
		// For virtual media, we need to get the actual attachment ID first.
		$attachment_id = $original_id;
	}

	$transcoded_url     = $attachment_id ? rtgodam_get_transcoded_url_from_attachment( $attachment_id ) : '';
	$hls_transcoded_url = $attachment_id ? rtgodam_get_hls_transcoded_url_from_attachment( $attachment_id ) : '';
	$video_src          = $attachment_id ? wp_get_attachment_url( $attachment_id ) : '';
	$video_src_type     = $attachment_id ? get_post_mime_type( $attachment_id ) : '';
	$job_id             = '';

	if ( $attachment_id && ! empty( $transcoded_url ) ) {
		$job_id = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );

		if ( empty( $job_id ) ) {
			$job_id = get_post_meta( $attachment_id, '_godam_original_id', true );
		}
	}
	$sources = array();

	if ( ! empty( $hls_transcoded_url ) ) {
		$sources[] = array(
			'src'  => $hls_transcoded_url,
			'type' => 'application/x-mpegURL',
		);
	}

	if ( ! empty( $transcoded_url ) ) {
		$sources[] = array(
			'src'  => $transcoded_url,
			'type' => 'application/dash+xml',
		);
	}

	$sources[] = array(
		'src'  => $video_src,
		'type' => 'video/quicktime' === $video_src_type ? 'video/mp4' : $video_src_type,
	);
}

// Check if no media is selected - return early to prevent broken output.
// Also check if sources array contains only empty sources.
$has_valid_sources = false;
foreach ( $sources as $source ) {
	if ( ! empty( $source['src'] ) ) {
		$has_valid_sources = true;
		break;
	}
}

if ( empty( $attachment_id ) && empty( $src ) && empty( $transcoded_url ) && ! $has_valid_sources ) {
	return;
}

$easydam_control_bar_color = 'initial'; // Default color.

$godam_settings         = get_option( 'rtgodam-settings', array() );
$brand_color            = isset( $godam_settings['video_player']['brand_color'] ) ? $godam_settings['video_player']['brand_color'] : null;
$appearance_color       = isset( $easydam_meta_data['videoConfig']['controlBar']['appearanceColor'] ) ? $easydam_meta_data['videoConfig']['controlBar']['appearanceColor'] : null;
$brand_image            = isset( $godam_settings['video_player']['brand_image'] ) ? $godam_settings['video_player']['brand_image'] : null;
$individual_brand_image = isset( $easydam_meta_data['videoConfig']['controlBar']['brand_image'] ) ? $easydam_meta_data['videoConfig']['controlBar']['brand_image'] : null;
$player_skin            = isset( $godam_settings['video_player']['player_skin'] ) ? $godam_settings['video_player']['player_skin'] : 'Default';
$ads_settings           = isset( $godam_settings['ads_settings'] ) ? $godam_settings['ads_settings'] : array();
$ads_settings           = wp_json_encode( $ads_settings );

// Build the video setup options for data-setup.
$video_setup = array(
	'controls'    => $controls,
	'autoplay'    => $autoplay,
	'loop'        => $loop,
	'muted'       => $muted,
	'preload'     => $preload,
	'poster'      => empty( $poster ) ? $poster_image : $poster,
	'fluid'       => true,
	'flvjs'       => array(
		'mediaDataSource' => array(
			'isLive'          => true,
			'cors'            => false,
			'withCredentials' => false,
		),
	),
	'sources'     => $sources,
	'playsinline' => true,
	'controlBar'  => array(
		'volumePanel'  => array(
			'inline' => ! in_array( $player_skin, array( 'Minimal', 'Pills' ), true ),
		),
		'skipButtons'  => array(
			'forward'  => 10,
			'backward' => 10,
		),
		'brandingIcon' => true, // provide default value for brand logo. 
	),
);
if ( ! empty( $control_bar_settings ) ) {
	$video_setup['controlBar'] = $control_bar_settings; // contains settings specific to control bar.

	if ( isset( $control_bar_settings['volumePanel'] ) && empty( $control_bar_settings['volumePanel'] ) ) {
		$volume_panel_setting = $control_bar_settings['volumePanel'];
	} else {
		// Define your default volumePanel setting.
		$volume_panel_setting = array(
			'inline' => ! in_array( $player_skin, array( 'Minimal', 'Pills' ), true ),
		);
	}

	$video_setup['controlBar']['volumePanel'] = $volume_panel_setting;
}

$video_setup = wp_json_encode( $video_setup );

$video_config = wp_json_encode(
	array(
		'preview'          => $video_preview,
		'layers'           => ! empty( $easydam_meta_data['layers'] ) ? $easydam_meta_data['layers'] : array(), // contains list of layers.
		'chapters'         => ! empty( $easydam_meta_data['chapters'] ) ? $easydam_meta_data['chapters'] : array(), // contains list of chapters.
		'overlayTimeRange' => $overlay_time_range, // Add overlay time range to video config.
		'playerSkin'       => $player_skin, // Add player skin to video config. Add brand image to video config.
		'aspectRatio'      => $aspect_ratio,
		'showShareBtn'     => $show_share_btn,
	)
);

if ( ! empty( $appearance_color ) ) {
	$easydam_control_bar_color = $appearance_color;
} elseif ( ! empty( $brand_color ) ) {
	$easydam_control_bar_color = $brand_color;
}

$easydam_hover_color        = ! empty( $easydam_meta_data['videoConfig']['controlBar']['hoverColor'] ) ? $easydam_meta_data['videoConfig']['controlBar']['hoverColor'] : '#fff';
$easydam_hover_zoom         = ! empty( $easydam_meta_data['videoConfig']['controlBar']['zoomLevel'] ) ? $easydam_meta_data['videoConfig']['controlBar']['zoomLevel'] : 0;
$easydam_custom_btn_img     = ! empty( $easydam_meta_data['videoConfig']['controlBar']['customPlayBtnImg'] ) ? $easydam_meta_data['videoConfig']['controlBar']['customPlayBtnImg'] : '';
$easydam_control_bar_config = ! empty( $easydam_meta_data['videoConfig']['controlBar'] ) ? $easydam_meta_data['videoConfig']['controlBar'] : array();

$layers     = $easydam_meta_data['layers'] ?? array();
$ads_layers = array_filter(
	$layers,
	function ( $layer ) {
		return 'ad' === $layer['type'];
	}
);
$ad_tag_url = '';

$ad_server = isset( $easydam_meta_data['videoConfig']['adServer'] ) ? sanitize_text_field( $easydam_meta_data['videoConfig']['adServer'] ) : 'self-hosted';

if ( ! empty( $ad_server ) && 'ad-server' === $ad_server ) :
	$ad_tag_url = isset( $easydam_meta_data['videoConfig']['adTagURL'] ) ? $easydam_meta_data['videoConfig']['adTagURL'] : '';
elseif ( ! empty( $ads_layers ) && 'self-hosted' === $ad_server ) :
	$ad_tag_url = get_rest_url( get_current_blog_id(), '/godam/v1/adTagURL/' ) . $attachment_id;
endif;

$instance_id = 'video_' . bin2hex( random_bytes( 8 ) );

// Create custom inline styles in a more maintainable way.
$custom_css_properties = array(
	'--rtgodam-control-bar-color'      => $easydam_control_bar_color,
	'--rtgodam-control-hover-color'    => $easydam_hover_color,
	'--rtgodam-control-hover-zoom'     => 1 + $easydam_hover_zoom,
	'--rtgodam-custom-play-button-url' => $easydam_custom_btn_img ? 'url(' . esc_url( $easydam_custom_btn_img ) . ')' : '',
);

if ( ! empty( $aspect_ratio ) ) {
	$custom_css_properties['--rtgodam-video-aspect-ratio'] = str_replace( ':', '/', $aspect_ratio );
}

// Build the inline style string, escaping each value.
$custom_inline_styles = '';
foreach ( $custom_css_properties as $property => $value ) {
	if ( ! empty( $value ) ) {
		$custom_inline_styles .= $property . ': ' . $value . ';';
	}
}

// Build the figure attributes for the <figure> element.
if ( $is_shortcode || $is_elementor_widget ) {
	$figure_attributes = ! empty( $custom_inline_styles )
		? 'style="' . esc_attr( $custom_inline_styles ) . '"'
		: '';
} else {
	$additional_attributes = array();
	if ( ! empty( $custom_inline_styles ) ) {
		$additional_attributes['style'] = esc_attr( $custom_inline_styles );
	}
	$figure_attributes = get_block_wrapper_attributes( $additional_attributes );
}

/**
 * Fetch AI Generated video tracks from REST endpoint
 */
$transcript_path = godam_get_transcript_path( $job_id );

if ( ! empty( $transcript_path ) ) {
	$tracks[] = array(
		'src'     => esc_url( $transcript_path ),
		'kind'    => 'subtitles',
		'label'   => 'English',
		'srclang' => 'en',
	);
}

/**
 * Print styles and scripts whose handles contain one of the given substrings.
 *
 * @param string ...$handle_names One or more substrings to match against registered script/style handles.
 */
function handle_assets( ...$handle_names ) {
	$assets_html = '';
	global $wp_styles, $wp_scripts;

	// Collect style handles.
	$style_handles = array();
	foreach ( $wp_styles->registered as $handle => $data ) {
		foreach ( $handle_names as $handle_name ) {
			if ( strpos( $handle, $handle_name ) !== false ) {
				$style_handles[] = $handle;
				break;
			}
		}
	}

	// Print styles with dependencies.
	if ( ! empty( $style_handles ) ) {
		ob_start();
		wp_print_styles( $style_handles );
		$assets_html .= ob_get_clean();
	}

	// Collect script handles.
	$script_handles = array();
	foreach ( $wp_scripts->registered as $handle => $data ) {
		foreach ( $handle_names as $handle_name ) {
			if ( strpos( $handle, $handle_name ) !== false ) {
				$script_handles[] = $handle;
				break;
			}
		}
	}

	// Print scripts with dependencies.
	if ( ! empty( $script_handles ) ) {
		ob_start();
		wp_print_scripts( $script_handles );
		$assets_html .= ob_get_clean();
	}

	echo $assets_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
}

?>

<?php if ( ! empty( $sources ) ) : ?>
	<figure 
		id="godam-player-container-<?php echo esc_attr( $instance_id ); ?>"
		<?php echo wp_kses_data( $figure_attributes ); ?>>
		<div class="godam-video-wrapper">
			<?php if ( $show_overlay && ! empty( $inner_blocks_content ) ) : ?>
				<div
					class="godam-video-overlay-container godam-overlay-alignment-<?php echo esc_attr( $vertical_alignment ); ?>"
					data-overlay-content
					data-overlay-time-range="<?php echo esc_attr( $overlay_time_range ); ?>"
				>
					<?php
					// Safely output the inner blocks content.
					echo wp_kses_post( $inner_blocks_content );
					?>
				</div>
			<?php endif; ?>

			<div class="easydam-video-container animate-video-loading godam-<?php echo esc_attr( strtolower( $player_skin ) ); ?>-skin" >
				<?php if ( isset( $hover_select ) && 'shadow-overlay' === $hover_select ) : ?>
					<div class="godam-player-overlay"></div>
				<?php endif; ?>
				<div class="animate-play-btn">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
						<path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
					</svg>
				</div>
				<video
					class="easydam-player video-js vjs-big-play-centered vjs-hidden"
					data-options="<?php echo esc_attr( $video_config ); ?>"
					data-ad_tag_url="<?php echo esc_url( $ad_tag_url ); ?>"
					data-id="<?php echo esc_attr( $attachment_id ); ?>"
					data-instance-id="<?php echo esc_attr( $instance_id ); ?>"
					data-controls="<?php echo esc_attr( $video_setup ); ?>"
					data-job_id="<?php echo esc_attr( $job_id ); ?>"
					data-global_ads_settings="<?php echo esc_attr( $ads_settings ); ?>"
					data-hover-select="<?php echo esc_attr( $hover_select ); ?>"
				>
					<?php

					$display_caption = ( ! isset( $easydam_meta_data['videoConfig']['controlBar']['subsCapsButton'] ) ) ||
						( isset( $easydam_meta_data['videoConfig']['controlBar']['subsCapsButton'] ) && $easydam_meta_data['videoConfig']['controlBar']['subsCapsButton'] );

					if ( $display_caption ) {
						foreach ( $tracks as $track ) :
							if ( ! empty( $track['src'] ) && ! empty( $track['kind'] ) ) :
								?>
								<track
									src="<?php echo esc_url( $track['src'] ); ?>"
									kind="<?php echo esc_attr( $track['kind'] ); ?>"
									<?php
									echo ! empty( $track['srclang'] ) ? sprintf( 'srclang="%s"', esc_attr( $track['srclang'] ) ) : '';
									echo ! empty( $track['label'] ) ? sprintf( 'label="%s"', esc_attr( $track['label'] ) ) : '';
									?>
								/>
								<?php
							endif;
						endforeach;
					}
					?>
				</video>
				<!-- Add this to target godam uppy modal inside video. -->
				<div id="uppy-godam-video-modal-container"></div>

				<!-- Dynamically render shortcodes for form layers. -->
				<?php
				if ( ! empty( $easydam_meta_data['layers'] ) ) :
					foreach ( $easydam_meta_data['layers'] as $layer ) :
						$form_type = ! empty( $layer['form_type'] ) ? $layer['form_type'] : 'gravity';
						// FORM layer.
						if ( isset( $layer['type'] ) && 'form' === $layer['type'] ) :
							if ( 'gravity' === $form_type && ! empty( $layer['gf_id'] ) ) :
								?>
							<div id="layer-<?php echo esc_attr( $instance_id . '-' . $layer['id'] ); ?>" class="easydam-layer hidden" style="background-color: <?php echo isset( $layer['bg_color'] ) ? esc_attr( $layer['bg_color'] ) : '#FFFFFFB3'; ?>">
								<div class="form-container">
									<?php
										$theme = ! empty( $layer['theme'] ) ? esc_attr( $layer['theme'] ) : '';
										echo do_shortcode(
											sprintf(
												"[gravityform id='%d' title='false' description='false' ajax='true'%s]",
												intval( $layer['gf_id'] ),
												$theme ? " theme='$theme'" : ''
											)
										);
									?>
								</div>
							</div>
								<?php
							elseif ( 'cf7' === $form_type && ! empty( $layer['cf7_id'] ) ) :
								$form_theme = ! empty( $layer['theme'] ) ? $layer['theme'] : 'godam';
								?>
								<div id="layer-<?php echo esc_attr( $instance_id . '-' . $layer['id'] ); ?>" class="easydam-layer hidden" style="background-color: <?php echo isset( $layer['bg_color'] ) ? esc_attr( $layer['bg_color'] ) : '#FFFFFFB3'; ?>">
									<div class="form-container <?php echo esc_attr( 'godam' === $form_theme ? 'rtgodam-wpcf7-form' : '' ); ?>">
										<?php
											echo do_shortcode(
												sprintf(
													"[contact-form-7 id='%d' title='false' ajax='true']",
													intval( $layer['cf7_id'] )
												)
											);
										?>
									</div>
								</div>
								<?php
							elseif ( 'wpforms' === $form_type && ! empty( $layer['wpform_id'] ) ) :
								?>
								<div id="layer-<?php echo esc_attr( $instance_id . '-' . $layer['id'] ); ?>" class="easydam-layer hidden" style="background-color: <?php echo isset( $layer['bg_color'] ) ? esc_attr( $layer['bg_color'] ) : '#FFFFFFB3'; ?>">
									<div class="form-container">
										<?php

										if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
											if ( function_exists( 'wpforms' ) ) {
												$frontend = wpforms()->get( 'frontend' );

												if ( $frontend ) {
													$frontend->assets_css();
													$frontend->assets_js();
													handle_assets( 'wpforms' );
												}
											}

											echo do_shortcode(
												sprintf(
													"[wpforms id='%d' title='false' description='false' ajax='true']",
													intval( $layer['wpform_id'] )
												)
											);
										}
										?>
									</div>
								</div>
								<?php
							elseif ( 'sureforms' === $form_type && ! empty( $layer['sureform_id'] ) ) :
								?>
								<div id="layer-<?php echo esc_attr( $instance_id . '-' . $layer['id'] ); ?>" class="easydam-layer hidden" style="background-color: <?php echo isset( $layer['bg_color'] ) ? esc_attr( $layer['bg_color'] ) : '#FFFFFFB3'; ?>">
									<div class="form-container">
										<?php
											echo do_shortcode(
												sprintf(
													"[sureforms id='%d']",
													intval( $layer['sureform_id'] )
												)
											);
										?>
									</div>
								</div>
								<?php
							elseif ( 'forminator' === $form_type && ! empty( $layer['forminator_id'] ) ) :
								?>
								<div id="layer-<?php echo esc_attr( $instance_id . '-' . $layer['id'] ); ?>" class="easydam-layer hidden" style="background-color: <?php echo isset( $layer['bg_color'] ) ? esc_attr( $layer['bg_color'] ) : '#FFFFFFB3'; ?>">
									<div class="form-container">
										<?php

											echo do_shortcode(
												sprintf(
													"[forminator_form id='%d']",
													intval( $layer['forminator_id'] )
												)
											);
										?>
									</div>
								</div>
								<?php
							elseif ( 'metform' === $form_type && ! empty( $layer['metform_id'] ) ) :
								?>
								<div id="layer-<?php echo esc_attr( $instance_id . '-' . $layer['id'] ); ?>" class="easydam-layer hidden <?php echo esc_attr( $form_type ); ?>" style="background-color: <?php echo isset( $layer['bg_color'] ) ? esc_attr( $layer['bg_color'] ) : '#FFFFFFB3'; ?>">
									<div class="form-container">
										<?php
											echo do_shortcode(
												sprintf(
													"[metform form_id='%d']",
													intval( $layer['metform_id'] )
												)
											);
										?>
									</div>
								</div>
								<?php
							elseif ( 'jetpack' === $form_type && ! empty( $layer['jp_id'] ) ) :
								// Get the origin post ID from the layer data.
								$origin_post_id = isset( $layer['origin_post_id'] ) ? $layer['origin_post_id'] : '';

								// Use the static helper method to get the rendered form HTML.
								$form_html = \RTGODAM\Inc\REST_API\Jetpack::get_rendered_form_html_static( $layer['jp_id'] );

								if ( $form_html && ! is_wp_error( $form_html ) ) :
									?>
									<div id="layer-<?php echo esc_attr( $instance_id . '-' . $layer['id'] ); ?>" class="easydam-layer hidden" style="background-color: <?php echo isset( $layer['bg_color'] ) ? esc_attr( $layer['bg_color'] ) : '#FFFFFFB3'; ?>">
										<div class="form-container jetpack-form-container" <?php echo ! empty( $origin_post_id ) ? 'data-origin-post-id="' . esc_attr( $origin_post_id ) . '"' : ''; ?>>
											<?php
												// HTML generated dynamically using Block content.
												// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
												echo $form_html;
											?>
										</div>
									</div>
									<?php
								endif;
							elseif ( 'fluentforms' === $form_type && ! empty( $layer['fluent_form_id'] ) ) :
								?>
								<div id="layer-<?php echo esc_attr( $instance_id . '-' . $layer['id'] ); ?>" class="easydam-layer hidden" style="background-color: <?php echo isset( $layer['bg_color'] ) ? esc_attr( $layer['bg_color'] ) : '#FFFFFFB3'; ?>">
									<div class="form-container">
										<?php
											echo do_shortcode(
												sprintf(
													"[fluentform id='%d']",
													intval( $layer['fluent_form_id'] )
												)
											);
										?>
									</div>
								</div>
									<?php
							elseif ( 'everestforms' === $form_type && ! empty( $layer['everest_form_id'] ) ) :
								?>
								<div
									id="layer-<?php echo esc_attr( $instance_id . '-' . $layer['id'] ); ?>"
									class="easydam-layer hidden"
									style="background-color: <?php echo isset( $layer['bg_color'] ) ? esc_attr( $layer['bg_color'] ) : '#FFFFFFB3'; ?>"
								>
									<div class="form-container everest-form">
										<?php
											echo do_shortcode(
												sprintf(
													"[everest_form id='%d' title='false' description='false']",
													intval( $layer['everest_form_id'] )
												)
											);
										?>
									</div>
								</div>
								<?php
							elseif ( 'ninjaforms' === $form_type && ! empty( $layer['ninja_form_id'] ) ) :
								?>
								<div id="layer-<?php echo esc_attr( $instance_id . '-' . $layer['id'] ); ?>" class="easydam-layer hidden <?php echo esc_attr( $form_type ); ?>" style="background-color: <?php echo isset( $layer['bg_color'] ) ? esc_attr( $layer['bg_color'] ) : '#FFFFFFB3'; ?>">
									<div class="form-container">
										<?php
											echo do_shortcode(
												sprintf(
													"[ninja_form id='%d']",
													intval( $layer['ninja_form_id'] )
												)
											);
										?>
									</div>
								</div>
								<?php
							endif;
								// Poll layer.
						elseif ( isset( $layer['type'] ) && 'poll' === $layer['type'] ) :
							?>
							<div id="layer-<?php echo esc_attr( $instance_id . '-' . $layer['id'] ); ?>" class="easydam-layer hidden" style="background-color: <?php echo isset( $layer['bg_color'] ) ? esc_attr( $layer['bg_color'] ) : '#FFFFFFB3'; ?>">
								<div class="form-container poll-container">
									<?php
									$poll_id = ! empty( $layer['poll_id'] ) ? intval( $layer['poll_id'] ) : 0;
									echo do_shortcode( "[poll id='$poll_id']" );
									?>
								</div>
							</div>
							<?php
							// CTA layer.
						elseif ( isset( $layer['type'] ) && 'cta' === $layer['type'] ) :
							?>
							<div id="layer-<?php echo esc_attr( $instance_id . '-' . $layer['id'] ); ?>" class="easydam-layer hidden" style="background-color: <?php echo isset( $layer['bg_color'] ) ? esc_attr( $layer['bg_color'] ) : '#FFFFFFB3'; ?>">
								<?php if ( 'text' === $layer['cta_type'] ) : ?>
									<div class="ql-editor easydam-layer--cta-text">
										<?php echo wp_kses_post( $layer['text'] ); ?>
									</div>
								<?php elseif ( 'html' === $layer['cta_type'] && ! empty( $layer['html'] ) ) : ?>
									<div class="easydam-layer--cta-html">
										<?php echo wp_kses_post( $layer['html'] ); ?>
									</div>
								<?php elseif ( 'image' === $layer['cta_type'] && ! empty( $layer['image'] ) ) : ?>
									<?php echo wp_kses_post( rtgodam_image_cta_html( $layer ) ); ?>
								<?php endif; ?>
							</div>
							<?php
							// HOTSPOT layer.
						elseif ( isset( $layer['type'] ) && 'hotspot' === $layer['type'] ) :
							?>
							<div
								id="layer-<?php echo esc_attr( $instance_id . '-' . $layer['id'] ); ?>"
								class="easydam-layer hidden hotspot-layer"
								<?php
								if ( ! empty( $layer['bg_color'] ) ) :
									?>
									style="background-color: <?php echo esc_attr( $layer['bg_color'] ); ?>"<?php endif; ?>
							>
							</div>
							<?php
						endif;
					endforeach;
					?>
				<?php endif; ?>
			</div>
		</div>

		<?php if ( $caption && ! empty( $caption ) ) : ?>
			<figcaption class="wp-element-caption rtgodam-video-caption"><?php echo esc_html( $caption ); ?></figcaption>
			<?php
			endif;
				do_action( 'rtgodam_after_video_html', $attributes, $instance_id, $easydam_meta_data );
		?>
	</figure>
<?php endif; ?>
