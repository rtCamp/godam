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

$godam_is_shortcode = false;
if ( isset( $is_shortcode ) && $is_shortcode ) {
	$godam_is_shortcode = true;
}

$godam_is_elementor_widget = false;
if ( isset( $is_elementor_widget ) && $is_elementor_widget ) {
	$godam_is_elementor_widget = true;
}

// prevent default behavior of Gravity Forms autoscroll on submission.
add_filter( 'gform_confirmation_anchor', '__return_false' );

// Check if the block attributes are set and is an array.
if ( ! isset( $attributes ) || ! is_array( $attributes ) ) {
	// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- WordPress core variable passed to template.
	$attributes = array();
}

// Create filter for the block attributes.
// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- WordPress core variable passed to template.
$attributes = apply_filters(
	'godam_player_block_attributes',
	$attributes
);

// attributes.
$godam_autoplay       = ! empty( $attributes['autoplay'] );
$godam_controls       = isset( $attributes['controls'] ) ? $attributes['controls'] : true;
$godam_loop           = ! empty( $attributes['loop'] );
$godam_muted          = ! empty( $attributes['muted'] );
$godam_poster         = ! empty( $attributes['poster'] ) ? esc_url( $attributes['poster'] ) : '';
$godam_preload_poster = ! empty( $attributes['preloadPoster'] );
$godam_preload        = ! empty( $attributes['preload'] ) ? esc_attr( $attributes['preload'] ) : 'auto';
$godam_hover_select   = isset( $attributes['hoverSelect'] ) ? $attributes['hoverSelect'] : 'none';
$godam_caption        = ! empty( $attributes['caption'] ) ? esc_html( $attributes['caption'] ) : '';
$godam_tracks         = ! empty( $attributes['tracks'] ) ? $attributes['tracks'] : array();
$godam_show_share_btn = ! empty( $attributes['showShareButton'] );

// Resolve the attachment ID (could be WordPress or virtual media).
$godam_attachment_id = '';

// Prefer "id" if available.
if ( ! empty( $attributes['id'] ) ) {
	$godam_attachment_id = is_numeric( $attributes['id'] )
		? intval( $attributes['id'] )   // WordPress media ID.
		: sanitize_text_field( $attributes['id'] ); // Virtual media ID.
} elseif ( ! empty( $attributes['cmmId'] ) ) { // Fallback to "cmmId" for backward compatibility.
	$godam_attachment_id = sanitize_text_field( $attributes['cmmId'] );
}

// Determine whether the attachment ID refers to a virtual (GoDAM) media item.
// If it's not numeric, we assume it's a virtual reference (e.g., a GoDAM ID).
$godam_is_virtual  = ! empty( $godam_attachment_id ) && ! is_numeric( $godam_attachment_id );
$godam_original_id = $godam_attachment_id;

if ( $godam_is_virtual ) {
	// Query the WordPress Media Library to find an attachment post that has
	// a meta key `_godam_original_id` matching this virtual media ID.
	$godam_query = new \WP_Query(
		array(
			'post_type'      => 'attachment',
			'posts_per_page' => 1,
			'post_status'    => 'any',
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- Required for finding attachment by GoDAM ID.
			'meta_key'       => '_godam_original_id',
			'meta_value'     => sanitize_text_field( $godam_attachment_id ), // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
			'fields'         => 'ids',
		)
	);

	// If a matching media attachment exists, use its actual WordPress ID.
	if ( $godam_query->have_posts() ) {
		$godam_original_id = $godam_query->posts[0];
	}
}

$godam_video_preview      = isset( $attributes['preview'] ) ? $attributes['preview'] : false;
$godam_overlay_time_range = ! empty( $attributes['overlayTimeRange'] ) ? floatval( $attributes['overlayTimeRange'] ) : 0;
$godam_show_overlay       = isset( $attributes['showOverlay'] ) ? $attributes['showOverlay'] : false;
$godam_vertical_alignment = ! empty( $attributes['verticalAlignment'] ) ? esc_attr( $attributes['verticalAlignment'] ) : 'center';
$godam_aspect_ratio       = ! empty( $attributes['aspectRatio'] ) && 'responsive' === $attributes['aspectRatio']
	? ( ! empty( $attributes['videoWidth'] ) && ! empty( $attributes['videoHeight'] )
		? $attributes['videoWidth'] . ':' . $attributes['videoHeight']
		: '16:9'
	)
	: '16:9';

