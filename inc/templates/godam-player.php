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

// attributes.
$autoplay      = ! empty( $attributes['autoplay'] );
$controls      = isset( $attributes['controls'] ) ? $attributes['controls'] : true;
$loop          = ! empty( $attributes['loop'] );
$muted         = ! empty( $attributes['muted'] );
$poster        = ! empty( $attributes['poster'] ) ? esc_url( $attributes['poster'] ) : '';
$preload       = ! empty( $attributes['preload'] ) ? esc_attr( $attributes['preload'] ) : 'auto';
$caption       = ! empty( $attributes['caption'] ) ? esc_html( $attributes['caption'] ) : '';
$heading       = ! empty( $attributes['heading'] ) ? wp_kses_post( $attributes['heading'] ) : '';
$tracks        = ! empty( $attributes['tracks'] ) ? $attributes['tracks'] : array();
$attachment_id = ! empty( $attributes['id'] ) ? intval( $attributes['id'] ) : null;
$video_preview = isset( $attributes['preview'] ) ? $attributes['preview'] : false;

$src            = ! empty( $attributes['src'] ) ? esc_url( $attributes['src'] ) : '';
$transcoded_url = ! empty( $attributes['transcoded_url'] ) ? esc_url( $attributes['transcoded_url'] ) : '';

// Retrieve 'rtgodam_meta' for the given attachment ID, defaulting to an empty array if not found.
$easydam_meta_data = $attachment_id ? get_post_meta( $attachment_id, 'rtgodam_meta', true ) : array();
$easydam_meta_data = is_array( $easydam_meta_data ) ? $easydam_meta_data : array();

// Extract control bar settings with a fallback to an empty array.
$control_bar_settings = $easydam_meta_data['videoConfig']['controlBar'] ?? array();

$poster_image = get_post_meta( $attachment_id, 'rtgodam_media_video_thumbnail', true );
$poster_image = ! empty( $poster_image ) ? $poster_image : '';

$job_id = '';

$sources = array();
if ( empty( $attachment_id ) && ! empty( $attributes['sources'] ) ) {
	$sources = $attributes['sources'];
} elseif ( empty( $attachment_id ) &&
	( ! empty( $src || ! empty( $transcoded_url ) ) )
) {
	$sources = array();
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
	$transcoded_url = $attachment_id ? get_post_meta( $attachment_id, 'rtgodam_transcoded_url', true ) : '';
	$video_src      = $attachment_id ? wp_get_attachment_url( $attachment_id ) : '';
	$video_src_type = $attachment_id ? get_post_mime_type( $attachment_id ) : '';
	$job_id         = $attachment_id && ! empty( $transcoded_url ) ? get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true ) : '';

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
}

// Build the video setup options for data-setup.
$video_setup = array(
	'controls'    => $controls,
	'autoplay'    => $autoplay,
	'loop'        => $loop,
	'muted'       => $muted,
	'preload'     => $preload,
	'poster'      => empty( $poster ) ? $poster_image : $poster,
	'fluid'       => true,
	'sources'     => $sources,
	'playsinline' => true,
);
if ( ! empty( $control_bar_settings ) ) {
	$video_setup['controlBar'] = $control_bar_settings; // contains settings specific to control bar.
}
$video_setup = wp_json_encode( $video_setup );

