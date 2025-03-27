<?php
/**
 * Render template for the GoDAM Player Block.
 *
 * This file dynamically renders the video player block on the frontend.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Block attributes.
$autoplay      = ! empty( $attributes['autoplay'] );
$controls      = isset( $attributes['controls'] ) ? $attributes['controls'] : true;
$loop          = ! empty( $attributes['loop'] );
$muted         = ! empty( $attributes['muted'] );
$poster        = ! empty( $attributes['poster'] ) ? esc_url( $attributes['poster'] ) : '';
$preload       = ! empty( $attributes['preload'] ) ? esc_attr( $attributes['preload'] ) : 'auto';
$plays_inline  = ! empty( $attributes['playsInline'] );
$caption       = ! empty( $attributes['caption'] ) ? esc_html( $attributes['caption'] ) : '';
$tracks        = ! empty( $attributes['tracks'] ) ? $attributes['tracks'] : array();
$attachment_id = ! empty( $attributes['id'] ) ? intval( $attributes['id'] ) : null;
$video_preview = isset( $attributes['preview'] ) ? $attributes['preview'] : false;

// Retrieve 'rtgodam_meta' for the given attachment ID, defaulting to an empty array if not found.
$easydam_meta_data = $attachment_id ? get_post_meta( $attachment_id, 'rtgodam_meta', true ) : array();
$easydam_meta_data = is_array( $easydam_meta_data ) ? $easydam_meta_data : array();

// Extract control bar settings with a fallback to an empty array.
$control_bar_settings = $easydam_meta_data['videoConfig']['controlBar'] ?? array();

$poster_image = get_post_meta( $attachment_id, 'rtgodam_media_video_thumbnail', true );
$poster_image = ! empty( $poster_image ) ? $poster_image : '';

$sources        = array();
$transcoded_url = $attachment_id ? get_post_meta( $attachment_id, 'rtgodam_transcoded_url', true ) : '';
$video_src      = $attachment_id ? wp_get_attachment_url( $attachment_id ) : '';
$video_src_type = $attachment_id ? get_post_mime_type( $attachment_id ) : '';

if ( ! empty( $transcoded_url ) ) {
	$sources = array(
		array(
			'src'  => $transcoded_url,
			'type' => 'application/dash+xml',
		),
		array(
			'src'  => $video_src,
			'type' => 'video/quicktime' === $video_src_type ? 'video/mp4' : $video_src_type,
		),
	);
} else {
	$sources = array(
		array(
			'src'  => $video_src,
			'type' => 'video/quicktime' === $video_src_type ? 'video/mp4' : $video_src_type,
		),
	);
}

// Build the video setup options for data-setup.
$video_setup = wp_json_encode(
	array(
		'controls'   => $controls,
		'autoplay'   => $autoplay,
		'loop'       => $loop,
		'muted'      => $muted,
		'preload'    => $preload,
		'poster'     => empty( $poster ) ? $poster_image : $poster,
		'fluid'      => true,
		'sources'    => $sources,
		'controlBar' => $control_bar_settings, // contains settings specific to control bar.
	)
);

$video_config = wp_json_encode(
	array(
		'preview' => $video_preview,
		'layers'  => ! empty( $easydam_meta_data['layers'] ) ? $easydam_meta_data['layers'] : array(), // contains list of layers.
	)
);

$easydam_control_bar_color = '#2b333fb3'; // Default color.

$godam_settings   = get_option( 'rtgodam-settings', array() );
$brand_color      = isset( $godam_settings['general']['brand_color'] ) ? $godam_settings['general']['brand_color'] : null;
$appearance_color = isset( $easydam_meta_data['videoConfig']['controlBar']['appearanceColor'] ) ? $easydam_meta_data['videoConfig']['controlBar']['appearanceColor'] : null;

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

$ad_server = isset( $easydam_meta_data['videoConfig']['adServer'] ) ? sanitize_text_field( $easydam_meta_data['videoConfig']['adServer'] ) : '';

if ( ! empty( $ad_server ) ) :
	$ad_tag_url = isset( $easydam_meta_data['videoConfig']['adTagURL'] ) ? $easydam_meta_data['videoConfig']['adTagURL'] : '';
elseif ( ! empty( $ads_layers ) ) :
	$ad_tag_url = get_rest_url( get_current_blog_id(), '/godam/v1/adTagURL/' ) . $attachment_id;
endif;

$instance_id = 'video_' . bin2hex( random_bytes( 8 ) );
?>

<?php if ( ! empty( $sources ) ) : ?>
	<figure <?php echo wp_kses_data( get_block_wrapper_attributes() ); ?>
	style="
	--rtgodam-control-bar-color: <?php echo esc_attr( $easydam_control_bar_color ); ?>;
	--rtgodam-control-hover-color: <?php echo esc_attr( $easydam_hover_color ); ?>;
	--rtgodam-control-hover-zoom: <?php echo esc_attr( 1 + $easydam_hover_zoom ); ?>;
	--rtgodam-custom-play-button-url: url(<?php echo esc_url( $easydam_custom_btn_img ); ?>);
	--rtgodam-video-aspect-ratio: <?php echo esc_attr( $attributes['aspectRatio'] ); ?>;
	">
	<div class="easydam-video-container animate-video-loading">
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
			data-controls = "<?php echo esc_attr( $video_setup ); ?>"
		>
			<?php
			foreach ( $sources as $source ) :
				if ( ! empty( $source['src'] ) && ! empty( $source['type'] ) ) :
					?>
					<source
						src="<?php echo esc_url( $source['src'] ); ?>"
						type="<?php echo esc_attr( $source['type'] ); ?>"
					/>
					<?php
				endif;
			endforeach;

			if ( isset( $easydam_meta_data['videoConfig']['controlBar']['subsCapsButton'] ) &&
				$easydam_meta_data['videoConfig']['controlBar']['subsCapsButton']
			) {
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

		<!-- Dynamically render shortcodes for form layers. -->
		<?php
		if ( ! empty( $easydam_meta_data['layers'] ) ) :
			foreach ( $easydam_meta_data['layers'] as $layer ) :
				// FORM layer.
				if ( isset( $layer['type'] ) && 'form' === $layer['type'] && ! empty( $layer['gf_id'] ) ) :
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
					// CTA layer.
				elseif ( isset( $layer['type'] ) && 'cta' === $layer['type'] ) :
					?>
					<div id="layer-<?php echo esc_attr( $instance_id . '-' . $layer['id'] ); ?>" class="easydam-layer hidden" style="background-color: <?php echo isset( $layer['bg_color'] ) ? esc_attr( $layer['bg_color'] ) : '#FFFFFFB3'; ?>">
						<?php if ( 'text' === $layer['cta_type'] ) : ?>
							<div class="ql-editor easydam-layer--cta-text">
								<?php echo wp_kses_post( $layer['text'] ); ?>
							</div>
						<?php elseif ( 'html' === $layer['cta_type'] && ! empty( $layer['html'] ) ) : ?>
							<?php echo wp_kses_post( $layer['html'] ); ?>
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
				?>
			<?php endforeach; ?>
		<?php endif; ?>
	</div>

	<?php if ( $caption && ! empty( $caption ) ) : ?>
		<figcaption class="wp-element-caption rtgodam-video-caption"><?php echo esc_html( $caption ); ?></figcaption>
	<?php endif; ?>
</figure>
<?php endif; ?>
