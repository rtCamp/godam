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
$autoplay     = ! empty( $attributes['autoplay'] );
$controls     = isset( $attributes['controls'] ) ? $attributes['controls'] : true;
$loop         = ! empty( $attributes['loop'] );
$muted        = ! empty( $attributes['muted'] );
$poster       = ! empty( $attributes['poster'] ) ? esc_url( $attributes['poster'] ) : '';
$preload      = ! empty( $attributes['preload'] ) ? esc_attr( $attributes['preload'] ) : 'auto';
$plays_inline = ! empty( $attributes['playsInline'] );
$caption      = ! empty( $attributes['caption'] ) ? esc_html( $attributes['caption'] ) : '';
$src          = ! empty( $attributes['src'] ) ? esc_url( $attributes['src'] ) : '';
$sources      = ! empty( $attributes['sources'] ) ? $attributes['sources'] : array();
$tracks       = ! empty( $attributes['tracks'] ) ? $attributes['tracks'] : array();

// Build the video setup options for data-setup.
$video_setup = wp_json_encode(
	array(
		'controls' => $controls,
		'autoplay' => $autoplay,
		'loop'     => $loop,
		'muted'    => $muted,
		'preload'  => $preload,
		'poster'   => $poster,
		'fluid'    => true,
		'sources'  => $sources,
	)
);
?>

<?php if ( $src ) : ?>
<figure <?php echo wp_kses_data( get_block_wrapper_attributes() ); ?>>
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
</figure>
<?php endif; ?>