$godam_src                = ! empty( $attributes['src'] ) ? esc_url( $attributes['src'] ) : '';
$godam_transcoded_url     = ! empty( $attributes['transcoded_url'] ) ? esc_url( $attributes['transcoded_url'] ) : '';
$godam_hls_transcoded_url = ! empty( $attributes['hls_transcoded_url'] ) ? esc_url( $attributes['hls_transcoded_url'] ) : '';

// Retrieve 'rtgodam_meta' for the given attachment ID, defaulting to an empty array if not found.
$godam_meta_data = $godam_attachment_id ? get_post_meta( $godam_attachment_id, 'rtgodam_meta', true ) : array();
$godam_meta_data = is_array( $godam_meta_data ) ? $godam_meta_data : array();

if ( $godam_is_virtual ) {
	$godam_meta_data = $godam_original_id ? get_post_meta( $godam_original_id, 'rtgodam_meta', true ) : array();
}
// Extract control bar settings with a fallback to an empty array.
$godam_control_bar_settings = $godam_meta_data['videoConfig']['controlBar'] ?? array();

$godam_poster_image = get_post_meta( $godam_attachment_id, 'rtgodam_media_video_thumbnail', true );
$godam_poster_image = ! empty( $godam_poster_image ) ? $godam_poster_image : '';

$godam_job_id = '';

$godam_sources = array();

if ( empty( $godam_attachment_id ) ) {
	$godam_job_id = ! empty( $attributes['cmmId'] ) ? sanitize_text_field( $attributes['cmmId'] ) : '';
} elseif ( $godam_is_virtual ) {
	// For virtual media, the attachment_id is the GoDAM ID, which is the job_id.
	$godam_job_id = $godam_attachment_id;
}

if ( ( empty( $godam_attachment_id ) || ( $godam_is_virtual && ! empty( $godam_original_id ) ) ) &&
	! empty( $attributes['sources'] ) 
) {
	// If media is virtual media.
	$godam_sources = $attributes['sources'];
} elseif ( empty( $godam_attachment_id ) &&
	! ( empty( $godam_src ) && empty( $godam_transcoded_url ) && empty( $godam_hls_transcoded_url ) )
) {
	// in case of shortcode with src or transcoded_url or hls_transcoded_url attribute.
	$godam_sources = array();

	if ( ! empty( $godam_hls_transcoded_url ) ) {
		$godam_sources[] = array(
			'src'  => $godam_hls_transcoded_url,
			'type' => 'application/x-mpegURL',
		);
	}
	if ( ! empty( $godam_transcoded_url ) ) {
		$godam_sources[] = array(
			'src'  => $godam_transcoded_url,
			'type' => 'application/dash+xml',
		);
	}
	if ( ! empty( $godam_src ) ) {
		$godam_sources[] = array(
			'src'  => $godam_src,
			'type' => 'video/mp4',
		);
	}
} else {

	if ( $godam_is_virtual ) {
		// For virtual media, we need to get the actual attachment ID first.
		$godam_attachment_id = $godam_original_id;
	}

	$godam_transcoded_url     = $godam_attachment_id ? rtgodam_get_transcoded_url_from_attachment( $godam_attachment_id ) : '';
	$godam_hls_transcoded_url = $godam_attachment_id ? rtgodam_get_hls_transcoded_url_from_attachment( $godam_attachment_id ) : '';
	$godam_video_src          = $godam_attachment_id ? wp_get_attachment_url( $godam_attachment_id ) : '';
	$godam_video_src_type     = $godam_attachment_id ? get_post_mime_type( $godam_attachment_id ) : '';
	$godam_job_id             = '';

	if ( $godam_attachment_id && ! empty( $godam_transcoded_url ) ) {
		$godam_job_id = get_post_meta( $godam_attachment_id, 'rtgodam_transcoding_job_id', true );

		if ( empty( $godam_job_id ) ) {
			$godam_job_id = get_post_meta( $godam_attachment_id, '_godam_original_id', true );
		}
	}
	$godam_sources = array();

	if ( ! empty( $godam_hls_transcoded_url ) ) {
		$godam_sources[] = array(
			'src'  => $godam_hls_transcoded_url,
			'type' => 'application/x-mpegURL',
		);
	}

	if ( ! empty( $godam_transcoded_url ) ) {
		$godam_sources[] = array(
			'src'  => $godam_transcoded_url,
			'type' => 'application/dash+xml',
		);
	}

	$godam_sources[] = array(
		'src'  => $godam_video_src,
		'type' => 'video/quicktime' === $godam_video_src_type ? 'video/mp4' : $godam_video_src_type,
	);
}

