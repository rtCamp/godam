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
$src           = ! empty( $attributes['src'] ) ? esc_url( $attributes['src'] ) : '';
$sources       = ! empty( $attributes['sources'] ) ? $attributes['sources'] : array();
$tracks        = ! empty( $attributes['tracks'] ) ? $attributes['tracks'] : array();
$attachment_id = ! empty( $attributes['id'] ) ? intval( $attributes['id'] ) : null;

// Retrieve easydam_meta for the attachment id.
$easydam_meta      = $attachment_id ? get_post_meta( $attachment_id, 'easydam_meta', true ) : '';
$easydam_meta_data = $easydam_meta ? json_decode( $easydam_meta, true ) : array();

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
		'id'           => $attachment_id,
		'easydam_meta' => $easydam_meta_data,
	)
);

?>

<?php if ( $src ) : ?>
<figure <?php echo wp_kses_data( get_block_wrapper_attributes() ); ?>>
	<div class="easydam-video-container">
		<video
			class="easydam-player video-js vjs-big-play-centered"
			data-setup="<?php echo esc_attr( $video_setup ); ?>"
		>
			<source src="<?php echo esc_url( $src ); ?>" type="video/mp4" />

			<?php
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

	<!-- Dynamically render shortcodes for form layers -->
	<?php
	if ( ! empty( $easydam_meta_data['layers'] ) ) :
		foreach ( $easydam_meta_data['layers'] as $layer ) :
			if ( isset( $layer['type'] ) && 'form' === $layer['type'] && ! empty( $layer['gf_id'] ) ) :
				?>
				<div id="layer-<?php echo esc_attr( $layer['id'] ); ?>" class="easydam-layer hidden">
					<div class="form-container">
						<?php
							$theme = ! empty( $layer['template'] ) ? esc_attr( $layer['template'] ) : '';
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
			<?php elseif ( isset( $layer['type'] ) && 'cta' === $layer['type'] ) : ?>
				<div id="layer-<?php echo esc_attr( $layer['id'] ); ?>" class="easydam-layer hidden">
					<!-- Add sample button for now -->
					<button class="cta-button">Call To Action</button>
				</div>
				<?php
			endif;
		endforeach;
	endif;
	?>
	</div>
</figure>
	<?php
endif;
