<?php
/**
 * Render template for the GoDAM Audio Block.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$godam_attachment_id = ! empty( $attributes['id'] ) ? intval( $attributes['id'] ) : null;
$godam_src           = ! empty( $attributes['src'] ) ? esc_url( $attributes['src'] ) : '';
$godam_autoplay      = ! empty( $attributes['autoplay'] ) ? 'autoplay' : '';
$godam_loop          = ! empty( $attributes['loop'] ) ? 'loop' : '';
$godam_preload       = ! empty( $attributes['preload'] ) ? esc_attr( $attributes['preload'] ) : 'metadata';
$godam_audio_title   = ! empty( $attributes['audioTitle'] ) ? $attributes['audioTitle'] : '';
$godam_description   = ! empty( $attributes['description'] ) ? $attributes['description'] : '';
$godam_thumbnail     = ! empty( $attributes['thumbnail'] ) ? esc_url( $attributes['thumbnail'] ) : '';

// The transcript toggle defaults to on when the attribute is absent.
$godam_show_transcript = ! array_key_exists( 'showTranscript', $attributes ) || ! empty( $attributes['showTranscript'] );
$godam_show_chapters   = ! array_key_exists( 'showChapters', $attributes ) || ! empty( $attributes['showChapters'] );

// Chapters live on the attachment's rtgodam_meta; the transcript is a caption
// file URL stored in rtgodam_transcript_path (resolved by the helper).
$godam_meta_all       = $godam_attachment_id ? get_post_meta( $godam_attachment_id, 'rtgodam_meta', true ) : array();
$godam_chapters_raw   = ( is_array( $godam_meta_all ) && ! empty( $godam_meta_all['chapters'] ) ) ? $godam_meta_all['chapters'] : array();
$godam_transcript_url = $godam_attachment_id && function_exists( 'godam_get_transcript_path' ) ? godam_get_transcript_path( $godam_attachment_id ) : '';

// Normalise chapters for both server rendering and the front-end script.
$godam_chapters = array();
foreach ( $godam_chapters_raw as $godam_chapter ) {
	$godam_chapters[] = array(
		'start' => isset( $godam_chapter['startTime'] ) ? floatval( $godam_chapter['startTime'] ) : 0,
		'text'  => isset( $godam_chapter['text'] ) ? (string) $godam_chapter['text'] : '',
	);
}

// Each tab shows only when its own toggle is on and it has content; the panel
// appears when at least one tab is visible.
$godam_chapters_visible   = $godam_show_chapters && ! empty( $godam_chapters );
$godam_transcript_visible = $godam_show_transcript && ! empty( $godam_transcript_url );
$godam_has_panel          = $godam_chapters_visible || $godam_transcript_visible;

// Chapters is the first tab, so it is active when visible; the transcript is
// active only when chapters is hidden. Pre-build class / aria / hidden strings
// so the markup only echoes escaped values.
$godam_chapters_active      = $godam_chapters_visible;
$godam_transcript_active    = $godam_transcript_visible && ! $godam_chapters_visible;
$godam_chapters_tab_class   = 'godam-audio-tabs__tab' . ( $godam_chapters_active ? ' is-active' : '' );
$godam_transcript_tab_class = 'godam-audio-tabs__tab' . ( $godam_transcript_active ? ' is-active' : '' );
$godam_chapters_aria        = $godam_chapters_active ? 'true' : 'false';
$godam_transcript_aria      = $godam_transcript_active ? 'true' : 'false';
$godam_chapters_hidden      = $godam_chapters_active ? '' : 'hidden';
$godam_transcript_hidden    = $godam_transcript_active ? '' : 'hidden';

if ( ! $godam_attachment_id && empty( $godam_src ) ) {
	return;
}

if ( ! $godam_attachment_id && ! empty( $godam_src ) ) {
	// Virtual attachment scenario.
	$godam_primary_audio = $godam_src;
	$godam_backup_audio  = '';
} else {
	$godam_primary_audio = get_post_meta( $godam_attachment_id, 'rtgodam_transcoded_url', true );
	$godam_backup_audio  = wp_get_attachment_url( $godam_attachment_id );

	if ( empty( $godam_primary_audio ) && empty( $godam_backup_audio ) ) {
		return;
	}
}
?>

<figure data-test-id="godam-audio-render" <?php echo wp_kses_data( get_block_wrapper_attributes() ); ?>>
	<div class="godam-audio-card">
		<div class="godam-audio-card__head">

			<?php /* Thumbnail */ ?>
			<div class="godam-audio-card__cover" data-test-id="godam-audio-render-cover">
				<?php if ( $godam_thumbnail ) : ?>
					<img
						src="<?php echo esc_url( $godam_thumbnail ); ?>"
						alt="<?php echo esc_attr( $godam_audio_title ? $godam_audio_title : __( 'Audio thumbnail', 'godam' ) ); ?>"
					/>
				<?php endif; ?>
			</div>

			<?php /* Info + player */ ?>
			<div class="godam-audio-card__body">
				<p class="godam-audio-card__title" data-test-id="godam-audio-render-title"><?php echo esc_html( $godam_audio_title ? $godam_audio_title : __( 'Untitled audio', 'godam' ) ); ?></p>

				<?php if ( $godam_description ) : ?>
					<p class="godam-audio-card__description" data-test-id="godam-audio-render-description"><?php echo esc_html( $godam_description ); ?></p>
				<?php endif; ?>

			<audio
				class="godam-audio-card__player"
				data-test-id="godam-audio-render-player"
				controls
				<?php echo esc_attr( $godam_autoplay ); ?>
				<?php echo esc_attr( $godam_loop ); ?>
				preload="<?php echo esc_attr( $godam_preload ); ?>"
			>
				<?php if ( ! empty( $godam_primary_audio ) ) : ?>
					<source src="<?php echo esc_url( $godam_primary_audio ); ?>" type="audio/mpeg" />
				<?php endif; ?>

				<?php if ( ! empty( $godam_backup_audio ) ) : ?>
					<source src="<?php echo esc_url( $godam_backup_audio ); ?>" type="audio/mpeg" />
				<?php endif; ?>

				<?php esc_html_e( 'Your browser does not support the audio element.', 'godam' ); ?>
			</audio>
		</div>

	</div>

	<?php if ( $godam_has_panel ) : ?>
		<div
			class="godam-audio-tabs"
			data-test-id="godam-audio-render-tabs"
			data-godam-audio-panel
			data-godam-chapters="<?php echo esc_attr( wp_json_encode( $godam_chapters ) ); ?>"
			data-godam-transcript="<?php echo esc_url( $godam_transcript_url ); ?>"
		>
			<div class="godam-audio-tabs__bar">
				<div class="godam-audio-tabs__nav" role="tablist">
					<?php if ( $godam_chapters_visible ) : ?>
						<button type="button" class="<?php echo esc_attr( $godam_chapters_tab_class ); ?>" role="tab" aria-selected="<?php echo esc_attr( $godam_chapters_aria ); ?>" data-godam-tab="chapters">
							<?php esc_html_e( 'Chapters', 'godam' ); ?>
						</button>
					<?php endif; ?>
					<?php if ( $godam_transcript_visible ) : ?>
						<button type="button" class="<?php echo esc_attr( $godam_transcript_tab_class ); ?>" role="tab" aria-selected="<?php echo esc_attr( $godam_transcript_aria ); ?>" data-godam-tab="transcript">
							<?php esc_html_e( 'Transcript', 'godam' ); ?>
						</button>
					<?php endif; ?>
				</div>
				<button type="button" class="godam-audio-tabs__toggle" aria-expanded="true" aria-label="<?php esc_attr_e( 'Toggle panel', 'godam' ); ?>">
					<span class="dashicons dashicons-arrow-down-alt2"></span>
				</button>
			</div>

			<div class="godam-audio-tabs__body">
				<?php if ( $godam_chapters_visible ) : ?>
				<div class="godam-audio-tabs__panel" data-godam-panel="chapters" role="tabpanel" <?php echo esc_attr( $godam_chapters_hidden ); ?>>
					<?php if ( ! empty( $godam_chapters ) ) : ?>
						<ul class="godam-audio-tabs__list">
							<?php foreach ( $godam_chapters as $godam_chapter ) : ?>
								<?php
								$godam_cs    = (int) floatval( $godam_chapter['start'] );
								$godam_stamp = $godam_cs >= 3600
								? sprintf( '%d:%02d:%02d', floor( $godam_cs / 3600 ), floor( ( $godam_cs % 3600 ) / 60 ), $godam_cs % 60 )
								: sprintf( '%d:%02d', floor( $godam_cs / 60 ), $godam_cs % 60 );
								?>
							<li>
									<button type="button" class="godam-audio-tabs__row" data-godam-start="<?php echo esc_attr( $godam_chapter['start'] ); ?>">
										<span class="godam-audio-tabs__stamp"><?php echo esc_html( $godam_stamp ); ?></span>
										<span class="godam-audio-tabs__row-text"><?php echo esc_html( $godam_chapter['text'] ); ?></span>
									</button>
								</li>
							<?php endforeach; ?>
						</ul>
					<?php else : ?>
						<p class="godam-audio-tabs__empty"><?php esc_html_e( 'No chapters to show', 'godam' ); ?></p>
					<?php endif; ?>
				</div>
				<?php endif; ?>

				<?php if ( $godam_transcript_visible ) : ?>
				<div class="godam-audio-tabs__panel" data-godam-panel="transcript" role="tabpanel" <?php echo esc_attr( $godam_transcript_hidden ); ?>>
					<?php if ( ! empty( $godam_transcript_url ) ) : ?>
						<p class="godam-audio-tabs__empty" data-godam-transcript-loading><?php esc_html_e( 'Loading transcript…', 'godam' ); ?></p>
					<?php else : ?>
						<p class="godam-audio-tabs__empty"><?php esc_html_e( 'No transcript to show', 'godam' ); ?></p>
					<?php endif; ?>
				</div>
				<?php endif; ?>
			</div>
		</div>
	<?php endif; ?>
	</div>
</figure>