// Check if no media is selected - return early to prevent broken output.
// Also check if sources array contains only empty sources.
$godam_has_valid_sources = false;
foreach ( $godam_sources as $godam_source ) {
	if ( ! empty( $godam_source['src'] ) ) {
		$godam_has_valid_sources = true;
		break;
	}
}

if ( empty( $godam_attachment_id ) && empty( $godam_src ) && empty( $godam_transcoded_url ) && ! $godam_has_valid_sources ) {
	return;
}

$godam_easydam_control_bar_color = 'initial'; // Default color.

$godam_settings               = get_option( 'rtgodam-settings', array() );
$godam_brand_color            = isset( $godam_settings['video_player']['brand_color'] ) ? $godam_settings['video_player']['brand_color'] : null;
$godam_appearance_color       = isset( $godam_meta_data['videoConfig']['controlBar']['appearanceColor'] ) ? $godam_meta_data['videoConfig']['controlBar']['appearanceColor'] : null;
$godam_brand_image            = isset( $godam_settings['video_player']['brand_image'] ) ? $godam_settings['video_player']['brand_image'] : null;
$godam_individual_brand_image = isset( $godam_meta_data['videoConfig']['controlBar']['brand_image'] ) ? $godam_meta_data['videoConfig']['controlBar']['brand_image'] : null;
$godam_player_skin            = isset( $godam_settings['video_player']['player_skin'] ) ? $godam_settings['video_player']['player_skin'] : 'Default';
$godam_ads_settings           = isset( $godam_settings['ads_settings'] ) ? $godam_settings['ads_settings'] : array();
$godam_ads_settings           = wp_json_encode( $godam_ads_settings );

$godam_video_poster = empty( $godam_poster ) ? $godam_poster_image : $godam_poster;

// Build the video setup options for data-setup.
$godam_video_setup = array(
	'controls'    => $godam_controls,
	'autoplay'    => $godam_autoplay,
	'loop'        => $godam_loop,
	'muted'       => $godam_muted,
	'preload'     => $godam_preload,
	'poster'      => $godam_video_poster,
	'fluid'       => true,
	'flvjs'       => array(
		'mediaDataSource' => array(
			'isLive'          => true,
			'cors'            => false,
			'withCredentials' => false,
		),
	),
	'sources'     => $godam_sources,
	'playsinline' => true,
	'controlBar'  => array(
		'volumePanel'  => array(
			'inline' => ! in_array( $godam_player_skin, array( 'Minimal', 'Pills' ), true ),
		),
		'skipButtons'  => array(
			'forward'  => 10,
			'backward' => 10,
		),
		'brandingIcon' => true, // provide default value for brand logo. 
	),
);
if ( ! empty( $godam_control_bar_settings ) ) {
	$godam_video_setup['controlBar'] = $godam_control_bar_settings; // contains settings specific to control bar.

	if ( isset( $godam_control_bar_settings['volumePanel'] ) && empty( $godam_control_bar_settings['volumePanel'] ) ) {
		$godam_volume_panel_setting = $godam_control_bar_settings['volumePanel'];
	} else {
		// Define your default volumePanel setting.
		$godam_volume_panel_setting = array(
			'inline' => ! in_array( $godam_player_skin, array( 'Minimal', 'Pills' ), true ),
		);
	}

	$godam_video_setup['controlBar']['volumePanel'] = $godam_volume_panel_setting;
}

$godam_video_setup = wp_json_encode( $godam_video_setup );

$godam_video_config = wp_json_encode(
	array(
		'preview'          => $godam_video_preview,
		'layers'           => ! empty( $godam_meta_data['layers'] ) ? $godam_meta_data['layers'] : array(), // contains list of layers.
		'chapters'         => ! empty( $godam_meta_data['chapters'] ) ? $godam_meta_data['chapters'] : array(), // contains list of chapters.
		'overlayTimeRange' => $godam_overlay_time_range, // Add overlay time range to video config.
		'playerSkin'       => $godam_player_skin, // Add player skin to video config. Add brand image to video config.
		'aspectRatio'      => $godam_aspect_ratio,
		'showShareBtn'     => $godam_show_share_btn,
	)
);

