<?php
/**
 * Render template for the GoDAM Player.
 *
 * This file dynamically renders the video player block on the frontend.
 *
 * @package GoDAM
 */

use RTGODAM\Inc\Assets\IMA_Assets;
use RTGODAM\Inc\Assets\Jetpack_Form_Assets;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Player wrapper styles (placeholder / poster / loading states) ship as a real
// stylesheet, not an inline <style>. An inline tag here rendered as a sibling of
// the player markup, so inside a flow-layout container (core/column, core/group)
// the player became the second child and inherited the container's blockGap
// `margin-block-start`, adding phantom space above the video.
//
// `godam-player-wrapper-style` is a registered dependency of `godam-player-style`,
// so every render path that enqueues the player CSS already pulls it in; this call
// covers direct `require` of this template and is a no-op otherwise.
if ( wp_style_is( 'godam-player-wrapper-style', 'registered' ) ) {
	wp_enqueue_style( 'godam-player-wrapper-style' );
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
$godam_autoplay     = ! empty( $attributes['autoplay'] );
$godam_controls     = isset( $attributes['controls'] ) ? $attributes['controls'] : true;
$godam_loop         = ! empty( $attributes['loop'] );
$godam_muted        = ! empty( $attributes['muted'] );
$godam_poster       = ! empty( $attributes['poster'] ) ? esc_url( $attributes['poster'] ) : '';
$godam_hover_select = isset( $attributes['hoverSelect'] ) ? $attributes['hoverSelect'] : 'none';

// Autoplay and hover modes are mutually exclusive – reset hover to 'none' so
// the frontend player never initialises hover behaviour on autoplay videos,
// regardless of the stored block/shortcode attribute value.
if ( $godam_autoplay ) {
	$godam_hover_select = 'none';
}

// "Show in lightbox": the inline player becomes a click-to-open trigger that
// plays the video inside a lightbox (see godam-player/managers/modalManager.js).
// The inline render itself is left untouched.
$godam_show_in_lightbox = ! empty( $attributes['showInLightbox'] );

// Autoplay and "Show in lightbox" are mutually exclusive, the same way autoplay
// and hover are above: the inline render is a click-to-open poster, so playing it
// where it stands both defeats the point and double-plays the video (once inline,
// again on opening). The lightbox wins because it is the more specific intent, and
// the author still gets autoplay where it counts — opening the lightbox starts
// playback.
//
// Hover modes are excluded for the same reason, and because the closed poster
// shows nothing but the play icon: previewing (or revealing controls) in place
// competes with the lightbox and re-introduces the very controls it hides. The
// reset happens here as well as in the editors, so a value stored on existing
// content — block, shortcode, Elementor or WPBakery — can never reach the
// frontend player.
if ( $godam_show_in_lightbox ) {
	$godam_autoplay     = false;
	$godam_hover_select = 'none';
}

// Raw "Show caption" block attribute: true/false when explicitly set, null when
// unset (inherit from the attachment's Display-captions setting — resolved into
// $godam_show_caption once the attachment meta is loaded, further below).
$godam_caption           = ! empty( $attributes['caption'] ) ? esc_html( $attributes['caption'] ) : '';
$godam_show_caption_attr = isset( $attributes['showCaption'] ) ? ! empty( $attributes['showCaption'] ) : null;
$godam_show_share_btn    = ! empty( $attributes['showShareButton'] );

// Transcription panel defaults to on; only an explicit `false` disables it.
$godam_show_transcription = ! isset( $attributes['showTranscription'] ) || ! empty( $attributes['showTranscription'] );

// Determine if subtitles and transcript should be disabled based on the context (e.g., product gallery or reels contexts not require them).
$godam_disable_subtitles_and_transcript = isset( $attributes['godam_context'] ) &&
	in_array(
		$attributes['godam_context'],
		array( 'godam-video-product-gallery', 'godam-for-woo-product-page-reels' ),
		true
	);

// Analytics placement attribution: which surface this player render came from.
// An explicit `block_source` attribute (the embed page threads the gallery
// iframe's value through) wins over the godam_context-derived mapping; the
// block/Elementor render paths carry no context and default to 'video-block'.
// block_source is ultimately user-controlled (threaded from a public GET param
// on the embed page), so cap its length here too, matching the same
// mb_substr(...,100) cap video-embed.php already applies to that GET param --
// otherwise an oversized value could reach this attribute uncapped.
$godam_block_source = ! empty( $attributes['block_source'] )
	? mb_substr( sanitize_text_field( $attributes['block_source'] ), 0, 100, 'UTF-8' )
	: rtgodam_get_block_source_from_context( isset( $attributes['godam_context'] ) ? $attributes['godam_context'] : '' );

// Host page attribution for embeds: when the (iframe) render carries the
// embedding page's post ID, stamp it so analytics count against that page
// instead of the embed page itself.
$godam_host_post_id = ! empty( $attributes['host_post_id'] ) ? absint( $attributes['host_post_id'] ) : 0;

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
	// Resolve virtual GoDAM ID → WordPress attachment ID.
	// The WP_Query is expensive, so cache the mapping separately.
	$godam_virtual_map_key = 'work_cache_godam_virtual_' . md5( $godam_attachment_id );
	$godam_cached_wp_id    = function_exists( 'rtgodam_work_cache_get' )
		? rtgodam_work_cache_get( $godam_virtual_map_key )
		: false;

	if ( false !== $godam_cached_wp_id ) {
		$godam_original_id = $godam_cached_wp_id;
	} else {
		/**
		 * Fires before resolving/reading attachment data for a virtual GoDAM
		 * media reference, so integrations that centralize media on another
		 * site can switch context first. Queries the `attachment` post type
		 * for whichever attachment carries this virtual ID in its
		 * `_godam_original_id` meta, to translate it into a real WordPress
		 * attachment ID.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );

		$godam_query = new \WP_Query(
			array(
				'post_type'      => 'attachment',
				'posts_per_page' => 1,
				'post_status'    => 'any',
				'meta_key'       => '_godam_original_id', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key,WordPress.DB.SlowDBQuery.slow_db_query_meta_value -- Required for finding attachment by GoDAM ID.
				'meta_value'     => sanitize_text_field( $godam_attachment_id ), // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key,WordPress.DB.SlowDBQuery.slow_db_query_meta_value -- Required for finding attachment by GoDAM ID.
				'fields'         => 'ids',
			)
		);

		do_action( 'rtgodam_after_attachment_lookup' );

		if ( $godam_query->have_posts() ) {
			$godam_original_id = $godam_query->posts[0];
			// Only cache a successful resolution — never cache a miss, so a
			// newly-created attachment is resolvable on the very next request.
			if ( function_exists( 'rtgodam_work_cache_set' ) ) {
				rtgodam_work_cache_set( $godam_virtual_map_key, $godam_original_id );
			}
		}
	}
}

$godam_video_preview      = isset( $attributes['preview'] ) ? $attributes['preview'] : false;
$godam_overlay_time_range = ! empty( $attributes['overlayTimeRange'] ) ? floatval( $attributes['overlayTimeRange'] ) : 0;
$godam_show_overlay       = isset( $attributes['showOverlay'] ) ? $attributes['showOverlay'] : false;
$godam_vertical_alignment = ! empty( $attributes['verticalAlignment'] ) ? esc_attr( $attributes['verticalAlignment'] ) : 'center';

$godam_src                = ! empty( $attributes['src'] ) ? esc_url( $attributes['src'] ) : '';
$godam_transcoded_url     = ! empty( $attributes['transcoded_url'] ) ? esc_url( $attributes['transcoded_url'] ) : '';
$godam_hls_transcoded_url = ! empty( $attributes['hls_transcoded_url'] ) ? esc_url( $attributes['hls_transcoded_url'] ) : '';

// ---------------------------------------------------------------------------
// Attachment metadata cache
// ---------------------------------------------------------------------------
// All DB calls tied to the resolved numeric attachment ID are bundled into a
// single cache entry (work_cache_godam_meta_{id}).  The invalidation hooks in
// GoDAM_Player already clear this index whenever rtgodam_meta or the
// transcoded-URL meta keys change on an attachment post.
// ---------------------------------------------------------------------------

// The resolved numeric WP attachment ID used as the cache key.
$godam_numeric_id = 0;
if ( $godam_is_virtual && is_numeric( $godam_original_id ) ) {
	$godam_numeric_id = intval( $godam_original_id );
} elseif ( ! $godam_is_virtual && is_numeric( $godam_attachment_id ) ) {
	$godam_numeric_id = intval( $godam_attachment_id );
}

// Always start as an empty array — safe for all downstream ?? / isset() / empty() access.
// A populated array means a cache hit; an empty array means miss or no numeric ID.
$godam_meta_cache_key  = $godam_numeric_id ? 'work_cache_godam_meta_' . $godam_numeric_id : '';
$godam_attachment_data = array();

if ( $godam_meta_cache_key && function_exists( 'rtgodam_work_cache_get' ) ) {
	$godam_cached = rtgodam_work_cache_get( $godam_meta_cache_key );
	if ( is_array( $godam_cached ) ) {
		$godam_attachment_data = $godam_cached;
	}
}

if ( empty( $godam_attachment_data ) && $godam_numeric_id ) {
	/**
	 * Fires before this cache-miss block collects every DB/meta call for
	 * this attachment, so integrations that centralize media on another
	 * site can switch context first.
	 *
	 * @since 2.2.0
	 */
	do_action( 'rtgodam_before_attachment_lookup' );

	// Cache miss — collect every DB/meta call for this attachment in one pass.
	$rtgodam_raw_transcoded_url     = rtgodam_get_transcoded_url_from_attachment( $godam_numeric_id );
	$rtgodam_raw_hls_transcoded_url = rtgodam_get_hls_transcoded_url_from_attachment( $godam_numeric_id );
	$rtgodam_raw_video_src          = wp_get_attachment_url( $godam_numeric_id );
	$rtgodam_raw_video_src_type     = get_post_mime_type( $godam_numeric_id );
	$rtgodam_raw_job_id             = '';
	if ( ! empty( $rtgodam_raw_transcoded_url ) ) {
		$rtgodam_raw_job_id = get_post_meta( $godam_numeric_id, 'rtgodam_transcoding_job_id', true );
		if ( empty( $rtgodam_raw_job_id ) ) {
			$rtgodam_raw_job_id = get_post_meta( $godam_numeric_id, '_godam_original_id', true );
		}
	}

	$godam_attachment_data = array(
		'meta_data'          => get_post_meta( $godam_numeric_id, 'rtgodam_meta', true ),
		'poster_image'       => get_post_meta( $godam_numeric_id, 'rtgodam_media_video_thumbnail', true ),
		'transcoded_url'     => $rtgodam_raw_transcoded_url,
		'hls_transcoded_url' => $rtgodam_raw_hls_transcoded_url,
		'video_src'          => $rtgodam_raw_video_src,
		'video_src_type'     => $rtgodam_raw_video_src_type,
		'job_id'             => $rtgodam_raw_job_id,
		// Transcript resolved in the authenticated editor and cached on the
		// attachment. Read only — never call godam_get_transcript_path() here:
		// on a miss it makes a blocking SaaS request on public page loads and
		// re-caches without the delete guard. Same rule as the audio block.
		'transcript_path'    => get_post_meta( $godam_numeric_id, 'rtgodam_transcript_path', true ),
		'transcript_deleted' => get_post_meta( $godam_numeric_id, 'rtgodam_transcript_deleted', true ),
		'placeholder_map'    => get_post_meta( $godam_numeric_id, 'rtgodam_media_placeholder_thumbnails', true ),
		'placeholder_single' => get_post_meta( $godam_numeric_id, 'rtgodam_media_video_placeholder_thumbnail', true ),
		'attachment_meta'    => wp_get_attachment_metadata( $godam_numeric_id ),
	);

	do_action( 'rtgodam_after_attachment_lookup' );

	if ( function_exists( 'rtgodam_work_cache_set' ) && function_exists( 'rtgodam_work_cache_index_add' ) ) {
		rtgodam_work_cache_set( $godam_meta_cache_key, $godam_attachment_data );
		rtgodam_work_cache_index_add( $godam_meta_cache_key, $godam_meta_cache_key );
	}
}

// Unpack cached (or freshly fetched) attachment data into template variables.
$godam_meta_data    = isset( $godam_attachment_data['meta_data'] ) && is_array( $godam_attachment_data['meta_data'] )
	? $godam_attachment_data['meta_data']
	: array();
$godam_poster_image = ! empty( $godam_attachment_data['poster_image'] ) ? $godam_attachment_data['poster_image'] : '';

// Resolve aspect ratio after we have all metadata loaded.
if ( ! empty( $attributes['aspectRatio'] ) && 'responsive' === $attributes['aspectRatio'] ) {
	if ( ! empty( $attributes['videoWidth'] ) && ! empty( $attributes['videoHeight'] ) ) {
		// Use explicitly provided dimensions (from block attributes).
		$godam_aspect_ratio = $attributes['videoWidth'] . ':' . $attributes['videoHeight'];
	} elseif ( ! empty( $godam_attachment_data['attachment_meta']['width'] ) && ! empty( $godam_attachment_data['attachment_meta']['height'] ) ) {
		$godam_aspect_ratio = intval( $godam_attachment_data['attachment_meta']['width'] ) . ':' . intval( $godam_attachment_data['attachment_meta']['height'] );
	} else {
		// Fallback: let frontend JavaScript detect dimensions dynamically.
		$godam_aspect_ratio = 'responsive';
	}
} elseif ( ! empty( $attributes['aspectRatio'] ) && preg_match( '/^\d+:\d+$/', $attributes['aspectRatio'] ) ) {
	// Use an explicitly set ratio like "16:9", "4:3", etc.
	$godam_aspect_ratio = $attributes['aspectRatio'];
} else {
	$godam_aspect_ratio = '16:9';
}

// Extract control bar settings with a fallback to an empty array.
$godam_control_bar_settings = $godam_meta_data['videoConfig']['controlBar'] ?? array();

// Resolve "Show caption": the block attribute (when set) overrides the
// attachment's Display-captions setting (Video Editor > Display Settings,
// stored as `subsCapsButton`). When the block attribute is unset (legacy
// blocks), inherit the attachment setting, which itself defaults to on.
$godam_attachment_show_caption = ! isset( $godam_control_bar_settings['subsCapsButton'] ) || ! empty( $godam_control_bar_settings['subsCapsButton'] );
$godam_show_caption            = null === $godam_show_caption_attr ? $godam_attachment_show_caption : $godam_show_caption_attr;
$godam_tracks                  = $godam_show_caption && ! empty( $attributes['tracks'] ) ? $attributes['tracks'] : array();

$godam_job_id  = '';
$godam_sources = array();

if ( empty( $godam_attachment_id ) ) {
	$godam_job_id = ! empty( $attributes['cmmId'] ) ? sanitize_text_field( $attributes['cmmId'] ) : '';
} elseif ( $godam_is_virtual ) {
	// For virtual media the attachment_id is the GoDAM ID, which is the job_id.
	$godam_job_id = $godam_attachment_id;
}

if ( ( empty( $godam_attachment_id ) || ( $godam_is_virtual && ! empty( $godam_original_id ) ) ) &&
	! empty( $attributes['sources'] )
) {
	// Virtual media: sources supplied directly via attributes.
	$godam_sources = $attributes['sources'];
} elseif ( empty( $godam_attachment_id ) &&
	! ( empty( $godam_src ) && empty( $godam_transcoded_url ) && empty( $godam_hls_transcoded_url ) )
) {
	// Shortcode with explicit src / transcoded_url / hls_transcoded_url attributes.
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
	// Normal WP attachment — use cached transcoded/source URLs.
	if ( $godam_is_virtual ) {
		$godam_attachment_id = $godam_original_id;
	}

	$godam_transcoded_url     = $godam_attachment_data['transcoded_url'] ?? '';
	$godam_hls_transcoded_url = $godam_attachment_data['hls_transcoded_url'] ?? '';
	$godam_video_src          = $godam_attachment_data['video_src'] ?? '';
	$godam_video_src_type     = $godam_attachment_data['video_src_type'] ?? '';
	$godam_job_id             = $godam_attachment_data['job_id'] ?? '';

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

$godam_woocommerce_allowed_contexts = apply_filters( 'godam_player_woocommerce_contexts', array() );

$godam_woocommerce_context = false;

if ( isset( $attributes['godam_context'] ) && ! empty( $godam_woocommerce_allowed_contexts ) ) {
	$godam_woocommerce_context = in_array( $attributes['godam_context'], $godam_woocommerce_allowed_contexts, true );
}

// Check if this video is loaded inside a GoDAM Gallery modal iframe.
// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- No nonce needed for this read-only context flag.
$godam_is_gallery_context = ! empty( $_GET['godam_gallery'] ) && '1' === sanitize_key( $_GET['godam_gallery'] );

if ( isset( $attributes['godam_context'] ) && $godam_woocommerce_context ) {
	$godam_player_skin = apply_filters( 'godam_player_woocommerce_skin', 'reels', $attributes['godam_context'] );
} else {
	$godam_player_skin = isset( $godam_settings['video_player']['player_skin'] )
		? $godam_settings['video_player']['player_skin']
		: 'Default';
}

$godam_ads_settings = isset( $godam_settings['ads_settings'] ) ? $godam_settings['ads_settings'] : array();

$godam_ads_settings       = wp_json_encode( $godam_ads_settings );
$godam_global_video_share = isset( $godam_settings['video']['enable_global_video_share'] ) ? $godam_settings['video']['enable_global_video_share'] : true;

$godam_video_poster = empty( $godam_poster ) ? $godam_poster_image : $godam_poster;
$godam_performance  = rtgodam_get_video_performance_settings( $attributes );

/**
 * Filter the final performance-resolved attributes used to render a GoDAM video block.
 *
 * This runs after legacy preload values are mapped to the new performance modes,
 * and before the HTML attributes are printed.
 *
 * @param array $render_attributes {
 *     Final resolved render attributes.
 *
 *     @type string $mode                  Balanced or priority.
 *     @type array  $video_attributes      Attributes applied to the <video> element.
 *     @type array  $poster_attributes     Attributes applied to the poster <img>.
 * }
 * @param array $attributes Original block or shortcode attributes.
 */
$godam_performance = apply_filters(
	'godam_video_block_attributes',
	$godam_performance,
	$attributes
);

$godam_preload                  = isset( $godam_performance['video_attributes']['preload'] ) ? sanitize_text_field( $godam_performance['video_attributes']['preload'] ) : 'none';
$godam_poster_render_attributes = isset( $godam_performance['poster_attributes'] ) && is_array( $godam_performance['poster_attributes'] )
	? $godam_performance['poster_attributes']
	: array();
$godam_poster_attribute_string  = rtgodam_format_html_attributes( $godam_poster_render_attributes );

// Resolve the blur-up placeholder thumbnail.
// For block-editor poster overrides, look up the mapping directly.
// For auto-selected thumbnails, use the pre-synced single meta key.
// Supports both normal WP media and virtual GoDAM media.
$godam_placeholder_thumbnail = '';
$godam_placeholder_lookup_id = is_numeric( $godam_attachment_id )
	? intval( $godam_attachment_id )
	: ( is_numeric( $godam_original_id ) ? intval( $godam_original_id ) : 0 );

if ( $godam_placeholder_lookup_id > 0 ) {
	if ( ! empty( $godam_poster ) ) {
		// Use cached placeholder map (array of poster_url → placeholder_url).
		$godam_placeholder_map = isset( $godam_attachment_data['placeholder_map'] ) && is_array( $godam_attachment_data['placeholder_map'] )
			? $godam_attachment_data['placeholder_map']
			: array();
		if ( isset( $godam_placeholder_map[ $godam_poster ] ) ) {
			$godam_placeholder_thumbnail = esc_url( $godam_placeholder_map[ $godam_poster ] );
		}
	} else {
		// Use cached single-placeholder thumbnail.
		$godam_placeholder_thumbnail = ! empty( $godam_attachment_data['placeholder_single'] )
			? esc_url( $godam_attachment_data['placeholder_single'] )
			: '';
	}
}
$godam_video_setup = array(
	'controls'    => $godam_controls,
	'autoplay'    => $godam_autoplay,
	'loop'        => $godam_loop,
	'muted'       => $godam_autoplay ? true : $godam_muted,
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

// The block's "Show caption" overrides the attachment's Display-captions
// setting for the CC button + caption display on the frontend.
$godam_video_setup['controlBar']['subsCapsButton'] = $godam_disable_subtitles_and_transcript ? false : $godam_show_caption;

// Allow add-ons to disable double-click-to-fullscreen for specific contexts.
$godam_no_dblclick_fullscreen_contexts = apply_filters( 'godam_player_no_dblclick_fullscreen_contexts', array() );
if ( isset( $attributes['godam_context'] ) && in_array( $attributes['godam_context'], $godam_no_dblclick_fullscreen_contexts, true ) ) {
	if ( ! isset( $godam_video_setup['userActions'] ) || ! is_array( $godam_video_setup['userActions'] ) ) {
		$godam_video_setup['userActions'] = array();
	}
	$godam_video_setup['userActions']['doubleClick'] = false;
}

$godam_video_setup = wp_json_encode( $godam_video_setup );

$godam_frontend_layers = ! empty( $godam_meta_data['layers'] ) ? $godam_meta_data['layers'] : array();

// Strip the layer-manager JS's own rich-content fields (html/text) from the
// player's JSON config before encoding: it doesn't need them there (it reads
// the already-rendered HTML from the DOM separately), and leaving them out
// avoids duplicating potentially large freeform content into data-options.
// `rtgodam_video_layers_for_js` remains as an optional override point.
$godam_frontend_layers = apply_filters(
	'rtgodam_video_layers_for_js',
	array_map(
		function ( $godam_frontend_layer ) {
			return is_array( $godam_frontend_layer ) ? array_diff_key( $godam_frontend_layer, array_flip( array( 'html', 'text' ) ) ) : $godam_frontend_layer;
		},
		$godam_frontend_layers
	)
);

$godam_video_config = wp_json_encode(
	array(
		'preview'           => $godam_video_preview,
		'layers'            => $godam_frontend_layers, // contains list of layers.
		'chapters'          => ! empty( $godam_meta_data['chapters'] ) ? $godam_meta_data['chapters'] : array(), // contains list of chapters.
		'overlayTimeRange'  => $godam_overlay_time_range, // Add overlay time range to video config.
		'playerSkin'        => $godam_player_skin, // Add player skin to video config. Add brand image to video config.
		'aspectRatio'       => $godam_aspect_ratio,
		'showShareBtn'      => true === $godam_global_video_share ? $godam_show_share_btn : false,
		'showTranscription' => $godam_disable_subtitles_and_transcript ? false : $godam_show_transcription,
		'showCaption'       => $godam_disable_subtitles_and_transcript ? false : $godam_show_caption,
	)
);

if ( ! empty( $godam_appearance_color ) ) {
	$godam_easydam_control_bar_color = $godam_appearance_color;
} elseif ( ! empty( $godam_brand_color ) ) {
	$godam_easydam_control_bar_color = $godam_brand_color;
}

$godam_raw_hover_color            = ! empty( $godam_meta_data['videoConfig']['controlBar']['hoverColor'] ) ? $godam_meta_data['videoConfig']['controlBar']['hoverColor'] : '#fff';
$godam_easydam_hover_color        = preg_match( '/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/', $godam_raw_hover_color ) ? $godam_raw_hover_color : '#fff';
$godam_easydam_hover_zoom         = (float) ( $godam_meta_data['videoConfig']['controlBar']['zoomLevel'] ?? 0 );
$godam_easydam_custom_btn_img     = ! empty( $godam_meta_data['videoConfig']['controlBar']['customPlayBtnImg'] ) ? $godam_meta_data['videoConfig']['controlBar']['customPlayBtnImg'] : '';
$godam_easydam_control_bar_config = ! empty( $godam_meta_data['videoConfig']['controlBar'] ) ? $godam_meta_data['videoConfig']['controlBar'] : array();

$godam_layers     = $godam_meta_data['layers'] ?? array();
$godam_ad_tag_url = '';

$godam_ads_layers = array_filter(
	$godam_layers,
	function ( $godam_layer ) {
		return 'ad' === $godam_layer['type'];
	}
);

$godam_ad_server = isset( $godam_meta_data['videoConfig']['adServer'] ) ? sanitize_text_field( $godam_meta_data['videoConfig']['adServer'] ) : 'self-hosted';

if ( ! empty( $godam_ad_server ) && 'ad-server' === $godam_ad_server ) :
	$godam_ad_tag_url = isset( $godam_meta_data['videoConfig']['adTagURL'] ) ? $godam_meta_data['videoConfig']['adTagURL'] : '';
elseif ( ! empty( $godam_ads_layers ) && 'self-hosted' === $godam_ad_server ) :
	$godam_ad_tag_url = get_rest_url( get_current_blog_id(), '/godam/v1/adTagURL/' ) . $godam_attachment_id;
endif;

// Enqueue IMA SDK assets only if Ad is enabled for this GoDAM player block.
if ( ! empty( $godam_ad_tag_url ) ) {
	IMA_Assets::get_instance();
}

// Allow callers that cache output (e.g. the shortcode renderer) to inject a
// deterministic ID so cached HTML doesn't embed a random value. When no ID is
// pre-set, fall back to a random one (non-cached / direct-require path).
if ( ! isset( $godam_instance_id ) ) {
	$godam_instance_id = 'video_' . bin2hex( random_bytes( 8 ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.rand_rand
}

// When a player height is set, derive max-width = height × (arW / arH), mirroring
// the video-editor approach. This lets Video.js (fluid:true) fill the width and
// naturally reach the desired height via the aspect-ratio padding trick.
$godam_player_height      = ! empty( $attributes['playerHeight'] ) ? $attributes['playerHeight'] : '';
$godam_computed_max_width = '';
if ( ! empty( $godam_player_height ) && preg_match( '/^\d+:\d+$/', $godam_aspect_ratio ) ) {
	preg_match( '/^([\d.]+)([a-z%]*)$/', $godam_player_height, $godam_height_match );
	if ( ! empty( $godam_height_match[1] ) ) {
		$godam_height_value  = (float) $godam_height_match[1];
		$godam_allowed_units = array( 'px', 'em', 'rem', 'vh', 'vw', '%' );
		$godam_height_unit   = ( isset( $godam_height_match[2] ) && in_array( $godam_height_match[2], $godam_allowed_units, true ) )
			? $godam_height_match[2]
			: 'px';
		$godam_ar_parts      = explode( ':', $godam_aspect_ratio );
		$godam_ar_w          = (float) $godam_ar_parts[0];
		$godam_ar_h          = (float) $godam_ar_parts[1];
		if ( $godam_ar_h > 0 && $godam_ar_w > 0 ) {
			$godam_computed_max_width = round( $godam_height_value * ( $godam_ar_w / $godam_ar_h ) ) . $godam_height_unit;
		}
	}
}

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

if ( ! empty( $godam_computed_max_width ) ) {
	$godam_custom_css_properties['max-width'] = $godam_computed_max_width;
}

// Build the inline style string, escaping each value.
$godam_custom_inline_styles = '';
foreach ( $godam_custom_css_properties as $godam_property => $godam_value ) {
	if ( ! empty( $godam_value ) ) {
		$godam_custom_inline_styles .= $godam_property . ': ' . $godam_value . ';';
	}
}

// Get WPBakery Design Options CSS class if available.
$godam_css_class = ! empty( $attributes['css_class'] ) ? trim( $attributes['css_class'] ) : '';

// Build the figure attributes for the <figure> element.
if ( $godam_is_shortcode || $godam_is_elementor_widget ) {
	$godam_style_attr = ! empty( $godam_custom_inline_styles )
		? 'style="' . esc_attr( $godam_custom_inline_styles ) . '"'
		: '';
	$godam_class_attr = '';
	if ( ! empty( $godam_css_class ) ) {
		$godam_class_attr = 'class="' . esc_attr( $godam_css_class ) . '"';
	}
	$godam_figure_attributes = trim( $godam_class_attr . ' ' . $godam_style_attr );
} else {
	$godam_additional_attributes = array();
	if ( ! empty( $godam_custom_inline_styles ) ) {
		$godam_additional_attributes['style'] = esc_attr( $godam_custom_inline_styles );
	}
	if ( ! empty( $godam_css_class ) ) {
		$godam_additional_attributes['class'] = esc_attr( $godam_css_class );
	}
	$godam_figure_attributes = get_block_wrapper_attributes( $godam_additional_attributes );
}

/**
 * Transcription resolution order on the front end:
 *
 * 1. `data-transcript-url` — the transcript stored on the attachment
 *    (`rtgodam_transcript_path`), i.e. whatever the Transcription tab of the
 *    media editor last generated or the user uploaded. This wins so a
 *    hand-uploaded .vtt/.srt is what visitors actually get.
 * 2. `data-transcript-deleted` — set when the user deleted the transcript in
 *    the editor. The player then shows nothing instead of resurrecting the
 *    SaaS copy.
 * 3. Otherwise the frontend JavaScript falls back to fetching the transcript
 *    URL by job_id via the public API endpoint:
 *    GET /api/method/godam_core.api.process.get_public_transcription_path?job_name=<job_id>
 *    which keeps ETag/Cache-Control caching for attachments that were never
 *    opened in the editor (and for virtual media with no local meta).
 */
$godam_transcript_url     = (string) ( $godam_attachment_data['transcript_path'] ?? '' );
$godam_transcript_deleted = ! empty( $godam_attachment_data['transcript_deleted'] );

$godam_attachment_title = '';

/**
 * Fires before this title/filename fallback block, so integrations that
 * centralize media on another site can switch context first.
 *
 * @since 2.2.0
 */
do_action( 'rtgodam_before_attachment_lookup' );

if ( ! empty( $godam_attachment_id ) && is_numeric( $godam_attachment_id ) ) {
	$godam_attachment_title = get_the_title( $godam_attachment_id );
} elseif ( ! empty( $godam_original_id ) && is_numeric( $godam_original_id ) ) {
	$godam_attachment_title = get_the_title( $godam_original_id );
}
// Use the filename as the title.
if ( empty( $godam_attachment_title ) ) {
	$godam_attachment_title = basename( get_attached_file( $godam_attachment_id ) );
}

do_action( 'rtgodam_after_attachment_lookup' );

?>

<?php if ( ! empty( $godam_sources ) ) : ?>
	<div <?php echo wp_kses_data( $godam_figure_attributes ); ?>>
		<figure id="godam-player-container-<?php echo esc_attr( $godam_instance_id ); ?>">
			<div class="godam-video-wrapper<?php echo $godam_show_in_lightbox ? ' godam-show-in-lightbox' : ''; ?>">
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

				<?php if ( ! empty( $godam_video_poster ) && ! empty( $godam_placeholder_thumbnail ) ) : ?>
				<div
					class="godam-video-placeholder godam-blurred-img <?php echo esc_attr( 'godam-' . strtolower( $godam_player_skin ) . '-skin' ); ?>"
					style="background-image: url('<?php echo esc_url( $godam_placeholder_thumbnail ); ?>')"
				>
					<div class="animate-play-btn">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
							<path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
						</svg>
					</div>
					<img
						class="godam-player-poster-image"
						src="<?php echo esc_url( $godam_video_poster ); ?>"
						<?php echo $godam_poster_attribute_string ? wp_kses_data( $godam_poster_attribute_string ) : ''; ?>
						aria-hidden="true"
						alt="<?php echo esc_attr( $godam_attachment_title ); ?>"
					/>
				</div>
				<?php elseif ( ! empty( $godam_video_poster ) ) : ?>
				<div class="godam-video-placeholder <?php echo esc_attr( 'godam-' . strtolower( $godam_player_skin ) . '-skin' ); ?>">
					<div class="animate-play-btn">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
							<path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
						</svg>
					</div>
					<img
						class="godam-player-poster-image"
						src="<?php echo esc_url( $godam_video_poster ); ?>"
						<?php echo $godam_poster_attribute_string ? wp_kses_data( $godam_poster_attribute_string ) : ''; ?>
						aria-hidden="true"
						alt="<?php echo esc_attr( $godam_attachment_title ); ?>"
					/>
				</div>
				<?php else : ?>
				<div class="godam-video-placeholder godam-animate-video-loading <?php echo esc_attr( 'godam-' . strtolower( $godam_player_skin ) . '-skin' ); ?>">
					<div class="animate-play-btn">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
							<path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
						</svg>
					</div>
				</div>
				<?php endif; ?>

				<div class="easydam-video-container loading <?php echo esc_attr( 'godam-' . strtolower( $godam_player_skin ) . '-skin' ); ?>" data-test-id="godam-video-render" >
					<?php if ( isset( $godam_hover_select ) && 'shadow-overlay' === $godam_hover_select ) : ?>
						<div class="godam-player-overlay"></div>
					<?php endif; ?>

					<video
						class="easydam-player video-js vjs-big-play-centered vjs-hidden"
						<?php if ( $godam_autoplay || $godam_muted ) : ?>
							muted
						<?php endif; ?>
						<?php if ( $godam_autoplay ) : ?>
							autoplay
						<?php endif; ?>
						playsinline webkit-playsinline
						data-options="<?php echo esc_attr( $godam_video_config ); ?>"
						data-ad_tag_url="<?php echo ! $godam_woocommerce_context ? esc_url( $godam_ad_tag_url ) : ''; ?>"
						data-id="<?php echo esc_attr( is_numeric( $godam_attachment_id ) ? $godam_attachment_id : $godam_original_id ); ?>"
						data-instance-id="<?php echo esc_attr( $godam_instance_id ); ?>"
						data-controls="<?php echo esc_attr( $godam_video_setup ); ?>"
						data-job_id="<?php echo esc_attr( $godam_job_id ); ?>"
						data-block-source="<?php echo esc_attr( $godam_block_source ); ?>"
						<?php if ( ! empty( $godam_host_post_id ) ) : ?>
							data-host-post-id="<?php echo esc_attr( $godam_host_post_id ); ?>"
						<?php endif; ?>
							data-global_ads_settings="<?php echo esc_attr( $godam_ads_settings ); ?>"
							data-hover-select="<?php echo esc_attr( $godam_hover_select ); ?>"
							data-video-title="<?php echo esc_attr( $godam_attachment_title ); ?>"
							data-autoplay-on-view="<?php echo esc_attr( ( $godam_autoplay && 'auto' !== $godam_preload ) ? 'true' : 'false' ); ?>"
							data-disable-transcript="<?php echo esc_attr( $godam_disable_subtitles_and_transcript ? 'true' : 'false' ); ?>"
							data-transcript-url="<?php echo esc_url( $godam_transcript_url ); ?>"
							data-transcript-deleted="<?php echo esc_attr( $godam_transcript_deleted ? 'true' : 'false' ); ?>"
							data-show-in-lightbox="<?php echo esc_attr( $godam_show_in_lightbox ? 'true' : 'false' ); ?>"
						>
							<?php

							// Caption display follows the block's "Show caption" (already
							// resolved against the attachment's Display-captions setting).
							$godam_display_caption = ! $godam_disable_subtitles_and_transcript && $godam_show_caption;

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
					if ( ! empty( $godam_meta_data['layers'] ) && ! $godam_woocommerce_context ) :
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

									// Enqueue GoDAM specific jetpack form script only if Jetpack form is used in this GoDAM player block.
									Jetpack_Form_Assets::get_instance();

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
								$godam_cta_type         = isset( $godam_layer['cta_type'] ) ? $godam_layer['cta_type'] : '';
								$godam_render_html_cta  = ( 'html' === $godam_cta_type && ! empty( $godam_layer['html'] ) );
								$godam_render_image_cta = ( 'image' === $godam_cta_type );
								// Only HTML and Card (image) CTAs are supported. Legacy "text" CTAs
								// (and any other unknown/empty type) render nothing — skipping the
								// overlay container avoids an empty box that would otherwise pause
								// playback with no content. The frontend layer JS no-ops when the
								// matching DOM element is absent, so the video just plays through.
								if ( $godam_render_html_cta || $godam_render_image_cta ) :
									?>
									<div id="layer-<?php echo esc_attr( $godam_instance_id . '-' . $godam_layer['id'] ); ?>" class="easydam-layer hidden" style="background-color: <?php echo isset( $godam_layer['bg_color'] ) ? esc_attr( $godam_layer['bg_color'] ) : '#FFFFFFB3'; ?>">
										<?php if ( $godam_render_html_cta ) : ?>
											<div class="easydam-layer--cta-html">
												<?php
												// Run shortcodes in CTA HTML by default (e.g. a Marketo form
												// shortcode) rather than requiring an extension-side filter
												// listener to enable it; `rtgodam_cta_html_content` remains as
												// an optional override point.
												echo apply_filters( 'rtgodam_cta_html_content', do_shortcode( wp_kses_post( $godam_layer['html'] ) ), $godam_layer ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- wp_kses_post() already sanitizes; do_shortcode()/the filter run after, same pattern as godam_preview_page_content().
												?>
											</div>
										<?php else : ?>
											<?php echo wp_kses_post( rtgodam_image_cta_html( $godam_layer ) ); ?>
										<?php endif; ?>
									</div>
									<?php
								endif;
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
								// Extensible layer types (e.g. WooCommerce) rendered by add-ons.
							else :
								/**
								 * Action to render add-on layer containers.
								 *
								 * @param array  $godam_layer       Layer configuration.
								 * @param string $godam_instance_id Player instance ID.
								 */
								do_action( 'godam_player_render_layer', $godam_layer, $godam_instance_id );
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
					do_action( 'rtgodam_after_video_html', $attributes, $godam_instance_id, $godam_meta_data, $godam_settings );
			?>
		</figure>
	</div>
<?php endif; ?>
