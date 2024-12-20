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
		'id'           => $attachment_id,
		'easydam_meta' => $easydam_meta_data,
	)
);

$player_track_sources = array(
	array(
		'sourceURL' => 'https://example.com/captions-en.vtt',
		'srcLang'   => 'en',
		'label'     => 'English',
	),
	array(
		'sourceURL' => 'https://example.com/captions-fr.vtt',
		'srcLang'   => 'fr',
		'label'     => 'French',
	),
);

?>

<?php if ( $src ) : ?>
<figure <?php echo wp_kses_data( get_block_wrapper_attributes() ); ?> 
	style="
	--easydam-control-bar-color: <?php echo esc_attr( $easydam_meta_data['videoConfig']['controlBar']['appearanceColor'] ); ?>;
	--easydam-control-hover-color: <?php echo esc_attr( $easydam_meta_data['videoConfig']['controlBar']['hoverColor'] ); ?>;
	--easydam-control-hover-zoom: <?php echo esc_attr( 1 + $easydam_meta_data['videoConfig']['controlBar']['zoomLevel'] ); ?>;
	--easydam-custom-play-button-url: url(<?php echo esc_url( $easydam_meta_data['videoConfig']['controlBar']['customPlayBtnImg'] ); ?>);
	">
	<div class="easydam-video-container">
		<video
			class="easydam-player video-js vjs-big-play-centered"
			data-setup="<?php echo esc_attr( $video_setup ); ?>"
		>
		<source src="<?php echo esc_url( $src ); ?>" type="video/mp4" />
		<?php
		if ( $easydam_meta_data['videoConfig']['controlBar']['subsCapsButton'] ) {
			foreach ( $player_track_sources as $source ) { 
				?>
					<track kind="captions" src="<?php echo esc_url( $source['sourceURL'] ); ?>" srclang="<?php echo esc_attr( $source['srcLang'] ); ?>" label="<?php echo esc_attr( $source['label'] ); ?>" default />
					<?php
			}
		}
		?>
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
				<?php elseif ( isset( $layer['type'] ) && 'cta' === $layer['type'] ) : ?>
					<div id="layer-<?php echo esc_attr( $layer['id'] ); ?>" class="easydam-layer hidden">
						<?php if ( 'text' === $layer['cta_type'] ) : ?>
							<a 
								href="<?php echo esc_url( $layer['link'] ); ?>" 
								target="_blank" 
								rel="noopener noreferrer" 
								class="cta-button"
							>
								<?php echo esc_html( $layer['text'] ); ?>
							</a>
						<?php elseif ( 'html' === $layer['cta_type'] && ! empty( $layer['html'] ) ) : ?>
							<?php echo wp_kses_post( $layer['html'] ); ?>
						<?php endif; ?>
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
?>
<style>
	
</style>