$video_config = wp_json_encode(
	array(
		'preview'  => $video_preview,
		'layers'   => ! empty( $easydam_meta_data['layers'] ) ? $easydam_meta_data['layers'] : array(), // contains list of layers.
		'chapters' => ! empty( $easydam_meta_data['chapters'] ) ? $easydam_meta_data['chapters'] : array(), // contains list of chapters.
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

$ad_server = isset( $easydam_meta_data['videoConfig']['adServer'] ) ? sanitize_text_field( $easydam_meta_data['videoConfig']['adServer'] ) : 'self-hosted';

if ( ! empty( $ad_server ) && 'ad-server' === $ad_server ) :
	$ad_tag_url = isset( $easydam_meta_data['videoConfig']['adTagURL'] ) ? $easydam_meta_data['videoConfig']['adTagURL'] : '';
elseif ( ! empty( $ads_layers ) && 'self-hosted' === $ad_server ) :
	$ad_tag_url = get_rest_url( get_current_blog_id(), '/godam/v1/adTagURL/' ) . $attachment_id;
endif;

$instance_id = 'video_' . bin2hex( random_bytes( 8 ) );

// Add vertical alignment attribute.
$vertical_alignment = ! empty( $attributes['verticalAlignment'] ) ? esc_attr( $attributes['verticalAlignment'] ) : 'center';

// Get alignment styles inline.
$alignment_map = array(
	'top'    => 'flex-start',
	'center' => 'center',
	'bottom' => 'flex-end',
);

$justify_content  = isset( $alignment_map[ $vertical_alignment ] ) ? $alignment_map[ $vertical_alignment ] : 'center';
$alignment_styles = "display: flex; flex-direction: column; justify-content: {$justify_content}; align-items: stretch; height: 100%; overflow: hidden;";
?>

<?php if ( ! empty( $sources ) ) : ?>
	<figure
	<?php echo $is_shortcode || $is_elementor_widget ? '' : wp_kses_data( get_block_wrapper_attributes() ); ?>
	style="
	--rtgodam-control-bar-color: <?php echo esc_attr( $easydam_control_bar_color ); ?>;
	--rtgodam-control-hover-color: <?php echo esc_attr( $easydam_hover_color ); ?>;
	--rtgodam-control-hover-zoom: <?php echo esc_attr( 1 + $easydam_hover_zoom ); ?>;
	--rtgodam-custom-play-button-url: url(<?php echo esc_url( $easydam_custom_btn_img ); ?>);
	<?php echo $attributes['aspectRatio'] ? '--rtgodam-video-aspect-ratio: ' . esc_attr( $attributes['aspectRatio'] ) : ''; ?>
	">
		<div class="godam-video-wrapper" style="position: relative;">
			<?php if ( ! empty( $inner_blocks_content ) ) : ?>
				<div
					class="godam-video-overlay-container"
					data-overlay-content
					style="
						position: absolute;
						top: 0;
						left: 0;
						right: 0;
						bottom: 0;
						z-index: 100;
						pointer-events: none;
						opacity: 1;
						transition: opacity 0.3s ease;
						<?php echo esc_attr( $alignment_styles ); ?>
					"
				>
					<?php
					// Safely output the inner blocks content.
					echo wp_kses_post( $inner_blocks_content );
					?>
				</div>
			<?php endif; ?>

			<div class="easydam-video-container animate-video-loading" style="position: relative;">
				<?php if ( ! empty( $heading ) ) : ?>
					<div
						class="godam-video-heading-overlay"
						data-heading-overlay
						style="
							position: absolute;
							top: 50%;
							left: 20px;
							right: 20px;
							transform: translateY(-50%);
							z-index: 10;
							color: <?php echo esc_attr( $heading_color ); ?>;
							background-color: <?php echo esc_attr( $heading_bg_color ); ?>;
							font-size: 24px;
							font-weight: bold;
							text-shadow: 2px 2px 4px rgba(0,0,0,0.7);
							padding: 8px;
							border-radius: 4px;
							opacity: 1;
							transition: opacity 0.3s ease;
						"
					>
						<?php echo wp_kses_post( $heading ); ?>
					</div>
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
					data-has-heading="<?php echo ! empty( $heading ) ? 'true' : 'false'; ?>"
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
											echo do_shortcode(
												sprintf(
													"[wpforms id='%d' title='false' description='false' ajax='true']",
													intval( $layer['wpform_id'] )
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

								if ( $form_html && ! is_wp_error( $form_html ) ) :									?>
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
							elseif ( 'everest-forms' === $form_type && ! empty( $layer['everest_form_id'] ) ) :
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
		<?php endif; ?>
	</figure>

<?php endif; ?>