if ( ! empty( $godam_appearance_color ) ) {
	$godam_easydam_control_bar_color = $godam_appearance_color;
} elseif ( ! empty( $godam_brand_color ) ) {
	$godam_easydam_control_bar_color = $godam_brand_color;
}

$godam_easydam_hover_color        = ! empty( $godam_meta_data['videoConfig']['controlBar']['hoverColor'] ) ? $godam_meta_data['videoConfig']['controlBar']['hoverColor'] : '#fff';
$godam_easydam_hover_zoom         = ! empty( $godam_meta_data['videoConfig']['controlBar']['zoomLevel'] ) ? $godam_meta_data['videoConfig']['controlBar']['zoomLevel'] : 0;
$godam_easydam_custom_btn_img     = ! empty( $godam_meta_data['videoConfig']['controlBar']['customPlayBtnImg'] ) ? $godam_meta_data['videoConfig']['controlBar']['customPlayBtnImg'] : '';
$godam_easydam_control_bar_config = ! empty( $godam_meta_data['videoConfig']['controlBar'] ) ? $godam_meta_data['videoConfig']['controlBar'] : array();

$godam_layers     = $godam_meta_data['layers'] ?? array();
$godam_ads_layers = array_filter(
	$godam_layers,
	function ( $godam_layer ) {
		return 'ad' === $godam_layer['type'];
	}
);
$godam_ad_tag_url = '';

$godam_ad_server = isset( $godam_meta_data['videoConfig']['adServer'] ) ? sanitize_text_field( $godam_meta_data['videoConfig']['adServer'] ) : 'self-hosted';

if ( ! empty( $godam_ad_server ) && 'ad-server' === $godam_ad_server ) :
	$godam_ad_tag_url = isset( $godam_meta_data['videoConfig']['adTagURL'] ) ? $godam_meta_data['videoConfig']['adTagURL'] : '';
elseif ( ! empty( $godam_ads_layers ) && 'self-hosted' === $godam_ad_server ) :
	$godam_ad_tag_url = get_rest_url( get_current_blog_id(), '/godam/v1/adTagURL/' ) . $godam_attachment_id;
endif;

$godam_instance_id = 'video_' . bin2hex( random_bytes( 8 ) );

// Create custom inline styles in a more maintainable way.
$godam_custom_css_properties = array(
	'--rtgodam-control-bar-color'      => $godam_easydam_control_bar_color,
	'--rtgodam-control-hover-color'    => $godam_easydam_hover_color,
	'--rtgodam-control-hover-zoom'     => 1 + $godam_easydam_hover_zoom,
	'--rtgodam-custom-play-button-url' => $godam_easydam_custom_btn_img ? 'url(' . esc_url( $godam_easydam_custom_btn_img ) . ')' : '',
);

if ( ! empty( $godam_aspect_ratio ) ) {
	$godam_custom_css_properties['--rtgodam-video-aspect-ratio'] = str_replace( ':', '/', $godam_aspect_ratio );
}

// Build the inline style string, escaping each value.
$godam_custom_inline_styles = '';
foreach ( $godam_custom_css_properties as $godam_property => $godam_value ) {
	if ( ! empty( $godam_value ) ) {
		$godam_custom_inline_styles .= $godam_property . ': ' . $godam_value . ';';
	}
}

// Build the figure attributes for the <figure> element.
if ( $godam_is_shortcode || $godam_is_elementor_widget ) {
	$godam_figure_attributes = ! empty( $godam_custom_inline_styles )
		? 'style="' . esc_attr( $godam_custom_inline_styles ) . '"'
		: '';
} else {
	$godam_additional_attributes = array();
	if ( ! empty( $godam_custom_inline_styles ) ) {
		$godam_additional_attributes['style'] = esc_attr( $godam_custom_inline_styles );
	}
	$godam_figure_attributes = get_block_wrapper_attributes( $godam_additional_attributes );
}

/**
 * Fetch AI Generated video tracks from post meta
 */
$godam_transcript_path = '';

// Determine which attachment ID to use for transcript check.
// If attachment_id is a string, it's a job ID - resolve it to attachment ID.
$godam_transcript_attachment_id = $godam_attachment_id;

