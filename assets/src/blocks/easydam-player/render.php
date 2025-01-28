<?php
/**
 * Render template for the EasyDAM Player Block.
 *
 * This file dynamically renders the video player block on the frontend.
 *
 * @package EasyDAM
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
$sources       = ! empty( $attributes['sources'] ) ? $attributes['sources'] : array();
$tracks        = ! empty( $attributes['tracks'] ) ? $attributes['tracks'] : array();
$attachment_id = ! empty( $attributes['id'] ) ? intval( $attributes['id'] ) : null;
$preview       = isset($attributes['preview'])? $attributes['preview'] : false;

// Retrieve easydam_meta for the attachment id.
$easydam_meta_data = $attachment_id ? get_post_meta( $attachment_id, 'easydam_meta', true ) : '';

// Build the video setup options for data-setup.
$video_setup = wp_json_encode(
	array(
		'controls'     => $controls,
		'autoplay'     => $autoplay,
		'loop'         => $loop,
		'muted'        => $muted,
		'preload'      => $preload,
		'poster'       => $poster,
		'fluid'        => true,
		'sources'      => $sources,
		'preview'      => $preview,
		'easydam_meta' => $easydam_meta_data,
	)
);

$layers     = $easydam_meta_data['layers'] ?? array();
$ads_layers = array_filter(
	$layers,
	function ( $layer ) {
		return 'ad' === $layer['type'];
	}
);
$ad_tag_url = '';

$ad_server = isset( $easydam_meta_data['videoConfig']['adServer'] ) ? sanitize_text_field( $easydam_meta_data['videoConfig']['adServer'] ) : '';

if ( 'ad-server' === $ad_server ) :
	$ad_tag_url = isset( $easydam_meta_data['videoConfig']['adTagURL'] ) ? $easydam_meta_data['videoConfig']['adTagURL'] : '';
elseif ( 'self-hosted' === $ad_server && ! empty( $ads_layers ) ) :
	$ad_tag_url = rest_url( '/easydam/v1/adTagURL/' ) . $attachment_id;
endif;

$instance_id = 'video_' . bin2hex( random_bytes( 8 ) );
?>

<?php if ( ! empty( $sources ) ) : ?>
	<figure <?php echo wp_kses_data( get_block_wrapper_attributes() ); ?>>
	<div class="easydam-video-container">
		<video
			class="easydam-player video-js vjs-big-play-centered"
			data-options="<?php echo esc_attr( $video_setup ); ?>"
			data-ad_tag_url="<?php echo esc_url_raw( $ad_tag_url ); ?>"
			data-id="<?php echo esc_attr( $attachment_id ); ?>" 
			data-instance-id="<?php echo esc_attr( $instance_id ); ?>"
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
			?>
		</video>

		<?php if ( $caption ) : ?>
			<figcaption><?php echo esc_html( $caption ); ?></figcaption>
		<?php endif; ?>

		<!-- Dynamically render shortcodes for form layers. -->
		<?php
		if ( ! empty( $easydam_meta_data['layers'] ) ) :
			foreach ( $easydam_meta_data['layers'] as $layer ) :
				// FORM layer.
				if ( isset( $layer['type'] ) && 'form' === $layer['type'] && ! empty( $layer['gf_id'] ) ) :
					?>
					<div id="layer-<?php echo esc_attr( $instance_id . '-' . $layer['id'] ); ?>" class="easydam-layer hidden" style="background-color: <?php echo esc_attr( $layer['bg_color'] ); ?>">
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
					<div id="layer-<?php echo esc_attr( $instance_id . '-' . $layer['id'] ); ?>" class="easydam-layer hidden" style="background-color: <?php echo esc_attr( $layer['bg_color'] ); ?>">
						<?php if ( 'text' === $layer['cta_type'] ) : ?>
							<div class="ql-editor easydam-layer--cta-text">
								<?php echo wp_kses_post( $layer['text'] ); ?>
							</div>
						<?php elseif ( 'html' === $layer['cta_type'] && ! empty( $layer['html'] ) ) : ?>
							<?php echo wp_kses_post( $layer['html'] ); ?>
						<?php elseif ( 'image' === $layer['cta_type'] && ! empty( $layer['image'] ) ) : ?>
							<?php echo wp_kses_post( image_cta_html( $layer ) ); ?>
						<?php endif; ?>
					</div>
					<?php
					// HOTSPOT layer.
				elseif ( isset( $layer['type'] ) && 'hotspot' === $layer['type'] ) :
					?>
					<div
						id="layer-<?php echo esc_attr( $instance_id . '-' . $layer['id'] ); ?>"
						class="easydam-layer hidden hotspot-layer"
						style="background-color: <?php echo esc_attr( $layer['bg_color'] ); ?>"
					>
					</div>
					<?php
				endif;
				?>
			<?php endforeach; ?>
		<?php endif; ?>
	</div>
</figure>
<?php endif; ?>