if ( ! empty( $godam_attachment_id ) && ! is_numeric( $godam_attachment_id ) ) {
	// It's a job ID string, find the actual attachment ID.
	if ( ! class_exists( 'RTGODAM_Transcoder_Handler' ) ) {
		include_once RTGODAM_PATH . 'admin/class-rtgodam-transcoder-handler.php';
	}

	$godam_transcoder_handler       = new RTGODAM_Transcoder_Handler();
	$godam_transcript_attachment_id = $godam_transcoder_handler->get_post_id_by_meta_key_and_value( 'rtgodam_transcoding_job_id', $godam_attachment_id );
}

// Check for transcription if we have a valid numeric attachment ID.
// The function will check post meta first before making API calls.
if ( ! empty( $godam_transcript_attachment_id ) && is_numeric( $godam_transcript_attachment_id ) ) {
	$godam_transcript_path = godam_get_transcript_path( $godam_transcript_attachment_id, $godam_job_id );
}

if ( ! empty( $godam_transcript_path ) ) {
	$godam_tracks[] = array(
		'src'     => esc_url( $godam_transcript_path ),
		'kind'    => 'subtitles',
		'label'   => 'English',
		'srclang' => 'en',
	);
}

$godam_attachment_title = '';

if ( ! empty( $godam_attachment_id ) && is_numeric( $godam_attachment_id ) ) {
	$godam_attachment_title = get_the_title( $godam_attachment_id );
} elseif ( ! empty( $godam_original_id ) && is_numeric( $godam_original_id ) ) {
	$godam_attachment_title = get_the_title( $godam_original_id );
}
// Use the filename as the title.
if ( empty( $godam_attachment_title ) ) {
	$godam_attachment_title = basename( get_attached_file( $godam_attachment_id ) );
}

$godam_should_preload_poster = $godam_preload_poster && ! empty( $godam_video_poster );

// Preload poster image if enabled to improve performance, especially LCP.
if ( $godam_should_preload_poster ) {
	add_action(
		'wp_head',
		function () use ( $godam_video_poster ) {
			printf( '<link rel="preload" as="image" fetchpriority="high" href="%s">', esc_url( $godam_video_poster ) );
		}
	);
}

?>

<?php if ( ! empty( $godam_sources ) ) : ?>
	<figure 
		id="godam-player-container-<?php echo esc_attr( $godam_instance_id ); ?>"
		<?php echo wp_kses_data( $godam_figure_attributes ); ?>>
		<div class="godam-video-wrapper">
			<?php if ( $godam_show_overlay && ! empty( $godam_inner_blocks_content ) ) : ?>
				<div
					class="godam-video-overlay-container godam-overlay-alignment-<?php echo esc_attr( $godam_vertical_alignment ); ?>"
					data-overlay-content
					data-overlay-time-range="<?php echo esc_attr( $godam_overlay_time_range ); ?>"
				>
					<?php
					// Safely output the inner blocks content.
					echo wp_kses_post( $godam_inner_blocks_content );
					?>
				</div>
			<?php endif; ?>

			<div class="easydam-video-container animate-video-loading godam-<?php echo esc_attr( strtolower( $godam_player_skin ) ); ?>-skin" >
				<?php if ( isset( $godam_hover_select ) && 'shadow-overlay' === $godam_hover_select ) : ?>
					<div class="godam-player-overlay"></div>
				<?php endif; ?>
				<div class="animate-play-btn">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
						<path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
					</svg>
				</div>
				<?php foreach ( $godam_layers as $layer ) : ?>
					<?php if ( isset( $layer['miniCart'] ) ) : ?>
						<?php if ( true === $layer['miniCart'] ) : ?>
							<div class="godam-video--cart-basket">
								<?php echo do_blocks( '<!-- wp:woocommerce/mini-cart /-->' ); // phpcs:ignore ?>
							</div>
						<?php endif; ?>
						<?php break; ?>
					<?php endif; ?>
				<?php endforeach; ?>
				<?php if ( $godam_should_preload_poster ) : ?>
					<img
						class="godam-poster-image"
						src="<?php echo esc_url( $godam_video_poster ); ?>"
						fetchpriority="high"
						aria-hidden="true"
					/>
				<?php endif; ?>
				<video
					class="easydam-player video-js vjs-big-play-centered vjs-hidden"
					data-options="<?php echo esc_attr( $godam_video_config ); ?>"
					data-ad_tag_url="<?php echo esc_url( $godam_ad_tag_url ); ?>"
					data-id="<?php echo esc_attr( is_numeric( $godam_attachment_id ) ? $godam_attachment_id : $godam_original_id ); ?>"
					data-instance-id="<?php echo esc_attr( $godam_instance_id ); ?>"
					data-controls="<?php echo esc_attr( $godam_video_setup ); ?>"
					data-job_id="<?php echo esc_attr( $godam_job_id ); ?>"
					data-global_ads_settings="<?php echo esc_attr( $godam_ads_settings ); ?>"
					data-hover-select="<?php echo esc_attr( $godam_hover_select ); ?>"
					data-video-title="<?php echo esc_attr( $godam_attachment_title ); ?>"
				>
					<?php

					$godam_display_caption = ( ! isset( $godam_meta_data['videoConfig']['controlBar']['subsCapsButton'] ) ) ||
						( isset( $godam_meta_data['videoConfig']['controlBar']['subsCapsButton'] ) && $godam_meta_data['videoConfig']['controlBar']['subsCapsButton'] );

					if ( $godam_display_caption ) {
						foreach ( $godam_tracks as $godam_track ) :
							if ( ! empty( $godam_track['src'] ) && ! empty( $godam_track['kind'] ) ) :
								?>
								<track
									src="<?php echo esc_url( $godam_track['src'] ); ?>"
									kind="<?php echo esc_attr( $godam_track['kind'] ); ?>"
									<?php
									echo ! empty( $godam_track['srclang'] ) ? sprintf( 'srclang="%s"', esc_attr( $godam_track['srclang'] ) ) : '';
									echo ! empty( $godam_track['label'] ) ? sprintf( 'label="%s"', esc_attr( $godam_track['label'] ) ) : '';
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
				if ( ! empty( $godam_meta_data['layers'] ) ) :
					foreach ( $godam_meta_data['layers'] as $godam_layer ) :
						$godam_form_type = ! empty( $godam_layer['form_type'] ) ? $godam_layer['form_type'] : 'gravity';
						// FORM layer.
						if ( isset( $godam_layer['type'] ) && 'form' === $godam_layer['type'] ) :
							if ( 'gravity' === $godam_form_type && ! empty( $godam_layer['gf_id'] ) ) :
								?>
							<div id="layer-<?php echo esc_attr( $godam_instance_id . '-' . $godam_layer['id'] ); ?>" class="easydam-layer hidden" style="background-color: <?php echo isset( $godam_layer['bg_color'] ) ? esc_attr( $godam_layer['bg_color'] ) : '#FFFFFFB3'; ?>">
								<div class="form-container">
									<?php
										$godam_theme = ! empty( $godam_layer['theme'] ) ? esc_attr( $godam_layer['theme'] ) : '';
										echo do_shortcode(
											sprintf(
												"[gravityform id='%d' title='false' description='false' ajax='true'%s]",
												intval( $godam_layer['gf_id'] ),
												$godam_theme ? " theme='$godam_theme'" : ''
											)
										);
									?>
								</div>
							</div>
								<?php
							elseif ( 'cf7' === $godam_form_type && ! empty( $godam_layer['cf7_id'] ) ) :
								$godam_form_theme = ! empty( $godam_layer['theme'] ) ? $godam_layer['theme'] : 'godam';
								?>
								<div id="layer-<?php echo esc_attr( $godam_instance_id . '-' . $godam_layer['id'] ); ?>" class="easydam-layer hidden" style="background-color: <?php echo isset( $godam_layer['bg_color'] ) ? esc_attr( $godam_layer['bg_color'] ) : '#FFFFFFB3'; ?>">
									<div class="form-container <?php echo esc_attr( 'godam' === $godam_form_theme ? 'rtgodam-wpcf7-form' : '' ); ?>">
										<?php
											echo do_shortcode(
												sprintf(
													"[contact-form-7 id='%d' title='false' ajax='true']",
													intval( $godam_layer['cf7_id'] )
												)
											);
										?>
									</div>
								</div>
								<?php
							elseif ( 'wpforms' === $godam_form_type && ! empty( $godam_layer['wpform_id'] ) ) :
								?>
								<div id="layer-<?php echo esc_attr( $godam_instance_id . '-' . $godam_layer['id'] ); ?>" class="easydam-layer hidden" style="background-color: <?php echo isset( $godam_layer['bg_color'] ) ? esc_attr( $godam_layer['bg_color'] ) : '#FFFFFFB3'; ?>">
									<div class="form-container">
										<?php
											echo do_shortcode(
												sprintf(
													"[wpforms id='%d' title='false' description='false' ajax='true']",
													intval( $godam_layer['wpform_id'] )
												)
											);
										?>
									</div>
								</div>
								<?php
							elseif ( 'sureforms' === $godam_form_type && ! empty( $godam_layer['sureform_id'] ) ) :
								?>
								<div id="layer-<?php echo esc_attr( $godam_instance_id . '-' . $godam_layer['id'] ); ?>" class="easydam-layer hidden" style="background-color: <?php echo isset( $godam_layer['bg_color'] ) ? esc_attr( $godam_layer['bg_color'] ) : '#FFFFFFB3'; ?>">
									<div class="form-container">
										<?php
											echo do_shortcode(
												sprintf(
													"[sureforms id='%d']",
													intval( $godam_layer['sureform_id'] )
												)
											);
										?>
									</div>
								</div>
								<?php
							elseif ( 'forminator' === $godam_form_type && ! empty( $godam_layer['forminator_id'] ) ) :
								?>
								<div id="layer-<?php echo esc_attr( $godam_instance_id . '-' . $godam_layer['id'] ); ?>" class="easydam-layer hidden" style="background-color: <?php echo isset( $godam_layer['bg_color'] ) ? esc_attr( $godam_layer['bg_color'] ) : '#FFFFFFB3'; ?>">
									<div class="form-container">
										<?php
											echo do_shortcode(
												sprintf(
													"[forminator_form id='%d']",
													intval( $godam_layer['forminator_id'] )
												)
											);
										?>
									</div>
								</div>
								<?php
							elseif ( 'metform' === $godam_form_type && ! empty( $godam_layer['metform_id'] ) ) :
								?>
								<div id="layer-<?php echo esc_attr( $godam_instance_id . '-' . $godam_layer['id'] ); ?>" class="easydam-layer hidden <?php echo esc_attr( $godam_form_type ); ?>" style="background-color: <?php echo isset( $godam_layer['bg_color'] ) ? esc_attr( $godam_layer['bg_color'] ) : '#FFFFFFB3'; ?>">
									<div class="form-container">
										<?php
											echo do_shortcode(
												sprintf(
													"[metform form_id='%d']",
													intval( $godam_layer['metform_id'] )
												)
											);
										?>
									</div>
								</div>
								<?php
							elseif ( 'jetpack' === $godam_form_type && ! empty( $godam_layer['jp_id'] ) ) :
								// Get the origin post ID from the layer data.
								$godam_origin_post_id = isset( $godam_layer['origin_post_id'] ) ? $godam_layer['origin_post_id'] : '';

								// Use the static helper method to get the rendered form HTML.
								$godam_form_html = \RTGODAM\Inc\REST_API\Jetpack::get_rendered_form_html_static( $godam_layer['jp_id'] );

								if ( $godam_form_html && ! is_wp_error( $godam_form_html ) ) :
									?>
									<div id="layer-<?php echo esc_attr( $godam_instance_id . '-' . $godam_layer['id'] ); ?>" class="easydam-layer hidden" style="background-color: <?php echo isset( $godam_layer['bg_color'] ) ? esc_attr( $godam_layer['bg_color'] ) : '#FFFFFFB3'; ?>">
										<div class="form-container jetpack-form-container" <?php echo ! empty( $godam_origin_post_id ) ? 'data-origin-post-id="' . esc_attr( $godam_origin_post_id ) . '"' : ''; ?>>
											<?php
												// HTML generated dynamically using Block content.
												// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
												echo $godam_form_html;
											?>
										</div>
									</div>
									<?php
								endif;
							elseif ( 'fluentforms' === $godam_form_type && ! empty( $godam_layer['fluent_form_id'] ) ) :
								?>
								<div id="layer-<?php echo esc_attr( $godam_instance_id . '-' . $godam_layer['id'] ); ?>" class="easydam-layer hidden" style="background-color: <?php echo isset( $godam_layer['bg_color'] ) ? esc_attr( $godam_layer['bg_color'] ) : '#FFFFFFB3'; ?>">
									<div class="form-container">
										<?php
											echo do_shortcode(
												sprintf(
													"[fluentform id='%d']",
													intval( $godam_layer['fluent_form_id'] )
												)
											);
										?>
									</div>
								</div>
									<?php
							elseif ( 'everestforms' === $godam_form_type && ! empty( $godam_layer['everest_form_id'] ) ) :
								?>
								<div
									id="layer-<?php echo esc_attr( $godam_instance_id . '-' . $godam_layer['id'] ); ?>"
									class="easydam-layer hidden"
									style="background-color: <?php echo isset( $godam_layer['bg_color'] ) ? esc_attr( $godam_layer['bg_color'] ) : '#FFFFFFB3'; ?>"
								>
									<div class="form-container everest-form">
										<?php
											echo do_shortcode(
												sprintf(
													"[everest_form id='%d' title='false' description='false']",
													intval( $godam_layer['everest_form_id'] )
												)
											);
										?>
									</div>
								</div>
								<?php
							elseif ( 'ninjaforms' === $godam_form_type && ! empty( $godam_layer['ninja_form_id'] ) ) :
								?>
								<div id="layer-<?php echo esc_attr( $godam_instance_id . '-' . $godam_layer['id'] ); ?>" class="easydam-layer hidden <?php echo esc_attr( $godam_form_type ); ?>" style="background-color: <?php echo isset( $godam_layer['bg_color'] ) ? esc_attr( $godam_layer['bg_color'] ) : '#FFFFFFB3'; ?>">
									<div class="form-container">
										<?php
											echo do_shortcode(
												sprintf(
													"[ninja_form id='%d']",
													intval( $godam_layer['ninja_form_id'] )
												)
											);
										?>
									</div>
								</div>
								<?php
							endif;
								// Poll layer.
						elseif ( isset( $godam_layer['type'] ) && 'poll' === $godam_layer['type'] ) :
							?>
							<div id="layer-<?php echo esc_attr( $godam_instance_id . '-' . $godam_layer['id'] ); ?>" class="easydam-layer hidden" style="background-color: <?php echo isset( $godam_layer['bg_color'] ) ? esc_attr( $godam_layer['bg_color'] ) : '#FFFFFFB3'; ?>">
								<div class="form-container poll-container">
									<?php
									$godam_poll_id = ! empty( $godam_layer['poll_id'] ) ? intval( $godam_layer['poll_id'] ) : 0;
									echo do_shortcode( "[poll id='$godam_poll_id']" );
									?>
								</div>
							</div>
							<?php
							// CTA layer.
						elseif ( isset( $godam_layer['type'] ) && 'cta' === $godam_layer['type'] ) :
							?>
							<div id="layer-<?php echo esc_attr( $godam_instance_id . '-' . $godam_layer['id'] ); ?>" class="easydam-layer hidden" style="background-color: <?php echo isset( $godam_layer['bg_color'] ) ? esc_attr( $godam_layer['bg_color'] ) : '#FFFFFFB3'; ?>">
								<?php if ( 'text' === $godam_layer['cta_type'] ) : ?>
									<div class="ql-editor easydam-layer--cta-text">
										<?php echo wp_kses_post( $godam_layer['text'] ); ?>
									</div>
								<?php elseif ( 'html' === $godam_layer['cta_type'] && ! empty( $godam_layer['html'] ) ) : ?>
									<div class="easydam-layer--cta-html">
										<?php echo wp_kses_post( $godam_layer['html'] ); ?>
									</div>
								<?php elseif ( 'image' === $godam_layer['cta_type'] && ! empty( $godam_layer['image'] ) ) : ?>
									<?php echo wp_kses_post( rtgodam_image_cta_html( $godam_layer ) ); ?>
								<?php endif; ?>
							</div>
							<?php
							// HOTSPOT layer.
						elseif ( isset( $godam_layer['type'] ) && 'hotspot' === $godam_layer['type'] ) :
							?>
							<div
								id="layer-<?php echo esc_attr( $godam_instance_id . '-' . $godam_layer['id'] ); ?>"
								class="easydam-layer hidden hotspot-layer"
								<?php
								if ( ! empty( $godam_layer['bg_color'] ) ) :
									?>
									style="background-color: <?php echo esc_attr( $godam_layer['bg_color'] ); ?>"<?php endif; ?>
							>
							</div>
							<?php
						endif;
					endforeach;
					?>
				<?php endif; ?>
			</div>
		</div>

		<?php if ( $godam_caption && ! empty( $godam_caption ) ) : ?>
			<figcaption class="wp-element-caption rtgodam-video-caption"><?php echo esc_html( $godam_caption ); ?></figcaption>
			<?php
			endif;
				do_action( 'rtgodam_after_video_html', $attributes, $godam_instance_id, $godam_meta_data );
		?>
	</figure>
<?php endif; ?>
